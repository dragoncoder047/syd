import { AutomatedValueMethod } from "../runtime/automation";

export type Instrument = PitchedInstrument | ModInstrument;

export interface PitchedInstrument {
    isMod: false;
    voice: NodeGraph;
    fx: NodeGraph;
}

export interface ModInstrument {
    isMod: true;
    name: string;
    value: number,
    mode: AutomatedValueMethod
    min: number;
    max: number;
    step?: number;
}

export interface NodeGraph {
    nodes: GraphNode[];
    out: number;
}

export type GraphNode = [
    kind: string | number | SpecialNode,
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

export type NodeInput =
    | number
    | [NodeInputLocation.CONSTANT, number]
    | [NodeInputLocation.MOD, string]
    | [NodeInputLocation.FRAG_INPUT, string]
    | [
        | NodeInputLocation.SAMPLE_INPUT
        | NodeInputLocation.PITCH_VAL
        | NodeInputLocation.GATE_VAL
        | NodeInputLocation.EXPRESSION_VAL]

export enum NodeInputLocation {
    CONSTANT,
    MOD,
    FRAG_INPUT,
    SAMPLE_INPUT,
    PITCH_VAL,
    GATE_VAL,
    EXPRESSION_VAL
}
