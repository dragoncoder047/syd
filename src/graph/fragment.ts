import { NodeGraph, NodeInputLocation } from ".";
import { isArray, isNumber } from "../utils";

export interface NodeFragmentEdge {
    from: number;
    to: [number, string];
}

export function unifyFragments(fragments: NodeGraph[], edges: NodeFragmentEdge[], outFrag: number): NodeGraph {
    const merged: NodeGraph = {
        nodes: [],
        out: null as any,
        mods: {},
    };
    const fragToRenumberMap: Record<number, Record<number, number>> = {};
    const nodeToFragmentMap: Record<number, [number, number]> = {};
    for (var fragNo = 0; fragNo < fragments.length; fragNo++) {
        const { nodes, mods } = fragments[fragNo]!;
        // Save the mods.
        for (var [name, mod] of Object.entries(mods)) {
            merged.mods[name] = mod;
        }
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
    const globalOutputNumberOfFragment = (fragNo: number) => fragToRenumberMap[fragNo]![fragments[fragNo]!.out]!
    merged.out = globalOutputNumberOfFragment(outFrag);
    // Finally, process all the links and re-numberings
    for (var globalNodeNo = 0; globalNodeNo < merged.nodes.length; globalNodeNo++) {
        const [_, args] = merged.nodes[globalNodeNo]!;
        const [srcFragment] = nodeToFragmentMap[globalNodeNo]!;
        for (var argNo = 0; argNo < args.length; argNo++) {
            const arg = args[argNo]!;
            if (isArray(arg) && arg[1] === NodeInputLocation.FRAG_INPUT) {
                // Find the output node of fragment N
                const inputName = arg[0] as string;
                const inFrag = edges.find(({ to: [toFrag, toName] }) => toFrag === srcFragment && toName == inputName)!.from;
                args[argNo] = globalOutputNumberOfFragment(inFrag);
            } else if (isNumber(arg)) {
                // Intra-fragment renumbering
                args[argNo] = fragToRenumberMap[srcFragment]![arg]!;
            }
        }
    }
    return merged;
}
