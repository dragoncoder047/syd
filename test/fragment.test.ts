import { expect, test } from "bun:test";
import { AudioProcessorFactory, compile, ErrorReason, NodeGraph, NodeInputLocation } from "../src";
import { Opcode } from "../src/compiler/prog";
import { NodeFragmentEdge, unifyFragments } from "../src/graph/fragment";
import { Matrix } from "../src/matrix";

test("unify fragments", () => {
    const fragment1: NodeGraph = {
        mods: {},
        out: 0,
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, ["z", NodeInputLocation.FRAG_INPUT]]],
        ]
    };
    const fragment2: NodeGraph = {
        mods: {},
        out: 0,
        nodes: [
            ["c", [1, 0]],
            ["d", [1, 0]],
        ]
    };
    const links: NodeFragmentEdge[] = [
        { from: 1, to: [0, "z"] }
    ];
    expect(unifyFragments([fragment1, fragment2], links, 0)).toEqual({
        nodes: [
            ["a", [1, 0]],
            ["b", [1, 0, 2]],
            ["c", [3, 2]],
            ["d", [3, 2]],
        ],
        out: 0,
        mods: {}
    });
});

test("compining graph with un-unified input returns an error but uses the default", () => {
    const fragment1: NodeGraph = {
        mods: {},
        out: 0,
        nodes: [
            ["b", [["z", NodeInputLocation.FRAG_INPUT]]],
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
            constantTab: [Matrix.scalar(123)],
            mods: [],
            nodes: [
                ["b", {}]
            ]
        },
        [
            {
                node: 0,
                index: 0,
                dim: 0,
                code: ErrorReason.NOT_CONNECTED
            }
        ]
    ])
});
