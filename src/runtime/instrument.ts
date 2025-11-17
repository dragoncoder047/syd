import { CompiledGraph } from "../compiler/prog";
import { WorkletSynth } from "./synthImpl";
import { PassMode, Tone } from "./tone";

export class Instrument {
    liveNotes: Tone[] = [];
    liveNoteIds: number[] = [];
    deadNotes: [Tone, number][] = [];
    fx: Tone;
    inputs: Record<string, any> = {};
    prevInputs: Record<string, any> = null as any;
    lb = new Float32Array();
    rb = new Float32Array();
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
    automate(param: string, value: any, time: number, note?: number) {
        if (note !== undefined) this.liveNotes[this.liveNoteIds.indexOf(note)]!.automate(param, value, time);
        else {
            for (var i = 0; i < this.liveNotes.length; i++) this.liveNotes[i]!.automate(param, value, time);
            this.fx.automate(value, this.dt, time);
        }
    }
    /** HOT CODE */
    process(left: Float32Array, right: Float32Array) {
        var lb = this.lb, rb = this.rb, len = left.length;
        if (lb.buffer.byteLength < left.buffer.byteLength) {
            this.lb = lb = new Float32Array(len);
            this.rb = rb = new Float32Array(len);
        } else if (lb.length !== len) {
            this.lb = lb = new Float32Array(lb.buffer, 0, len);
            this.rb = rb = new Float32Array(rb.buffer, 0, len);
        }
        var i: number;
        const liveNotes = this.liveNotes, deadNotes = this.deadNotes, liveNoteCount = liveNotes.length;
        for (i = 0; i < liveNoteCount; i++) {
            liveNotes[i]!.processBlock(lb, rb, PassMode.ADD, true, gainForChord(liveNoteCount));
        }
        for (i = 0; i < deadNotes.length; i++) {
            var tone = deadNotes[i]![0];
            var gain = deadNotes[i]![1];
            tone.alive = false;
            tone.processBlock(lb, rb, PassMode.ADD, false, gain);
            if (!tone.alive) {
                deadNotes[i] = deadNotes.pop()!;
                i--;
            }
        }
        this.fx.processBlock(lb, rb, PassMode.SET, true, 1);
        for (i = 0; i < len; i++) {
            left[i]! += lb[i]!;
            right[i]! += rb[i]!;
        }
    }
}

function gainForChord(chordSize: number) {
    return 1 / ((chordSize - 1) / 4 + 1);
}
