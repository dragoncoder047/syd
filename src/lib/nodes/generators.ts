import { AudioProcessor, Dimensions, AudioProcessorFactory, SCALAR_DIMS } from "../../compiler/nodeDef";
import { scalarMatrix } from "../../math/matrix";
import { Synth } from "../../runtime/synth";


export class WavetableOscillator extends AudioProcessorFactory {
    name = "osc";
    getInputs = () => [
        {
            name: "frequency",
            dims: [1, 1] as Dimensions,
            default: 220,
        },
        {
            name: "wave",
            dims: [1, 1] as Dimensions,
            default: 0,
        },
        {
            name: "phase",
            dims: [1, 1] as Dimensions,
            default: 0
        },
        {
            name: "aliasing",
            default: 0,
            dims: [1, 1] as Dimensions,
        }
    ];
    getOutputDims = () => SCALAR_DIMS;
    make(synth: Synth): AudioProcessor {
        var phase = 0, prevIntegral: number;
        const value = scalarMatrix(0);
        return inputs => {
            var sample = 0;
            const wantedFrequency = inputs[0]!.toScalar();
            const wave = synth.w[inputs[1]!.toScalar()];
            const phaseMod = inputs[2]!.toScalar();
            const aliasing = inputs[3]!.toScalar() > 0;
            if (wave) {
                const baseFrequency = wave.b, waveSampleRate = wave.r;
                const pitchBendFactor = wantedFrequency / baseFrequency;
                const samplesPerSample = pitchBendFactor * synth.dt * waveSampleRate;
                phase = (phase + samplesPerSample) % wave.s.length;
                const fIndex = phase + phaseMod * waveSampleRate / baseFrequency;
                const iIndex = fIndex | 0;
                if (aliasing) {
                    sample = wave.s[iIndex]!;
                } else {
                    const alpha = fIndex - iIndex;
                    var next = wave.i[iIndex]!;
                    next += (wave.i[iIndex + 1]! - next) * alpha;
                    sample = next - prevIntegral;
                    prevIntegral = next;
                }
            }
            value.setScalar(sample);
            return value;

        }
    }
}
