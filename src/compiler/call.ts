import { isinstance, str } from "../utils";
import * as AST from "./ast";
import { ErrorNote, LocationTrace, RuntimeError } from "./errors";
import { EvalState } from "./evalState";
import { AudioProcessorFactory } from "./nodeDef";

export async function processArgsInCall(state: EvalState, doEvalArgs: boolean, site: LocationTrace, args: AST.Node[], nodeImpl: AudioProcessorFactory) {
    const newArgs: (AST.Node | null)[] = nodeImpl.inputs.map(arg => arg.default ? new AST.Value(site, arg.default) : null);
    const seenArgs: (AST.Node | null)[] = newArgs.map(_ => null);
    var firstKW: AST.Node | undefined;
    for (var i = 0; i < args.length; i++) {
        const arg = args[i]!;
        var argIndex = i;
        if (isinstance(arg, AST.KeywordArgument)) {
            if (!firstKW) firstKW = arg;
            argIndex = nodeImpl.inputs.findIndex(a => a.name === arg.name);
            if (argIndex === -1) {
                throw new RuntimeError(`no such keyword argument ${str(arg.name)} on node ${nodeImpl.name}`, arg.loc, AST.stackToNotes(state.callstack));
            }
        } else {
            if (firstKW) throw new RuntimeError("positional argument can't come after keyword argument", arg.loc, [new ErrorNote("note: first keyword argument was here:", firstKW.loc), ...AST.stackToNotes(state.callstack)]);
            if (i >= nodeImpl.inputs.length) throw new RuntimeError("too many arguments to " + nodeImpl.name, arg.edgemost(true).loc, AST.stackToNotes(state.callstack));
        }
        const argEntry = nodeImpl.inputs[argIndex]!;
        if (seenArgs[argIndex]) {
            throw new RuntimeError(`argument ${str(argEntry.name)} already provided`, arg.loc, [new ErrorNote("note: first occurrance was here:", seenArgs[argIndex]!.edgemost(true).loc), ...AST.stackToNotes(state.callstack)]);
        }
        seenArgs[argIndex] = arg;

        const defaultValue = argEntry.name;
        const enumChoices = argEntry.constantOptions ?? null;
        const walkAndReplaceSymbols = async (ast: AST.Node): Promise<AST.Node> => {
            if (isinstance(ast, AST.Call)) return ast; // Don't walk into another call's symbols
            if (isinstance(ast, AST.Symbol)) {
                var value: any = enumChoices?.[ast.value];
                if ((value ?? undefined) === undefined) {
                    throw new RuntimeError(enumChoices ? `unknown symbol name ${str(ast.value)} for parameter` : "symbol constant not valid here", ast.loc, enumChoices ? [new ErrorNote("note: valid options are: " + Object.keys(enumChoices).join(", "), ast.loc)] : []);
                }
                if (!isinstance(value, AST.Value)) {
                    value = new AST.Value(ast.loc, value);
                }
                return value;
            }
            return ast.pipe(walkAndReplaceSymbols);
        };
        var value = await walkAndReplaceSymbols(isinstance(arg, AST.KeywordArgument) ? arg.arg : arg);
        if (isinstance(arg, AST.DefaultPlaceholder)) {
            if ((defaultValue ?? null) === null) {
                throw new RuntimeError(`missing value for argument ${argEntry.name}`, arg.loc, AST.stackToNotes(state.callstack));
            }
            value = new AST.Value(arg.loc, defaultValue);
        } else if (isinstance(arg, AST.SplatValue)) {
            throw new RuntimeError("splats are only valid in a list", arg.loc, AST.stackToNotes(state.callstack));
        } else if (doEvalArgs) {
            value = await value.eval(state);
        }
        newArgs[argIndex] = value;
    }
    // now all of the ones that still have null arguments, that were not provided, are truly missing
    for (var i = 0; i < nodeImpl.inputs.length; i++) {
        if (newArgs[i] === null) {
            const argEntry = nodeImpl.inputs[i]!;
            throw new RuntimeError(`missing value for argument ${argEntry.name}`, site, AST.stackToNotes(state.callstack));
        }
    }
    return newArgs as AST.Node[];
}
