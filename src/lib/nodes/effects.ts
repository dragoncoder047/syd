import { AudioProcessor, AudioProcessorFactory, Rate } from "../../compiler/nodeDef";
import { TAU, cos as cosine, sin, sqrt, tan } from "../../math";
import { Matrix, scalarMatrix } from "../../matrix";
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
            rate: Rate.A_RATE,
            dims: "Nx1"
        },
        {
            name: "cutoff",
            rate: Rate.K_RATE,
            range: [0, 10000] as any,
            unit: "Hz",
            dims: "1x1"
        },
        {
            name: "resonance",
            rate: Rate.K_RATE,
            default: scalarMatrix(2),
            range: [0, 100] as any,
            description: "Affects the resonance of the filter. 1 means no resonance, >1 causes the filter to emphasize frequencies around the cutoff point, <1 causes the stopband slope to decrease and flatten. The default is 2 to match ZzFX's filter parameter.",
            dims: "1x1"
        },
        {
            name: "kind",
            rate: Rate.K_RATE,
            description: "Selects what band the filter will process. A low-pass filter dampens frequencies higher than the cutoff, making the sound more muffled. A high-pass filter dampens frequencies below the cutoff, making the sound more tinny. A peak filter enhances or dampens frequencies close to the cutoff, adding or suppressing shrieks at that point.",
            dims: "1x1",
            constantOptions: {
                lowpass: scalarMatrix(FilterType.LOWPASS),
                highpass: scalarMatrix(FilterType.HIGHPASS),
                peak: scalarMatrix(FilterType.PEAK),
            }
        }
    ];
    outputRate = Rate.A_RATE;
    outputDims = "Nx1";
    make(synth: WorkletSynth): AudioProcessor {
        var x2 = new Matrix, x1 = new Matrix, y2 = new Matrix, y1 = new Matrix;
        var ch = 1;
        const coefficients = new Matrix(3, 2), cData = coefficients.data;
        cData[0]! = 1; // a0 not used, but for completeness
        return {
            updateControl(controls) {
                const cutoff = controls[0]!.toScalar();
                const resonance = controls[1]!.toScalar();
                const kind = controls[2]!.toScalar() as FilterType;
                const cornerRadiansPerSample = TAU * cutoff * synth.dt;
                var alpha, a0, a1, a2, b0, b1, b2, sign, sqrtGain, bandwidth;
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
                    default:
                        // peak
                        sqrtGain = sqrt(resonance);
                        bandwidth = cornerRadiansPerSample / (sqrtGain < 1 ? 1 / sqrtGain : sqrtGain);
                        alpha = tan(bandwidth / 2);
                        a0 = 1 + alpha / sqrtGain;
                        b0 = (1 + alpha * sqrtGain) / a0;
                        b1 = a1 = -2 * cos / a0;
                        b2 = (1 - alpha * sqrtGain) / a0;
                        a2 = (1.0 - alpha / sqrtGain) / a0;
                }
                cData[1] = b0;
                cData[2] = a1;
                cData[3] = b1;
                cData[4] = a2;
                cData[5] = b2;
                return [coefficients];
            },
            updateSample(inputs) {
                const samples = inputs[0]!.asColumn();
                if (ch != samples.rows) {
                    const temp = new Matrix;
                    for (var s of [x2, x1, y2, y1]) {
                        temp.copyFrom(s);
                        s.resize(ch, 1);
                        if (ch >= samples.rows) temp.paste(0, 0, s);
                        else samples.cut(0, 0, temp);
                    }
                    ch = samples.rows;
                }
                const params = this.kCur![0]!.data;
                const b0 = params[1]!,
                    a1 = params[2]!,
                    b1 = params[3]!,
                    a2 = params[4]!,
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
};

export class Bitcrusher implements AudioProcessorFactory {
    name = "bitcrusher";
    description = "The classic low-fidelity effect produced by resampling the audio at a lower sample rate. Called 'frequency crush' in BeepBox.";
    inputs = [
        {
            name: "sample",
            rate: Rate.A_RATE,
            dims: "MxN",
        },
        {
            name: "newSampleRate",
            rate: Rate.K_RATE,
            range: [1, 48000] as any,
            unit: "Hz",
            dims: "1x1",
        }
    ];
    outputRate = Rate.A_RATE;
    outputDims = "MxN";
    make(synth: WorkletSynth): AudioProcessor {
        var phase = 1, last: Matrix;
        return {
            updateSample(inputs) {
                phase += this.kCur![0]!.toScalar() * synth.dt;
                if (phase >= 1) {
                    phase -= (phase | 0);
                    last.copyFrom(inputs[0]!);
                }
                return last;
            },
        }
    }
}

export class DelayLine implements AudioProcessorFactory {
    name = "delay";
    description = "Singular delay line. No self-feedback or interpolation between samples.";
    inputs = [
        {
            name: "sample",
            rate: Rate.A_RATE,
            dims: "Nx1",
        },
        {
            name: "delayTime",
            rate: Rate.K_RATE,
            range: [0, 100] as any,
            unit: "seconds",
            description: "How long to delay the sample for. Changing this mid-delay will effectively pitch-shift the buffered samples. If this input is a vector, the output matrix will be rows of each sample delayed by the time specified here.",
            dims: "Mx1"
        }
    ];
    outputRate = Rate.A_RATE;
    outputDims = "NxM";
    make(synth: WorkletSynth): AudioProcessor {
        // buffer: each column is a delay line for the channel
        var buffer = new Matrix(1 << 14, 1);
        var pos = 0;
        // out: each row is the input channel, each column is the channel delayed by amount
        const outTmp = new Matrix(2, 1);
        const maybeResize = (delaySamples: number) => {
            if (buffer.rows > delaySamples) return;
            const c = buffer.cols;
            const numEl = buffer.rows * c;
            const newLen = buffer.rows << 1;
            const newBuffer = new Matrix(newLen, c);
            // layout:
            //    ->  ->   v delay ->  v pos -> v wrap delay  ->
            // [--<--<--<--'---<-<<----'.-------'---<------<---<---]
            //                          ^ last entry about to be overwritten is where the new entries go in
            newBuffer.data.set(buffer.data);
            newBuffer.data.copyWithin(pos * c + numEl, pos * c, numEl);
        };
        return {
            updateSample(inputs) {
                const inSamples = inputs[0]!.asColumn();
                if (inSamples.rows > buffer.cols) {
                    // resize number of columns
                    const newBuffer = new Matrix(buffer.rows, inSamples.rows);
                    buffer.paste(0, 0, newBuffer);
                    buffer = newBuffer;
                }
                const delays = this.kCur![0]!.asColumn().data;
                outTmp.resize(inSamples.rows, delays.length);
                var mask = buffer.rows - 1;
                for (var delayI = 0; delayI < delays.length; delayI++) {
                    const delaySamples = delays[delayI]! / synth.dt;
                    const di0 = delaySamples | 0;
                    const di1 = di0 + 1;
                    const alpha = delaySamples - di0;
                    maybeResize(di1);
                    const len = buffer.rows;
                    mask = len - 1;
                    for (var sampleI = 0; sampleI < inSamples.rows; sampleI++) {
                        // linear interpolation between samples
                        const s0 = buffer.get((pos + len - di0) & mask, sampleI);
                        const s1 = buffer.get((pos + len - di1) & mask, sampleI);
                        outTmp.put(sampleI, delayI, s0 * (1 - alpha) + s1 * alpha);
                        buffer.put(pos, sampleI, inSamples.get(sampleI, 1));
                    }
                }
                pos = (pos + 1) & mask;
                return outTmp;
            },
        }
    }
}
