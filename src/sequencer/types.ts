import { Instrument, NodeGraph } from "../graph/types";
import { ChannelMode } from "../runtime/channels";

export interface Song {
    meta: Metadata;
    /** string if modulated, number if constant */
    tempo: string | number;
    tuning?: SongTuning;
    instruments: Record<string, Instrument>;
    timeline: TimelineEntry[];
    patterns: Pattern[];
    noteShapes: NoteShape[];
    postFX: NodeGraph;
    channels: Record<string, {
        mode: ChannelMode,
        rows: number,
        cols: number,
        data: Float32Array
    }>;
}

// MARK: SONG DATA

export interface Metadata {
    title: string;
    author?: string;
    authorURL?: string;
    comment?: string;
    license?: string;
    rendering?: RenderingPreferences;
}

export interface SongTuning {
    rootN?: [noteNo: number, Hz: number]; // defaults to [69, 440] (standard A4)
    edo?: number; // defaults to 12 obviously. If it is not 12 then it is the number of notes per octave
    octRatio?: number; // defaults to 2 obviously
}

export interface RenderingPreferences {
    // like AbyssBox stuff
    theme?: string;
    layout?: string;
    channelColors?: string[];
}

export type TimelineEntry = [delta: number, startPatterns: number[]];

/**
 * * a ref can be told apart from a note by the type of the element at index 1 (2-tuple = note, number = ref)
 */
export type Pattern = [
    instruments: string | string[],
    notes: Note[]
];

export type Note = [
    dt: number,
    pitch: number,
    shape: NoteShape,
];

export type NoteShape = NotePin[];

export type NotePin = [
    delta: number, // beats
    pitchDelta?: number | null,
    expression?: number,
];

/*

playback algorithm (pseudopython)

for slice in timeline:
    wait(slice.delta)
    for patternNo in slice.startPatterns:
        startPattern(patterns[patternNo])

*/
