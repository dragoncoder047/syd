import { AnnotatorDef } from "./annotatorDef";
import * as AST from "./ast";
import { FunctionDef } from "./funcDef";
import { AudioProcessorFactory } from "./nodeDef";

export interface EvalState {
    env: Record<string, AST.Node>;
    globalEnv: Record<string, AST.Node>;
    functions: FunctionDef[];
    nodes: AudioProcessorFactory[];
    annotators: AnnotatorDef[];
    callstack: AST.Call[],
    recursionLimit: number;
}

export function pushNamed<T extends AudioProcessorFactory | FunctionDef | AnnotatorDef>(defs: T[], newDef: T) {
    const i = defs.findIndex(d => d.name === newDef.name);
    if (i !== -1) defs[i] = newDef;
    else defs.push(newDef);
}
