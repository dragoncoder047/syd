import { GraphNode, NodeGraph, NodeInput } from "../graph/types";
import { Matrix, scalarMatrix } from "../math/matrix";
import { Opcode, Program } from "../runtime/program";
import { isArray, isNumber, isString } from "../utils";
import { AudioProcessorFactory, CompilerCtx, Dimensions, NodeArgs, SCALAR_DIMS } from "./nodeDef";

export interface CompiledGraph {
    code: Program;
    registers: Matrix[];
    constantTab: Matrix[];
    nodes: [type: string, dimVars: Record<string, number>][];
}

export enum ErrorReason {
    DIM_MISMATCH,
    UNBOUND,
    UNUSED_FRAG_INPUT,
    WRONG_NO_OF_ARGS,
}
interface MisMatchError {
    node: number
    index: number
    dim: 0 | 1;
    code: ErrorReason;
}

type ImplMap = Record<string, AudioProcessorFactory>;
type NodeInfoTab = [name: string, eager: boolean, args: NodeArgs][];
type VarMap = Record<number, Record<string, number>>;
type SmearMap = Record<number, Record<number, [number | null, number | null]>>;

export function compile(graph: NodeGraph, defs: AudioProcessorFactory[]): [CompiledGraph, MisMatchError[]] {
    const map = toImplMap(defs);
    const [outputUsed, seenTwice] = findDuplicates(graph);
    const nodeInfoTab = infoTab(map, graph.nodes);
    const outDimsList = getOutDimsList(map, nodeInfoTab);
    // step two: resolve matrix dimensions
    const [nodeToDimsMap, needsSmeared, defaultsTab, errors] = resolveDimensions(graph.nodes, map, outDimsList, nodeInfoTab);
    // step three: compile stack machine
    const program: Program = [];
    const seenInCompilation = new Set<number>();
    const nodeIndexToRegisterIndex: Record<number, number> =
        Object.fromEntries([...seenTwice]
            .map((nodeNo, regNo) => [nodeNo, regNo]));
    const constantTab: Matrix[] = [];
    const compile = (nodeNo: NodeInput, argNo: number, parentNode: number, default_: number) => {
        if (isString(nodeNo) || isArray(nodeNo)) {
            if (isString(nodeNo)) errors.push({
                node: parentNode,
                index: argNo,
                dim: 0,
                code: ErrorReason.UNUSED_FRAG_INPUT
            });
            const smear = needsSmeared[parentNode]?.[argNo];
            const mat = scalarMatrix(default_);
            if (smear) {
                mat.smear(smear[0]!, smear[1]!);
            }
            context.pushConstant(mat, false);
            return;
        }
        const [nodeName, eager, params] = nodeInfoTab[nodeNo]!;
        const args = graph.nodes[nodeNo]![1];
        if (!eager && seenInCompilation.has(nodeNo)) {
            program.push([Opcode.GET_REGISTER, nodeIndexToRegisterIndex[nodeNo]]);
            return;
        }
        seenInCompilation.add(nodeNo);
        const defaults = defaultsTab[nodeNo]!;
        map[nodeName]!.compile(nodeNo, params, args, defaults, program, context);
        const smear = needsSmeared[parentNode]?.[argNo];
        if (smear) {
            program.push([Opcode.SMEAR_MATRIX, smear[0]!, smear[1]!]);
        }
        if (seenTwice.has(nodeNo)) {
            program.push([Opcode.TAP_REGISTER, nodeIndexToRegisterIndex[nodeNo]]);
        }
    }
    const context: CompilerCtx = {
        compile,
        value(index) {
            if (isString(index)) return scalarMatrix(0);
            if (isArray(index)) return scalarMatrix(index[0]);
            const [name, _, args] = nodeInfoTab[index]!;
            return map[name]!.value(args, context);
        },
        pushConstant(value, forceNew) {
            const existIndex = forceNew ? -1 : constantTab.findIndex(v => v.equals(value));
            program.push([Opcode.PUSH_CONSTANT, existIndex >= 0 ? existIndex : (constantTab.push(value) - 1)]);
        },
    };
    compile(graph.out, 0, -1, 0);
    for (var i = 0; i < graph.nodes.length; i++) {
        if (!outputUsed.has(i)) {
            compile(i, 0, -1, 0);
            program.push([Opcode.DROP_TOP]);
        }
    }
    // Renumber CALL_NODE used nodes them to be consecutive
    const usedNodes: (number | undefined)[] = new Array(nodeInfoTab.length).fill(0).map((_, i) => i);
    for (var i = 0; i < nodeInfoTab.length; i++) {
        const curNodeNo = usedNodes[i]!;
        if (!program.some(([op, arg1]) => op === Opcode.CALL_NODE && arg1 === curNodeNo)) {
            usedNodes[i] = undefined;
        }
    }
    const runtimeNodeIndexes = usedNodes.filter(x => x !== undefined);
    program.forEach(command => {
        if (command[0] === Opcode.CALL_NODE) {
            command[1] = runtimeNodeIndexes.indexOf(command[1] as number);
        }
    });
    const registers: Matrix[] = [];
    const nodes: CompiledGraph["nodes"] = [];
    for (var i = 0; i < nodeInfoTab.length; i++) {
        if (!usedNodes.includes(i)) continue;
        const [name] = nodeInfoTab[i]!;
        const dimsMap = nodeToDimsMap[i] ?? {};
        nodes.push([name, dimsMap]);
        if (seenTwice.has(i)) {
            const [dRows, dCols] = outDimsList[i]!;
            const rows = isNumber(dRows) ? dRows : dimsMap[dRows]!;
            const cols = isNumber(dCols) ? dCols : dimsMap[dCols]!;
            registers[nodeIndexToRegisterIndex[i]!] = new Matrix(rows, cols);
        }
    }
    return [{
        code: program,
        registers,
        constantTab,
        nodes,
    }, errors]
}

