import { max } from "../math";

export interface AVLNode<T> {
    /** timestamp */
    readonly t: number;
    /** data */
    readonly d: T;
    /** left subtree */
    readonly l: this | null;
    /** right subtree */
    readonly r: this | null;
    /** tree height */
    readonly h: number;
}

function height(n: AVLNode<any> | null) {
    return n?.h ?? 0;
}

export function combinedHeight(left: AVLNode<any> | null, right: AVLNode<any> | null) {
    return 1 + max(height(left), height(right))
}

export type NodeCopier<N extends AVLNode<any>> = (old: N, newLeft: N | null, newRight: N | null) => N;
export type NodeMaker<N extends AVLNode<any>, D> = (time: number, data: D, newLeft: N | null, newRight: N | null) => N;

function makeLeaf<N extends AVLNode<any>, D>(time: number, data: D, nodeMaker: NodeMaker<N, D>): N {
    return nodeMaker(time, data, null, null);
}

function rightRotate<N extends AVLNode<any>>(y: N, copy: NodeCopier<N>): N {
    const x = y.l!, lr = x.r;
    return copy(x, x.l, copy(y, lr, y.r));
}

function leftRotate<N extends AVLNode<any>>(x: N, copy: NodeCopier<N>): N {
    const y = x.r!, rl = y.l;
    return copy(y, copy(x, x.l, rl), y.r);
}

function balanceFactor(n: AVLNode<any> | null) {
    return n ? height(n.l) - height(n.r) : 0;
}

function rebalance<N extends AVLNode<any>>(n: N, copy: NodeCopier<N>): N {
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
 * @param time The time stamp to insert at
 * @param data The data to insert
 * @returns Them updated tree
 */
export function treeInsertOrUpdate<N extends AVLNode<any>, D>(root: N | null, time: number, data: D, make: NodeMaker<N, D>, copy: NodeCopier<N>): N {
    if (!root) return makeLeaf(time, data, make);

    if (time < root.t) {
        return rebalance(make(root.t, root.d, treeInsertOrUpdate(root.l, time, data, make, copy), root.r), copy);
    } else if (time > root.t) {
        return rebalance(make(root.t, root.d, root.l, treeInsertOrUpdate(root.r, time, data, make, copy)), copy);
    } else {
        // found it, replace the data
        return make(time, data, root.l, root.r);
    }
}

/**
 * Update a tree to change the node at the particular time through the function
 * @param root The tree to update
 * @param time The time stamp to be updated
 * @param mapper The function to transform the old value into the new value
 * @returns The updated tree
 */
export function treeUpdateByMapping<N extends AVLNode<any>, D>(root: N | null, time: number, mapper: (d: D) => D, make: NodeMaker<N, D>, copy: NodeCopier<N>): N | null {
    if (!root) return null;
    // No need to rebalance since we're not adding or removing nodes
    if (time < root.t) {
        const newLeft = treeUpdateByMapping(root.l, time, mapper, make, copy);
        // if nothing happened, don't make a new node
        if (newLeft === root.l) return root;
        return copy(root, newLeft, root.r);
    } else if (time > root.t) {
        const newRight = treeUpdateByMapping(root.r, time, mapper, make, copy);
        // if nothing happened, don't make a new node
        if (newRight === root.r) return root;
        return copy(root, root.l, newRight);
    } else {
        const newData = mapper(root.d);
        if (root.d === newData) return root;
        return make(root.t, newData, root.l, root.r);
    }
}

function leftmostLeaf<N extends AVLNode<any>>(n: N): N {
    while (n.l) n = n.l;
    return n;
}

/**
 * Remove the data stored at a particular time stamp
 * @param root The tree to be modified
 * @param time The time stamp to remove the data of
 * @returns The update tree
 */
export function treeRemove<N extends AVLNode<any>>(root: N | null, time: number, copy: NodeCopier<N>): N | null {
    if (!root) return null;
    if (time < root.t) {
        const newLeft = treeRemove(root.l, time, copy);
        // if nothing happened, don't make a new node
        if (newLeft === root.l) return root;
        return rebalance(copy(root, newLeft, root.r), copy);
    } else if (time > root.t) {
        const newRight = treeRemove(root.r, time, copy);
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
        return rebalance(copy(next, root.l, treeRemove(root.r, next.t, copy)), copy);
    }
}

// /**
//  * Search a tree for a particular timestamp
//  * @param root The tree to search
//  * @param time The time stamp to look for
//  * @returns The data stored at that node or null if it doesn't exist
//  */
// export function treeSearch<T>(root: AVLNode<T> | null, time: number): T | null {
//     while (root) {
//         if (time === root.t) return root.d;
//         root = time < root.t ? root.l : root.r;
//     }
//     return null;
// }

/**
 * In-order traversal of the tree
 * @param root The tree to iterate over
 * @param fn The callback for each iteration
 */
export function treeMap<T>(root: AVLNode<T> | null, fn: (data: T) => void) {
    if (!root) return;
    treeMap(root.l, fn);
    fn(root.d);
    treeMap(root.r, fn);
}

// /**
//  * Collects the data of all of the items within the range specified
//  * @param root The tree to search
//  * @param start The start of the range (inclusive)
//  * @param end The end of the range (inclusive)
//  * @param out A list to collect the data
//  * @returns The list with all the data
//  */
// export function treeGetInRange<T>(root: AVLNode<T> | null, start: number, end: number, out: T[] = []): T[] {
//     if (root) {
//         if (start <= root.t) treeGetInRange(root.l, start, end, out);
//         if (root.t >= start && root.t <= end) out.push(root.d);
//         if (root.t <= end) treeGetInRange(root.r, start, end, out);
//     }
//     return out;
// }

/**
 * Get the two points immediately to the right and to the left of the time value.
 * @param tree The tree to search
 * @param time The time at which to look
 * @returns The time value in the tree immediately to the left and to the right of the time value.
 */
export function treeGetBookends(tree: AVLNode<any> | null, time: number): [number | null, number | null] {
    var left: number | null = null;
    var right: number | null = null;

    while (tree !== null) {
        if (time === tree.t) {
            // exact match
            return [tree.t, tree.r ? leftmostLeaf(tree.r).t : null];
        } else if (time < tree.t) {
            // node.t is a candidate successor (strictly > time)
            right = tree.t;
            tree = tree.l;
        } else { // time > node.t
            // node.t is a candidate predecessor (<= time)
            left = tree.t;
            tree = tree.r;
        }
    }

    return [left, right];
}
