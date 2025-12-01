
export enum Opcode {
    /** the index in the constant table */
    PUSH_CONSTANT,
    PUSH_PITCH,
    PUSH_EXPRESSION,
    PUSH_GATE,
    DROP_TOP,
    MARK_LIVE_STATE,
    SET_MATRIX_EL,
    SMEAR_MATRIX,
    GET_REGISTER,
    TAP_REGISTER,
    CALL_NODE,
    GET_CHANNEL,
    MAYBE_STORE_TO_CHANNEL,
    PUSH_WAVE_NUMBER,
}

export type Command = [Opcode, a?: number | string, b?: number];
export type Program = Command[];
