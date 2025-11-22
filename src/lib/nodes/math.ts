import { AudioProcessor, AudioProcessorFactory, Dimensions } from "../../compiler/nodeDef";
import { WorkletSynth } from "../../runtime/synthImpl";

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
    make(synth: WorkletSynth): AudioProcessor {
        return inputs => inputs[0]!.applyBinary(this.opFunc, inputs[1]!);
    }
}
