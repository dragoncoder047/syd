import { Instrument, NodeGraph } from "../graph/types";

// TODO: make this use more records instead of arrays where possible

export interface Song {
    meta: Metadata;
    /** string if modulated, number if constant */
    tempo: string | number;
    tuning?: SongTuning;
    instruments: Record<InstrumentName, Instrument>;
    timeline: EventSequence<number>;
    patterns: Pattern[];
    noteShapes: NoteShape[];
    postFX: NodeGraph;
    channels: Record<string, {
        sticky: boolean,
        rows: number,
        cols: number,
        data: number[]
    }>;
}

export type EventSequence<T> = [dt: number, eventsData: T[]][];

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

export type Pattern = [
    instruments: InstrumentName | InstrumentName[],
    notes: EventSequence<Note>
];

export type Note = [
    pitch: number,
    shape: number, // index into global note shape table
    instruments?: number[], // if not specified, all of them
];

export type InstrumentName = number | string;

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
