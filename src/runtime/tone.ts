import { AudioProcessor } from "../compiler/nodeDef";
import { CompiledVoiceData } from "../compiler/prog";
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
    aRate: ProgramState;
    kRate: ProgramState;
    input = new Matrix;
    constructor(
        state: CompiledVoiceData,
        public dt: number,
        public synth: WorkletSynth,
        pitch: number,
        expression: number) {
        this.pitch = new AutomatedValue(pitch, AutomatedValueMethod.EXPONENTIAL);
        this.expression = new AutomatedValue(expression, AutomatedValueMethod.EXPONENTIAL);
        this.mods = state.mods.map(([_, initial, mode]) => new AutomatedValue(initial, mode));
        this.modToIndexMap = Object.fromEntries(state.mods.map((m, i) => [m[0], i]));
        this.nodes = state.nodeNames.map(n => synth.nodes.find(f => f.name === n)!.make(synth));
        this.aRate = new ProgramState(state.aCode, state.registers, this.nodes, state.constantTab);
        this.kRate = new ProgramState(state.kCode, state.registers, this.nodes, state.constantTab);
    }
    /** HOT CODE */
    processBlock(leftBuffer: Float32Array, rightBuffer: Float32Array, mode: PassMode, gate: boolean, gain: number) {
        const dt = this.dt, len = leftBuffer.length, modList = this.mods, input = this.input, aRate = this.aRate, pitch = this.pitch, expression = this.expression, nodes = this.nodes, sample = aRate.result.data;
        var si, i, j: number, node: AudioProcessor, f: Matrix, g: Matrix, l: Matrix, alpha: number;
        // Update k-rate parameters
        var alive = this.kRate.run(input, pitch.value, expression.value, gate ? 0 : 1, modList, len, this.alive);
        for (si = 0; si < len; si++) {
            // Mods always update per-sample
            for (i = 0; i < modList.length; i++) {
                modList[i]!.update(dt);
            }
            pitch.update(dt);
            expression.update(dt);
            // Interpolate k-rate parameters
            alpha = si / len;
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i]!;
                node.kCur ??= [];
                for (j = 0; j < node.kNext!.length; j++) {
                    f = node.kPrev![j]!;
                    g = node.kNext![j]!;
                    (node.kCur[j] ??= new Matrix).applyUnary((_, row, col) => f.get(row, col) * (1 - alpha) + g.get(row, col) * alpha);
                }
            }
            // Update sample
            alive = aRate.run(input, pitch.value, expression.value, gate ? 0 : 1, modList, len, alive);
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
