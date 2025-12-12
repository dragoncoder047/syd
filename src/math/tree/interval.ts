import { max, min } from "../math";
import { AVLNode, combinedHeight, NodeCopier, NodeMaker } from "./avl";


export interface IntervalNode<T> extends AVLNode<T> {
    /** this node's end */
    readonly e: number;
    /** left subtree's min end */
    readonly x: number;
    /** right subtree's max end */
    readonly y: number;
}
export const makeIntervalNode = (<T>(time: number, [data, end]: [T, number], left: IntervalNode<T> | null, right: IntervalNode<T> | null): IntervalNode<T> => ({
    t: time, d: data, l: left, r: right,
    h: combinedHeight(left, right),
    e: end,
    x: min(end, left?.x ?? Infinity, right?.x ?? Infinity),
    y: max(end, left?.y ?? -Infinity, right?.y ?? -Infinity),
})) satisfies NodeMaker<IntervalNode<any>, [any, number]>;

export const cloneIntervalNode = (<T>({ t, d, x, y, e }: IntervalNode<T>, left: IntervalNode<T> | null, right: IntervalNode<T> | null): IntervalNode<T> => ({
    t, d, x, y, e, l: left, r: right,
    h: combinedHeight(left, right)
})) satisfies NodeCopier<IntervalNode<any>>;

/**
 * Find all of the data that intersects with the range
 * @param root The tree to search
 * @param start The start of the interval (inclusive)
 * @param end The end of the interval (inclusive)
 * @param out The list to collect results into
 * @returns The list with results
 */
export function intervalQuery<T>(
    root: IntervalNode<T> | null,
    start: number,
    end: number,
): T[] {
    const out = [];
    const stack: IntervalNode<T>[] = [];
    if (root) stack.push(root);
    while (stack.length) {
        const { t: nStart, e: nEnd, d: data, l: left, r: right } = stack.pop()!;
        // if the current node is in the interval, save it
        if (!(nEnd < start || nStart > end)) out.push(data);
        // if the left tree exists and its right edge is in the interval, check it
        if (left && left.y >= start) stack.push(left);
        // if the right tree exists and its left edge is in the interval, check it
        if (right && right.x <= end) stack.push(right);
    }
    return out;
}
