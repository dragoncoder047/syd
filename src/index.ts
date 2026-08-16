export {
    compile,
    ErrorReason
} from "./compiler/compile";
export {
    AudioProcessorFactory,
    SCALAR_DIMS,
    type AudioProcessor,
    type Dimensions,
    type NodeInputDef
} from "./compiler/nodeDef";
export {
    getFragmentInputs,
    unifyGraphFragments
} from "./graph/fragment";
export {
    type GraphNode,
    type Instrument,
    type NodeGraph,
    type NodeInput,
    type SpecialNode
} from "./graph/types";
export { NODES } from "./lib";
export { newSynth } from "./runtime/synthProxy";
export {
    Sequencer
} from "./sequencer";
export type {
    NodeFragmentEdge,
    NoteData,
    NotePin,
    NoteShape,
    RenderingPreferences,
    SectionData,
    Song,
    SongMetadata,
    Tuning
} from "./songFormat";

