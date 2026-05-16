import { Matrix, Matrix_applyBinary, Matrix_fill_i } from "@r47onfire/game-math";
import { add } from "lib0/math";
import { AudioProcessor, AudioProcessorFactory, Dimensions } from "../../compiler/nodeDef";
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
        return inputs => Matrix_applyBinary(inputs[0]!, this.opFunc, inputs[1]!);
    }
}

export class MixAllNode extends AudioProcessorFactory {
    name = "mixall";
    getInputs = () => [];
    getOutputDims = () => [2, 1] as Dimensions;
    make(synth: Synth): AudioProcessor {
        const sum = new Matrix(2, 1);
        return _ => {
            Matrix_fill_i(sum, 0);
            for (var i = 0; i < synth.i.length; i++) {
                Matrix_applyBinary(sum, add, synth.c.get(synth.i[i]!.ocn));
            }
            return sum;
        }
    }
}
