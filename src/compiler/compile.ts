import { GraphNode, NodeGraph, NodeInputLocation } from "../graph";
import { Matrix } from "../matrix";
import { AutomatedValueMethod } from "../runtime/automation";
import { AudioProcessorFactory } from "./nodeDef";
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
    message: string
}

export function compile(graph: NodeGraph, nodes: AudioProcessorFactory[]): [CompiledGraph, CompileError[]] {
    const map = toImplMap(nodes);
    const [outputUsed, seenTwice] = findDuplicates(graph);
    // step two: resolve matrix dimensions
    const [nodeToDimsMap, errors] = resolveDimensions(graph, map);
    // step three: compile stack machine
    const program: Program = [];
    const seenInCompilation = new Set<number>();
    const recurse = (nodeNo: number) => {
        if (seenInCompilation.has(nodeNo)) {
            program.push([Opcode.GET_REGISTER, nodeNo]);
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
                    case NodeInputLocation.WELL_KNOWN:
                    case NodeInputLocation.MOD:
                        throw 'todo';
                }
            }
        }
        if (typeof nodeName === "string") {
            program.push([Opcode.CALL_NODE, nodeNo]);
        } else {
            throw 'todo';
        }
        if (seenTwice.has(nodeNo)) {
            program.push([Opcode.TAP_REGISTER, nodeNo]);
        }
    }
    recurse(graph.out);
    for (var i = 0; i < graph.nodes.length; i++) {
        if (!outputUsed.has(i)) {
            recurse(i);
            program.push([Opcode.DROP_TOP]);
        }
    }
    return [{
        code: program,
        registers: [...seenTwice].map(nodeNo => {
            const dims = nodes[graph.nodes[nodeNo]![0]]
        }),
        constantTab: undefined,
        nodes: undefined,
        mods: undefined,
    }, errors]
}

function findDuplicates(graph: NodeGraph): [once: Set<number>, twice: Set<number>] {
    // step one: determine which nodes are referenced multiple times
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
    const equalities: Record<string, string> = {};
    const known: Record<string, number> = {};
    const errors: CompileError[] = [];
    const globalVarToNodeMap: Record<string, [node: number, input: number]> = {};
    // Create the global var map and all equalities
    for (var nodeNo = 0; nodeNo < graph.nodes.length; nodeNo++) {
        const [nodeName, inputs] = graph.nodes[nodeNo]!;
        // TODO
    }
    // Resolve equalities and report errors
}

function toImplMap(defs: AudioProcessorFactory[]): Record<string, AudioProcessorFactory> {
    return Object.fromEntries(defs.map(n => [n.name, n]));
}

function isArray(x: any) {
    return Array.isArray(x);
}