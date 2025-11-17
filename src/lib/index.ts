import { AudioProcessorFactory, Dimensions } from "../compiler/nodeDef";
import { OPERATORS } from "../compiler/operator";
import { lerp } from "../math";
import { Matrix } from "../matrix";
import { Bitcrusher, DelayLine, Filter } from "./nodes/effects";
import { WavetableOscillator } from "./nodes/generators";
import { Clock, Integrator, Shimmer } from "./nodes/logic";

export const NODES: AudioProcessorFactory[] = [
    new WavetableOscillator,
    new Filter,
    new Bitcrusher,
    new DelayLine,
    new Shimmer,
    new Integrator,
    new Clock,
    ...Object.entries(OPERATORS).map(([op, func]) => ({
        name: "op" + op,
        inputs: [
            {
                name: "a",
                dims: ["N", "M"] as Dimensions,
            },
            {
                name: "b",
                dims: ["N", "M"] as Dimensions,
            }
        ],
        outputDims: ["N", "M"] as Dimensions,
        make() {
            return (inputs: Matrix[]) => inputs[0]!.applyBinary(func, inputs[1]!);
        }
    })),
];

export class KRateHelper {
    prev: Matrix;
    current: Matrix;
    sample: Matrix;
    constructor(rows: number, cols: number) {
        this.prev = new Matrix(rows, cols);
        this.current = new Matrix(rows, cols);
        this.sample = new Matrix(rows, cols);
    }
    nextBlock() {
        this.prev.copyFrom(this.current);
    }
    loadForSample(progress: number) {
        this.sample.applyUnary((_, row, col) => lerp(this.prev.get(row, col), this.current.get(row, col), progress));
    }
}