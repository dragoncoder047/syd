import { CompiledGraph } from "../compiler/compile";
import { AudioProcessorFactory } from "../compiler/nodeDef";
import { NODES, PASSTHROUGH_FX } from "../lib";
import { Channels } from "./channels";
import { Instrument } from "./instrument";
import { Tone } from "./tone";
import { lengthToBasePitch, samplesToIntegral } from "./waveProcess";

export interface Wave {
    /** normal wavetable */
    s: Float32Array,
    /** integral wavetable */
    i: Float32Array,
    /** base pitch in Hz */
    b: number;
}

export class WorkletSynth {
    /** instruments */
    i: Instrument[] = [];
    /** post effects and stuff */
    p: Tone = null as any;
    /** note ID to instrument map */
    n2i: Record<number, number> = {};
    /** waves list */
    w: Wave[] = [];
    /** nodes types definitions */
    nt: AudioProcessorFactory[] = NODES;
    /** master volume */
    v: number = 0.8;
    /** channels for passing data between instruments or the postFX */
    c = new Channels;
    constructor(public dt: number) {
        this.clearPostFX();
    }
    clearAll() {
        this.clearInstruments();
        this.clearPostFX();
    }
    clearInstrument(index: number) {
        delete this.i[index];
    }
    clearInstruments() {
        this.i = [];
    }
    clearPostFX() {
        this.p = new Tone(PASSTHROUGH_FX, this.dt, this, 0, 1);
    }
    setWave(number: number, samples: Float32Array, basePitch?: number) {
        this.w[number] = {
            s: samples,
            i: samplesToIntegral(samples),
            b: basePitch ?? lengthToBasePitch(samples.length, this.dt),
        }
    }
    setInstrument(instrumentNumber: number, voiceDef: CompiledGraph) {
        this.i[instrumentNumber] = new Instrument(this.dt, this, voiceDef);
    }
    setPostFX(fxDef: CompiledGraph): void {
        this.p = new Tone(fxDef, this.dt, this, 1, 1);
    }
    setVolume(volume: number) {
        this.v = volume;
    }
    private _ifn(noteID: number) {
        return this.i[this.n2i[noteID]!];
    }
    noteOn(id: number, instrument: number, pitch: number, expression: number) {
        this._ifn(id)?.noteOff(id);
        this.i[this.n2i[id] = instrument]?.noteOn(id, pitch, expression);
    }
    noteOff(id: number) {
        this._ifn(id)?.noteOff(id);
        delete this.n2i[id];
    }
    pitchBend(id: number, pitch: number, time: number) {
        this._ifn(id)?.pitchBend(id, pitch, time);
    }
    expressionBend(id: number, expression: number, time: number) {
        this._ifn(id)?.expressionBend(id, expression, time);
    }
    /** HOT CODE */
    /** only private to prevent types from picking it up, it must be called */
    private process(left: Float32Array, right: Float32Array) {
        const len = left.length;
        for (var i = 0; i < len; i++) {
            const [l, r] = this.nextSample(i === 0, i / len);
            left[i] = l!;
            right[i] = r!;
        }

    }
    private nextSample(isStartOfBlock: boolean, blockProgress: number) {
        var leftSample = 0, rightSample = 0, i = 0;
        const instruments = this.i, channels = this.c;
        for (i = 0; i < instruments.length; i++) {
            const [l, r] = this.i[i]!.nextSample(isStartOfBlock, blockProgress, channels);
            leftSample += l!;
            rightSample += r!;
        }
        return this.p.processSample(true, this.v, channels, isStartOfBlock, blockProgress);
    }
}
