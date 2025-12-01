import { NodeGraph, NodeInputLocation } from "./types";
import { isArray, isNumber } from "../utils";

export interface NodeFragmentEdge {
    constant?: boolean;
    from?: [frag: number, port: string];
    value?: number;
    to: [number, string];
}

export type GraphFragment = Omit<NodeGraph, "out"> & {
    out: Record<string, number>;
};

export function getFragmentInputs(fragment: GraphFragment): string[] {
    const out: string[] = [];
    for (var [_, inputs] of fragment.nodes) {
        for (var input of inputs) {
            if (isArray(input) && input[0] == NodeInputLocation.FRAG_INPUT) {
                out.push(input[1] as string);
            }
        }
    }
    return out;
}

export function unifyGraphFragments(fragments: GraphFragment[], edges: NodeFragmentEdge[], outFrag: number, outPort: string): NodeGraph {
    const merged: NodeGraph = {
        nodes: [],
        out: null as any,
    };
    const fragToRenumberMap: Record<number, Record<number, number>> = {};
    const nodeToFragmentMap: Record<number, [frag: number, localNodeNo: number]> = {};
    for (var fragNo = 0; fragNo < fragments.length; fragNo++) {
        const { nodes } = fragments[fragNo]!;
        // Compute re-numberings for all nodes.
        fragToRenumberMap[fragNo] = {};
        for (var localNodeNo = 0; localNodeNo < nodes.length; localNodeNo++) {
            // Clone the nodes first; we'll update the numbers later
            const [name, args] = nodes[localNodeNo]!;
            const globalNodeNo = merged.nodes.push([name, args.slice()]) - 1;
            nodeToFragmentMap[globalNodeNo] = [fragNo, localNodeNo];
            fragToRenumberMap[fragNo]![localNodeNo] = globalNodeNo;
        }
    }
    const globalOutputNumberOfFragment = (fragNo: number, portNo: string) => fragToRenumberMap[fragNo]![fragments[fragNo]!.out[portNo]!]!
    merged.out = globalOutputNumberOfFragment(outFrag, outPort);
    // Finally, process all the links and re-numberings
    for (var globalNodeNo = 0; globalNodeNo < merged.nodes.length; globalNodeNo++) {
        const args = merged.nodes[globalNodeNo]![1];
        const [srcFragment] = nodeToFragmentMap[globalNodeNo]!;
        for (var argNo = 0; argNo < args.length; argNo++) {
            const arg = args[argNo]!;
            if (isArray(arg) && arg[0] === NodeInputLocation.FRAG_INPUT) {
                // Find the output node of fragment N
                const inputName = arg[1] as string;
                const { from, constant, value } = edges.find(({ to: [toFrag, toName] }) => toFrag === srcFragment && toName == inputName)!;
                args[argNo] = constant ? [NodeInputLocation.CONSTANT, value!] : globalOutputNumberOfFragment(from![0], from![1]);
            } else if (isNumber(arg)) {
                // Intra-fragment renumbering
                args[argNo] = fragToRenumberMap[srcFragment]![arg]!;
            }
        }
    }
    return merged;
}
