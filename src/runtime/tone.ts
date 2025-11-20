import { CompiledGraph } from "../compiler/compile";
import { AudioProcessor } from "../compiler/nodeDef";
import { Matrix } from "../matrix";
import { AutomatedValue, AutomatedValueMethod } from "./automation";
import { ProgramState } from "./programState";
import { WorkletSynth } from "./synthImpl";

export class Tone {
    pitch: AutomatedValue;
    expression: AutomatedValue;
    nodes: AudioProcessor[];
    alive = true;
    impl: ProgramState;
    input = new Matrix(2, 1);
    constructor(
        state: CompiledGraph,
        public dt: number,
        public synth: WorkletSynth,
        pitch: number,
        expression: number) {
        this.pitch = new AutomatedValue(pitch, AutomatedValueMethod.EXPONENTIAL);
        this.expression = new AutomatedValue(expression, AutomatedValueMethod.EXPONENTIAL);
        this.nodes = state.nodes.map(([name, dims]) => synth.nodes.find(f => f.name === name)!.make(synth, dims));
        this.impl = new ProgramState(state.code, state.registers.map(r => Matrix.resurrect(r)), this.nodes, state.constantTab);
    }
    /** HOT CODE */
    processSample(leftIn: number, rightIn: number, gate: boolean, gain: number, inputs: Record<string, number>, isStartOfBlock: boolean, blockProgress: number) {
        const dt = this.dt,
            input = this.input,
            impl = this.impl,
            pitch = this.pitch,
            expression = this.expression,
            sample = impl.result.data;
        pitch.update(dt);
        expression.update(dt);
        input.put(0, 0, leftIn);
        input.put(1, 0, rightIn);
        this.alive = impl.run(
            input,
            pitch.value,
            expression.value,
            gate ? 0 : 1,
            inputs,
            isStartOfBlock,
            blockProgress,
            this.alive);
        sample[0]! *= gain;
        sample[1]! *= gain;
        return sample;
    }
}
