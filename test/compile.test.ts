import { expect, test } from "bun:test";
import { AudioProcessorFactory, compile, ErrorReason, NodeGraph, NodeInput, NodeInputLocation, SpecialNodeKind } from "../src";
import { Matrix } from "../src/matrix";
import { Opcode } from "../src/runtime/program";

test("compiles", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            ["a", [1, 0]],
            ["b", []],
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        {
            name: "a",
            inputs: [
                {
                    name: "a",
                    dims: ["M", "N"],
                    default: 0
                },
                {
                    name: "a",
                    dims: ["P", "Q"],
                    default: 0
                }
            ],
            outputDims: [1, 1],
            make: null as any
        },
        {
            name: "b",
            inputs: [],
            outputDims: [2, 3],
            make: null as any
        }
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.CALL_NODE, 1, 0],
                [Opcode.GET_REGISTER, 0],
                [Opcode.CALL_NODE, 0, 2],
                [Opcode.TAP_REGISTER, 0],
            ],
            registers: [Matrix.scalar(0)],
            constantTab: [],
            nodes: [
                ["a", { M: 2, N: 3, P: 1, Q: 1 }],
                ["b", {}]
            ]
        },
        []
    ])
});

test("compile with warnings", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            ["a", [0]],
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        {
            name: "a",
            inputs: [
                {
                    name: "a",
                    dims: ["N", "N"],
                    default: 0
                },
            ],
            outputDims: [2, 4],
            make: null as any
        },
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.GET_REGISTER, 0],
                [Opcode.CALL_NODE, 0, 1],
                [Opcode.TAP_REGISTER, 0],
            ],
            registers: [new Matrix(2, 4)],
            constantTab: [],
            nodes: [
                ["a", { N: 2 }],
            ]
        },
        [
            {
                node: 0,
                index: 0,
                dim: 1,
                code: ErrorReason.DIM_MISMATCH
            }
        ]
    ])
});

test("compile with smeared nodes", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            ["a", [1]],
            ["b", []],
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        {
            name: "a",
            inputs: [
                {
                    name: "a",
                    dims: [2, 4],
                    default: 0
                },
            ],
            outputDims: [1, 1],
            make: null as any
        },
        {
            name: "b",
            inputs: [],
            outputDims: [1, 1],
            make: null as any
        }
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.CALL_NODE, 1, 0],
                [Opcode.SMEAR_MATRIX, 2, 4],
                [Opcode.CALL_NODE, 0, 1],
            ],
            registers: [],
            constantTab: [],
            nodes: [
                ["a", {}],
                ["b", {}]
            ]
        },
        []
    ])
});

test("compile with matrix builder", () => {
    const k = (n: number): NodeInput => [NodeInputLocation.CONSTANT, n];
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [[SpecialNodeKind.BUILD_MATRIX, 2, 3], [k(1), k(2), k(3), k(4), k(5), k(6)]],
        ]
    };
    const nodes: AudioProcessorFactory[] = [];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.PUSH_CONSTANT, 0]
            ],
            registers: [],
            constantTab: [Matrix.of2DList([[1, 2, 3], [4, 5, 6]])],
            nodes: []
        },
        []
    ])
});
test("compile with matrix builder with inputs", () => {
    const k = (n: number): NodeInput => [NodeInputLocation.CONSTANT, n];
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [[SpecialNodeKind.BUILD_MATRIX, 2, 3], [k(1), 1, k(3), k(4), 1, k(6)]],
            ["a", []]
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        {
            name: "a",
            inputs: [],
            outputDims: [1, 1],
            make: null as any
        }
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.PUSH_CONSTANT, 0],
                [Opcode.CALL_NODE, 0, 0],
                [Opcode.TAP_REGISTER, 0],
                [Opcode.SET_MATRIX_EL, 0, 1],
                [Opcode.GET_REGISTER, 0],
                [Opcode.SET_MATRIX_EL, 1, 1],
            ],
            registers: [Matrix.scalar(0)],
            constantTab: [Matrix.of2DList([[1, 0, 3], [4, 0, 6]])],
            nodes: [
                ["a", {}]
            ]
        },
        []
    ])
});