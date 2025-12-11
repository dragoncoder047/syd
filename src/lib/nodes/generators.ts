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
        var phase = 0, prevIntegral = 0;
        const value = scalarMatrix(0);
        return inputs => {
            var sample = 0;
            const wantedFrequency = inputs[0]!.toScalar();
            const wave = synth.w[inputs[1]!.toScalar()];
            const phaseMod = inputs[2]!.toScalar();
            const aliasing = inputs[3]!.toScalar() > 0;
            if (wave) {
                const
                    baseFrequency = wave.b,
                    waveSampleRate = wave.r,
                    table = wave.s,
                    intTable = wave.i,
                    len = table.length;
                const pitchBendFactor = wantedFrequency / baseFrequency;
                const samplesPerSample = pitchBendFactor * synth.dt * waveSampleRate;
                phase += samplesPerSample;
                const fIndex = phase + phaseMod * waveSampleRate / baseFrequency;
                const iIndex = fIndex | 0;
                const wIndex = iIndex % len;
                if (aliasing) {
                    sample = table[wIndex]!;
                } else {
                    const alpha = fIndex - iIndex;
                    var next = intTable[wIndex]!;
                    next += (intTable[wIndex + 1]! - next) * alpha;
                    sample = next - prevIntegral;
                    prevIntegral = next;
                }
            }
            value.setScalar(sample);
            return value;
        }
    }
}
