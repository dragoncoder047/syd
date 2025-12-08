import { AudioProcessor, AudioProcessorFactory, Dimensions, NodeInputDef } from "../../compiler/nodeDef";
import { Matrix } from "../../math/matrix";
import { Synth } from "../../runtime/synth";

export class MathNode implements AudioProcessorFactory {
    name: string;
    inputs = [
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
    outputDims: Dimensions = ["M", "N"];
    constructor(operator: string, public opFunc: (a: number, b: number) => number) {
        this.name = "op" + operator;
    }
    make(synth: Synth): AudioProcessor {
        return inputs => inputs[0]!.applyBinary(this.opFunc, inputs[1]!);
    }
}

export class MixAllNode implements AudioProcessorFactory {
    name = "mixall";
    inputs = [];
    outputDims: Dimensions = [2, 1];
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
