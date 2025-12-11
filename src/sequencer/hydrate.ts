import IntervalTree from "@flatten-js/interval-tree";
import { EventSequence } from "./types";

export function eventsToAbsolute<T>(e: EventSequence<T>) {
    var t = 0;
    const out: [time: number, event: T][] = [];
    for (var [delta, events] of e) {
        t += delta;
        for (var event of events) {
            out.push([t, event]);
        }
    }
    return out;
}

export function toTree<T>(items: EventSequence<T>): [IntervalTree<T>, [number, number]] {
    const stamped = eventsToAbsolute(items);
}
