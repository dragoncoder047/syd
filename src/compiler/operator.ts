import { str } from "../utils";
import { ParseError } from "./errors";
import type { Token } from "./tokenizer";

/** constant used to note that an operator is not valid in this context (unary or binary) */
export const INVALID = -1;

class Operator {
    cb: ((this: unknown, a: any, b: any) => any) | null = null;
    cu: ((this: unknown, a: any) => any) | null = null;
    constructor(
        public b: number,
        public u: number = INVALID,
        public r: boolean = false) { }
    code(b: this["cb"], u: this["cu"] = null) {
        this.cb = b;
        this.cu = u;
        return this;
    }
}

const op: (...args: ConstructorParameters<typeof Operator>) => Operator = (b, u, r) => new Operator(b, u, r);

export const OPERATORS: Record<string, Operator> = {
    // attribute sigil
    "#!": op(INVALID, -Infinity),
    // symbol name
    ".": op(INVALID, -Infinity),
    // interpolate and bitwise AND
    "&": op(6, 0).code((a, b) => a & b),
    // length or as 0-ary pipeline placeholder (that is handled specially)
    "#": op(INVALID, 0).code(null, a => a.length),
    // boolean NOT
    "!": op(INVALID, 0).code(null, a => !a),
    // power
    "**": op(1, INVALID, true).code((a, b) => a ** b),
    // multiply or splat operator
    "*": op(3, -Infinity).code((a, b) => a * b),
    // divide & modulo
    "/": op(3).code((a, b) => a / b),
    "%": op(3).code((a, b) => a % b),
    // matrix multiply
    // or decorator to mark param or declaration as lazy/macro
    "@": op(3, -Infinity),
    // add
    "+": op(4).code((a, b) => a + b),
    // subtract, negate
    "-": op(4, 2).code((a, b) => a - b, a => -a),
    // boolean OR / AND
    "||": op(5).code((a, b) => a || b),
    "&&": op(5).code((a, b) => a && b),
    // bit shifting (before other bitwise to match C)
    ">>": op(5.9).code((a, b) => a >> b),
    "<<": op(5.9).code((a, b) => a << b),
    // bitwise OR / XOR
    "|": op(6).code((a, b) => a | b),
    "^": op(6).code((a, b) => a ^ b),
    // comparison
    "==": op(7).code((a, b) => a == b),
    ">=": op(7).code((a, b) => a >= b),
    ">": op(7).code((a, b) => a > b),
    "<=": op(7).code((a, b) => a <= b),
    "<": op(7).code((a, b) => a < b),
    "!=": op(7).code((a, b) => a != b),
    // indexing
    "->": op(8).code((a, b) => a[b]),
    // pipe
    "|>": op(9),
    // conditional in 2 parts (treated as binary and postprocessed for simplicity)
    // colon is also used for keyword arguments
    ":": op(10, INVALID, true),
    "?": op(11, INVALID, true),
    // assignment operator (no overloads and handles specially, just here so it can be parsed in the right spot)
    "=": op(12),
    // mapping operator (for inside lists)
    "=>": op(13),
    // define operator (handled specially)
    ":-": op(13),
    // statement separator
    ",": op(14).code((_, b) => b),
    ";": op(14),
};

export const OP_REGEX = new RegExp(`^(${Object.keys(OPERATORS).sort((a, b) => b.length - a.length).map(e => e.replaceAll(/([()[\]{}*+?|^$\\.])/g, "\\$1")).join("|")})`);

export function getPrecedence(token: string, unary: boolean): number {
    return OPERATORS[token]![unary ? "u" : "b"] ?? INVALID;
}

export function getPrecedenceAndCheckValidity(token: Token, isUnary: boolean): number {
    const keyOperator = token.a ? "=" : token.t;
    const realOperator = token.t + (token.a ? "=" : "")
    const mePrecedence = getPrecedence(keyOperator, isUnary);
    if (mePrecedence === INVALID) {
        throw new ParseError(`${str(realOperator)} is not valid as a ${["binary", "unary"][+isUnary]} operator`, token.s);
    }
    return mePrecedence;
}

export function isRightAssociative(token: string): boolean {
    return OPERATORS[token]!.r;
}
