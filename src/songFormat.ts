import { FragmentGraph } from "./graph/builder";

export type EventSequence<T> = {
    delta: number,
    events: T[]
}[];

interface Named<T extends string> { name: T }

type PatternName = string;
type InstrumentName = string;
type ChannelName = string;

export interface Song {
    metadata: SongMetadata;
    instruments: InstrumentData[];
    channels: ChannelData[];
    conductor: ChannelName;
    defaults?: {
        tuning?: Tuning;
        beatDiv?: [divisionsPerNote: number, beatsPerBar: number]; // Default: [4, 4], i.e. common time, 16th notes
    },
    timeline: EventSequence<PatternName>;
    patterns: PatternData[];
    noteShapes: NoteShape[];
    postprocess: FragmentGraph;
}

export interface SongMetadata {
    title: string;
    author?: string;
    authorURL?: string;
    comment?: string;
    license?: string;
    rendering: RenderingPreferences;
}

export interface RenderingPreferences {
    baseTheme?: string;
    instrumentColors?: Record<InstrumentName, string>;
    patternColors?: Record<PatternName, string>;
    playerLayout?: string;
}

export interface Tuning {
    root?: { offset: number, frequency: number }, // default: { midi: 69, freq: 440 }
    edo?: number, // default: 12
    octaveRatio?: number // default: 2
}

export interface InstrumentData extends Named<InstrumentName> {
    def: FragmentGraph;
    // TODO: more stuff here
}

export interface ChannelData extends Named<ChannelName> {
    size: [rows: number, cols: number]
}

export interface PatternData extends Named<PatternName> {
    instruments: InstrumentName[];
    tuning?: Tuning;
    data: EventSequence<NoteData>;
    edit?: PatternEditSettings;
}

export interface PatternEditSettings {
    beatDiv?: [divisionsPerNote: number, beatsPerBar: number];
}

export interface NoteData {
    pitch: number;
    instruments?: InstrumentName[]; // If present, overrides pattern instruments
    shape: number; // Index into global note shape table
}

export type NoteShape = EventSequence<NotePin>;

export interface NotePin {
    pitchBend: number; // Delta from initial pitch
    expression: number; // Absolute 0-1
};
