
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
    SMEAR_MATRIX,
    /** register no. */
    GET_REGISTER,
    /** register no. */
    TAP_REGISTER,
    CALL_NODE,
    /** input number, returns 0 if doesn't exist */
    GET_MOD
}

export type Command = [Opcode, a?: number | string, b?: number];
export type Program = Command[];
