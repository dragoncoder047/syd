import { expect, test } from "bun:test";
import { AVLNode, treeGetBookends, treeInsertOrUpdate, treeRemove, treeSearch } from "../src/math/tree/avl";
import { makeTreeNode } from "../src/math/tree/tree";

type Key = readonly [number, number];
const lexComparator = (a: Key, b: Key) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
};

test("avl supports 2-tuple keys with primary ordering", () => {
    var tree: AVLNode<Key, string> | null = null;

    const k1: Key = [1, 0];
    const k2: Key = [2, 0];
    const k3: Key = [2, 1];
    const k4: Key = [3, 0];

    tree = treeInsertOrUpdate(tree, k1, "a", makeTreeNode, lexComparator);
    tree = treeInsertOrUpdate(tree, k3, "c", makeTreeNode, lexComparator);
    tree = treeInsertOrUpdate(tree, k2, "b", makeTreeNode, lexComparator);
    tree = treeInsertOrUpdate(tree, k4, "d", makeTreeNode, lexComparator);

    // exact search
    const foundK2 = treeSearch(tree, k2, lexComparator);
    expect(foundK2).not.toBeNull();
    expect(foundK2!.d).toBe("b");

    // bookends for a mid-second value between k2 and k3
    const [left, right] = treeGetBookends(tree, [2, 0.5], lexComparator);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.k).toEqual(k2);
    expect(right!.k).toEqual(k3);

    // remove k2
    tree = treeRemove(tree, k2, makeTreeNode as any, lexComparator) as any;
    const afterRemove = treeSearch(tree, k2, lexComparator);
    expect(afterRemove).toBeNull();

    // bookends around removed key now should be k1 and k3
    const [l2, r2] = treeGetBookends(tree, k2, lexComparator);
    expect(l2).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(l2!.k).toEqual(k1);
    expect(r2!.k).toEqual(k3);
});
