import { AutomatedValueMethod } from "../runtime/automation";

export interface Instrument {
    voice: NodeGraph;
    fx: NodeGraph;
}

export interface NodeGraph {
    nodes: GraphNode[];
    out: number;
    mods: NodeGraphInput[];
}

export type GraphNode = [
    kind: string | SpecialNode,
    inputs: NodeInput[],
];

export type SpecialNode = [
    specialKind: SpecialNodeKind,
    data1: any,
    data2?: any
];

export enum SpecialNodeKind {
    // Passes through
    MARK_ALIVE,
    BUILD_MATRIX,
}

export interface NodeGraphInput {
    name: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    mode: AutomatedValueMethod;
}

export type NodeInput = number | [
    indexOrValue: number | string,
    from: NodeInputLocation,
];

export enum NodeInputLocation {
    CONSTANT,
    WELL_KNOWN,
    MOD
}

export enum WellKnownInput {
    PASS_IN,
    PITCH,
    GATE,
    EXPRESSION
}
