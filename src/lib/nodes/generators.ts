import { Matrix_fromScalar, Matrix_setScalar_i, Matrix_toScalar } from "@r47onfire/game-math";
import { AudioProcessor, AudioProcessorFactory, Dimensions, SCALAR_DIMS } from "../../compiler/nodeDef";
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
        const value = Matrix_fromScalar(0);
        return inputs => {
            var sample = 0;
            const wantedFrequency = Matrix_toScalar(inputs[0]!);
            const wave = synth.w[Matrix_toScalar(inputs[1]!)];
            const phaseMod = Matrix_toScalar(inputs[2]!);
            const aliasing = Matrix_toScalar(inputs[3]!) > 0;
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
            Matrix_setScalar_i(value, sample);
            return value;
        }
    }
}
