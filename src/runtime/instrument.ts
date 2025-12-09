import { CompiledGraph } from "../compiler/compile";
import { Matrix } from "../math/matrix";
import { ChannelMode, Channels } from "./channels";
import { Synth } from "./synth";
import { Tone } from "./tone";

export class Instrument {
    /** live notes */
    ln: Tone[] = [];
    /** live note IDs */
    lni: number[] = [];
    /** dead notes */
    dn: [Tone, number][] = [];
    /** tmp sample */
    x = new Matrix(2, 1);
    constructor(
        public ocn: string,
        public dt: number,
        public p: Synth,
        public v: CompiledGraph,
    ) {
        p.c.setup(ocn, ChannelMode.STICKY);
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
    processSample(isStartOfBlock: boolean, blockProgress: number, channels: Channels) {
        var i: number;
        const liveNotes = this.ln, deadNotes = this.dn, liveNoteCount = liveNotes.length;
        const curGain = gainForChord(liveNoteCount);
        const out = this.x.fill(0), outData = out.data;
        for (i = 0; i < liveNoteCount; i++) {
            const note = liveNotes[i]!;
            const s = note.processSample(true, curGain, channels, isStartOfBlock, blockProgress);
            outData[0]! += s[0]!;
            outData[1]! += s[1]!;
        }
        for (i = 0; i < deadNotes.length; i++) {
            const noteAndGain = deadNotes[i]!, note = noteAndGain[0], gain = noteAndGain[1];
            note.alive = false;
            const s = note.processSample(false, gain, channels, isStartOfBlock, blockProgress);
            outData[0]! += s[0]!;
            outData[1]! += s[1]!;
            if (!note.alive) {
                deadNotes[i] = deadNotes.pop()!;
                i--;
            }
        }
        channels.put(this.ocn, out);
    }
}

function gainForChord(chordSize: number) {
    return 1 / ((chordSize - 1) / 4 + 1);
}
