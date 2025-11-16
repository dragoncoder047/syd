import { isinstance } from "../utils";
import * as AST from "./ast";
import { processArgsInCall } from "./call";
import { EvalState } from "./evalState";
import { RuntimeError } from "./errors";
import { AudioProcessorFactory, Rate } from "./nodeDef";

export function makeCodeMacroExpander(name: string, finalMacro: boolean, params: AST.Node[], body: AST.Node): ((args: AST.Node[], state: EvalState) => Promise<AST.Node>) & { body: AST.Node } {
    const fakeNodeDef: AudioProcessorFactory = { name, inputs: [], outputRate: Rate.K_RATE, stateless: true, make: () => null as any };
    const shouldEvalParam: boolean[] = [];
    var built = false;
    async function build(state: EvalState) {
        await validate(state);
        built = true;
        for (var i = 0; i < params.length; i++) {
            var param = params[i]!;
            if (isinstance(param, AST.Name)) {
                fakeNodeDef.inputs.push({ name: param.name, rate: Rate.K_RATE });
                shouldEvalParam.push(true);
            } else if (isinstance(param, AST.ParameterDescriptor)) {
                var v: any = param.defaultValue;
                if (isinstance(v, AST.DefaultPlaceholder)) v = null;
                fakeNodeDef.inputs.push({ name: param.name, default: v, rate: Rate.K_RATE, constantOptions: (await param.enumOptions.eval(state)).toImmediate() });
                shouldEvalParam.push(!param.lazy);
            } else throw new RuntimeError("unreachable", param.loc, AST.stackToNotes(state.callstack));
        }
    }
    async function validate(state: EvalState) {
        // TODO: check for possible infinite recursion and throw an error
    }
    const f = async (args: AST.Node[], state: EvalState): Promise<AST.Node> => {
        if (!built) await build(state);
        if (state.callstack.length > state.recursionLimit) throw new RuntimeError("too much recursion", state.callstack.at(-1)!.loc, AST.stackToNotes(state.callstack));
        const givenArgs = await processArgsInCall(state, false, state.callstack.at(-1)!.loc, args, fakeNodeDef);
        const newState = { ...state, env: Object.create(state.globalEnv) };
        for (var i = 0; i < fakeNodeDef.inputs.length; i++) {
            const param = givenArgs[i]!;
            newState.env[fakeNodeDef.inputs[i]!.name] = shouldEvalParam[i] ? await param.eval(state) : param;
        }
        const result = await body.eval(newState);
        return finalMacro ? result.eval(state) : result;
    };
    f.body = body;
    return f;
}
