import { CompiledGraph } from "../compiler/compile";
import { WorkletSynth } from "./synthImpl";
import { Tone } from "./tone";

export class Instrument {
    liveNotes: Tone[] = [];
    liveNoteIds: number[] = [];
    deadNotes: [Tone, number][] = [];
    fx: Tone;
    constructor(
        public dt: number,
        public synth: WorkletSynth,
        public voiceTemplate: CompiledGraph,
        fxDef: CompiledGraph
    ) {
        this.fx = new Tone(fxDef, dt, synth, 1, 1);
    }
    noteOn(id: number, pitch: number, expression: number) {
        this.noteOff(id);
        this.liveNotes.push(new Tone(this.voiceTemplate, this.dt, this.synth, pitch, expression));
        this.liveNoteIds.push(id);
    }
    noteOff(id: number) {
        if (this.liveNoteIds.includes(id)) {
            const index = this.liveNoteIds.indexOf(id);
            const note = this.liveNotes[index]!;
            this.deadNotes.push([note, gainForChord(this.liveNotes.length)]);
            this.liveNotes[index] = this.liveNotes.pop()!;
            this.liveNoteIds[index] = this.liveNoteIds.pop()!;
        }
    }
    pitchBend(id: number, pitch: number, time: number) {
        this.liveNotes[id]?.pitch.goto(pitch, this.dt, time);
    }
    expressionBend(id: number, expression: number, time: number) {
        this.liveNotes[id]?.expression.goto(expression, this.dt, time);
    }
    /** HOT CODE */
    nextSample(isStartOfBlock: boolean, blockProgress: number, inputs: Record<string, number>) {
        var i: number;
        const liveNotes = this.liveNotes, deadNotes = this.deadNotes, liveNoteCount = liveNotes.length;
        const curGain = gainForChord(liveNoteCount);
        var leftSample = 0, rightSample = 0;
        for (i = 0; i < liveNoteCount; i++) {
            const note = liveNotes[i]!;
            const sample = note.processSample(0, 0, true, curGain, inputs, isStartOfBlock, blockProgress);
            leftSample += sample[0]!;
            rightSample += sample[1]!;
        }
        for (i = 0; i < deadNotes.length; i++) {
            const [note, gain] = deadNotes[i]!;
            note.alive = false;
            const sample = note.processSample(0, 0, false, gain, inputs, isStartOfBlock, blockProgress);
            leftSample += sample[0]!;
            rightSample += sample[1]!;
            if (!note.alive) {
                deadNotes[i] = deadNotes.pop()!;
                i--;
            }
        }
        return this.fx.processSample(leftSample, rightSample, true, 1, inputs, isStartOfBlock, blockProgress);
    }
}

function gainForChord(chordSize: number) {
    return 1 / ((chordSize - 1) / 4 + 1);
}
