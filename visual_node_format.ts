interface Song {
    meta: Metadata;
    instruments: Instrument[];
    sectionSeq: number[];
    sections: number[][];
    bars: Bar[];
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

// a ref can be told apart from a note by the type of the elements at index 1 or 2
type Bar = [instruments: number | number[], ...notes: (Note | NoteRef)[]];

type Note = [
    deltaTime: number,
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

for s in sectionSequence:
    for barColumn in sections[s]:
        for barNo in barColumn:
            startBar(bars[barNo])
        wait(metadata.barLength)

*/

// MARK: INSTRUMENT

