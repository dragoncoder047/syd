export interface Instrument {
    isMod: false;
    voice: NodeGraph;
    fx: NodeGraph;
}

export interface NodeGraph {
    nodes: GraphNode[];
    out: number;
}

export type GraphNode = [
    kind: string | number | SpecialNode,
    inputs: NodeInput[],
];

export type SpecialNode =
    | [SpecialNodeKind.USE_WAVETABLE, name: string]
    | [SpecialNodeKind.MARK_ALIVE]
    | [SpecialNodeKind.BUILD_MATRIX, rows: number, cols: number]
    | [SpecialNodeKind.SAVE_TO_CHANNEL, channel: string];

export enum SpecialNodeKind {
    // Passes through
    MARK_ALIVE,
    BUILD_MATRIX,
    SAVE_TO_CHANNEL,
    USE_WAVETABLE,
}

export type NodeInput =
    | number
    | [NodeInputLocation.CONSTANT, number]
    | [NodeInputLocation.CHANNEL, string]
    | [NodeInputLocation.FRAG_INPUT, string]
    | [
        | NodeInputLocation.PITCH_VAL
        | NodeInputLocation.GATE_VAL
        | NodeInputLocation.EXPRESSION_VAL]

export enum NodeInputLocation {
    CONSTANT,
    CHANNEL,
    FRAG_INPUT,
    PITCH_VAL,
    GATE_VAL,
    EXPRESSION_VAL
}
