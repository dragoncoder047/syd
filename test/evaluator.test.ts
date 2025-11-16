import { beforeEach, describe, expect, mock, test } from "bun:test";
import * as AST from "../src/compiler/ast";
import { LocationTrace } from "../src/compiler/errors";
import { EvalState } from "../src/compiler/evalState";
import { Rate } from "../src/compiler/nodeDef";
import { Matrix, scalarMatrix } from "../src/matrix";
import { expectEval, expectEvalError } from "./astCheck";

var dummyState: EvalState;
beforeEach(() => {
    const N = LocationTrace.nowhere;
    dummyState = {
        globalEnv: {
            a: new AST.Value(N, 1),
            b: new AST.Value(N, 2),
            c: new AST.Value(N, 3),
            d: new AST.Value(N, 4),
        },
        env: {},
        functions: [
            {
                name: "reverse3",
                argc: 3,
                async expand(args, state) {
                    const [a, b, c] = args as [AST.Node, AST.Node, AST.Node];
                    return new AST.List(c.edgemost(false).loc, [c, b, a]);
                },
            },
        ],
        nodes: [
            {
                name: "foo",
                inputs: [
                    {
                        name: "bar",
                        rate: Rate.K_RATE,
                        dims: "1x1",
                    },
                    {
                        name: "baz",
                        rate: Rate.K_RATE,
                        dims: "1x1",
                    }
                ],
                outputRate: Rate.K_RATE,
                outputDims: "1x1",
                stateless: false,
                make: () => ({
                    updateControl: () => null as any,
                    updateSample: () => scalarMatrix(1),
                }),
            },
        ],
        callstack: [],
        recursionLimit: 50,
        annotators: [],
    };
    dummyState.env = Object.create(dummyState.globalEnv);
})

