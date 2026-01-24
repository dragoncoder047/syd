import { expect, test } from "bun:test";
import { treeInsertOrUpdate, treeSearch, treeGetBookends, treeRemove } from "../src/math/tree/avl";
import { makeTreeNode, cloneTreeNode } from "../src/math/tree/tree";

type Key = readonly [number, number];
const lexComparator = (a: Key, b: Key) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
};

test("avl supports 2-tuple keys with primary ordering", () => {
    let tree: any = null;

    const k1: Key = [1, 0];
    const k2: Key = [2, 0];
    const k3: Key = [2, 1];
    const k4: Key = [3, 0];

    tree = treeInsertOrUpdate(tree, k1, "a", makeTreeNode, cloneTreeNode, lexComparator);
    tree = treeInsertOrUpdate(tree, k3, "c", makeTreeNode, cloneTreeNode, lexComparator);
    tree = treeInsertOrUpdate(tree, k2, "b", makeTreeNode, cloneTreeNode, lexComparator);
    tree = treeInsertOrUpdate(tree, k4, "d", makeTreeNode, cloneTreeNode, lexComparator);

    // exact search
    const foundK2 = treeSearch(tree, k2, lexComparator);
    expect(foundK2).not.toBeNull();
    expect(foundK2!.d).toBe("b");

    // bookends for a mid-second value between k2 and k3
    const probe: Key = [2, 0.5];
    const [left, right] = treeGetBookends(tree, probe, lexComparator);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.t).toEqual(k2);
    expect(right!.t).toEqual(k3);

    // remove k2
    tree = treeRemove(tree, k2, cloneTreeNode, lexComparator) as any;
    const afterRemove = treeSearch(tree, k2, lexComparator);
    expect(afterRemove).toBeNull();

    // bookends around removed key now should be k1 and k3
    const [l2, r2] = treeGetBookends(tree, k2, lexComparator);
    expect(l2).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(l2!.t).toEqual(k1);
    expect(r2!.t).toEqual(k3);
});
