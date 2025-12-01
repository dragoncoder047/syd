import { CompiledGraph } from "../compiler/compile";
import { AudioProcessor } from "../compiler/nodeDef";
import { Matrix } from "../matrix";
import { AutomatedValue, AutomatedValueMethod } from "./automation";
import { Channels } from "./channels";
import { ProgramState } from "./programState";
import { Synth } from "./synth";

export class Tone {
    pitch: AutomatedValue;
    expression: AutomatedValue;
    nodes: AudioProcessor[];
    alive = true;
    impl: ProgramState;
    constructor(
        state: CompiledGraph,
        public dt: number,
        public synth: Synth,
        pitch: number,
        expression: number) {
        this.pitch = new AutomatedValue(pitch, AutomatedValueMethod.EXPONENTIAL);
        this.expression = new AutomatedValue(expression, AutomatedValueMethod.EXPONENTIAL);
        this.nodes = state.nodes.map(([name, dims]) => synth.nt.find(f => f.name === name)!.make(synth, dims));
        this.impl = new ProgramState(state.code, state.registers.map(r => Matrix.resurrect(r)), this.nodes, state.constantTab);
    }
    /** HOT CODE */
    processSample(gate: boolean, gain: number, channels: Channels, isStartOfBlock: boolean, blockProgress: number) {
        const dt = this.dt,
            impl = this.impl,
            pitch = this.pitch,
            expression = this.expression,
            sample = impl.x.data;
        pitch.update(dt);
        expression.update(dt);
        this.alive = impl.run(
            pitch.c,
            expression.c,
            gate ? 0 : 1,
            channels,
            isStartOfBlock,
            blockProgress,
            this.alive,
            this.synth.wn);
        sample[0]! *= gain;
        sample[1]! *= gain;
        return sample;
    }
}
