import { expect, test } from "bun:test";
import { AudioProcessorFactory, compile, ErrorReason, NodeGraph, SCALAR_DIMS } from "../src";
import { getFragmentInputs, GraphFragment, NodeFragmentEdge, unifyGraphFragments } from "../src/graph/fragment";
import { scalarMatrix } from "../src/math/matrix";
import { Opcode } from "../src/runtime/program";

test("unify fragments", () => {
    const fragment1: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, "z"]],
        ]
    };
    const fragment2: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["c", [1, 0]],
            ["d", [1, 0]],
        ]
    };
    const links: NodeFragmentEdge[] = [
        { from: [1, "x"], to: [0, "z"] }
    ];
    expect(unifyGraphFragments([fragment1, fragment2], links, 0, "x")).toEqual({
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, 2]],
            ["c", [3, 2]],
            ["d", [3, 2]],
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
            ["a", [1, 0]],
            ["b", [1, 0, "z"]],
        ]
    };
    const links: NodeFragmentEdge[] = [
        { value: 123, to: [0, "z"], constant: true }
    ];
    expect(unifyGraphFragments([fragment], links, 0, "x")).toEqual({
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, [123]]],
        ],
        out: 0,
    });
});
test("fragment get all inputs", () => {
    const fragment: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, "z", "y"]],
        ]
    };
    expect(getFragmentInputs(fragment)).toEqual(["z", "y"])
});
