import { Channel } from "../runtime/channels";
import { Wave } from "../runtime/synth";
import { GraphFragment } from "./fragment";

// TODO: allow metabuilders such as unisons
export abstract class FragmentBuilder<T extends GraphFragment> {
    abstract name: string;
    abstract build(data: T, childFragments: FragmentBuilder<any>[]): Promise<{
        fragment: GraphFragment;
        waves: Record<string, Wave>;
        channels: Channel[]
    }>;
}
