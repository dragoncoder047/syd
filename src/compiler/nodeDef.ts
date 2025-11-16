import { Matrix } from "../matrix";
import { WorkletSynth } from "../runtime/synthImpl";

export enum Rate {
    /** update once per block */
    K_RATE,
    /** must update every sample */
    A_RATE,
    /** K-rate or A-rate, I don't care. Implemented as A-rate */
    ANY_RATE,
}

export interface NodeInput {
    name: string;
    description?: string;
    unit?: string;
    dims: string;
    range?: [number, number, step?: number];
    default?: Matrix | undefined;
    rate: Rate,
    constantOptions?: Record<string, Matrix | undefined>;
}

export interface AudioProcessorFactory {
    name: string;
    description?: string;
    inputs: NodeInput[];
    /** if outputRate is K_RATE then the first value returned will
     * be used as the "k-rate result" for the node */
    outputRate: Rate;
    outputDims: string;
    stateless?: boolean;
    make(synth: WorkletSynth): AudioProcessor;
}

export interface AudioProcessor {
    kPrev?: Matrix[];
    kNext?: Matrix[];
    /** current values of k-rate parameters */
    kCur?: Matrix[];
    /** process (or don't process) the control inputs into usable internal state.
     * if not present the k-rate inputs will be the state. */
    updateControl?(controlParams: Matrix[], blockSize: number): Matrix[];
    /** called once per sample, with the a-rate inputs,
     * k-rate can be read from `this.kCur` */
    updateSample(inputs: Matrix[]): Matrix;
}
