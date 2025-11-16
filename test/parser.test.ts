import { test } from "bun:test";
import * as AST from "../src/compiler/ast";
import { describe } from "node:test";
import { expectParse, expectParseError } from "./astCheck";

describe("parse primitive values", () => {
    test("number", async () => {
        await expectParse("123.456e+78", {
            __class__: AST.Value,
            value: 123.456e+78
        });
    });
    test("negative number", async () => {
        await expectParse("-1", {
            __class__: AST.Value,
            value: -1
        });
    });
    test("regular string", async () => {
        await expectParse('"hello!\\nworld!"', {
            __class__: AST.Value,
            value: "hello!\nworld!"
        });
    });
    test("raw string", async () => {
        await expectParse("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
        await expectParse("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
    });
    test("string with escaped quote", async () => {
        await expectParse('"hello \\"quoted\\" world"', {
            __class__: AST.Value,
            value: 'hello "quoted" world',
        });
    });
    test("raw string with escaped quote", async () => {
        await expectParse("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
    });
    test("raw string with escaped quote", async () => {
        await expectParse("'hello!\\nworld!'", {
            __class__: AST.Value,
            value: "hello!\\nworld!"
        });
        await expectParse("'hello \\'quoted\\' world'", {
            __class__: AST.Value,
            value: "hello 'quoted' world",
        });
    });
    test("Unicode escape", async () => {
        await expectParse('"\\u{1F914}"', {
            __class__: AST.Value,
            value: "\u{1F914}"
        });
    });
    test("ignore Unicode escape in raw string", async () => {
        await expectParse("'\\u{1F914}'", {
            __class__: AST.Value,
            value: "\\u{1F914}"
        });
    });
    test("symbol", async () => {
        await expectParse(".foo", {
            __class__: AST.Symbol,
            value: "foo"
        });
    });
    test("variable name", async () => {
        await expectParse("a", {
            __class__: AST.Name,
            name: "a"
        });
    });
});
describe("parse expressions", () => {
    test("implicit operator precedence", async () => {
        await expectParse("a + b * c", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.Name,
                name: "a",
            },
            right: {
                __class__: AST.BinaryOp,
                op: "*",
                left: {
                    __class__: AST.Name,
                    name: "b"
                },
                right: {
                    __class__: AST.Name,
                    name: "c",
                }
            }
        });
    });
    test("parens force order", async () => {
        await expectParse("(a + 2) * 3", {
            __class__: AST.BinaryOp,
            op: "*",
            left: {
                __class__: AST.BinaryOp,
                op: "+",
                left: {
                    __class__: AST.Name,
                    name: "a",
                },
                right: {
                    __class__: AST.Value,
                    value: 2,
                }
            },
            right: {
                __class__: AST.Value,
                value: 3,
            },
        });
    });
    test("exponentiation is right associative", async () => {
        await expectParse("2 ** a ** 4", {
            __class__: AST.BinaryOp,
            op: "**",
            left: {
                __class__: AST.Value,
                value: 2,
            },
            right: {
                __class__: AST.BinaryOp,
                op: "**",
                left: {
                    __class__: AST.Name,
                    name: "a",
                },
                right: {
                    __class__: AST.Value,
                    value: 4,
                }
            }
        });
    });
    test("unary minus comes after exponentiation", async () => {
        await expectParse("-a ** x", {
            __class__: AST.UnaryOp,
            op: "-",
            value: {
                __class__: AST.BinaryOp,
                op: "**",
                left: {
                    __class__: AST.Name,
                    name: "a",
                },
                right: {
                    __class__: AST.Name,
                    name: "x"
                }
            }
        });
    });
    test("unary minus doesn't come after exponentiation with a number", async () => {
        await expectParse("-1 ** x", {
            __class__: AST.BinaryOp,
            op: "**",
            left: {
                __class__: AST.Value,
                value: -1,
            },
            right: {
                __class__: AST.Name,
                name: "x"
            }
        });
    });
    test("subtraction sign in mooshed expression is not confused for a negative number", async () => {
        expectParse("a-1", {
            __class__: AST.BinaryOp,
            op: "-",
            left: {
                __class__: AST.Name,
                name: "a",
            },
            right: {
                __class__: AST.Value,
                value: 1
            }
        });
    });
    test("parses splat form", async () => {
        await expectParse("foo(*bar())", {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.SplatValue,
                    value: {
                        __class__: AST.Call,
                        name: "bar",
                        args: []
                    }
                }
            ]
        })
    });
    test("parses matrix multiplication form with correct precedence", async () => {
        await expectParse("a**t @ b + c", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.BinaryOp,
                op: "@",
                left: {
                    __class__: AST.BinaryOp,
                    op: "**",
                    left: {
                        __class__: AST.Name,
                        name: "a"
                    },
                    right: {
                        __class__: AST.Name,
                        name: "t"
                    }
                },
                right: {
                    __class__: AST.Name,
                    name: "b"
                }
            },
            right: {
                __class__: AST.Name,
                name: "c"
            }
        });
    });
    test("no postfix operators", async () => {
        await expectParseError("1 +", "expected a value after operator");
    });
    test("unmatched parens", async () => {
        await expectParseError("(abc234(1, 4)", '"(" was never closed');
        await expectParseError("[{a: 1, b: 3", '"{" was never closed');
        await expectParseError("[1 => 2, 3 => [", '"[" was never closed');
        await expectParseError("]:", "stray close paren");
        await expectParseError("}:-", "stray close paren");
        await expectParseError(":)", "stray close paren");
    });
    test("mismatched parens", async () => {
        await expectParseError("[a, b)", 'expected "]"');
    });
});
describe("parse assignment statements", () => {
    test("simple assignment", async () => {
        await expectParse("a = 1", {
            __class__: AST.Assignment,
            target: {
                __class__: AST.Name,
                name: "a",
            },
            value: {
                __class__: AST.Value,
                value: 1
            }
        });
    });
    test("compound assignment", async () => {
        await expectParse("a += 1", {
            __class__: AST.Assignment,
            target: {
                __class__: AST.Name,
                name: "a",
            },
            value: {
                __class__: AST.BinaryOp,
                op: "+",
                left: {
                    __class__: AST.Name,
                    name: "a"
                },
                right: {
                    __class__: AST.Value,
                    value: 1
                }
            }
        });
    });
});
describe("parse call", () => {
    test("standard", async () => {
        await expectParse("foo(1, a)", {
            __class__: AST.Call,
            name: "foo",
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Name,
                    name: "a"
                }
            ]
        });
    });
    test("with keyword arguments", async () => {
        await expectParse("foo(1, 2, a: 3, b: 4)", {
            __class__: AST.Call,
            args: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                },
                {
                    __class__: AST.KeywordArgument,
                    name: "a",
                    arg: {
                        __class__: AST.Value,
                        value: 3,
                    }
                },
                {
                    __class__: AST.KeywordArgument,
                    name: "b",
                    arg: {
                        __class__: AST.Value,
                        value: 4,
                    }
                }
            ]
        });
    });
});
describe("parse list", () => {
    test("normal list", async () => {
        await expectParse("[1, a]", {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Name,
                    name: "a"
                }
            ]
        });
    });
    test("throw error about empty slots in list", async () => {
        await expectParseError("[1, 2, ]", "illegal trailing comma in list");
        await expectParseError("[1, , 2]", "empty elements not allowed in list");
    });
    test("empty list", async () => {
        await expectParse("[]", {
            __class__: AST.List,
            values: []
        });
    });
    test("empty list 2-deep", async () => {
        await expectParse("[[]]", {
            __class__: AST.List,
            values: [
                {
                    __class__: AST.List,
                    values: []
                }
            ]
        });
    });
});
describe("parse mapping", () => {
    test("parse mapping like a list", async () => {
        await expectParse("[1 => 2, .foo => .bar]", {
            __class__: AST.Mapping,
            mapping: [
                {
                    key: {
                        __class__: AST.Value,
                        value: 1,
                    },
                    val: {
                        __class__: AST.Value,
                        value: 2,
                    }
                },
                {
                    key: {
                        __class__: AST.Symbol,
                        value: "foo",
                    },
                    val: {
                        __class__: AST.Symbol,
                        value: "bar",
                    }
                }
            ]
        });
    });
    test('error when not all entries have "=>"', async () => {
        await expectParseError("[1, 2, 3 => 4]", 'expected "=>" after key value');
        await expectParseError("[1 => 2, 3, 4]", 'expected "=>" after key value');
    });
    test("arbitrary expressions as key & value", async () => {
        await expectParse("[1 + a => 3 + a]", {
            __class__: AST.Mapping,
            mapping: [
                {
                    key: {
                        __class__: AST.BinaryOp,
                        op: "+",
                        left: {
                            __class__: AST.Value,
                            value: 1,
                        },
                        right: {
                            __class__: AST.Name,
                            name: "a",
                        }
                    },
                    val: {
                        __class__: AST.BinaryOp,
                        op: "+",
                        left: {
                            __class__: AST.Value,
                            value: 3,
                        },
                        right: {
                            __class__: AST.Name,
                            name: "a",
                        }
                    }
                }
            ]
        });
    });
});
describe("parse ternary operator", () => {
    test("lift 2 binary operators", async () => {
        await expectParse("a ? b : c", {
            __class__: AST.Conditional,
            cond: {
                __class__: AST.Name,
                name: "a",
            },
            caseTrue: {
                __class__: AST.Name,
                name: "b",
            },
            caseFalse: {
                __class__: AST.Name,
                name: "c",
            }
        });
    });
    test("nested ternary", async () => {
        await expectParse("a?b?c:d:e", {
            __class__: AST.Conditional,
            cond: {
                __class__: AST.Name,
                name: "a",
            },
            caseTrue: {
                __class__: AST.Conditional,
                cond: {
                    __class__: AST.Name,
                    name: "b",
                },
                caseTrue: {
                    __class__: AST.Name,
                    name: "c",
                },
                caseFalse: {
                    __class__: AST.Name,
                    name: "d",
                }
            },
            caseFalse: {
                __class__: AST.Name,
                name: "e",
            }
        });
    });
    test("chained ternary", async () => {
        await expectParse("a?b:c?d:e", {
            __class__: AST.Conditional,
            cond: {
                __class__: AST.Name,
                name: "a",
            },
            caseTrue: {
                __class__: AST.Name,
                name: "b",
            },
            caseFalse: {
                __class__: AST.Conditional,
                cond: {
                    __class__: AST.Name,
                    name: "c",
                },
                caseTrue: {
                    __class__: AST.Name,
                    name: "d",
                },
                caseFalse: {
                    __class__: AST.Name,
                    name: "e",
                }
            }
        });
    });
    test("error when only half present", async () => {
        await expectParseError("a ? b", 'expected ":" after expression');
        await expectParseError("b : c", "named parameter not directly inside a callsite");
    });
});
describe("parse definition", () => {
    test("simple definition", async () => {
        await expectParse("foo(a, b) :- 1", {
            __class__: AST.Definition,
            name: "foo",
            parameters: [
                {
                    __class__: AST.Name,
                    name: "a",
                },
                {
                    __class__: AST.Name,
                    name: "b"
                }
            ],
            body: {
                __class__: AST.Value,
                value: 1,
            }
        });
    });
});
describe("parse block of commas", () => {
    test("defaults get nuked in block", async () => {
        await expectParse(",1, ,2, 3,", {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                },
                {
                    __class__: AST.Value,
                    value: 3,
                }
            ],
        });
    });
    test("normal commas", async () => {
        await expectParse("1, 2, 3", {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Value,
                    value: 1,
                },
                {
                    __class__: AST.Value,
                    value: 2,
                },
                {
                    __class__: AST.Value,
                    value: 3,
                }
            ],
        });
    });
});
describe("parse template and interpolation", () => {
    test("single template", async () => {
        await expectParse("{foo(), bar()}", {
            __class__: AST.Template,
            result: {
                __class__: AST.Block,
                body: [
                    {
                        __class__: AST.Call,
                        name: "foo",
                        args: []
                    },
                    {
                        __class__: AST.Call,
                        name: "bar",
                        args: []
                    },
                ]
            }
        });
    });
    test("template with interpolation", async () => {
        await expectParse("{foo(), &bar}", {
            __class__: AST.Template,
            result: {
                __class__: AST.Block,
                body: [
                    {
                        __class__: AST.Call,
                        name: "foo",
                        args: []
                    },
                    {
                        __class__: AST.InterpolatedValue,
                        value: {
                            __class__: AST.Name,
                            name: "bar"
                        }
                    },
                ]
            }
        });
    })
});

