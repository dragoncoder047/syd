import { AudioProcessor, AudioProcessorFactory, Dimensions, Range } from "../../compiler/nodeDef";
import { abs } from "../../math";
import { Matrix, scalarMatrix } from "../../matrix";
import { WorkletSynth } from "../../runtime/synthImpl";

export class Shimmer implements AudioProcessorFactory {
    name = "shimmer";
    description = "Each time the input value changes, perturbs it by a small amount. No noise is added.";
    inputs = [
        {
            name: "value",
            dims: ["M", "N"] as Dimensions,
            default: 0,
        },
        {
            name: "amount",
            default: .05,
            unit: "fraction of value",
            range: [0, 1] as Range,
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

enum IntegratorMode {
    SATURATE,
    WRAP,
    PINGPONG
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
            description: "When this changes from 0 to 1, the internal integrand is reset instantly to resetTo. A 1 on the very first sample triggers a reset as well.",
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
            description: "If boundaryMode is 0 (clamp), the integrand will saturate when it reaches high or low. If boundaryMode is 1 (wrap), the integrand will jump down to low when it passes high, and vice versa. If boundaryMode is 2 (pingpong) it will swap back and forth between forwards and backwards.",
            default: IntegratorMode.WRAP,
            constantOptions: {
                clamp: IntegratorMode.SATURATE,
                saturate: IntegratorMode.SATURATE,
                wrap: IntegratorMode.WRAP,
                loop: IntegratorMode.WRAP,
                pingpong: IntegratorMode.PINGPONG,
                reflect: IntegratorMode.PINGPONG,
            }
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
            description: "If sampleMode is 1 (integrate) the derivative value will be treated as a value with units, and will be scaled by the sample rate - useful when it is a continuous value varying in real units with time. If sampleMode is 0 (accumulate) the derivative value will not be scaled and will be added on every sample - this is useful in combination with the clock node to create a stepping motion.",
            dims: ["M", "N"] as Dimensions,
            default: 1,
            constantOptions: {
                integrate: 1,
                accumulate: 0,
            }
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
                    sampleMode = m_sampleMode.get(row, col),
                    sign = m_signs.get(row, col),
                    prevReset = m_prevReset.get(row, col),
                    bound = abs(high - low);
                // do the integration
                i += diff * (sampleMode ? synth.dt : 1) * sign;
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
    description = "A clock, that counts time internally and outputs 1 when the timer rolls over, and 0 otherwise.";
    inputs = [
        {
            name: "period",
            unit: "seconds",
            dims: ["M", "N"] as Dimensions,
            range: [0, Infinity] as Range,
            default: 1,
            description: "The interval which the clock should roll over at. If this is suddenly lowered, the clock may immediately roll over if the internal counter was less than the old period, but now greater than the new period."
        },
        {
            name: "scale",
            unit: "seconds per second",
            dims: ["M", "N"] as Dimensions,
            range: [0, Infinity] as Range,
            default: 1,
            description: "Makes the clock run faster or slower internally. If this is suddenly increased, the clock will NOT roll over as this doesn't affect the rollover point, only how fast that point is reached."
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
