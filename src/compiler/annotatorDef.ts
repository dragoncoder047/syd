import * as AST from "./ast";
import { EvalState } from "./evalState";

export interface AnnotatorDef {
    name: string;
    apply(
        val: AST.Node | null,
        evaledArgs: AST.Node[] | null,
        state: EvalState,
    ): Promise<AST.Node>;
}

