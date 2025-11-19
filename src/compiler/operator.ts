export const OPERATORS: Record<string, ((a: number, b: number) => number)> = {
    // interpolate and bitwise AND
    "&": (a, b) => a & b,
    // boolean NOT
    "!": a => 1 - a,
    // power
    "**": (a, b) => a ** b,
    // multiply or splat operator
    "*": (a, b) => a * b,
    // divide & modulo
    "/": (a, b) => a / b,
    "%": (a, b) => a % b,
    // add
    "+": (a, b) => a + b,
    // subtract, negate
    "-": (a, b) => a - b,
    // boolean OR / AND
    "||": (a, b) => a || b,
    "&&": (a, b) => a && b,
    // bit shifting (before other bitwise to match C)
    ">>": (a, b) => a >> b,
    "<<": (a, b) => a << b,
    // bitwise OR / XOR
    "|": (a, b) => a | b,
    "^": (a, b) => a ^ b,
    // comparison
    "==": (a, b) => +(a == b),
    ">=": (a, b) => +(a >= b),
    ">": (a, b) => +(a > b),
    "<=": (a, b) => +(a <= b),
    "<": (a, b) => +(a < b),
    "!=": (a, b) => +(a != b),
};
