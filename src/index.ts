export { compile, ErrorReason } from "./compiler/compile";
export type { AudioProcessor, AudioProcessorFactory, Dimensions, NodeInputDef, Range } from "./compiler/nodeDef";
export { NodeInputLocation, SpecialNodeKind, WellKnownInput, type GraphNode, type ModInstrument, type NodeGraph, type NodeGraphInput, type NodeInput, type PitchedInstrument, type SpecialNode } from "./graph";
export { unifyFragments as unifyGraphFragments, type NodeFragmentEdge } from "./graph/fragment";
export { NODES } from "./lib";
export { newSynth } from "./runtime/synthProxy";

export function initWorklet(context: AudioContext, pathToWorkletScript?: URL | string): Promise<void> {
    if (pathToWorkletScript === undefined) {
        pathToWorkletScript = new URL("./sydWorklet.js", import.meta.url);
    }
    return context.audioWorklet.addModule(pathToWorkletScript);
}
