import { Matrix, Matrix_applyBinary, Matrix_applyMulti, Matrix_applyUnary, Matrix_copyFrom, Matrix_equals, Matrix_fromScalar, Matrix_get, Matrix_put, Matrix_smear_i } from "@r47onfire/game-math";
import { abs } from "lib0/math";
import { AudioProcessor, AudioProcessorFactory, Dimensions } from "../../compiler/nodeDef";
import { Synth } from "../../runtime/synth";

export class Shimmer extends AudioProcessorFactory {
    name = "shimmer";
    getInputs = () => [
        {
            name: "value",
            dims: ["M", "N"] as Dimensions,
            default: 0,
        },
        {
            name: "amount",
            default: .05,
            dims: ["M", "N"] as Dimensions
        }
    ];
    getOutputDims = () => ["M", "N"] as Dimensions;
    make(_: Synth, sizeVars: { M: number, N: number }): AudioProcessor {
        const oldValue = new Matrix(sizeVars.M, sizeVars.N);
        const output = new Matrix(sizeVars.M, sizeVars.N);
        return inputs => {
            const curValue = inputs[0]!;
            const shimmerAmt = inputs[1]!;
            if (!Matrix_equals(oldValue, curValue)) {
                Matrix_copyFrom(oldValue, curValue);
                Matrix_copyFrom(output, curValue)
                Matrix_applyBinary(output, (val, amt) => val + (Math.random() - .5) * val * amt, shimmerAmt);
            }
            return output;
        }
    }
}

export enum IntegratorMode {
    SATURATE,
    WRAP,
    PINGPONG
}

export enum SampleMode {
    ACCUMULATOR = 0,
    TIME_DEPENDENT = 1
}

export class Integrator extends AudioProcessorFactory {
    name = "integrate";
    getInputs = () => [
        {
            name: "derivative",
            dims: ["M", "N"] as Dimensions,
            default: 0,
        },
        {
            name: "reset",
            dims: ["M", "N"] as Dimensions,
            default: 0,
        },
        {
            name: "resetTo",
            dims: ["M", "N"] as Dimensions,
            default: 0,
        },
        {
            name: "mode",
            dims: ["M", "N"] as Dimensions,
            default: IntegratorMode.WRAP,
        },
        {
            name: "low",
            dims: ["M", "N"] as Dimensions,
            default: -Infinity,
        },
        {
            name: "high",
            dims: ["M", "N"] as Dimensions,
            default: Infinity,
        },
        {
            name: "sampleMode",
            dims: ["M", "N"] as Dimensions,
            default: SampleMode.TIME_DEPENDENT
        }
    ];
    getOutputDims = () => ["M", "N"] as Dimensions;

    make(synth: Synth, sizeVars: { M: number, N: number }): AudioProcessor {
        const m_accumulator = new Matrix(sizeVars.M, sizeVars.N), m_signs = Matrix_smear_i(Matrix_fromScalar(1), sizeVars.M, sizeVars.N), m_prevReset = new Matrix(sizeVars.M, sizeVars.N);
        const argArray = new Array(7).fill(0);
        return inputs => {
            return Matrix_applyMulti(m_accumulator, (i, [diff, reset, resetTo, mode, low, high, sampleMode], row, col) => {
                const sign = Matrix_get(m_signs, row, col),
                    prevReset = Matrix_get(m_prevReset, row, col),
                    bound = abs(high - low);
                // do the integration
                i += diff * (sampleMode ? 1 : synth.dt) * sign;
                // handle wrapping or stuff
                var newSign = sign;
                switch (mode) {
                    case IntegratorMode.SATURATE:
                        if (i > high) i = high;
                        if (i < low) i = low;
                        newSign = 1;
                        break;
                    case IntegratorMode.PINGPONG:
                        while (i > high || i < low) {
                            if (i > high) { i = high - (i - high); newSign = -1 };
                            if (i < low) { i = low - (i - low); newSign = 1 };
                        }
                        break;
                    case IntegratorMode.WRAP:
                    default:
                        while (i > high) i -= bound;
                        while (i < low) i += bound;
                        newSign = 1;
                        break;
                }
                Matrix_put(m_signs, row, col, newSign);
                // reset if triggered
                if (reset && !prevReset) {
                    i = resetTo;
                }
                Matrix_put(m_prevReset, row, col, reset);
                return i;
            }, inputs, argArray);
        }
    }
}

export class Clock extends AudioProcessorFactory {
    name = "clock";
    getInputs = () => [
        {
            name: "period",
            dims: ["M", "N"] as Dimensions,
            default: 1,
        },
        {
            name: "scale",
            dims: ["M", "N"] as Dimensions,
            default: 1,
        },
    ];
    getOutputDims = () => ["M", "N"] as Dimensions;
    make(synth: Synth, sizeVars: { M: number, N: number }): AudioProcessor {
        const m_accumulator = Matrix_smear_i(Matrix_fromScalar(Infinity), sizeVars.M, sizeVars.N), temp = new Matrix(sizeVars.M, sizeVars.N);
        return inputs => {
            const m_period = inputs[0]!;
            const m_scale = inputs[1]!;
            Matrix_applyUnary(m_accumulator, (t, row, col) => {
                t += synth.dt * Matrix_get(m_scale, row, col);
                var res = 0;
                if (t >= Matrix_get(m_period, row, col)) {
                    t = 0;
                    res = 1;
                }
                Matrix_put(temp, row, col, res);
                return t;
            });
            return temp;
        }
    }
}
