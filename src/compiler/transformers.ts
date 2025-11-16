import { gensym, isinstance, str } from "../utils";
import * as AST from "./ast";
import { liftCommas } from "./core";
import { ErrorNote, ParseError } from "./errors";
import { countPlaceholdersIn, isPipe, replacePlaceholdersWith } from "./pipe";

const TRANSFORM_PASSES = [

    async function expandSymbols(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.UnaryOp) || ast.op !== ".") return ast.pipe(expandSymbols);
        if (!isinstance(ast.value, AST.Name)) {
            throw new ParseError('unexpected "."', ast.loc);
        }
        return new AST.Symbol(ast.value.loc, ast.value.name);
    },

    async function expandInterpolations(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandInterpolations);
        if (isinstance(ast, AST.UnaryOp) && ast.op === "&") ast = new AST.InterpolatedValue(ast.loc, ast.value);
        return ast;
    },

    async function expandMapping(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandMapping);
        if (!isinstance(ast, AST.List)) return ast;
        const elements = ast.values;
        const firstKVIndex = elements.findIndex(e => (isinstance(e, AST.BinaryOp) && e.op === "=>"));
        if (firstKVIndex < 0) {
            const firstColon = elements.find(e => (isinstance(e, AST.BinaryOp) && e.op === ":"));
            if (firstColon) {
                throw new ParseError('mappings use "=>", not ":"', firstColon.loc);
            }
            return ast;
        }
        const kvPairs: { key: AST.Node, val: AST.Node }[] = [];
        for (var i = 0; i < elements.length; i++) {
            const el = elements[i]!;
            if (!isinstance(el, AST.BinaryOp) || el.op !== "=>") {
                throw new ParseError(isinstance(el, AST.DefaultPlaceholder) ? "illegal trailing comma in mapping" : 'expected "=>" after key value', el.edgemost(false).loc, i < firstKVIndex ? [new ErrorNote('hint: the "=>" first used here makes this a mapping, not a list', elements[firstKVIndex]!.loc)] : []);
            }
            kvPairs.push({ key: el.left, val: el.right });
        }
        return new AST.Mapping(ast.edgemost(true).loc, kvPairs);
    },

    async function commasToBlocks(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || (ast.op !== "," && ast.op !== ";")) return ast.pipe(commasToBlocks);
        return new AST.Block(ast.edgemost(true).loc, await Promise.all(liftCommas(ast, true).map(commasToBlocks)));
    },

    async function trimDefaultSentinelsInCallExpression(ast: any): Promise<AST.Node> {
        ast = await ast.pipe(trimDefaultSentinelsInCallExpression);
        if (isinstance(ast, AST.Call))
            while (isinstance(ast.args.at(-1), AST.DefaultPlaceholder)) ast.args.pop();
        return ast;
    },

    async function trimDefaultSentinelsInBlock(ast: any): Promise<AST.Node> {
        ast = await ast.pipe(trimDefaultSentinelsInBlock);
        if (isinstance(ast, AST.Block)) {
            for (var i = 0; i < ast.body.length; i++) {
                if (isinstance(ast.body[i], AST.DefaultPlaceholder)) {
                    ast.body.splice(i, 1);
                    i--;
                }
            }
        }
        return ast;
    },

    async function expandDefinitions(ast: AST.Node, alreadyExpanded = false): Promise<AST.Node> {
        if (!isinstance(ast, AST.BinaryOp) || ast.op !== ":-") return ast.pipe(expandDefinitions);
        var header = alreadyExpanded ? ast.left : await ast.left.pipe(expandDefinitions);
        const body = alreadyExpanded ? ast.right : await ast.right.pipe(expandDefinitions);
        var isMacro = false;
        if (isinstance(header, AST.UnaryOp) && header.op === "@") {
            header = header.value;
            isMacro = true;
        }
        if (!isinstance(header, AST.Call)) {
            if (isinstance(header, AST.AnnotatedValue) && header.value !== null) {
                ast.left = header.value;
                return new AST.AnnotatedValue(header.loc, header.attributes, await expandDefinitions(ast, true));
            }
            throw new ParseError("illegal header", header.edgemost(true).loc, [new ErrorNote("note: definition operator is here", ast.loc)]);
        }
        const params = header.args;
        var firstOptional: AST.Node | undefined;
        const realParams: AST.Node[] = [];
        for (var i = 0; i < params.length; i++) {
            var param = params[i]!;
            var lazy = false;
            if (isinstance(param, AST.UnaryOp) && param.op === "@") {
                param = param.value;
                lazy = true;
            }
            if (isinstance(param, AST.Name)) {
                if (firstOptional) {
                    throw new ParseError("required parameter follows optional parameter", param.loc, [new ErrorNote("note: first optional parameter is here", firstOptional.loc)]);
                }
                realParams.push(lazy ? new AST.ParameterDescriptor(param.loc, param.name, new AST.Mapping(param.loc, []), new AST.DefaultPlaceholder(param.loc), true) : param);
                continue;
            }
            if (!isinstance(param, AST.BinaryOp) || (param.op !== ":" && param.op !== "=")) {
                throw new ParseError("illegal parameter", param.edgemost(true).loc);
            }
            var name = param.left, enums: AST.Mapping, default_: AST.Node | undefined;
            switch (param.op) {
                case ":":
                    default_ = undefined;
                    if (!isinstance(param.right, AST.Mapping)) {
                        throw new ParseError("expected a mapping", param.right.loc);
                    }
                    enums = param.right;
                    for (var { key } of enums.mapping) {
                        if (!isinstance(key, AST.Symbol)) {
                            throw new ParseError("expected a symbol here", key.edgemost(false).loc, [new ErrorNote(`note: while defining enum options for parameter`, name.loc), ...(isinstance(key, AST.Name) ? [new ErrorNote(`hint: put a "." before the ${str(key.name)} to make it a static symbol instead of a variable`, key.loc)] : [])]);
                        }
                    }
                    break;
                case "=":
                    enums = new AST.Mapping(param.loc, []);
                    if (isinstance(name, AST.BinaryOp) && name.op === ":") {
                        if (!isinstance(name.right, AST.Mapping)) {
                            throw new ParseError("expected a mapping", name.right.loc);
                        }
                        enums = name.right;
                        name = name.left;
                    }
                    default_ = param.right;
                    break;
                default:
                    throw "unreachable";
            }
            if (default_ === undefined) {
                default_ = new AST.DefaultPlaceholder(name.loc);
            } else {
                if (!firstOptional) firstOptional = name;
            }
            if (isinstance(name, AST.UnaryOp) && name.op === "@") {
                param = name.value;
                lazy = true;
            }
            if (!isinstance(name, AST.Name)) {
                throw new ParseError("illegal parameter name for optional parameter", name.edgemost(false).loc);
            }
            realParams.push(new AST.ParameterDescriptor(name.loc, name.name, enums, default_, lazy));
        }
        return new AST.Definition(header.loc, header.name, isMacro, realParams, body);
    },

    async function expandAssignments(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandAssignments);
        if (!isinstance(ast, AST.BinaryOp) || (ast.op !== "=" && !ast.assign)) return ast;
        const target = ast.left;
        var body = ast.right;
        if (ast.assign) {
            body = new AST.BinaryOp(ast.loc, ast.op, target, body);
        }
        return new AST.Assignment(target.loc, target, body);
    },

    async function expandTernaryOperators(ast: AST.Node): Promise<AST.Node> {
        // ... this needs work to support a?b?c:d:e and a?b:c?d:e constructs
        ast = await ast.pipe(expandTernaryOperators);
        if (!isinstance(ast, AST.BinaryOp) || ast.op !== "?") return ast;
        const condition = ast.left;
        const choices = ast.right;
        if (!isinstance(choices, AST.BinaryOp) || choices.op !== ":") {
            throw new ParseError('expected ":" after expression', (isinstance(choices, AST.BinaryOp) ? choices : choices.edgemost(false)).loc, [new ErrorNote('note: "?" is here:', ast.loc)]);
        }
        return new AST.Conditional(ast.loc, condition, choices.left, choices.right);
    },

    async function createKeywordArguments(ast: AST.Node, parent: AST.Node | null = null): Promise<AST.Node> {
        ast = await ast.pipe(e => createKeywordArguments(e, ast));
        if (!isinstance(ast, AST.BinaryOp) || ast.op !== ":") return ast;
        const name = ast.left;
        const value = ast.right;
        if (!isinstance(name, AST.Name)) {
            throw (isinstance(parent, AST.Call)
                ? new ParseError('expected name before ":"', name.edgemost(false).loc)
                : new ParseError('unexpected ":"', ast.loc));
        }
        if (!isinstance(parent, AST.Call) && !isinstance(parent, AST.Definition)) {
            throw new ParseError("named parameter not directly inside a callsite", name.loc);
        }
        return new AST.KeywordArgument(name.loc, name.name, value);
    },

    async function fixAndValidateListDefaultSentinels(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.List)) return ast.pipe(fixAndValidateListDefaultSentinels);
        const args = await Promise.all(ast.values.map(fixAndValidateListDefaultSentinels));
        // Special case for empty list
        if (args.length === 1 && isinstance(args[0], AST.DefaultPlaceholder)) {
            return new AST.List(ast.loc, []);
        }
        for (var i = 0; i < args.length; i++) {
            const el = args[i]!;
            if (isinstance(el, AST.DefaultPlaceholder)) {
                throw new ParseError((i + 1) === args.length ? "illegal trailing comma in list" : "empty elements not allowed in list", el.loc, [new ErrorNote("note: list starts here", ast.loc)]);
            }
        }
        return new AST.List(ast.loc, args);
    },

    async function transformUnarySplatOperators(ast: AST.Node): Promise<AST.Node> {
        if (!isinstance(ast, AST.UnaryOp) || ast.op !== "*") return ast.pipe(transformUnarySplatOperators);
        return new AST.SplatValue(ast.loc, await ast.value.pipe(transformUnarySplatOperators));
    },

    async function expandPipeOperators(ast: AST.Node): Promise<AST.Node> {
        ast = await ast.pipe(expandPipeOperators);
        if (!isPipe(ast)) return ast;
        const arg = ast.left;
        const expr = ast.right;
        const numPlaceholders = await countPlaceholdersIn(expr);
        if (numPlaceholders === 0) {
            throw new ParseError("missing '#' placeholder in pipe expression", expr.loc, [new ErrorNote("note: required by this pipe operator", ast.loc)]);
        } else if (numPlaceholders > 1 && !isinstance(arg, AST.Value)) {
            const sym = new AST.Name(ast.loc, gensym());
            return new AST.Block(ast.loc, [new AST.Assignment(ast.loc, sym, arg), await replacePlaceholdersWith(expr, sym)]);
        } else {
            return replacePlaceholdersWith(expr, arg);
        }
    }

];

export async function transformAST(ast: AST.Node): Promise<AST.Node> {
    for (var transformer of TRANSFORM_PASSES) {
        ast = await transformer(ast);
    }
    return ast;
}
