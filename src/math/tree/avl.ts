import { max } from "../math";
import { between } from "./interval";

export interface AVLNode<K, T> {
    /** timestamp */
    readonly t: K;
    /** data */
    readonly d: T;
    /** left subtree */
    readonly l: this | null;
    /** right subtree */
    readonly r: this | null;
    /** tree height */
    readonly h: number;
}

export const numberComparator: Comparator<number> = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function height(n: AVLNode<any, any> | null) {
    return n?.h ?? 0;
}

export function combinedHeight(left: AVLNode<any, any> | null, right: AVLNode<any, any> | null) {
    return 1 + max(height(left), height(right))
}

export type NodeCopier<N extends AVLNode<any, any>> = (old: N, newLeft: N | null, newRight: N | null) => N;
export type NodeMaker<N extends AVLNode<K, D>, D, K> = (time: K, data: D, newLeft: N | null, newRight: N | null) => N;
export type Comparator<K> = (a: K, b: K) => -1 | 0 | 1;

function makeLeaf<N extends AVLNode<K, D>, D, K>(time: K, data: D, nodeMaker: NodeMaker<N, D, K>): N {
    return nodeMaker(time, data, null, null);
}

function rightRotate<N extends AVLNode<K, D>, D, K>(y: N, copy: NodeCopier<N>): N {
    const x = y.l!, lr = x.r;
    return copy(x, x.l, copy(y, lr, y.r));
}

function leftRotate<N extends AVLNode<K, D>, D, K>(x: N, copy: NodeCopier<N>): N {
    const y = x.r!, rl = y.l;
    return copy(y, copy(x, x.l, rl), y.r);
}

function balanceFactor(n: AVLNode<any, any> | null) {
    return n ? height(n.l) - height(n.r) : 0;
}

function rebalance<N extends AVLNode<any, any>>(n: N, copy: NodeCopier<N>): N {
    const bf = balanceFactor(n);
    if (bf > 1) {
        if (balanceFactor(n.l) < 0) {
            const newLeft = leftRotate(n.l!, copy);
            const nWithNewLeft = copy(n, newLeft, n.r);
            return rightRotate(nWithNewLeft, copy);
        }
        return rightRotate(n, copy);
    }
    if (bf < -1) {
        if (balanceFactor(n.r) > 0) {
            const newRight = rightRotate(n.r!, copy);
            const nWithNewRight = copy(n, n.l, newRight);
            return leftRotate(nWithNewRight, copy);
        }
        return leftRotate(n, copy);
    }
    return n;
}

/**
 * Insert data into an existing tree
 * @param root The existing tree
 * @param time The key to insert at (or generic comparable key if comparator provided)
 * @param data The data to insert
 * @param make Function to create new nodes
 * @param copy Function to copy nodes
 * @param comparator Optional comparator function; defaults to numeric comparison
 * @returns The updated tree
 */
export function treeInsertOrUpdate<N extends AVLNode<K, D>, D, K = number>(
    root: N | null,
    time: K,
    data: D,
    make: NodeMaker<N, D, K>,
    copy: NodeCopier<N>,
    comparator: Comparator<K>
): N {

    if (!root) return makeLeaf(time, data, make);

    const comparison = comparator(time, root.t as any);
    if (comparison < 0) {
        return rebalance(make(root.t, root.d, treeInsertOrUpdate(root.l, time, data, make, copy, comparator), root.r), copy);
    } else if (comparison > 0) {
        return rebalance(make(root.t, root.d, root.l, treeInsertOrUpdate(root.r, time, data, make, copy, comparator)), copy);
    } else {
        // found it, replace the data
        return make(root.t, data, root.l, root.r);
    }
}

/**
 * Update a tree to change the node at the particular time through the function
 * @param root The tree to update
 * @param time The time stamp to be updated
 * @param mapper The function to transform the old value into the new value
 * @returns The updated tree
 */
export function treeUpdateByMapping<N extends AVLNode<K, D>, D, K>(root: N | null, time: K, mapper: (d: D) => D, make: NodeMaker<N, D, K>, copy: NodeCopier<N>, comparator: Comparator<K>): N | null {
    if (!root) return null;
    const comparison = comparator(time, root.t);
    // No need to rebalance since we're not adding or removing nodes
    if (comparison < 0) {
        const newLeft = treeUpdateByMapping(root.l, time, mapper, make, copy, comparator);
        // if nothing happened, don't make a new node
        if (newLeft === root.l) return root;
        return copy(root, newLeft, root.r);
    } else if (comparison > 0) {
        const newRight = treeUpdateByMapping(root.r, time, mapper, make, copy, comparator);
        // if nothing happened, don't make a new node
        if (newRight === root.r) return root;
        return copy(root, root.l, newRight);
    } else {
        const newData = mapper(root.d);
        if (root.d === newData) return root;
        return make(root.t, newData, root.l, root.r);
    }
}

