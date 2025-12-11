
export enum Opcode {
    /** the index in the constant table */
    PUSH_CONSTANT = "PUSH_CONSTANT",
    PUSH_PITCH = "PUSH_PITCH",
    PUSH_EXPRESSION = "PUSH_EXPRESSION",
    PUSH_GATE = "PUSH_GATE",
    DROP_TOP = "DROP_TOP",
    MARK_LIVE_STATE = "MARK_LIVE_STATE",
    SET_MATRIX_EL = "SET_MATRIX_EL",
    SMEAR_MATRIX = "SMEAR_MATRIX",
    GET_REGISTER = "GET_REGISTER",
    TAP_REGISTER = "TAP_REGISTER",
    CALL_NODE = "CALL_NODE",
    GET_CHANNEL = "GET_CHANNEL",
    MAYBE_STORE_TO_CHANNEL = "MAYBE_STORE_NUMBER_TO_CHANNEL",
    PUSH_WAVE_NUMBER = "PUSH_WAVE_NUMBER",
}

export type Command = [Opcode, a?: number | string, b?: number];
export type Program = Command[];
