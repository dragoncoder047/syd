import { NodeGraph, NodeInput, NodeInputLocation, SpecialNodeKind, WellKnownInput } from "../graph";
import { Matrix, scalarMatrix } from "../matrix";
import { AutomatedValueMethod } from "../runtime/automation";
import { isArray, isNumber, isString } from "../utils";
import { AudioProcessorFactory, Dimensions, SCALAR_DIMS } from "./nodeDef";
import { CompiledGraph, Opcode, Program } from "./prog";

export interface CompileState {
    registers: string[];
    nodeNames: string[];
    nodeDefs: AudioProcessorFactory[];
    constantTab: Matrix[];
    mods: [name: string, initial: number, mode: AutomatedValueMethod][],
}

export enum ErrorReason {
    DIM_MISMATCH,
    UNBOUND,
    NOT_CONNECTED
}
interface MisMatchError {
    node: number
    index: number
    dim: 0 | 1;
    code: ErrorReason;
}

type VarMap = Record<number, Record<string, number>>;
type SmearMap = Record<number, Record<number, [number | null, number | null]>>;

export function compile(graph: NodeGraph, defs: AudioProcessorFactory[]): [CompiledGraph, MisMatchError[]] {
    const map = toImplMap(defs);
    const [outputUsed, seenTwice] = findDuplicates(graph);
    // step two: resolve matrix dimensions
    const [nodeToDimsMap, needsSmeared, errors] = resolveDimensions(graph, map);
    // step three: compile stack machine
    const program: Program = [];
    const seenInCompilation = new Set<number>();
    const flatNodes = graph.nodes
        .flatMap(([n], i) => isString(n) ? [i] : []);
    const nodeIndexToRegisterIndex: Record<number, number> =
        Object.fromEntries([...seenTwice]
            .map((nodeNo, regNo) => [nodeNo, regNo]));
    const constantTab: Matrix[] = [];
    const mods: CompiledGraph["mods"] = Object.entries(graph.mods).map(([name, { value, mode }]) => [name, value, mode]);
    const recurse = (nodeNo: number) => {
        if (seenInCompilation.has(nodeNo)) {
            program.push([Opcode.GET_REGISTER, nodeIndexToRegisterIndex[nodeNo]]);
            return;
        }
        seenInCompilation.add(nodeNo);
        const [nodeName, args] = graph.nodes[nodeNo]!;
        var myConstant: Matrix;
        if (isArray(nodeName) && nodeName[0] === SpecialNodeKind.BUILD_MATRIX) {
            const [_, rows, cols] = nodeName;
            myConstant = new Matrix(rows, cols);
            program.push([Opcode.PUSH_CONSTANT, constantTab.push(myConstant) - 1]);
        }
        for (var argNo = 0; argNo < args.length; argNo++) {
            var arg = args[argNo]!;
            var argIsConstant = false;
            var argConstantValue: number = 0;
            if (isNumber(arg)) {
                recurse(arg);
            } else {
                switch (arg[1]) {
                    case NodeInputLocation.FRAG_INPUT:
                        errors.push({
                            node: nodeNo,
                            index: argNo,
                            dim: 0,
                            code: ErrorReason.NOT_CONNECTED
                        });
                        argConstantValue = map[nodeName as any]?.inputs[argNo]?.default ?? 0;
                        argIsConstant = true;
                        break;
                    case NodeInputLocation.CONSTANT:
                        argConstantValue = arg[0] as number;
                        argIsConstant = true;
                        break;
                    case NodeInputLocation.WELL_KNOWN:
                        switch (arg[0] as WellKnownInput) {
                            case WellKnownInput.PASS_IN:
                                program.push([Opcode.PUSH_INPUT_SAMPLES]);
                                break;
                            case WellKnownInput.PITCH:
                                program.push([Opcode.PUSH_PITCH]);
                                break;
                            case WellKnownInput.GATE:
                                program.push([Opcode.PUSH_GATE]);
                                break;
                            case WellKnownInput.EXPRESSION:
                                program.push([Opcode.PUSH_EXPRESSION]);
                        }
                        break;
                    case NodeInputLocation.MOD:
                        program.push([Opcode.GET_MOD, mods.findIndex(([name]) => name === (arg as NodeInput & any[])[0])]);
                }
            }
            const smear = needsSmeared[nodeNo]?.[argNo];
            if (smear) {
                program.push([Opcode.SMEAR_MATRIX, smear[0]!, smear[1]!]);
            }
            if (isArray(nodeName) && nodeName[0] === SpecialNodeKind.BUILD_MATRIX) {
                const cols = nodeName[2];
                const curRow = (argNo / cols) | 0;
                const curCol = argNo - curRow * cols;
                if (argIsConstant) {
                    argIsConstant = false;
                    myConstant!.put(curRow, curCol, argConstantValue);
                } else {
                    program.push([Opcode.SET_MATRIX_EL, curRow, curCol]);
                }
            }
            if (argIsConstant) {
                program.push([Opcode.PUSH_CONSTANT, constantTab.push(scalarMatrix(argConstantValue)) - 1]);
            }

        }
        if (!isArray(nodeName)) {
            program.push([Opcode.CALL_NODE, flatNodes.indexOf(nodeNo), args.length]);
        } else {
            if (nodeName[0] === SpecialNodeKind.MARK_ALIVE) {
                program.push([Opcode.MARK_LIVE_STATE]);
            }
        }
        if (seenTwice.has(nodeNo)) {
            program.push([Opcode.TAP_REGISTER, nodeIndexToRegisterIndex[nodeNo]]);
        }
    }
    recurse(graph.out);
    for (var i = 0; i < graph.nodes.length; i++) {
        if (!outputUsed.has(i)) {
            recurse(i);
            program.push([Opcode.DROP_TOP]);
        }
    }
    const registers: Matrix[] = [];
    const nodes: CompiledGraph["nodes"] = [];
    for (var index of flatNodes) {
        const name = graph.nodes[index]![0] as string;
        const dimsMap = nodeToDimsMap[index] ?? {};
        nodes.push([name, dimsMap]);
        if (seenTwice.has(index)) {
            const [dRows, dCols] = map[name]!.outputDims;
            const rows = isNumber(dRows) ? dRows : dimsMap[dRows]!;
            const cols = isNumber(dCols) ? dCols : dimsMap[dCols]!;
            registers[nodeIndexToRegisterIndex[index]!] = new Matrix(rows, cols);
        }
    }
    return [{
        code: program,
        registers,
        constantTab,
        nodes,
        mods,
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

function resolveDimensions(graph: NodeGraph, map: Record<string, AudioProcessorFactory>): [VarMap, SmearMap, MisMatchError[]] {
    const numNodes = graph.nodes.length;
    const errors: MisMatchError[] = [];
    var nodeNo: number;
    type OutPort = [NodeInput, Dimensions];
    const exposed: [
        in_: OutPort[],
        out: Dimensions,
    ][] = [];
    for (nodeNo = 0; nodeNo < numNodes; nodeNo++) {
        const [nodeName, args] = graph.nodes[nodeNo]!;
        var inputs: OutPort[], output: Dimensions;
        if (!isArray(nodeName)) {
            output = map[nodeName]!.outputDims;
            inputs = map[nodeName]!.inputs.map(({ dims }, i) => [args[i]!, dims]);
        } else {
            switch (nodeName[0]) {
                case SpecialNodeKind.MARK_ALIVE:
                    inputs = [[args[0]!, output = SCALAR_DIMS]];
                    break;
                case SpecialNodeKind.BUILD_MATRIX:
                    inputs = args.map(a => [a, SCALAR_DIMS]);
                    output = [nodeName[1], nodeName[2]];
            }
        }
        exposed.push([inputs, output]);
    }
    // Build a set of everythings that must be equal
    type Var = [node: number | null, val: Dimensions[number]];
    const equalities: [outFrom: Var, inTo: Var, bInIndex: number, bDimRC: 0 | 1][] = [];
    for (nodeNo = 0; nodeNo < numNodes; nodeNo++) {
        const [in_] = exposed[nodeNo]!;
        for (var i = 0; i < in_.length; i++) {
            const [source, localVar] = in_[i]!;
            // external inputs/outputs are always 1x1
            var fromName: number | null, fromDims: Dimensions;
            if (isNumber(source)) {
                fromName = source;
                fromDims = exposed[source]![1];
            } else {
                fromName = null;
                fromDims = [1, 1];
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
    return [varNameMap, toBeSmeared, errors];
}

function toImplMap(defs: AudioProcessorFactory[]): Record<string, AudioProcessorFactory> {
    return Object.fromEntries(defs.map(n => [n.name, n]));
}
