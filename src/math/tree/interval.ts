import { max, min } from "../math";
import { AVLNode, combinedHeight, Comparator, NodeMaker, compareNumbers } from "./avl";


export interface IntervalNode<T> extends AVLNode<number, [T, end: number]> {
    /** left subtree's min end */
    readonly x: number;
    /** right subtree's max end */
    readonly y: number;
}
export const makeIntervalNode = (<T>(time: number, dataAndEnd: [T, number], left: IntervalNode<T> | null, right: IntervalNode<T> | null): IntervalNode<T> => ({
    k: time, d: dataAndEnd, l: left, r: right,
    h: combinedHeight(left, right),
    x: min(time, left?.x ?? Infinity, right?.x ?? Infinity),
    y: max(dataAndEnd[1], left?.y ?? -Infinity, right?.y ?? -Infinity),
})) satisfies NodeMaker<IntervalNode<any>, [any, number], any>;

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
        const { k: nStart, d: [data, nEnd], l: left, r: right } = stack.pop()!;
        // if the current node touches the interval, save it
        if (intervalsIntersect(start, end, nStart, nEnd, compareNumbers)) out.push(data);
        // if the left tree exists and its span is in the interval, check it
        if (left && intervalsIntersect(start, end, left.x, left.y, compareNumbers)) stack.push(left);
        // if the right tree exists and its span is in the interval, check it
        if (right && intervalsIntersect(start, end, right.x, right.y, compareNumbers)) stack.push(right);
    }
    return out;
}

function intervalsIntersect<T>(a: T, b: T, x: T, y: T, comparator: Comparator<T>) {
    return (
        between(a, x, y, comparator) || between(b, x, y, comparator) // [a, b] intersects or is contained within [x, y]
        || between(x, a, b, comparator) || between(y, a, b, comparator) // [x, y] intersects or is contained within [a, b]
    );
}

export function between<T>(x: T, low: T, high: T, comparator: Comparator<T>) {
    return comparator(x, low) >= 0 && comparator(x, high) < 0;
}
