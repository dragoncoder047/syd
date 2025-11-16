import * as AST from "./ast";
import { parseTokens } from "./core";
import { tokenize } from "./tokenizer";
import { transformAST } from "./transformers";

export function parse(src: string, filename: string): Promise<AST.Node> {
    return transformAST(parseTokens(tokenize(src, filename)));
}

export { compile, newCompileData } from "./compile";
