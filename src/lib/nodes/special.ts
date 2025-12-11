import { AudioProcessorFactory, CompilerCtx, Dimensions, NodeArgs, NodeInputDef, SCALAR_DIMS } from "../../compiler/nodeDef";
import { NodeInput } from "../../graph/types";
import { Matrix } from "../../math/matrix";
import { Opcode, Program } from "../../runtime/program";

export class BuildMatrix extends AudioProcessorFactory {
    name = "matrix";
    getInputs(args: NodeArgs): NodeInputDef[] {
        const rows = args[0] as number;
        const cols = args[1] as number;
        const defs: NodeInputDef[] = [];
        for (var i = 0; i < rows; i++) {
            for (var j = 0; j < cols; j++) {
                defs.push({
                    name: `element ${i},${j}`,
                    dims: SCALAR_DIMS,
                    default: 0
                });
            }
        }
        return defs;
    }
    getOutputDims(args: NodeArgs): Dimensions {
        return args as Dimensions;
    }
    eager = false;
    value = () => null;
    compile(
        myNodeNo: number,
        args: NodeArgs,
        subnodes: NodeInput[],
        computedDefaults: number[],
        program: Program,
        compiler: CompilerCtx
    ) {
        const rows = args[0] as number;
        const cols = args[1] as number;
        const myMat = new Matrix(rows, cols);
        compiler.pushConstant(myMat, true);
        for (var i = 0; i < rows; i++) {
            for (var j = 0; j < cols; j++) {
                const index = j + i * cols;
                const val = compiler.value(subnodes[index]!);
                if (val !== null) {
                    myMat.put(i, j, val.toScalar());
                } else {
                    compiler.compile(subnodes[index]!, index, myNodeNo, computedDefaults[index]!);
                    program.push([Opcode.SET_MATRIX_EL, i, j]);
                }
            }
        }
    }
    make = () => { throw new Error("unreachable"); };
}
