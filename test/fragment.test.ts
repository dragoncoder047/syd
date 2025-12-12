import { expect, test } from "bun:test";
import { AudioProcessorFactory, compile, ErrorReason, NodeGraph, SCALAR_DIMS } from "../src";
import { getFragmentInputs, GraphFragment, NodeFragmentEdge, unifyGraphFragments } from "../src/graph/fragment";
import { scalarMatrix } from "../src/math/matrix";
import { Opcode } from "../src/runtime/program";

test("unify fragments", () => {
    const fragment1: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1, "z"]],
        ]
    };
    const fragment2: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["c", [0, 1]],
            ["d", [0, 1]],
        ]
    };
    const links: NodeFragmentEdge[] = [
        { from: [1, "x"], to: [0, "z"] }
    ];
    expect(unifyGraphFragments([fragment1, fragment2], links, 0, "x")).toEqual({
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1, 2]],
            ["c", [2, 3]],
            ["d", [2, 3]],
        ],
        out: 0,
    });
});

test("compining graph with un-unified input returns an error but uses the default", () => {
    const fragment1: NodeGraph = {
        out: 0,
        nodes: [
            ["b", ["z"]],
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        new class extends AudioProcessorFactory {
            name = "b"
            getOutputDims = () => SCALAR_DIMS
            getInputs = () => [
                {
                    name: "a",
                    dims: SCALAR_DIMS,
                    default: 123
                }
            ]
            make = null as any
        }
    ];
    expect(compile(fragment1, nodes)).toEqual([
        {
            code: [
                [Opcode.PUSH_CONSTANT, 0],
                [Opcode.CALL_NODE, 0, 1],
            ],
            registers: [],
            constantTab: [scalarMatrix(123)],
            nodes: [
                ["b", {}]
            ]
        },
        [
            {
                node: 0,
                index: 0,
                dim: 0,
                code: ErrorReason.UNUSED_FRAG_INPUT
            }
        ]
    ])
});
test("fragment with constant inputs inlined constants", () => {
    const fragment: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1, "z"]],
        ]
    };
    const links: NodeFragmentEdge[] = [
        { value: 123, to: [0, "z"], constant: true }
    ];
    expect(unifyGraphFragments([fragment], links, 0, "x")).toEqual({
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1, [123]]],
        ],
        out: 0,
    });
});
test("fragment get all inputs", () => {
    const fragment: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1, "z", "y"]],
        ]
    };
    expect(getFragmentInputs(fragment)).toEqual(["z", "y"])
});
test("using the same fragment multiple times behaves as though it's cloned", () => {
    const frag1: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1]]
        ]
    };
    const fragEnd: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["aa", ["x", "y"]],
        ]
    };
    const edges: NodeFragmentEdge[] = [
        { from: [0, "x"], to: [2, "x"] },
        { from: [1, "x"], to: [2, "y"] }
    ];
    expect(unifyGraphFragments([frag1, frag1, fragEnd], edges, 2, "x")).toEqual({
        out: 4,
        nodes: [
            ["a", [0, 1]],
            ["b", [0, 1]],
            ["a", [2, 3]],
            ["b", [2, 3]],
            ["aa", [0, 2]],
        ],
    });
});
