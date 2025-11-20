export { compile, ErrorReason } from "./compiler/compile";
export type { AudioProcessor, AudioProcessorFactory, Dimensions, NodeInputDef, Range } from "./compiler/nodeDef";
export { NodeInputLocation, SpecialNodeKind, WellKnownInput, type GraphNode, type Instrument, type ModInstrument, type NodeGraph, type NodeGraphInput, type NodeInput, type PitchedInstrument, type SpecialNode } from "./graph";
export { unifyGraphFragments, type NodeFragmentEdge } from "./graph/fragment";
export { NODES } from "./lib";
export { newSynth } from "./runtime/synthProxy";

