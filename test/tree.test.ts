import { expect, test } from "bun:test";
import { AVLNode, treeInsertOrUpdate, treeMap } from "../src/math/tree/avl";
import { cloneTreeNode, makeTreeNode } from "../src/math/tree/tree";

test("tree insert and traversal keeps things in sorted order", () => {
    var tree: AVLNode<number> | null = null;
    var elements = [3, 5, 2, 4, 7, 8, 1, 0, 9, 6, 10, 11, 20, 19, 16, 17, 12, 13, 15, 14, 18];
    for (var i of elements) {
        tree = treeInsertOrUpdate(tree, i, i, makeTreeNode, cloneTreeNode);
    }
    const list: number[] = [];
    treeMap(tree, x => list.push(x));
    expect(list).toEqual(elements.toSorted((a, b) => a - b));
});
// TODO: test more
