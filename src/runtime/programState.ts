import { Matrix, Matrix_copyFrom, Matrix_put, Matrix_setScalar_i, Matrix_smear_i, Matrix_toScalar } from "@r47onfire/game-math";
import { AudioProcessor } from "../compiler/nodeDef";
import { Channels } from "./channels";
import { Opcode, Program } from "./program";

export class ProgramState {
    s: Matrix[] = [];
    a: Matrix[] = [];
    x = new Matrix;
    constructor(
        public p: Program,
        public r: Matrix[],
        public n: AudioProcessor[],
        public c: Matrix[]) { }
    run(pitch: number, expression: number, gate: number, channels: Channels, isStartOfBlock: boolean, blockProgress: number, alive: boolean, wavenames: Record<string, number>): boolean {
        const stack = this.s;
        const argv = this.a;
        const prog = this.p;
        const registers = this.r;
        const constants = this.c;
        const nodes = this.n;
        const outSample = this.x;

        const push = (x: Matrix) => Matrix_copyFrom(stack[sp++] ??= new Matrix, x);
        const pushScalar = (x: number) => push(Matrix_setScalar_i(temp, x));
        const pop = () => stack[--sp];
        const peek = () => stack[sp - 1];
        const temp = new Matrix(1, 1);

        var sp = 0, i: number;
        for (var pc = 0; pc < prog.length; pc++) {
            const inst = prog[pc]!, op = inst[0], i1 = inst[1], i2 = inst[2];
            switch (op) {
                case Opcode.PUSH_CONSTANT:
                    push(constants[i1 as number]!);
                    break;
                case Opcode.PUSH_PITCH:
                    pushScalar(pitch);
                    break;
                case Opcode.PUSH_EXPRESSION:
                    pushScalar(expression);
                    break;
                case Opcode.PUSH_GATE:
                    pushScalar(gate);
                    break;
                case Opcode.DROP_TOP:
                    pop();
                    break;
                case Opcode.MARK_LIVE_STATE:
                    alive = !!Matrix_toScalar(peek()!);
                    break;
                case Opcode.SMEAR_MATRIX:
                    Matrix_smear_i(peek()!, i1 as number, i2!);
                    break;
                case Opcode.SET_MATRIX_EL:
                    i = Matrix_toScalar(pop()!);
                    Matrix_put(peek()!, i1 as number, i2!, i);
                    break;
                case Opcode.GET_REGISTER:
                    push(registers[i1 as number]!);
                    break;
                case Opcode.TAP_REGISTER:
                    Matrix_copyFrom(registers[i1 as number]!, peek()!);
                    break;
                case Opcode.CALL_NODE:
                    for (i = 0; i < i2!; i++) Matrix_copyFrom(argv[i2! - i - 1] ??= new Matrix, pop()!);
                    push(nodes[i1 as number]!(argv, isStartOfBlock, blockProgress));
                    break;
                case Opcode.GET_CHANNEL:
                    push(channels.get(i1 as string));
                    break;
                case Opcode.MAYBE_STORE_TO_CHANNEL:
                    var a = pop()!, b = peek()!;
                    if (Matrix_toScalar(a) > 0) channels.put(i1 as string, b);
                    break;
                case Opcode.PUSH_WAVE_NUMBER:
                    pushScalar(wavenames[i1 as string]!);
                    break;
                default:
                    throw new Error(`unimplemented opcode ${Opcode[op]} snuck in...`);
            }
        }
        Matrix_copyFrom(outSample, pop()!);
        if (outSample.rows !== 2 && outSample.cols !== 1) Matrix_smear_i(outSample, 2, 1);
        return alive;
    }
}

