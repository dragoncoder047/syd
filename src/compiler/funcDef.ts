import * as AST from "./ast";
import { EvalState } from "./evalState";

export interface FunctionDef {
    name: string;
    argc: number | undefined;
    expand(args: AST.Node[], state: EvalState): Promise<AST.Node>;
}
