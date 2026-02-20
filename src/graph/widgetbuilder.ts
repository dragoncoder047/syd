import { Wave } from "../runtime/synth";
import { ChannelData } from "../songFormat";
import { GraphFragment, NodeFragmentEdge, OutPort, unifyGraphFragments } from "./fragment";

export interface WidgetBuildResult {
    fragment: GraphFragment;
    waves: Record<string, Promise<Wave>>;
    channels: ChannelData[]
}

export interface Widget {
    /** creates a headless data map used to compile to lower-level instructions */
    build(data: any, children: GraphFragment[]): WidgetBuildResult;
    /** returns the size of the GUI box. */
    getSize(data: any): { width: number, height: number };
    /** return the Y-positions of the ports on this node's GUI box.
     * each is a mapping from port name -> Y-position of rendered port */
    getPorts(data: any): { inputs: Record<string, number>, outputs: Record<string, number> };
}

export interface WidgetGraphNode {
    name: string;
    data: any;
    children: WidgetGraph[];
}

export interface WidgetGraph {
    /** List of GUI nodes present in this graph */
    nodes: WidgetGraphNode[];
    /** List of links between edges */
    edges: NodeFragmentEdge[];
    /** List of "dangling outputs" used to connect into e.g. a parent graph */
    out: Record<string, OutPort>;
}

export function fragmentsToGraph(g: WidgetGraph, builders: Record<string, Widget>): WidgetBuildResult {
    const outWaves: Record<string, Promise<Wave>> = {};
    const outChannels: ChannelData[] = [];
    const mergedNodes: GraphFragment[] = [];
    for (var node of g.nodes) {
        const childItems = node.children.map(c => fragmentsToGraph(c, builders));
        const childBits: GraphFragment[] = [];
        for (let { fragment, waves, channels } of childItems) {
            childBits.push(fragment);
            Object.assign(outWaves, waves);
            outChannels.push(...channels);
        }
        const { fragment, waves, channels } = builders[node.name]!.build(node.data, childBits);
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