describe("variables & scopes", () => {
    test("variable resolution", async () => {
        await expectEval("a", dummyState, {
            __class__: AST.Value,
            value: 1
        });
    });
    test("variable assignment", async () => {
        await expectEval("a = 111", dummyState, {
            __class__: AST.Value,
            value: 111,
        });
        await expectEval("a", dummyState, {
            __class__: AST.Value,
            value: 111
        });
    });
    test("variable assignment 2", async () => {
        await expectEval("a = foo(1, 2); a", dummyState, {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                }
            ]
        });
        await expectEval("a", dummyState, {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                }
            ]
        });
    });
    test("side effects from inside a scope", async () => {
        await expectEval("f(a) :- b += a; f(1); b", dummyState, {
            __class__: AST.Value,
            value: 3
        });
    });
    test("new inner variables that aren't parameters don't leak", async () => {
        await expectEval("f(a) :- (x = a * 2, x * a); f(10)", dummyState, {
            __class__: AST.Value,
            value: 200
        });
        await expectEval("x", dummyState, {
            __class__: AST.LateBinding,
            name: "x",
            value: undefined
        });
    });
    test("banned assignment targets", async () => {
        await expectEvalError("[a, b] = [1, 2]", dummyState, "cannot assign to this");
    });
});
describe("operations", () => {
    test("simple math", async () => {
        await expectEval("1 + 2 * 3", dummyState, {
            __class__: AST.Value,
            value: 7
        });
    });
    test("conditional elimination", async () => {
        await expectEval("1 == 1 ? a : notdefined", dummyState, {
            __class__: AST.Value,
            value: 1
        });
    });
    test("inner expressions evaluated", async () => {
        await expectEval("[1+1, 2+2, 2**(1/12)]", dummyState, {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 2
                },
                {
                    __class__: AST.Value,
                    value: 4
                },
                {
                    __class__: AST.Value,
                    value: Math.pow(2, 1 / 12),
                }
            ]
        });
    });
    test("concatenating with strings", async () => {
        await expectEval("'Hello, ' + 'World!'", dummyState, {
            __class__: AST.Value,
            value: "Hello, World!"
        });
    });
    test("list splat flattening", async () => {
        await expectEval("[1, *[2, *[3], 4]]", dummyState, {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 1
                },
                {
                    __class__: AST.Value,
                    value: 2
                },
                {
                    __class__: AST.Value,
                    value: 3
                },
                {
                    __class__: AST.Value,
                    value: 4
                }
            ]
        });
    });
    test("pipe constant folding", async () => {
        await expectEval("100 + 245 |> (# + # + 'abc' + #)", dummyState, {
            __class__: AST.Value,
            value: "690abc345"
        });
    });
    test("length constant folding for a constant length list", async () => {
        await expectEval("1 |> (#[a, #b]+#)", dummyState, {
            __class__: AST.Value,
            value: 3
        });
    });
    test("length constant folding for a constant length list with splats", async () => {
        await expectEval("1 |> (#[a, *[1, 2, 3]]+#)", dummyState, {
            __class__: AST.Value,
            value: 5
        });
    });
    test("no length constant folding for a list with unfoldable splats in it", async () => {
        await expectEval("#[1, *a]", dummyState, {
            __class__: AST.UnaryOp,
            op: "#",
            value: {
                __class__: AST.List,
                values: [
                    {
                        __class__: AST.Value,
                        value: 1,
                    },
                    {
                        __class__: AST.SplatValue,
                        value: {
                            __class__: AST.Value,
                            value: 1
                        }
                    }
                ]
            }
        });
    });
    test("folding immediate lists", async () => {
        await expectEval("#[1, *[*a, 1]]", dummyState, {
            __class__: AST.UnaryOp,
            op: "#",
            value: {
                __class__: AST.List,
                values: [
                    {
                        __class__: AST.Value,
                        value: 1,
                    },
                    {
                        __class__: AST.SplatValue,
                        value: {
                            __class__: AST.Value,
                            value: 1
                        }
                    },
                    {
                        __class__: AST.Value,
                        value: 1,
                    },
                ]
            }
        });
    });
    test("matrix multiply", async () => {
        await expectEval("[[1, 2, 3]] @ [[1, 2], [3, 4], [5, 6]]", dummyState, {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.List,
                    values: [
                        {
                            __class__: AST.Value,
                            value: 22
                        },
                        {
                            __class__: AST.Value,
                            value: 28
                        }
                    ]
                }
            ]
        });
    });
    test("indexing list", async () => {
        await expectEval("[1, 2, 3]->a", dummyState, {
            __class__: AST.Value,
            value: 2
        });
    });
    test("indexing matrix", async () => {
        await expectEval("[[1, 2, 3], [4, 5, 6]]->a->b", dummyState, {
            __class__: AST.Value,
            value: 6
        });
    });
    test("indexing mapping", async () => {
        await expectEval("[.foo => 1, .bar => 3]->.foo", dummyState, {
            __class__: AST.Value,
            value: 1
        });
    });
});
describe("name resolution", () => {
    test("looking up node names", async () => {
        await expectEval("foo(1, b)", dummyState, {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Value,
                    value: 1
                },
                {
                    __class__: AST.Value,
                    value: 2
                }
            ]
        });
    });
    test("node key params", async () => {
        await expectEval("foo(1, .opt1)", dummyState, {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2
                }
            ]
        });
    });
    test("node key no names", async () => {
        await expectEvalError("foo(.a, 1)", dummyState, "symbol constant not valid here");
        await expectEvalError("foo(1, .a)", dummyState, 'unknown symbol name "a" for parameter');
    });
    test("too few/many arguments", async () => {
        await expectEvalError("foo()", dummyState, "missing value for argument bar");
        await expectEvalError("foo(1, 2, 3)", dummyState, "too many arguments to foo");
    });
    test("looking up macros", async () => {
        await expectEval("reverse3(1, 2, 3)", dummyState, {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 3
                },
                {
                    __class__: AST.Value,
                    value: 2
                },
                {
                    __class__: AST.Value,
                    value: 1
                }
            ]
        });
    });
});
describe("templates", () => {
    test("one deep", async () => {
        await expectEval("{a, &a}", dummyState, {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Name,
                    name: "a",
                },
                {
                    __class__: AST.Value,
                    value: 1
                }
            ]
        });
    });
    test("two deep", async () => {
        await expectEval("{{&a, &(&a)}}", dummyState, {
            __class__: AST.Template,
            result: {
                __class__: AST.Block,
                body: [
                    {
                        __class__: AST.InterpolatedValue,
                        value: {
                            __class__: AST.Name,
                            name: "a",
                        }
                    },
                    {
                        __class__: AST.Value,
                        value: 1
                    }
                ]
            }
        });
    });
    test("quote and expand", async () => {
        await expectEval("quote(@code) :- code; @expand(code) :- code; foo = quote({something = a}); expand(expand(foo)); something", dummyState, {
            __class__: AST.Value,
            value: 1
        });
    });
    test("dynamic injection", async () => {
        await expectEval("@expand(code) :- code; f(formula, x) :- expand(formula); c = {x**2 + 2}; [f(c, 1), f({&c + 1}, 2), f(c, 3)]", dummyState, {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 3
                },
                {
                    __class__: AST.Value,
                    value: 7
                },
                {
                    __class__: AST.Value,
                    value: 11
                }
            ]
        });
        await expectEval("x", dummyState, {
            __class__: AST.LateBinding,
            name: "x",
            value: undefined
        });
    });
});
describe("defining functions", () => {
    test("definitions", async () => {
        await expectEval("myFun(x, y) :- (y *= 2, y + x)", dummyState, {});
        await expectEval("myFun(100, 1000)", dummyState, {
            __class__: AST.Value,
            value: 2100
        });
        await expectEval("y", dummyState, {
            __class__: AST.LateBinding,
            name: "y",
            value: undefined
        });
    });
    test("definitions with valid options", async () => {
        await expectEval("func(a: [.a => 1, .b => 2] = -1) :- a; func(.a + .a + .b)", dummyState, {
            __class__: AST.Value,
            value: 4
        });
    });
});
describe("recursion", () => {
    test("A000142 (factorial)", async () => {
        await expectEval("f(a) :- a > 1 ? a * f(a - 1) : 1; f(15)", dummyState, {
            __class__: AST.Value,
            value: 1307674368000
        });
    });
    test("A000045 (Fibonacci sequence)", async () => {
        // Takes about 1.6 seconds
        await expectEval("f(a) :- a <= 1 ? a : f(a - 1) + f(a - 2); f(28)", dummyState, {
            __class__: AST.Value,
            value: 317811
        });
    });
    test("A005185 (Hofstadter 'Q' sequence)", async () => {
        // Takes about 1.3 seconds
        await expectEval("f(a) :- a < 3 ? 1 : f(a - f(a - 1)) + f(a - f(a - 2)); f(25)", dummyState, {
            __class__: AST.Value,
            value: 14
        });
    });
    test("A063510", async () => {
        await expectEval("f(a) :- a > 1 ? f((a ** .5) | 0) + 1 : 1; f(110)", dummyState, {
            __class__: AST.Value,
            value: 4
        });
    });
    test("list expansion", async () => {
        const x = 2;
        await expectEval(`f(a, n) :- n > 0 ? [*f(a, n - 1), *f(a, n - 1)] : [a]; f(1, ${x})`, dummyState, {
            __class__: AST.List,
            values: new Array(2 ** x).fill({
                __class__: AST.Value,
                value: 1
            }),
        });
    });
    test("looping via recursion", async () => {
        const m = mock(() => ({ updateSample: () => scalarMatrix(1) }));
        dummyState.nodes.push({ name: "dummy", inputs: [{ name: "x", rate: Rate.K_RATE, dims: "1x1", }, { name: "y", rate: Rate.K_RATE, dims: "1x1", }], outputRate: Rate.K_RATE, outputDims: "1x1", make: m });
        await expectEval("@while(@cond, @body) :- {&cond ? (&body, while(&cond, &body)) : 0}; @for(@var, min, max, @body, step=1) :- {&var = &min; while(&var < &max, (&body, &var += &step))}; for(i, 0, 10, dummy())", dummyState, {
            __class__: AST.Value,
            value: 0
        });
        expect(m).toHaveBeenCalledTimes(10);
    });
    test("recursion is limited", async () => {
        await expectEvalError("f() :- f(); f()", dummyState, "too much recursion");
    });
});
describe("immediate math", () => {
    test("node with immediate math mode", async () => {
        const m = mock(() => ({ updateSample: (inputs: Matrix[]) => inputs[0]!.applyBinary((a, b) => a + b, inputs[1]!.applyUnary(Math.sqrt)) }));
        dummyState.nodes.push({ name: "dummy", inputs: [{ name: "x", rate: Rate.K_RATE, dims: "1x1", }, { name: "y", rate: Rate.K_RATE, dims: "1x1", }], outputRate: Rate.K_RATE, outputDims: "1x1", make: m });
        await expectEval("dummy(1, 2)", dummyState, {
            __class__: AST.Value,
            value: 1 + Math.sqrt(2)
        });
        expect(m).toHaveBeenCalled();
    });
});
describe("annotations", () => {
    test("annotations registered on object", async () => {
        const m = mock(async (x: AST.Node | null) => x! && new AST.Value(x.loc, (x as any).value * 2));
        dummyState.annotators.push({ name: "doubleMe", apply: m });
        await expectEval("#!doubleMe 2", dummyState, {
            __class__: AST.Value,
            value: 4
        });
        expect(m).toHaveBeenCalledTimes(1);
    });
    // TODO: more annotation checks
});
