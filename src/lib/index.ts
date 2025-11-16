import * as AST from "../compiler/ast";
import { EvalState } from "../compiler/evalState";
import { AudioProcessorFactory } from "../compiler/nodeDef";
import { CompiledVoiceData, Opcode } from "../compiler/prog";
import { scalarMatrix } from "../matrix";
import { ast as lib, sources } from "./index.syd";
import { Bitcrusher, DelayLine, Filter } from "./nodes/effects";
import { WavetableOscillator } from "./nodes/generators";
import { Clock, Integrator, Shimmer } from "./nodes/logic";
export { sources as libSrc };

export function nodes(): AudioProcessorFactory[] {
    return [
        new WavetableOscillator,
        new Filter,
        new Bitcrusher,
        new DelayLine,
        new Shimmer,
        new Integrator,
        new Clock,
    ]
}

export function baseEnv(): EvalState {
    return {
        globalEnv: {},
        env: {},
        functions: [],
        nodes: nodes(),
        callstack: [],
        recursionLimit: 1000,
        // TODO
        annotators: [],
    };
}

export function silenceInstrument(): CompiledVoiceData {
    return {
        aCode: [[Opcode.PUSH_CONSTANT, 0]],
        kCode: [],
        registers: [],
        nodeNames: [],
        constantTab: [scalarMatrix(0)],
        mods: []
    }
}
export function passthroughFx(): CompiledVoiceData {
    return {
        aCode: [[Opcode.PUSH_INPUT_SAMPLES]],
        kCode: [],
        registers: [],
        nodeNames: [],
        constantTab: [],
        mods: []
    }
}

export async function newEnv() {
    const env = baseEnv();
    await (lib as AST.Node).eval(env);
    return env;
}
