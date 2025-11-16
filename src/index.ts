export { baseEnv, nodes, libSrc, newEnv } from "./lib";
export * from "./compiler/ast";
export * as AST from "./compiler/ast";
export { SydError, ErrorNote, LocationTrace, ParseError, CompileError, RuntimeError } from "./compiler/errors";
export { parse, compile, newCompileData } from "./compiler";
export { newSynth } from "./runtime/synthProxy";
export { disassemble } from "./runtime/disassemble";

export function initWorklet(context: AudioContext, pathToWorkletScript?: URL | string): Promise<void> {
    if (pathToWorkletScript === undefined) {
        pathToWorkletScript = new URL("./sydWorklet.js", import.meta.url);
    }
    return context.audioWorklet.addModule(pathToWorkletScript);
}
