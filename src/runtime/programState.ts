import { AudioProcessor } from "../compiler/nodeDef";
import { Matrix } from "../matrix";
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

        const push = (x: Matrix) => (stack[sp++] ??= new Matrix).copyFrom(x);
        const pushScalar = (x: number) => push(temp.setScalar(x));
        const pop = () => stack[--sp];
        const peek = () => stack[sp - 1];
        const temp = new Matrix(1, 1);

        var sp = 0, i: number;
        for (var pc = 0; pc < prog.length; pc++) {
            const [op, i1, i2] = prog[pc]!;
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
                    alive = !!peek()!.toScalar();
                    break;
                case Opcode.SMEAR_MATRIX:
                    peek()!.smear(i1 as number, i2!);
                    break;
                case Opcode.SET_MATRIX_EL:
                    i = pop()!.toScalar();
                    peek()!.put(i1 as number, i2!, i);
                    break;
                case Opcode.GET_REGISTER:
                    push(registers[i1 as number]!);
                    break;
                case Opcode.TAP_REGISTER:
                    registers[i1 as number]!.copyFrom(peek()!);
                    break;
                case Opcode.CALL_NODE:
                    for (i = 0; i < i2!; i++) (argv[i2! - i - 1] ??= new Matrix).copyFrom(pop()!);
                    push(nodes[i1 as number]!(argv, isStartOfBlock, blockProgress));
                    break;
                case Opcode.GET_CHANNEL:
                    push(channels.get(i1 as string));
                    break;
                case Opcode.MAYBE_STORE_TO_CHANNEL:
                    var a = pop()!, b = peek()!;
                    if (a.toScalar() > 0) channels.put(i1 as string, b);
                    break;
                case Opcode.PUSH_WAVE_NUMBER:
                    pushScalar(wavenames[i1 as string]!);
                    break;
                default:
                    throw new Error(`unimplemented opcode ${Opcode[op]} snuck in...`);
            }
        }
        outSample.copyFrom(pop()!);
        if (outSample.rows !== 2 && outSample.cols !== 1) outSample.smear(2, 1);
        return alive;
    }
}
