import { KRateHelper } from "..";
import { AudioProcessor, AudioProcessorFactory, Dimensions, Range, SCALAR_DIMS } from "../../compiler/nodeDef";
import { TAU, cos as cosine, lerp, sin, sqrt, tan } from "../../math";
import { Matrix } from "../../matrix";
import { WorkletSynth } from "../../runtime/synthImpl";

enum FilterType {
    LOWPASS = 0,
    HIGHPASS = 1,
    PEAK = 2
}

export class Filter implements AudioProcessorFactory {
    name = "filter";
    description = "Biquad filter as implemented in BeepBox.";
    inputs = [
        {
            name: "sample",
            dims: ["N", 1] as Dimensions,
            default: 0
        },
        {
            name: "cutoff",
            range: [0, 10000] as Range,
            default: 1000,
            unit: "Hz",
            dims: SCALAR_DIMS
        },
        {
            name: "resonance",
            default: 2,
            range: [0, 100] as Range,
            description: "Affects the resonance of the filter. 1 means no resonance, >1 causes the filter to emphasize frequencies around the cutoff point, <1 causes the stopband slope to decrease and flatten. The default is 2 to match ZzFX's filter parameter.",
            dims: SCALAR_DIMS
        },
        {
            name: "kind",
            description: "Selects what band the filter will process. A low-pass filter dampens frequencies higher than the cutoff, making the sound more muffled. A high-pass filter dampens frequencies below the cutoff, making the sound more tinny. A peak filter enhances or dampens frequencies close to the cutoff, adding or suppressing shrieks at that point.",
            dims: SCALAR_DIMS,
            default: FilterType.LOWPASS,
            constantOptions: {
                lowpass: FilterType.LOWPASS,
                highpass: FilterType.HIGHPASS,
                peak: FilterType.PEAK,
            }
        }
    ];
    outputDims: Dimensions = ["N", 1];
    make(synth: WorkletSynth, sizeVars: { N: number }): AudioProcessor {
        const N = sizeVars.N;
        var x2 = new Matrix(N, 1), x1 = new Matrix(N,), y2 = new Matrix(N, 1), y1 = new Matrix(N, 1);
        var ch = 1;
        const coefficients = new KRateHelper(3, 2),
            cData = coefficients.current.data;
        cData[0]! = 1; // a0 not used, but for completeness
        return (inputs, start, progress) => {
            var alpha: number,
                a0: number,
                a1: number,
                a2: number,
                b0: number,
                b1: number,
                b2: number,
                sign: number,
                sqrtGain: number,
                bandwidth: number;
            if (start) {
                coefficients.nextBlock();
                const cutoff = inputs[1]!.toScalar();
                const resonance = inputs[2]!.toScalar();
                const kind = inputs[3]!.toScalar() as FilterType;
                const cornerRadiansPerSample = TAU * cutoff * synth.dt;
                const cos = cosine(cornerRadiansPerSample);
                switch (kind) {
                    case FilterType.LOWPASS:
                    case FilterType.HIGHPASS:
                        // low-pass and high-pass
                        alpha = sin(cornerRadiansPerSample) / 2 / resonance;
                        a0 = 1 + alpha;
                        sign = kind === FilterType.HIGHPASS ? -1 : 1;
                        a1 = -2 * cos / a0;
                        a2 = (1 - alpha) / a0;
                        b2 = b0 = (1 - cos * sign) / 2 / a0;
                        b1 = sign * 2 * b0;
                        break;
                    case FilterType.PEAK:
                        // peak
                        sqrtGain = sqrt(resonance);
                        bandwidth = cornerRadiansPerSample / (sqrtGain < 1 ? 1 / sqrtGain : sqrtGain);
                        alpha = tan(bandwidth / 2);
                        a0 = 1 + alpha / sqrtGain;
                        b0 = (1 + alpha * sqrtGain) / a0;
                        b1 = a1 = -2 * cos / a0;
                        b2 = (1 - alpha * sqrtGain) / a0;
                        a2 = (1.0 - alpha / sqrtGain) / a0;
                        break;
                    default:
                        throw new Error();
                }
                cData[1] = b0;
                cData[2] = a1;
                cData[3] = b1;
                cData[4] = a2;
                cData[5] = b2;
            }
            const samples = inputs[0]!.asColumn();
            coefficients.loadForSample(progress);
            const params = coefficients.sample.data;
            b0 = params[1]!;
            a1 = params[2]!;
            b1 = params[3]!;
            a2 = params[4]!;
            b2 = params[5]!;
            const out = samples.applyUnary((sample, channel) =>
                /** $y[n]=b_{0}x[n]+b_{1}x[n-1]+b_{2}x[n-2]-a_{1}y[n-1]-a_{2}y[n-2]$ */
                b0 * sample + b1 * x1.get(channel, 1) + b2 * x2.get(channel, 1) - a1 * y1.get(channel, 1) - a2 * y2.get(channel, 1));
            x2.copyFrom(x1);
            x1.copyFrom(samples);
            y2.copyFrom(y1);
            y1.copyFrom(out);
            return out;
        }
    }
}

