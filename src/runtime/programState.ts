import { AudioProcessor } from "../compiler/nodeDef";
import { Matrix } from "../matrix";
import { Opcode, Program } from "./program";

export class ProgramState {
    stack: Matrix[] = [];
    argCache: Matrix[] = [];
    result = new Matrix;
    constructor(
        public instructions: Program,
        public registers: Matrix[],
        public nodes: AudioProcessor[],
        public constantTab: Matrix[]) { }
    run(input: Matrix, pitch: number, expression: number, gate: number, mods: Record<string, number>, isStartOfBlock: boolean, blockProgress: number, alive: boolean): boolean {
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

        var sp = 0, i: number;
        for (var pc = 0; pc < prog.length; pc++) {
            const command = prog[pc]!;
            const op = command[0];
            const i1 = command[1]! as number;
            const i2 = command[2]!;
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
                    alive = !!peek()!.toScalar();
                    break;
                case Opcode.SMEAR_MATRIX:
                    peek()!.smear(i1, i2);
                    break;
                case Opcode.SET_MATRIX_EL:
                    i = pop()!.toScalar();
                    peek()!.put(i1, i2!, i);
                    break;
                case Opcode.GET_REGISTER:
                    push(registers[i1]!);
                    break;
                case Opcode.TAP_REGISTER:
                    registers[i1]!.copyFrom(peek()!);
                    break;
                case Opcode.CALL_NODE:
                    for (i = 0; i < i2!; i++) (argv[i2! - i - 1] ??= new Matrix).copyFrom(pop()!);
                    push(nodes[i1]!(argv, isStartOfBlock, blockProgress));
                    break;
                case Opcode.GET_MOD:
                    pushScalar(mods[i1] ?? 0);
                    break;
                default:
                    throw new Error(`unimplemented opcode ${Opcode[op]} snuck in...`);
            }
        }
        this.result.copyFrom(pop()!);
        return alive;
    }
}
