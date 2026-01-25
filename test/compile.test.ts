import { expect, test } from "bun:test";
import { AudioProcessorFactory, compile, ErrorReason, NodeGraph, SCALAR_DIMS, Dimensions } from "../src";
import { BuildMatrix } from "../src/lib/nodes/special";
import { Matrix, scalarMatrix } from "../src/math/matrix";
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
        new class extends AudioProcessorFactory {
            name = "a"
            getInputs = () => [
                {
                    name: "a",
                    dims: ["M", "N"] as Dimensions,
                    default: 0
                },
                {
                    name: "a",
                    dims: ["P", "Q"] as Dimensions,
                    default: 0
                }
            ]
            value = () => null
            getOutputDims = () => SCALAR_DIMS
            make = null as any
        },
        new class extends AudioProcessorFactory {
            name = "b"
            getInputs = () => []
            getOutputDims = () => [2, 3] as Dimensions
            make = null as any
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
            registers: [scalarMatrix(0)],
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
        new class extends AudioProcessorFactory {
            name = "a"
            getInputs = () => [
                {
                    name: "a",
                    dims: ["N", "N"] as Dimensions,
                    default: 0
                },
            ]
            value = () => null
            getOutputDims = () => [2, 4] as Dimensions
            make = null as any
        }
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
        new class extends AudioProcessorFactory {
            name = "a"
            getInputs = () => [
                {
                    name: "a",
                    dims: [2, 4] as Dimensions,
                    default: 0
                },
            ]
            value = () => null
            getOutputDims = () => SCALAR_DIMS
            make = null as any
        },
        new class extends AudioProcessorFactory {
            name = "b"
            getInputs = () => []
            value = () => null
            getOutputDims = () => SCALAR_DIMS
            make = null as any
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
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [["matrix", 2, 3], [[1], [2], [3], [4], [5], [6]]],
        ]
    };
    const nodes: AudioProcessorFactory[] = [new BuildMatrix];
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
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [["matrix", 2, 3], [[1], 1, [3], [4], 1, [6]]],
            ["a", []]
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        new BuildMatrix,
        new class extends AudioProcessorFactory {
            name = "a"
            getInputs = () => []
            value = () => null
            getOutputDims = () => SCALAR_DIMS
            make = null as any
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
            registers: [scalarMatrix(0)],
            constantTab: [Matrix.of2DList([[1, 0, 3], [4, 0, 6]])],
            nodes: [
                ["a", {}]
            ]
        },
        []
    ])
});
test("compile matrix builder reports wrong number of arguments", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [["matrix", 2, 3], [[1], [2], [3], [4], [5]]],
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        new BuildMatrix,
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.PUSH_CONSTANT, 0],
            ],
            registers: [],
            constantTab: [Matrix.of2DList([[1, 2, 3], [4, 5, 0]])],
            nodes: []
        },
        [
            {
                code: ErrorReason.WRONG_NO_OF_ARGS,
                node: 0,
                dim: 0,
                index: 0
            }
        ]
    ])
});
test("compile matrix builder input with smash input", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [["matrix", 2, 2], [[1], [1], [1], 1]],
            ["a", []]
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        new BuildMatrix,
        new class extends AudioProcessorFactory {
            name = "a"
            getInputs = () => []
            value = () => null
            getOutputDims = () => [2, 2] as Dimensions
            make = null as any
        }
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.PUSH_CONSTANT, 0],
                [Opcode.CALL_NODE, 0, 0],
                [Opcode.SET_MATRIX_EL, 1, 1],
            ],
            registers: [],
            constantTab: [Matrix.of2DList([[1, 1], [1, 0]])],
            nodes: [
                ["a", {}]
            ]
        },
        [
            {
                node: 0,
                index: 3,
                dim: 0,
                code: ErrorReason.DIM_MISMATCH
            },
            {
                node: 0,
                index: 3,
                dim: 1,
                code: ErrorReason.DIM_MISMATCH
            }
        ]
    ])
});
test("compile matrix builder input with input from another matrix", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            [["matrix", 2, 2], [[1], [1], [1], 1]],
            [["matrix", 2, 2], [[2], [2], [2], [2]]]
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        new BuildMatrix,
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.PUSH_CONSTANT, 0],
                [Opcode.PUSH_CONSTANT, 1],
                [Opcode.SET_MATRIX_EL, 1, 1],
            ],
            registers: [],
            constantTab: [
                Matrix.of2DList([[1, 1], [1, 0]]),
                Matrix.of2DList([[2, 2], [2, 2]]),
            ],
            nodes: []
        },
        [
            {
                node: 0,
                index: 3,
                dim: 0,
                code: ErrorReason.DIM_MISMATCH
            },
            {
                node: 0,
                index: 3,
                dim: 1,
                code: ErrorReason.DIM_MISMATCH
            }
        ]
    ])
});
