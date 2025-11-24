import { CompiledGraph } from "../compiler/compile";
import { Matrix } from "../matrix";
import { Channels } from "./channels";
import { WorkletSynth } from "./synthImpl";
import { Tone } from "./tone";

export class Instrument {
    ln: Tone[] = [];
    lni: number[] = [];
    dn: [Tone, number][] = [];
    x = new Matrix(2, 1);
    constructor(
        public dt: number,
        public p: WorkletSynth,
        public v: CompiledGraph,
    ) {
    }
    noteOn(id: number, pitch: number, expression: number) {
        this.noteOff(id);
        this.ln.push(new Tone(this.v, this.dt, this.p, pitch, expression));
        this.lni.push(id);
    }
    noteOff(id: number) {
        if (this.lni.includes(id)) {
            const index = this.lni.indexOf(id);
            const note = this.ln[index]!;
            this.dn.push([note, gainForChord(this.ln.length)]);
            this.ln[index] = this.ln.pop()!;
            this.lni[index] = this.lni.pop()!;
        }
    }
    pitchBend(id: number, pitch: number, time: number) {
        this.ln[id]?.pitch.goto(pitch, this.dt, time);
    }
    expressionBend(id: number, expression: number, time: number) {
        this.ln[id]?.expression.goto(expression, this.dt, time);
    }
    /** HOT CODE */
    nextSample(isStartOfBlock: boolean, blockProgress: number, channels: Channels) {
        var i: number;
        const liveNotes = this.ln, deadNotes = this.dn, liveNoteCount = liveNotes.length;
        const curGain = gainForChord(liveNoteCount);
        const out = this.x.fill(0), outData = out.data;
        for (i = 0; i < liveNoteCount; i++) {
            const note = liveNotes[i]!;
            const [l, r] = note.processSample(true, curGain, channels, isStartOfBlock, blockProgress);
            outData[0]! += l!;
            outData[1]! += r!;
        }
        for (i = 0; i < deadNotes.length; i++) {
            const [note, gain] = deadNotes[i]!;
            note.alive = false;
            const [l, r] = note.processSample(false, gain, channels, isStartOfBlock, blockProgress);
            outData[0]! += l!;
            outData[1]! += r!;
            if (!note.alive) {
                deadNotes[i] = deadNotes.pop()!;
                i--;
            }
        }
        return outData;
    }
}

function gainForChord(chordSize: number) {
    return 1 / ((chordSize - 1) / 4 + 1);
}
