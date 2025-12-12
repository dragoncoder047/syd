import { Wave } from "../runtime/synth";
import { ChannelData } from "../songFormat";
import { GraphFragment, NodeFragmentEdge, unifyGraphFragments } from "./fragment";

export interface FragmentResult {
    fragment: GraphFragment;
    waves: Record<string, Promise<Wave>>;
    channels: ChannelData[]
}

// TODO: allow metabuilders such as unisons
export interface FragmentBuilder {
    name: string;
    build(data: any, children: GraphFragment[]): FragmentResult;
}

// TODO: give this a better name versus the GraphFragment
export interface FragmentGraph {
    nodes: FragmentGraphNode[];
    edges: NodeFragmentEdge[];
    out: Record<string, [number, string]>;
}

export interface FragmentGraphNode {
    name: string;
    pos: [x: number, y: number];
    data: any;
    children: FragmentGraph[];
}

export function fragmentsToGraph(g: FragmentGraph, builders: FragmentBuilder[]): FragmentResult {
    const outWaves: Record<string, Promise<Wave>> = {};
    const outChannels: ChannelData[] = [];
    const mergedNodes: GraphFragment[] = [];
    const buildersMap = Object.fromEntries(builders.map(b => [b.name, b]));
    for (var node of g.nodes) {
        const childItems = node.children.map(c => fragmentsToGraph(c, builders));
        const childBits: GraphFragment[] = [];
        for (let { fragment, waves, channels } of childItems) {
            childBits.push(fragment);
            Object.assign(outWaves, waves);
            outChannels.push(...channels);
        }
        const { fragment, waves, channels } = buildersMap[node.name]!.build(node.data, childBits);
        mergedNodes.push(fragment);
        Object.assign(outWaves, waves);
        outChannels.push(...channels);
    }
    return {
        channels: outChannels,
        waves: outWaves,
        fragment: unifyGraphFragments(mergedNodes, g.edges, g.out),
    }
}
