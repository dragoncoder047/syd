interface Song {
    meta: Metadata;
    instruments: Instrument[];
    mods: Record<string, Mod>;
    timeline: TimelineEntry[];
    patterns: Pattern[];
    postFX: NodeGraph;
}

// MARK: SONG DATA

interface Metadata {
    title: string;
    author?: string;
    authorURL?: string;
    comment?: string;
    license?: string;
    instrumentNames?: string[];
    tuning?: SongTuning;
    rendering?: RenderingPreferences;
    tempo?: string | number; // string if modulated, number if constant
}

interface SongTuning {
    rootN?: [noteNo: number, Hz: number]; // defaults to [69, 440] (standard A4)
    edo?: number; // defaults to 12 obviously. If it is not 12 then it is the number of notes per octave
    octRatio?: number; // defaults to 2 obviously
}

interface RenderingPreferences {
    // like AbyssBox stuff
    theme?: string;
    layout?: string;
}

type TimelineEntry = [delta: number, startPatterns: number[]];

/**
 * * a ref can be told apart from a note by the type of the element at index 1 (2-tuple = note, number = ref)
 * * a mod channel is a string name
 */
type Pattern = [instruments: number | number[] | string, notes: (Note | NoteRef)[]];

interface Mod {
    value: number,
    mode: AutomatedValueMethod
}

type Note = [
    delta: number,
    start: NotePin,
    pins: [
        offset: number, // beats
        data: NotePin,
    ][],
];

type NoteRef = [
    barRef: number,
    noteIndex: number,
    transposedPitch: number
];

type NotePin = [
    pitch: number | undefined | null,
    expression: number | undefined | null,
];

/*

playback algorithm (pseudopython)

for slice in timeline:
    wait(slice.delta)
    for patternNo in slice.startPatterns:
        startPattern(patterns[patternNo])

*/
