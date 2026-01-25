import { expect, test } from "bun:test";
import { AVLNode, compareNumbers, treeGetBookends, treeInsertOrUpdate, treeMap, treeRemove, treeUpdateByMapping } from "../src/math/tree/avl";
import { makeTreeNode } from "../src/math/tree/tree";

test("tree insert and traversal keeps things in sorted order", () => {
    var tree: AVLNode<number, number> | null = null;
    var elements = [3, 5, 2, 4, 7, 8, 1, 0, 9, 6, 10, 11, 20, 19, 16, 17, 12, 13, 15, 14, 18];
    for (var i of elements) {
        tree = treeInsertOrUpdate(tree, i, i, makeTreeNode, compareNumbers);
    }
    const list: number[] = [];
    treeMap(tree, x => list.push(x.d));
    expect(list).toEqual(elements.toSorted((a, b) => a - b));
});

test("tree insert and update replaces existing values", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 5, 10, makeTreeNode, compareNumbers);
    tree = treeInsertOrUpdate(tree, 3, 20, makeTreeNode, compareNumbers);
    tree = treeInsertOrUpdate(tree, 7, 30, makeTreeNode, compareNumbers);

    // Update existing value
    tree = treeInsertOrUpdate(tree, 5, 100, makeTreeNode, compareNumbers);

    const list: number[] = [];
    treeMap(tree, x => list.push(x.d));
    expect(list).toEqual([20, 100, 30]);
});

test("treeUpdateByMapping updates values at specific times", () => {
    var tree: AVLNode<number, number> | null = null;
    var elements = [1, 3, 5, 7, 9];
    for (var i of elements) {
        tree = treeInsertOrUpdate(tree, i, i * 10, makeTreeNode, compareNumbers);
    }

    // Update value at time 5 by doubling it
    tree = treeUpdateByMapping(tree, 5, d => d * 2, makeTreeNode, compareNumbers)!;

    const list: number[] = [];
    treeMap(tree, x => list.push(x.d));
    expect(list).toEqual([10, 30, 100, 70, 90]);
});

test("treeUpdateByMapping with no matching time returns original tree", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 5, 50, makeTreeNode, compareNumbers);


    expect(treeUpdateByMapping(tree, 10, d => d * 2, makeTreeNode, compareNumbers)).toBe(tree);
});

test("treeUpdateByMapping with no change returns original tree", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 5, 50, makeTreeNode, compareNumbers);

    expect(treeUpdateByMapping(tree, 5, d => d, makeTreeNode, compareNumbers)).toBe(tree);
});

test("treeRemove removes values from tree", () => {
    var tree: AVLNode<number, number> | null = null;
    var elements = [5, 3, 7, 1, 9, 4, 6];
    for (var i of elements) {
        tree = treeInsertOrUpdate(tree, i, i * 10, makeTreeNode, compareNumbers);
    }

    // Remove a value
    const newTree = treeRemove(tree, 5, makeTreeNode, compareNumbers);

    const list: number[] = [];
    treeMap(newTree, x => list.push(x.d));
    expect(list).toEqual([10, 30, 40, 60, 70, 90]);

    list.length = 0;
    treeMap(tree, x => list.push(x.d));
    // Assert the original tree was not modified
    expect(list).toEqual([10, 30, 40, 50, 60, 70, 90]);
});

test("treeRemove non-existent time returns original tree", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 5, 50, makeTreeNode, compareNumbers);

    expect(treeRemove(tree, 10, makeTreeNode, compareNumbers)).toBe(tree);
});

test("treeRemove the only element from a tree returns a null tree", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 5, 10, makeTreeNode, compareNumbers);

    expect(treeRemove(tree, 5, makeTreeNode, compareNumbers)).toBeNull();
});

test("treeRemove from empty tree returns null", () => {
    expect(treeRemove(null, 5,  makeTreeNode, compareNumbers)).toBeNull();
});

test("treeGetBookends exact match uses the matched as the left of the interval", () => {
    var tree: AVLNode<number, number> | null = null;
    var elements = [1, 3, 5, 7, 9];
    for (var i of elements) {
        tree = treeInsertOrUpdate(tree, i, i * 10, makeTreeNode, compareNumbers);
    }

    const [left, right] = treeGetBookends(tree, 5, compareNumbers);
    expect(left).not.toBeNull();
    expect(left!.k).toEqual(5);
    expect(left!.d).toEqual(50);
    expect(right).not.toBeNull();
    expect(right!.k).toEqual(7);
    expect(right!.d).toEqual(70);
});

test("treeGetBookends finds value between nodes", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 1, 10, makeTreeNode, compareNumbers);
    tree = treeInsertOrUpdate(tree, 5, 50, makeTreeNode, compareNumbers);
    tree = treeInsertOrUpdate(tree, 9, 90, makeTreeNode, compareNumbers);

    const [left, right] = treeGetBookends(tree, 3, compareNumbers);
    expect(left).not.toBeNull();
    expect(left!.k).toEqual(1);
    expect(left!.d).toEqual(10);
    expect(right).not.toBeNull();
    expect(right!.k).toEqual(5);
    expect(right!.d).toEqual(50);
});

test("treeGetBookends finds value before all nodes", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 5, 50, makeTreeNode, compareNumbers);
    tree = treeInsertOrUpdate(tree, 9, 90, makeTreeNode, compareNumbers);

    const [left, right] = treeGetBookends(tree, 1, compareNumbers);
    expect(left).toBeNull();
    expect(right).not.toBeNull();
    expect(right!.k).toEqual(5);
    expect(right!.d).toEqual(50);
});

test("treeGetBookends finds value after all nodes", () => {
    var tree: AVLNode<number, number> | null = null;
    tree = treeInsertOrUpdate(tree, 1, 10, makeTreeNode, compareNumbers);
    tree = treeInsertOrUpdate(tree, 5, 50, makeTreeNode, compareNumbers);

    const [left, right] = treeGetBookends(tree, 9, compareNumbers);
    expect(left).not.toBeNull();
    expect(left!.k).toEqual(5);
    expect(left!.d).toEqual(50);
    expect(right).toBeNull();
});

test("treeGetBookends on empty tree returns all null", () => {
    const [left, right] = treeGetBookends(null, 5, compareNumbers);
    expect(left).toBeNull();
    expect(right).toBeNull();
});
