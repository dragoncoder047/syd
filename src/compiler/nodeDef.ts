import { Matrix } from "../matrix";
import { WorkletSynth } from "../runtime/synthImpl";

export type Dimensions = [string | number, string | number];
export const SCALAR_DIMS = [1, 1] as const satisfies Dimensions;

export type Range = [number, number, step?: number];

export interface NodeInputDef {
    name: string;
    description?: string;
    unit?: string;
    dims: Dimensions;
    range?: Range;
    default: number;
    constantOptions?: Record<string, number | undefined>;
}

export interface AudioProcessorFactory {
    name: string;
    description?: string;
    inputs: NodeInputDef[];
    outputDims: Dimensions;
    stateless?: boolean;
    make(synth: WorkletSynth, sizeVars: Record<string, number>): AudioProcessor;
}

export type AudioProcessor = (
    inputs: Matrix[],
    isStartOfBlock: boolean,
    blockProgress: number,
) => Matrix;
