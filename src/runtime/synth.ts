import { CompiledGraph } from "../compiler/compile";
import { AudioProcessorFactory } from "../compiler/nodeDef";
import { NODES, PASSTHROUGH_FX } from "../lib";
import { ChannelMode, Channels } from "./channels";
import { Instrument } from "./instrument";
import { MessageReply } from "./synthProxy";
import { Tone } from "./tone";
import { lengthToBasePitch, samplesToIntegral } from "./waveProcess";

export class Wave {
    /** integral wavetable */
    i: Float32Array
    constructor(
        /** normal wavetable */
        public s: Float32Array,
        /** sample rate of this wave */
        public r: number,
        /** base pitch in Hz */
        public b: number,
    ) {
        this.i = samplesToIntegral(s);
    }
}

export class Synth {
    /** instruments */
    i: Instrument[] = [];
    /** name to index map */
    in: Record<string, number> = {};
    /** post effects and stuff */
    p: Tone = null as any;
    /** note ID to instrument map */
    n2i: Record<number, number> = {};
    /** waves list */
    w: Wave[] = [];
    /** wave name to index map */
    wn: Record<string, number> = {};
    /** nodes types definitions */
    nt: AudioProcessorFactory[] = NODES;
    /** master volume */
    v: number = 0.8;
    /** channels for passing data between instruments or the postFX */
    c = new Channels;
    cw = new Set<string>();
    r = true;
    constructor(public dt: number, public s: Readonly<MessagePort>) {
        this.clearPostFX();
    }
    suspend() {
        this.r = false;
    }
    resume() {
        this.r = true;
    }
    isRunning() {
        return this.r;
    }
    nukeAll() {
        this.clearInstruments();
        this.clearPostFX();
        this.clearWatchedChannels();
        this.c.clear();
        this.clearWaves();
    }
    clearInstrument(name: string) {
        const i = this.in[name] ?? -1;
        if (i >= 0) {
            this.i.splice(i, 1);
            delete this.in[name];
        }
    }
    clearInstruments() {
        this.i = [];
        this.in = {};
    }
    clearPostFX() {
        this.p = new Tone(PASSTHROUGH_FX, this.dt, this, 0, 1);
    }
    setWave(name: string, samples: Float32Array, rate: number, basePitch?: number) {
        const wave: Wave = new Wave(samples, rate, basePitch ?? lengthToBasePitch(samples.length, this.dt));
        const existIndex = this.wn[name];
        if (existIndex !== undefined) {
            this.w[existIndex] = wave;
        }
        else {
            this.wn[name] = this.w.push(wave) - 1;
        }
    }
    clearWaves() {
        this.w = [];
        this.wn = {};
    }
    setInstrument(name: string, voiceDef: CompiledGraph) {
        this.in[name] = this.i.push(new Instrument(name, this.dt, this, voiceDef)) - 1;
    }
    setupChannel(name: string, mode: ChannelMode) {
        this.c.setup(name, mode);
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
    noteOn(id: number, instrument: string, pitch: number, expression: number) {
        this._ifn(id)?.noteOff(id);
        this.i[this.n2i[id] = this.in[instrument]!]?.noteOn(id, pitch, expression);
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
    clearWatchedChannels() {
        this.cw.clear();
    }
    watchChannel(ch: string) {
        this.cw.add(ch);
    }
    unwatchChannel(ch: string) {
        this.cw.delete(ch);
    }
    /** HOT CODE */
    /** only private to prevent types from picking it up, it must be called */
    private process(left: Float32Array, right: Float32Array) {
        if (!this.r) {
            left.fill(0);
            right.fill(0);
            return;
        }
        const len = left.length;
        for (var i = 0; i < len; i++) {
            const s = this.nextSample(i === 0, i / len);
            left[i] = s[0]!;
            right[i] = s[1]!;
        }
        if (this.cw.size > 0)
            this.s.postMessage({
                t: true,
                dt: this.dt * len,
                w: [...this.cw].map(n => [n, this.c.get(n)])
            } as MessageReply);
    }
    private nextSample(isStartOfBlock: boolean, blockProgress: number) {
        const instruments = this.i, channels = this.c;
        channels.update();
        for (var i = 0; i < instruments.length; i++) {
            this.i[i]!.processSample(isStartOfBlock, blockProgress, channels);
        }
        return this.p.processSample(true, this.v, channels, isStartOfBlock, blockProgress);
    }
}
