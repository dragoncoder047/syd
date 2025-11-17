import { AudioProcessor } from "../compiler/nodeDef";
import { CompiledGraph } from "../compiler/prog";
import { Matrix } from "../matrix";
import { AutomatedValue, AutomatedValueMethod } from "./automation";
import { ProgramState } from "./programState";
import { WorkletSynth } from "./synthImpl";

export enum PassMode {
    SET,
    ADD,
}

export class Tone {
    pitch: AutomatedValue;
    expression: AutomatedValue;
    mods: AutomatedValue[];
    modToIndexMap: Record<string, number>;
    nodes: AudioProcessor[];
    alive = true;
    impl: ProgramState;
    input = new Matrix;
    constructor(
        state: CompiledGraph,
        public dt: number,
        public synth: WorkletSynth,
        pitch: number,
        expression: number) {
        this.pitch = new AutomatedValue(pitch, AutomatedValueMethod.EXPONENTIAL);
        this.expression = new AutomatedValue(expression, AutomatedValueMethod.EXPONENTIAL);
        this.mods = state.mods.map(([_, initial, mode]) => new AutomatedValue(initial, mode));
        this.modToIndexMap = Object.fromEntries(state.mods.map((m, i) => [m[0], i]));
        this.nodes = state.nodes.map(([name, dims]) => synth.nodes.find(f => f.name === name)!.make(synth, dims));
        this.impl = new ProgramState(state.code, state.registers.map(r => Matrix.resurrect(r)), this.nodes, state.constantTab);
    }
    /** HOT CODE */
    processBlock(leftBuffer: Float32Array, rightBuffer: Float32Array, mode: PassMode, gate: boolean, gain: number) {
        const dt = this.dt,
            len = leftBuffer.length,
            modList = this.mods,
            input = this.input,
            impl = this.impl,
            pitch = this.pitch,
            expression = this.expression,
            sample = impl.result.data;
        var si: number, i: number;
        var alive = this.alive;
        for (si = 0; si < len; si++) {
            // Mods always update per-sample
            for (i = 0; i < modList.length; i++) {
                modList[i]!.update(dt);
            }
            pitch.update(dt);
            expression.update(dt);
            alive = impl.run(
                input,
                pitch.value,
                expression.value,
                gate ? 0 : 1,
                modList,
                si == 0,
                si / len,
                alive);
            // Apply sample
            sample[0]! *= gain;
            sample[1]! *= gain;
            switch (mode) {
                case PassMode.SET: leftBuffer[si] = sample[0]!; rightBuffer[si] = sample[1]!; break;
                case PassMode.ADD: leftBuffer[si]! += sample[0]!; rightBuffer[si]! += sample[1]!;
            }
        }
        this.alive = alive;
    }
    automate(name: string, value: number, atTime: number) {
        this.mods[this.modToIndexMap[name]!]?.goto(value, this.dt, atTime);
    }
}