export function leftmostLeaf<N extends AVLNode<any, any>>(n: N): N {
    while (n.l) n = n.l;
    return n;
}

export function inOrderSuccessor<N extends AVLNode<any, any>>(n: N): N | null {
    return n.r ? leftmostLeaf(n.r) : null;
}

export function rightmostLeaf<N extends AVLNode<any, any>>(n: N): N {
    while (n.r) n = n.r;
    return n;
}

export function inOrderPredecessor<N extends AVLNode<any, any>>(n: N): N | null {
    return n.l ? rightmostLeaf(n.l) : null;
}

/**
 * Remove the data stored at a particular time stamp
 * @param root The tree to be modified
 * @param time The time stamp to remove the data of
 * @returns The update tree
 */
export function treeRemove<N extends AVLNode<K, D>, D, K>(
    root: N | null,
    time: K,
    copy: NodeCopier<N>,
    comparator: Comparator<K>
): N | null {
    if (!root) return null;
    const comparison = comparator(time, root.t as any);
    if (comparison < 0) {
        const newLeft = treeRemove(root.l, time, copy, comparator);
        // if nothing happened, don't make a new node
        if (newLeft === root.l) return root;
        return rebalance(copy(root, newLeft, root.r), copy);
    } else if (comparison > 0) {
        const newRight = treeRemove(root.r, time, copy, comparator);
        // if nothing happened, don't make a new node
        if (newRight === root.r) return root;
        return rebalance(copy(root, root.l, newRight), copy);
    } else {
        // delete this node
        if (!root.l && !root.r) return null;
        if (!root.l) return root.r;
        if (!root.r) return root.l;
        // two children: replace with in-order successor (min of right)
        const next = leftmostLeaf(root.r);
        return rebalance(copy(next, root.l, treeRemove(root.r, next.t as any, copy, comparator)), copy);
    }
}

/**
 * Search a tree for a particular key
 * @param root The tree to search
 * @param time The key to look for (or numeric timestamp if comparator not provided)
 * @param comparator Optional comparator function; defaults to numeric comparison
 * @returns The node or null if it doesn't exist
 */
export function treeSearch<T extends AVLNode<K, D>, D, K>(root: T | null, time: K, comparator: Comparator<K>): T | null {
    while (root) {
        const comparison = comparator(time, root.t as any);
        if (comparison === 0) return root;
        root = comparison < 0 ? root.l : root.r;
    }
    return null;
}

/**
 * In-order traversal of the tree
 * @param root The tree to iterate over
 * @param fn The callback for each iteration
 */
export function treeMap<T extends AVLNode<any, any>>(root: T | null, fn: (data: T) => void) {
    if (!root) return;
    treeMap(root.l, fn);
    fn(root);
    treeMap(root.r, fn);
}

/**
 * Collects the data of all of the items within the range specified
 * @param root The tree to search
 * @param start The start of the range (inclusive)
 * @param end The end of the range (exclusive)
 * @param out A list to collect the data
 * @returns The list with all the nodes in the range
 */
export function treeGetInRange<T extends AVLNode<K, any>, K>(root: T | null, start: K, end: K, out: T[] = [], comparator: Comparator<K>): T[] {
    if (root) {
        if (comparator(start, root.t) <= 0) treeGetInRange(root.l, start, end, out, comparator);
        if (between(root.t, start, end, comparator)) out.push(root);
        if (comparator(root.t, end) <= 0) treeGetInRange(root.r, start, end, out, comparator);
    }
    return out;
}

/**
 * Get the two points immediately to the left and right of the key value
 * @param tree The tree to search
 * @param time The key at which to look (or numeric timestamp if comparator not provided)
 * @param comparator Optional comparator function; defaults to numeric comparison
 * @returns [left, right] - the nodes on either side
 */
export function treeGetBookends<T extends AVLNode<K, any>, K>(tree: T | null, time: K, comparator: Comparator<K>): [T | null, T | null] {
    var left: T | null = null;
    var right: T | null = null;

    while (tree !== null) {
        const comparison = comparator(time, tree.t as any);
        if (comparison === 0) {
            // exact match
            left = tree;
            right ??= inOrderSuccessor(tree);
            break;
        } else if (comparison < 0) {
            // node.t is a candidate successor (strictly > time)
            right = tree;
            tree = tree.l;
        } else { // comparison > 0
            // node.t is a candidate predecessor (<= time)
            left = tree;
            tree = tree.r;
        }
    }
    return [left, right];
}
