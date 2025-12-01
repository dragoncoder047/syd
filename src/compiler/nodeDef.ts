import { Matrix } from "../matrix";
import { Synth } from "../runtime/synth";

export type Dimensions = [string | number, string | number];
export const SCALAR_DIMS = [1, 1] as const satisfies Dimensions;

export interface NodeInputDef {
    name: string;
    dims: Dimensions;
    default: number;
}

export interface AudioProcessorFactory {
    name: string;
    inputs: NodeInputDef[];
    outputDims: Dimensions;
    stateless?: boolean;
    make(synth: Synth, sizeVars: Record<string, number>): AudioProcessor;
}

export type AudioProcessor = (
    inputs: Matrix[],
    isStartOfBlock: boolean,
    blockProgress: number,
) => Matrix;
