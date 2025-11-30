export {
    compile,
    ErrorReason
} from "./compiler/compile";
export type {
    AudioProcessor,
    AudioProcessorFactory,
    Dimensions,
    NodeInputDef
} from "./compiler/nodeDef";
export {
    getFragmentInputs,
    unifyGraphFragments,
    type NodeFragmentEdge
} from "./graph/fragment";
export {
    NodeInputLocation,
    SpecialNodeKind,
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
    Metadata,
    Note,
    NotePin,
    NoteShape,
    Pattern,
    RenderingPreferences,
    Song,
    SongTuning,
    TimelineEntry
} from "./sequencer/types";

