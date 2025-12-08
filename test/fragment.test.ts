import { expect, test } from "bun:test";
import { AudioProcessorFactory, compile, ErrorReason, NodeGraph, NodeInputLocation } from "../src";
import { getFragmentInputs, GraphFragment, NodeFragmentEdge, unifyGraphFragments } from "../src/graph/fragment";
import { scalarMatrix } from "../src/math/matrix";
import { Opcode } from "../src/runtime/program";

test("unify fragments", () => {
    const fragment1: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, [NodeInputLocation.FRAG_INPUT, "z"]]],
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
            ["b", [[NodeInputLocation.FRAG_INPUT, "z"]]],
        ]
    };
    const nodes: AudioProcessorFactory[] = [
        {
            name: "b",
            outputDims: [1, 1],
            inputs: [
                {
                    name: "a",
                    dims: [1, 1],
                    default: 123
                }
            ],
            make: null as any
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
            ["b", [1, 0, [NodeInputLocation.FRAG_INPUT, "z"]]],
        ]
    };
    const links: NodeFragmentEdge[] = [
        { value: 123, to: [0, "z"], constant: true }
    ];
    expect(unifyGraphFragments([fragment], links, 0, "x")).toEqual({
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, [NodeInputLocation.CONSTANT, 123]]],
        ],
        out: 0,
    });
});
test("fragment get all inputs", () => {
    const fragment: GraphFragment = {
        out: { x: 0 },
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, [NodeInputLocation.FRAG_INPUT, "z"], [NodeInputLocation.FRAG_INPUT, "y"]]],
        ]
    };
    expect(getFragmentInputs(fragment)).toEqual(["z", "y"])
});
