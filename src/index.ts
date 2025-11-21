export { compile, ErrorReason } from "./compiler/compile";
export type { AudioProcessor, AudioProcessorFactory, Dimensions, NodeInputDef } from "./compiler/nodeDef";
export { NodeInputLocation, SpecialNodeKind, type GraphNode, type Instrument, type ModInstrument, type NodeGraph, type NodeGraphInput, type NodeInput, type PitchedInstrument, type SpecialNode } from "./graph";
export { getFragmentInputs, unifyGraphFragments, type NodeFragmentEdge } from "./graph/fragment";
export { NODES } from "./lib";
export { newSynth } from "./runtime/synthProxy";