function findDuplicates(graph: NodeGraph): [once: Set<number>, twice: Set<number>] {
    // determine which nodes are referenced multiple times
    // to be able to allocate registers
    const duplicated = new Set<number>();
    const seenOnce = new Set<number>();
    seenOnce.add(graph.out);
    for (var i = 0; i < graph.nodes.length; i++) {
        const [_, inputs] = graph.nodes[i]!;
        for (var usedNode of inputs) {
            if (isNumber(usedNode)) {
                if (seenOnce.has(usedNode)) {
                    duplicated.add(usedNode);
                }
                seenOnce.add(usedNode);
            }
        }
    }
    return [seenOnce, duplicated];
}

function resolveDimensions(graph: GraphNode[], map: ImplMap, outDimsList: Dimensions[], argLists: NodeInfoTab): [VarMap, SmearMap, number[][], MisMatchError[]] {
    const numNodes = graph.length;
    const errors: MisMatchError[] = [];
    var nodeNo: number;
    type OutPort = [NodeInput, Dimensions, number];
    const exposed: [
        in_: OutPort[],
        out: Dimensions,
    ][] = [];
    const defaultsLists: number[][] = [];
    for (nodeNo = 0; nodeNo < numNodes; nodeNo++) {
        const args = graph[nodeNo]![1];
        const [name, _, params] = argLists[nodeNo]!;
        const inputs: OutPort[] = map[name]!.getInputs(params).map(({ dims, default: d }, i) => [args[i]!, dims, d]);
        const output = outDimsList[nodeNo]!;
        if (args.length !== inputs.length) {
            errors.push({
                node: nodeNo,
                index: 0,
                dim: 0,
                code: ErrorReason.WRONG_NO_OF_ARGS,
            });
            if (args.length > inputs.length) args.length = inputs.length;
            else while (args.length < inputs.length) {
                args.push([0]);
            }
        }
        exposed.push([inputs, output]);
        defaultsLists.push(inputs.map(d => d[2]));
    }
    // Build a set of everythings that must be equal
    type Var = [node: number | null, val: Dimensions[number]];
    const equalities: [outFrom: Var, inTo: Var, bInIndex: number, bDimRC: 0 | 1][] = [];
    for (nodeNo = 0; nodeNo < numNodes; nodeNo++) {
        const [in_] = exposed[nodeNo]!;
        for (var i = 0; i < in_.length; i++) {
            const [source, localVar] = in_[i]!;
            var fromName: number | null, fromDims: Dimensions;
            if (isNumber(source)) {
                fromName = source;
                fromDims = exposed[source]![1];
            } else {
                fromName = null;
                fromDims = SCALAR_DIMS;
            }
            equalities.push(
                [[fromName, fromDims[0]], [nodeNo, localVar[0]], i, 0],
                [[fromName, fromDims[1]], [nodeNo, localVar[1]], i, 1]
            );

        }
    }
    // Resolve equalities
    var changing = true;
    const varNameMap: VarMap = {};
    const toBeSmeared: SmearMap = {};
    const setVar = (node: number, varName: string, value: number) => {
        (varNameMap[node] ??= {})[varName] = value;
    }
    const propagate = (node: number, varName: string, value: number) => {
        changing = true;
        setVar(node, varName, value);
        for (var i = 0; i < equalities.length; i++) {
            const eq = equalities[i]!;
            const [[node1, var1], [node2, var2]] = eq;
            if (node1 === node && var1 === varName) {
                eq[0][1] = value;
            }
            if (node2 === node && var2 === varName) {
                eq[1][1] = value;
            }
        }
    }
    while (changing) {
        changing = false;
        for (i = 0; i < equalities.length; i++) {
            const [[node1, var1], [node2, var2], port2, rc2] = equalities[i]!;
            if (isNumber(var1) && isNumber(var2)) {
                if (var1 !== var2) {
                    if (var1 > 1) {
                        errors.push({ node: node2!, index: port2, dim: rc2, code: ErrorReason.DIM_MISMATCH });
                    } else {
                        ((toBeSmeared[node2!] ??= {})[port2] ??= [null, null])[rc2] = var2;
                    }
                }
                equalities.splice(i, 1);
                i--;
            } else if (isString(var1) && isNumber(var2)) {
                propagate(node1!, var1, var2);
            } else if (isNumber(var1) && isString(var2)) {
                propagate(node2!, var2, var1);
            }
        }
    }
    if (equalities.length > 0) {
        // there are unbound variables
        for (var [_, [n2, v2], p2, rc2] of equalities) {
            setVar(n2!, v2 as string, 1);
            errors.push({ node: n2!, index: p2, dim: rc2, code: ErrorReason.UNBOUND });
        }
    }
    return [varNameMap, toBeSmeared, defaultsLists, errors];
}

function toImplMap(defs: AudioProcessorFactory[]): ImplMap {
    return Object.fromEntries(defs.map(n => [n.name, n]));
}

function infoTab(defs: ImplMap, graph: GraphNode[]): NodeInfoTab {
    const out: NodeInfoTab = [];
    for (var [nodeName] of graph) {
        if (isArray(nodeName)) {
            const name = nodeName[0]
            out.push([name, defs[name]!.eager, nodeName.slice(1) as NodeArgs]);
        } else {
            out.push([nodeName, defs[nodeName]!.eager, []]);
        }
    }
    return out;
}

function getOutDimsList(defs: ImplMap, headers: NodeInfoTab): Dimensions[] {
    const out = [];
    for (var [name, _, args] of headers) {
        out.push(defs[name]!.getOutputDims(args));
    }
    return out;
}
