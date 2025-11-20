import { CompiledGraph } from "../compiler/compile";
import { AudioProcessorFactory } from "../compiler/nodeDef";
import { NODES, PASSTHROUGH_FX } from "../lib";
import { AutomatedValue, AutomatedValueMethod } from "./automation";
import { Instrument } from "./instrument";
import { Tone } from "./tone";
import { lengthToBasePitch, samplesToIntegral } from "./waveProcess";

export interface Wave {
    samples: Float32Array,
    integral: Float32Array,
    basePitch: number;
}

export class WorkletSynth {
    instruments: Instrument[] = [];
    postFX: Tone = null as any;
    /** note ID to instrument map */
    n2i: Record<number, number> = {};
    mods: Record<string, AutomatedValue> = {};
    modNames: string[] = [];
    waves: Wave[] = [];
    nodes: AudioProcessorFactory[] = NODES;
    volume: number = 0.8;
    constructor(public dt: number) {
        this.clearPostFX();
    }
    clearAll() {
        this.clearInstruments();
        this.clearPostFX();
    }
    clearInstrument(index: number) {
        delete this.instruments[index];
    }
    clearInstruments() {
        this.instruments = [];
    }
    clearPostFX() {
        this.postFX = new Tone(PASSTHROUGH_FX, this.dt, this, 0, 1);
    }
    setWave(number: number, samples: Float32Array, basePitch?: number) {
        this.waves[number] = {
            samples,
            integral: samplesToIntegral(samples),
            basePitch: basePitch ?? lengthToBasePitch(samples.length, this.dt),
        }
    }
    setInstrument(voiceDef: CompiledGraph, fxDef: CompiledGraph, instrumentNumber: number) {
        this.instruments[instrumentNumber] = new Instrument(this.dt, this, voiceDef, fxDef);
    }
    setPostFX(fxDef: CompiledGraph): void {
        this.postFX = new Tone(fxDef, this.dt, this, 1, 1);
    }
    setVolume(volume: number) {
        this.volume = volume;
    }
    private _ifn(noteID: number) {
        return this.instruments[this.n2i[noteID]!];
    }
    noteOn(id: number, instrument: number, pitch: number, expression: number) {
        this._ifn(id)?.noteOff(id);
        this.instruments[this.n2i[id] = instrument]?.noteOn(id, pitch, expression);
    }
    noteOff(id: number) {
        this._ifn(id)?.noteOff(id);
        delete this.n2i[id];
    }
    addMod(name: string, initial: number, mode: AutomatedValueMethod) {
        this.mods[name] = new AutomatedValue(initial, mode);
        this.modNames.push(name);
    }
    clearMods() {
        this.mods = {};
        this.modNames = [];
    }
    automate(param: string, value: any, time: number) {
        this.mods[param]?.goto(value, this.dt, time);
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
            const sample = this._nextSample(i === 0, i / len);
            left[i] = sample[0]!;
            right[i] = sample[1]!;
        }

    }
    private _nextSample(isStartOfBlock: boolean, blockProgress: number) {
        var leftSample = 0, rightSample = 0, i = 0;
        const instruments = this.instruments, modNames = this.modNames, numMods = modNames.length, inputs: Record<string, number> = {};
        for (; i < numMods; i++) {
            const name = modNames[i]!
            inputs[name] = this.mods[name]!.update(this.dt)!;
        }
        for (i = 0; i < instruments.length; i++) {
            const sample = this.instruments[i]!.nextSample(isStartOfBlock, blockProgress, inputs);
            leftSample += sample[0]!;
            rightSample += sample[1]!;
        }
        return this.postFX.processSample(leftSample, rightSample, true, this.volume, inputs, isStartOfBlock, blockProgress);
    }
}
