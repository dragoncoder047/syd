import { GraphNode, NodeGraph, NodeInputLocation, WellKnownInput, NodeInput, SpecialNodeKind } from "../graph";
import { Matrix, scalarMatrix } from "../matrix";
import { AutomatedValueMethod } from "../runtime/automation";
import { AudioProcessorFactory, Dimensions, NodeInputDef, SCALAR_DIMS } from "./nodeDef";
import { CompiledGraph, Opcode, Program } from "./prog";

export interface CompileState {
    registers: string[];
    nodeNames: string[];
    nodeDefs: AudioProcessorFactory[];
    constantTab: Matrix[];
    mods: [name: string, initial: number, mode: AutomatedValueMethod][],
}

interface CompileError {
    node: number
    inputIndex: number
    message: string
}

export function compile(graph: NodeGraph, defs: AudioProcessorFactory[]): [CompiledGraph, CompileError[]] {
    const map = toImplMap(defs);
    const [outputUsed, seenTwice] = findDuplicates(graph);
    // step two: resolve matrix dimensions
    const [nodeToDimsMap, errors] = resolveDimensions(graph, map);
    // step three: compile stack machine
    const program: Program = [];
    const seenInCompilation = new Set<number>();
    const flatNodes = graph.nodes
        .flatMap(([n], i) => typeof n === "string" ? [i] : []);
    const nodeIndexToRegisterIndex: Record<number, number> =
        Object.fromEntries([...seenTwice]
            .map((nodeNo, regNo) => [nodeNo, regNo]));
    const constantTab: Matrix[] = [];
    const mods: CompiledGraph["mods"] = graph.mods.map(({ name, value, mode }) => [name, value, mode]);
    const recurse = (nodeNo: number) => {
        if (seenInCompilation.has(nodeNo)) {
            program.push([Opcode.GET_REGISTER, nodeIndexToRegisterIndex[nodeNo]]);
            return;
        }
        seenInCompilation.add(nodeNo);
        const [nodeName, args] = graph.nodes[nodeNo]!;
        for (var arg of args) {
            if (typeof arg === "number") {
                recurse(arg);
            } else {
                switch (arg[1]) {
                    case NodeInputLocation.CONSTANT:
                        program.push([Opcode.PUSH_CONSTANT, constantTab.push(scalarMatrix(arg[0] as number)) - 1]);
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
        }
        if (typeof nodeName === "string") {
            program.push([Opcode.CALL_NODE, nodeIndexToRegisterIndex[nodeNo]]);
        } else {
            throw 'todo';
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
        const dimsMap = nodeToDimsMap[index]!
        nodes.push([name, dimsMap]);
        if (seenTwice.has(index)) {
            const [dRows, dCols] = map[name]!.outputDims;
            const rows = typeof dRows === "number" ? dRows : dimsMap[dRows]!;
            const cols = typeof dCols === "number" ? dCols : dimsMap[dCols]!;
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
            if (typeof usedNode === "number") {
                if (seenOnce.has(usedNode)) {
                    duplicated.add(usedNode);
                }
                seenOnce.add(usedNode);
            }
        }
    }
    return [seenOnce, duplicated];
}

function resolveDimensions(graph: NodeGraph, map: Record<string, AudioProcessorFactory>): [Record<number, Record<string, number>>, CompileError[]] {
    const bindings: [result: Dimensions, [sourceNode: number | null, expected: Dimensions][], varnames: string[]][] = [], numNodes = graph.nodes.length;
    var nodeNo: number;
    for (nodeNo = 0; nodeNo < numNodes; nodeNo++) {
        const [nodeName, args] = graph.nodes[nodeNo]!;
        var outputDims: Dimensions, inputs: NodeInputDef[];
        if (typeof nodeName === "string") {
            ({ outputDims, inputs } = map[nodeName]!);
        } else {
            switch (nodeName[0]) {
                case SpecialNodeKind.MARK_ALIVE:
                    outputDims = ["M", "N"];
                    inputs = [{ name: "x", dims: ["M", "N"], default: 1 }];
                    break;
                case SpecialNodeKind.BUILD_MATRIX:
                    var cols: number;
                    outputDims = [nodeName[1], cols = nodeName[2]];
                    inputs = args.map((_, i) => ({ name: `${Math.floor(i / cols)},${i % cols}`, dims: SCALAR_DIMS, default: 1 }));
            }
        }
        const dim: (typeof bindings)[number][1] = inputs.map(({ dims }, i) => [typeof args[i] === "number" ? args[i] : null, dims]);
        bindings.push([
            outputDims,
            dim,
            [...outputDims, ...dim.flatMap(d => d[1])].filter(x => typeof x === "string"),
        ]);
    }
    const errors: CompileError[] = [];
    // Build a set of everythings that must be equal
    // And mapping of string name to node+var name
    // This would be so much easier if this were python and I could use a tuple as a key
    const gToNode = "help me pls";
    for (nodeNo = 0; nodeNo < numNodes; nodeNo++) {
        const [out, inputs, varnames] = bindings[nodeNo]!;
        for (var varname of varnames) {

        }
    }
    // this algorithm wants to make me cry
}

function toImplMap(defs: AudioProcessorFactory[]): Record<string, AudioProcessorFactory> {
    return Object.fromEntries(defs.map(n => [n.name, n]));
}
