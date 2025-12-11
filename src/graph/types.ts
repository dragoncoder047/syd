export interface Instrument {
    voice: NodeGraph;
    fx: NodeGraph;
}

export interface NodeGraph {
    nodes: GraphNode[];
    out: number;
}

export type GraphNode = [
    kind: string | SpecialNode,
    inputs: NodeInput[],
];
export type SpecialNode = [name: string, ...args: (number | string)[]];

export type NodeInput =
    | number // referenced node
    | string // frag input
    | [number] // constant
    ;

