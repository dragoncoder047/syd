import { AudioProcessor, AudioProcessorFactory, Dimensions } from "../../compiler/nodeDef";
import { fract } from "../../math";
import { scalarMatrix } from "../../matrix";
import { WorkletSynth } from "../../runtime/synthImpl";


export class WavetableOscillator implements AudioProcessorFactory {
    name = "osc";
    inputs = [
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
    outputDims: Dimensions = [1, 1];
    make(synth: WorkletSynth): AudioProcessor {
        // TODO: rewrite this so that phase is sample number not 0-1 fuzzy loop index
        // that way, precision will not be lost and later I can add advanced loop controls and stuff
        var phase = 0, prev: number;
        const value = scalarMatrix(0);
        return inputs => {
            var sample = 0;
            const wantedFrequency = inputs[0]!.toScalar();
            const wave = synth.w[inputs[1]!.toScalar()];
            const phaseMod = inputs[2]!.toScalar();
            const aliasing = inputs[3]!.toScalar() > 0;
            if (wave) {
                const baseFrequency = wave.b;
                const loopsPerSecond = wantedFrequency / baseFrequency;
                const loopsPerSample = loopsPerSecond * synth.dt;
                phase = fract(phase + loopsPerSample);
                const fIndex = fract(phase + phaseMod) * wave.i.length;
                const iIndex = fIndex | 0;
                if (aliasing) {
                    sample = wave.s[iIndex]!;
                } else {
                    const alpha = fIndex - iIndex;
                    var next = wave.i[iIndex]!;
                    next += (wave.i[iIndex + 1]! - next) * alpha;
                    sample = next - prev;
                    next = prev;
                }
            }
            value.setScalar(sample);
            return value;

        }
    }
}
