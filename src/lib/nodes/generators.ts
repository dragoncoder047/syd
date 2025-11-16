import { AudioProcessor, AudioProcessorFactory, Rate } from "../../compiler/nodeDef";
import { fract } from "../../math";
import { scalarMatrix } from "../../matrix";
import { Wave, WorkletSynth } from "../../runtime/synthImpl";


export class WavetableOscillator implements AudioProcessorFactory {
    name = "osc";
    description = "A wavetable oscillator, which plays back a list of samples on loop, pitch-shifted to produce the right note. Basically an arbitrary function generator If the wavetable was loaded as a sample, the basePitch is used. If no basePitch was provided the sample is interpreted as one complete cycle of the wave."
    inputs = [
        {
            name: "frequency",
            unit: "Hz",
            rate: Rate.A_RATE,
            dims: "1x1",
            range: [0, 20000] as any
        },
        {
            name: "wave",
            description: "The index of the wave returned by the wave-loading function.",
            rate: Rate.K_RATE,
            dims: "1x1"
        },
        {
            name: "phase",
            description: "Phase offset, useful for FM",
            unit: "cycles (NOT radians)!",
            rate: Rate.A_RATE,
            dims: "1x1"
        },
        {
            name: "aliasing",
            description: "When off (the default), antiderivative antialiasing is applied to the wave to reduce distortion at high frequencies. When on, samples are output verbatim (which is what you want for true samples).",
            rate: Rate.K_RATE,
            default: scalarMatrix(0),
            dims: "1x1",
            unit: "boolean",
            constantOptions: {
                on: scalarMatrix(1),
                off: scalarMatrix(0),
            }
        }
    ];
    outputRate = Rate.A_RATE;
    outputDims = "1x1";
    make(synth: WorkletSynth): AudioProcessor {
        var phase = 0, wave: Wave | undefined, aliasing = false, prev: number;
        return {
            updateControl(controlParams) {
                wave = synth.waves[controlParams[0]!.toScalar()];
                aliasing = controlParams[1]!.toScalar() != 0;
                return [];
            },
            updateSample(inputs) {
                if (!wave) return scalarMatrix(0);
                const wantedFrequency = inputs[0]!.toScalar();
                const baseFrequency = wave.basePitch;
                const loopsPerSecond = wantedFrequency / baseFrequency;
                const loopsPerSample = loopsPerSecond * synth.dt;
                const phaseMod = inputs[1]!.toScalar();
                phase += loopsPerSample;
                if (phase > 1) phase -= phase | 0;
                const fIndex = fract(phase + phaseMod) * wave.integral.length;
                if (aliasing) return scalarMatrix(wave.samples[fIndex | 0]!);
                const iIndex = fIndex | 0;
                const alpha = fIndex - iIndex;
                var next = wave.integral[iIndex]!;
                next += (wave.integral[iIndex + 1]! - next) * alpha;
                const sample = next - prev;
                next = prev;
                return scalarMatrix(sample);
            },
        }
    }
}
