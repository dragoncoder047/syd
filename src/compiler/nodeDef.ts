import { NodeInput } from "../graph/types";
import { Matrix } from "../math/matrix";
import { Opcode, Program } from "../runtime/program";
import { Synth } from "../runtime/synth";

export type Dimensions = [string | number, string | number];
export const SCALAR_DIMS = [1, 1] as const satisfies Dimensions;

export interface NodeInputDef {
    name: string;
    dims: Dimensions;
    default: number;
}

export interface CompilerCtx {
    compile(arg: NodeInput, argNumber: number, parentNode: number, default_: number): void;
    value(input: NodeInput): Matrix | null;
    pushConstant(value: Matrix, forceNew: boolean): void;
}

export type NodeArgs = (number | string)[];

export abstract class AudioProcessorFactory {
    abstract name: string;
    abstract getInputs(args: NodeArgs): NodeInputDef[];
    abstract getOutputDims(args: NodeArgs): Dimensions;
    eager = false;
    compile(
        myNodeNo: number,
        _args: NodeArgs,
        inputs: NodeInput[],
        computedDefaults: number[],
        program: Program,
        compiler: CompilerCtx
    ) {
        const n = inputs.length;
        for (var i = 0; i < n; i++) {
            const arg = inputs[i]!;
            compiler.compile(arg, i, myNodeNo, computedDefaults[i]!);
        }
        program.push([Opcode.CALL_NODE, myNodeNo, n]);
    }
    value(_args: NodeArgs, _context: CompilerCtx): Matrix | null {
        return null;
    }
    abstract make(synth: Synth, sizeVars: Record<string, number>): AudioProcessor;
}

export type AudioProcessor = (
    inputs: Matrix[],
    isStartOfBlock: boolean,
    blockProgress: number,
) => Matrix;
