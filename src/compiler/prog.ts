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
    /** register no. */
    GET_REGISTER,
    /** register no. */
    TAP_REGISTER,
    CONDITIONAL_SELECT,
    CALL_NODE,
    /** input number, returns 0 if doesn't exist */
    GET_MOD,
}

export type Command = [Opcode, a?: number, b?: number];
export type Program = Command[];

export interface CompiledGraph {
    code: Program;
    registers: Matrix[];
    constantTab: Matrix[];
    nodes: [type: string, dimVars: Record<string, number>][];
    mods: [name: string, initial: number, mode: AutomatedValueMethod][];
}