export class Bitcrusher implements AudioProcessorFactory {
    name = "bitcrusher";
    description = "The classic low-fidelity effect produced by resampling the audio at a lower sample rate. Called 'frequency crush' in BeepBox.";
    inputs = [
        {
            name: "sample",
            dims: ["M", "N"] as Dimensions,
            default: 0
        },
        {
            name: "newSampleRate",
            range: [1, 48000] as Range,
            unit: "Hz",
            dims: SCALAR_DIMS,
            default: 8000,
        }
    ];
    outputDims: Dimensions = ["M", "N"];
    make(synth: WorkletSynth, sizeVars: { M: number, N: number }): AudioProcessor {
        var phase = 1, last = new Matrix(sizeVars.M, sizeVars.N);
        return inputs => {
            phase += inputs[1]!.toScalar() * synth.dt;
            if (phase >= 1) {
                phase -= (phase | 0);
                last.copyFrom(inputs[0]!);
            }
            return last;
        }
    }
}

export class DelayLine implements AudioProcessorFactory {
    name = "delay";
    description = "Singular delay line. No self-feedback or interpolation between samples.";
    inputs = [
        {
            name: "sample",
            dims: ["C", 1] as Dimensions,
            default: 0,
        },
        {
            name: "delayTime",
            range: [0, 100] as Range,
            unit: "seconds",
            description: "How long to delay the sample for. Changing this mid-delay will effectively pitch-shift the buffered samples. If this input is a vector of tap positions, the output matrix will be rows of each sample delayed by the time specified here.",
            dims: ["T", 1] as Dimensions,
            default: 1
        }
    ];
    outputDims: Dimensions = ["C", "T"];
    make(synth: WorkletSynth, sizeVars: { C: number, T: number }): AudioProcessor {
        const C = sizeVars.C, T = sizeVars.T;
        // buffer: each column is a delay line for the channel
        var buffer = new Matrix(1 << 14, C);
        var pos = 0;
        // out: each row is the input channel, each column is the channel delayed by amount
        const outTmp = new Matrix(C, T);
        return inputs => {
            const inSamples = inputs[0]!.asColumn().data;
            const delaysTaps = inputs[1]!.asColumn().data;
            var mask = buffer.rows - 1;
            for (var tapIndex = 0; tapIndex < T; tapIndex++) {
                const delaySamples = delaysTaps[tapIndex]! / synth.dt;
                const di0 = delaySamples | 0;
                const di1 = di0 + 1;
                const alpha = delaySamples - di0;
                if (buffer.rows <= di1) {
                    const numEl = buffer.rows * C;
                    const newLen = buffer.rows << 1;
                    const newBuffer = new Matrix(newLen, C);
                    // layout:
                    //    ->  ->   v delay ->  v pos -> v wrap delay  ->
                    // [--<--<--<--'---<-<<----'.-------'---<------<---<---]
                    //                          ^ last entry about to be overwritten is where the new entries go in
                    newBuffer.data.set(buffer.data);
                    newBuffer.data.copyWithin(pos * C + numEl, pos * C, numEl);
                }
                const len = buffer.rows;
                mask = len - 1;
                for (var channelNo = 0; channelNo < C; channelNo++) {
                    // linear interpolation between samples
                    const s0 = buffer.get((pos + len - di0) & mask, channelNo);
                    const s1 = buffer.get((pos + len - di1) & mask, channelNo);
                    outTmp.put(channelNo, tapIndex, lerp(s0, s1, alpha));
                    buffer.put(pos, channelNo, inSamples[channelNo]!);
                }
            }
            pos = (pos + 1) & mask;
            return outTmp;
        }
    }
}
