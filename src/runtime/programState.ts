import { AudioProcessor } from "../compiler/nodeDef";
import { OPERATORS } from "../compiler/operator";
import { Opcode, Program } from "../compiler/prog";
import { Matrix } from "../matrix";
import { AutomatedValue } from "./automation";

export class ProgramState {
    stack: Matrix[] = [];
    argCache: Matrix[] = [];
    result = new Matrix;
    constructor(
        public instructions: Program,
        public registers: Matrix[],
        public nodes: AudioProcessor[],
        public constantTab: Matrix[]) { }
    run(input: Matrix, pitch: number, expression: number, gate: number, mods: AutomatedValue[], blockSize: number, alive: boolean): boolean {
        const stack = this.stack;
        const argv = this.argCache;
        const prog = this.instructions;
        const registers = this.registers;
        const constants = this.constantTab;
        const nodes = this.nodes;

        const push = (x: Matrix) => (stack[sp++] ??= new Matrix).copyFrom(x);
        const pushScalar = (x: number) => push(temp.setScalar(x));
        const pop = () => stack[--sp];
        const peek = () => stack[sp - 1];
        const temp = new Matrix(1, 1);

        var sp: number, a: Matrix, b: Matrix, c: Matrix, i: number, n: AudioProcessor, m: Matrix[];
        stack.length = argv.length = sp = 0;
        for (var pc = 0; pc < prog.length; pc++) {
            const command = prog[pc]!;
            const op = command[0];
            const i1 = command[1];
            const i2 = command[2];
            switch (op) {
                case Opcode.PUSH_CONSTANT:
                    push(constants[i1]!);
                    break;
                case Opcode.PUSH_INPUT_SAMPLES:
                    push(input);
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
                    alive = i1;
                    push(temp.setScalar(0));
                    break;
                case Opcode.SET_MATRIX_EL:
                    i = pop()!.toScalar();
                    peek()!.put(i1, i2!, i);
                    break;
                case Opcode.BINARY_OP:
                    a = pop()!;
                    peek()!.applyBinary(OPERATORS[i1]!.cb!, a);
                    break;
                case Opcode.UNARY_OP:
                    peek()!.applyUnary(OPERATORS[i1]!.cu!);
                    break;
                case Opcode.GET_REGISTER:
                    push(registers[i1]!);
                    break;
                case Opcode.TAP_REGISTER:
                    registers[i1]!.copyFrom(peek()!);
                    break;
                case Opcode.SWAP_REGISTER:
                    temp.copyFrom(pop()!);
                    push(registers[i1]!);
                    registers[i1]!.copyFrom(temp);
                    break;
                case Opcode.CONDITIONAL_SELECT:
                    a = pop()!;
                    b = pop()!;
                    c = pop()!;
                    push(c.toScalar() ? b : a);
                    break;
                case Opcode.CALL_NODE_A_RATE:
                    for (i = 0; i < i2!; i++) (argv[i2! - i - 1] ??= new Matrix).copyFrom(pop()!);
                    push(nodes[i1]!.updateSample(argv));
                    break;
                case Opcode.CALL_NODE_K_RATE:
                    n = nodes[i1]!;
                    for (i = 0; i < i2!; i++) (argv[i2! - i - 1] ??= new Matrix()).copyFrom(pop()!);
                    m = n.updateControl?.(argv, blockSize) ?? argv.slice(0, i2);
                    if (n.kNext) {
                        for (i = 0; i < m.length; i++) {
                            n.kPrev![i]!.copyFrom(n.kNext![i]!);
                            n.kNext![i]!.copyFrom(m[i]!);
                        }
                    }
                    else {
                        n.kNext = m.map(m => m.clone());
                        n.kPrev = m.map(m => m.clone());
                        n.kCur = m.map(m => m.clone());
                    }
                    break;
                case Opcode.PUSH_NODE_K_RESULT:
                    push(nodes[i1]!.kCur![0]!);
                    break;
                case Opcode.GET_MOD:
                    pushScalar(mods[i1]?.value ?? 0);
                    break;
                default:
                    throw new Error(`unimplemented opcode ${Opcode[op]} snuck in...`);
            }
        }
        this.result.copyFrom(pop()!);
        return alive;
    }
}