describe("pipeline placeholder", () => {
    test("parses pipe placeholder form", async () => {
        await expectParse("bar(#, 1, #)", {
            __class__: AST.Call,
            name: "bar",
            args: [
                {
                    __class__: AST.PipePlaceholder,
                },
                {
                    __class__: AST.Value,
                    value: 1
                },
                {
                    __class__: AST.PipePlaceholder,
                }
            ]
        })
    });
});
describe("parses and attaches attributes", () => {
    test("simple attributes on a definition", async () => {
        await expectParse("#!preset foo(a, b) :- 1", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Name,
                    name: "preset"
                }
            ],
            value: {
                __class__: AST.Definition,
                name: "foo",
                parameters: [
                    {
                        __class__: AST.Name,
                        name: "a",
                    },
                    {
                        __class__: AST.Name,
                        name: "b"
                    }
                ],
                body: {
                    __class__: AST.Value,
                    value: 1,
                }
            }
        });
    });
    test("complex attribute on a definition", async () => {
        await expectParse("#!preset('FM Sine') fmSine(a) :- 1", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Call,
                    name: "preset",
                    args: [
                        {
                            __class__: AST.Value,
                            value: "FM Sine"
                        },
                    ]
                }
            ],
            value: {
                __class__: AST.Definition,
                name: "fmSine",
                parameters: [
                    {
                        __class__: AST.Name,
                        name: "a",
                    },
                ],
                body: {
                    __class__: AST.Value,
                    value: 1,
                }
            }
        });
    });
    test("complex attribute 2", async () => {
        await expectParse("#!preset('FM Sine', category: 'Retro') fmSine(a) :- 1", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Call,
                    name: "preset",
                    args: [
                        {
                            __class__: AST.Value,
                            value: "FM Sine"
                        },
                        {
                            __class__: AST.KeywordArgument,
                            name: "category",
                            arg: {
                                __class__: AST.Value,
                                value: "Retro"
                            }
                        }
                    ]
                }
            ],
            value: {
                __class__: AST.Definition,
                name: "fmSine",
                parameters: [
                    {
                        __class__: AST.Name,
                        name: "a",
                    },
                ],
                body: {
                    __class__: AST.Value,
                    value: 1,
                }
            }
        });
    });
    test("simple attributes as a value in context", async () => {
        await expectParse("zz(#!pitch) + 1", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.Call,
                name: "zz",
                args: [
                    {
                        __class__: AST.AnnotatedValue,
                        value: null,
                        attributes: [
                            {
                                __class__: AST.Name,
                                name: "pitch"
                            }
                        ]
                    }
                ]
            },
            right: {
                __class__: AST.Value,
                value: 1
            }
        })
    });
    test("complex attributes as a value", async () => {
        await expectParse("#!mod(0, 1)", {
            __class__: AST.AnnotatedValue,
            attributes: [
                {
                    __class__: AST.Call,
                    name: "mod",
                    args: [
                        {
                            __class__: AST.Value,
                            value: 0
                        },
                        {
                            __class__: AST.Value,
                            value: 1
                        }
                    ]
                }
            ],
            value: null
        });
    });
    test("attribute used as value if cannot annotate expression", async () => {
        await expectParse("#!z + y", {
            __class__: AST.BinaryOp,
            op: "+",
            left: {
                __class__: AST.AnnotatedValue,
                attributes: [
                    {
                        __class__: AST.Name,
                        name: "z",
                    }
                ],
                value: null
            },
            right: {
                __class__: AST.Name,
                name: "y"
            }
        });
    });
    test("EOF'ed attribute", async () => {
        await expectParseError("#!", "expected attribute after '#!'")
    });
    test("attribute in invalid location", async () => {
        await expectParseError("a #!z + y", "expected operator before value");
    });
});
describe("expand simple pipe operators", () => {
    test("dumb pipe", async () => {
        await expectParse("a |> #", {
            __class__: AST.Name,
            name: "a",
        });
    });
    test("simple pipe expansion", async () => {
        await expectParse("foo() |> # * 2", {
            __class__: AST.BinaryOp,
            op: "*",
            left: {
                __class__: AST.Call,
                name: "foo",
                args: []
            },
            right: {
                __class__: AST.Value,
                value: 2
            }
        });
    });
    test("chained pipe expansion", async () => {
        await expectParse("foo() |> bar(#) |> baz(#)", {
            __class__: AST.Call,
            name: "baz",
            args: [
                {
                    __class__: AST.Call,
                    name: "bar",
                    args: [
                        {
                            __class__: AST.Call,
                            name: "foo",
                            args: []
                        }
                    ]
                }
            ]
        });
    });
    test("multiple targets for expansion", async () => {
        await expectParse("foo() |> (# ? # : 1)", {
            __class__: AST.Block,
            body: [
                {
                    __class__: AST.Assignment,
                    target: {
                        __class__: AST.Name,
                        name: "$1"
                    },
                    value: {
                        __class__: AST.Call,
                        name: "foo",
                        args: []
                    }
                },
                {
                    __class__: AST.Conditional,
                    cond: {
                        __class__: AST.Name,
                        name: "$1"
                    },
                    caseTrue: {
                        __class__: AST.Name,
                        name: "$1"
                    },
                    caseFalse: {
                        __class__: AST.Value,
                        value: 1
                    }
                }
            ]
        });
    });
});
