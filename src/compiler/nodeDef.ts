import { Matrix } from "../matrix";
import { WorkletSynth } from "../runtime/synthImpl";

export type Dimensions = [string | number, string | number];
export const SCALAR_DIMS: Dimensions = [1, 1];

export type Range = [number, number, step?: number];

export interface NodeInput {
    name: string;
    description?: string;
    unit?: string;
    dims: Dimensions;
    range?: Range;
    default?: number | undefined;
    constantOptions?: Record<string, number | undefined>;
}

export interface AudioProcessorFactory {
    name: string;
    description?: string;
    inputs: NodeInput[];
    outputDims: Dimensions;
    stateless?: boolean;
    make(synth: WorkletSynth, sizeVars: Record<string, number>): AudioProcessor;
}

export type AudioProcessor = (
    inputs: Matrix[],
    isStartOfBlock: boolean,
    blockProgress: number,
) => Matrix;
