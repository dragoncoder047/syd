import { AudioProcessor, AudioProcessorFactory, Dimensions } from "../../compiler/nodeDef";
import { abs } from "../../math";
import { Matrix, scalarMatrix } from "../../matrix";
import { WorkletSynth } from "../../runtime/synthImpl";

export class Shimmer implements AudioProcessorFactory {
    name = "shimmer";
    inputs = [
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
    outputDims: Dimensions = ["M", "N"];
    make(synth: WorkletSynth, sizeVars: { M: number, N: number }): AudioProcessor {
        const oldValue = new Matrix(sizeVars.M, sizeVars.N);
        const output = new Matrix(sizeVars.M, sizeVars.N);
        return inputs => {
            const curValue = inputs[0]!;
            const shimmerAmt = inputs[1]!;
            if (!oldValue.equals(curValue)) {
                oldValue.copyFrom(curValue);
                output.copyFrom(curValue).applyBinary((val, amt) => val + (Math.random() - .5) * val * amt, shimmerAmt);
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

export class Integrator implements AudioProcessorFactory {
    name = "integrate";
    inputs = [
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
    outputDims: Dimensions = ["M", "N"];

    make(synth: WorkletSynth, sizeVars: { M: number, N: number }): AudioProcessor {
        const m_accumulator = new Matrix(sizeVars.M, sizeVars.N), m_signs = scalarMatrix(1).smear(sizeVars.M, sizeVars.N), m_prevReset = new Matrix(sizeVars.M, sizeVars.N);
        return inputs => {
            const m_diff = inputs[0]!,
                m_reset = inputs[1]!,
                m_resetTo = inputs[2]!,
                m_mode = inputs[3]!,
                m_low = inputs[4]!,
                m_high = inputs[5]!,
                m_sampleMode = inputs[6]!;
            return m_accumulator.applyUnary((i, row, col) => {
                const diff = m_diff.get(row, col),
                    reset = m_reset.get(row, col),
                    resetTo = m_resetTo.get(row, col),
                    mode = m_mode.get(row, col) as IntegratorMode,
                    low = m_low.get(row, col),
                    high = m_high.get(row, col),
                    sampleMode = m_sampleMode.get(row, col) as SampleMode,
                    sign = m_signs.get(row, col),
                    prevReset = m_prevReset.get(row, col),
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
                m_signs.put(row, col, newSign);
                // reset if triggered
                if (reset && !prevReset) {
                    i = resetTo;
                }
                m_prevReset.put(row, col, reset);
                return i;
            });
        }
    }
}

export class Clock implements AudioProcessorFactory {
    name = "clock";
    inputs = [
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
    outputDims: Dimensions = ["M", "N"];
    make(synth: WorkletSynth, sizeVars: { M: number, N: number }): AudioProcessor {
        const m_accumulator = scalarMatrix(Infinity).smear(sizeVars.M, sizeVars.N), temp = new Matrix(sizeVars.M, sizeVars.N);
        return inputs => {
            const m_period = inputs[0]!;
            const m_scale = inputs[1]!;
            m_accumulator.applyUnary((t, row, col) => {
                t += synth.dt * m_scale.get(row, col);
                var res = 0;
                if (t >= m_period.get(row, col)) {
                    t = 0;
                    res = 1;
                }
                temp.put(row, col, res);
                return t;
            });
            return temp;
        }
    }
}
