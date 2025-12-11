import { AudioProcessor, Dimensions, AudioProcessorFactory } from "../../compiler/nodeDef";
import { Matrix } from "../../math/matrix";
import { Synth } from "../../runtime/synth";

export class MathNode extends AudioProcessorFactory {
    name: string;
    getInputs = () => [
        {
            name: "a",
            dims: ["M", "N"] as Dimensions,
            default: 1
        },
        {
            name: "b",
            dims: ["M", "N"] as Dimensions,
            default: 1
        }
    ]
    getOutputDims=()=> ["M", "N"] as Dimensions;
    constructor(operator: string, public opFunc: (a: number, b: number) => number) {
        super();
        this.name = "op" + operator;
    }
    make(synth: Synth): AudioProcessor {
        return inputs => inputs[0]!.applyBinary(this.opFunc, inputs[1]!);
    }
}

export class MixAllNode extends AudioProcessorFactory {
    name = "mixall";
    getInputs = () => [];
    getOutputDims = () => [2, 1] as Dimensions;
    make(synth: Synth): AudioProcessor {
        const sum = new Matrix(2, 1);
        return _ => {
            sum.fill(0);
            for (var i = 0; i < synth.i.length; i++) {
                sum.applyBinary((x, y) => x + y, synth.c.get(synth.i[i]!.ocn));
            }
            return sum;
        }
    }
}
