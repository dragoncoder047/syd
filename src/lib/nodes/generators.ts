import { AudioProcessor, AudioProcessorFactory, Dimensions } from "../../compiler/nodeDef";
import { fract } from "../../math";
import { scalarMatrix } from "../../matrix";
import { Wave, WorkletSynth } from "../../runtime/synthImpl";


export class WavetableOscillator implements AudioProcessorFactory {
    name = "osc";
    description = "A wavetable oscillator, which plays back a list of samples on loop, pitch-shifted to produce the right note. Basically an arbitrary function generator. If the wavetable was loaded as a sample, the basePitch is used. If no basePitch was provided the sample is interpreted as one complete cycle of the wave."
    inputs = [
        {
            name: "frequency",
            unit: "Hz",
            dims: [1, 1] as Dimensions,
            range: [0, 20000] as any
        },
        {
            name: "wave",
            description: "The index of the wave returned by the wave-loading function.",
            dims: [1, 1] as Dimensions,
        },
        {
            name: "phase",
            description: "Phase offset, useful for FM",
            unit: "cycles (NOT radians)!",
            dims: [1, 1] as Dimensions,
        },
        {
            name: "aliasing",
            description: "When off (the default), antiderivative antialiasing is applied to the wave to reduce distortion at high frequencies. When on, samples are output verbatim (which is what you want for true samples).",
            default: 0,
            dims: [1, 1] as Dimensions,
            unit: "boolean",
            constantOptions: {
                on: 1,
                off: 0,
            }
        }
    ];
    outputDims: Dimensions = [1, 1];
    make(synth: WorkletSynth): AudioProcessor {
        var phase = 0, prev: number;
        const value = scalarMatrix(0);
        return inputs => {
            var sample = 0;
            const wantedFrequency = inputs[0]!.toScalar();
            const wave = synth.waves[inputs[1]!.toScalar()];
            const phaseMod = inputs[2]!.toScalar();
            const aliasing = inputs[3]!.toScalar() > 0;
            if (wave) {
                const baseFrequency = wave.basePitch;
                const loopsPerSecond = wantedFrequency / baseFrequency;
                const loopsPerSample = loopsPerSecond * synth.dt;
                phase = fract(phase + loopsPerSample);
                const fIndex = fract(phase + phaseMod) * wave.integral.length;
                if (aliasing) {
                    sample = wave.samples[fIndex | 0]!;
                } else {
                    const iIndex = fIndex | 0;
                    const alpha = fIndex - iIndex;
                    var next = wave.integral[iIndex]!;
                    next += (wave.integral[iIndex + 1]! - next) * alpha;
                    sample = next - prev;
                    next = prev;
                }
            }
            value.setScalar(sample);
            return value;

        }
    }
}
