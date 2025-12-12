import { isArray, isNumber, isString } from "../utils";
import { NodeGraph } from "./types";

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
        out.push(...inputs.filter(isString));
    }
    return out;
}

export type OutPort = [frag: number, port: string];
export function unifyGraphFragments(fragments: GraphFragment[], edges: NodeFragmentEdge[], out: OutPort): NodeGraph;
export function unifyGraphFragments(fragments: GraphFragment[], edges: NodeFragmentEdge[], out: Record<string, OutPort>): GraphFragment;
export function unifyGraphFragments(fragments: GraphFragment[], edges: NodeFragmentEdge[], out: OutPort | Record<string, OutPort>): NodeGraph | GraphFragment {
    const merged: NodeGraph | GraphFragment = {
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
    if (isArray(out)) {
        merged.out = globalOutputNumberOfFragment(out[0], out[1]);
    } else {
        merged.out = Object.fromEntries(Object.entries(out).map(([name, [frag, port]]) => [name, globalOutputNumberOfFragment(frag, port)]));
    }
    // Finally, process all the links and re-numberings
    for (var globalNodeNo = 0; globalNodeNo < merged.nodes.length; globalNodeNo++) {
        const args = merged.nodes[globalNodeNo]![1];
        const [srcFragment] = nodeToFragmentMap[globalNodeNo]!;
        for (var argNo = 0; argNo < args.length; argNo++) {
            const arg = args[argNo]!;
            if (isString(arg)) {
                // Find the output node of fragment N
                const { from, constant, value } = edges.find(({ to: [toFrag, toName] }) => toFrag === srcFragment && toName == arg)!;
                args[argNo] = constant ? [value!] : globalOutputNumberOfFragment(from![0], from![1]);
            } else if (isNumber(arg)) {
                // Intra-fragment renumbering
                args[argNo] = fragToRenumberMap[srcFragment]![arg]!;
            }
        }
    }
    return merged;
}
