import { Matrix } from "../matrix";
import { AutomatedValueMethod } from "../runtime/automation";

export enum Opcode {
    /** the index in the constant table */
    PUSH_CONSTANT,
    PUSH_INPUT_SAMPLES,
    PUSH_PITCH,
    PUSH_EXPRESSION,
    PUSH_GATE,
    DROP_TOP,
    MARK_LIVE_STATE,
    SET_MATRIX_EL,
    /** opcode */
    BINARY_OP,
    /** opcode */
    UNARY_OP,
    /** register no. */
    GET_REGISTER,
    /** register no. */
    TAP_REGISTER,
    SWAP_REGISTER,
    CONDITIONAL_SELECT,
    /** node no, argc */
    CALL_NODE_A_RATE,
    /** node no, argc */
    CALL_NODE_K_RATE,
    /** node no */
    PUSH_NODE_K_RESULT,
    /** input number, returns 0 if doesn't exist */
    GET_MOD,
    /** only used internally by compiler */
    TEMP_OPCODE_FOR_UNIFIED_CALL,
    /** only used internally by compiler */
    TEMP_OPCODE_FOR_LABEL,
}

export type Command = [Opcode, arg?: any, b?: number, c?: number];
export type Program = Command[];

export interface CompiledVoiceData {
    aCode: Program;
    kCode: Program;
    registers: Matrix[];
    constantTab: Matrix[];
    nodeNames: string[];
    mods: [name: string, initial: number, mode: AutomatedValueMethod][]
}

