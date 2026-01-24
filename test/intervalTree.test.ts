import { expect, test } from "bun:test";
import { numberComparator, treeInsertOrUpdate } from "../src/math/tree/avl";
import { cloneIntervalNode, IntervalNode, intervalQuery, makeIntervalNode } from "../src/math/tree/interval";

test("intervalQuery finds intervals that intersect with range", () => {
    var tree: IntervalNode<string> | null = null;

    // Insert intervals: [start, end] => data
    // [0,   5] => "A"
    //    [3,   8] => "B"
    //       [6,  10] => "C"
    //              [12, 15] => "D"
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 0, ["A", 5], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 3, ["B", 8], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 6, ["C", 10], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 12, ["D", 15], makeIntervalNode, cloneIntervalNode, numberComparator);

    expect(intervalQuery(tree, 4, 7).sort()).toEqual(["A", "B", "C"]);
});

test("intervalQuery returns empty when no intervals intersect", () => {
    var tree: IntervalNode<string> | null = null;

    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 0, ["A", 5], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 10, ["B", 15], makeIntervalNode, cloneIntervalNode, numberComparator);

    // Query [6, 9] should find nothing
    expect(intervalQuery(tree, 6, 9)).toEqual([]);
});

test("intervalQuery finds intervals when it touches lower or upper boundary", () => {
    var tree: IntervalNode<string> | null = null;

    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 0, ["A", 5], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 5, ["B", 10], makeIntervalNode, cloneIntervalNode, numberComparator);

    // Upper boundary is not included, lower boundary is included
    expect(intervalQuery(tree, 5, 5)).toEqual(["B"]);
});

test("intervalQuery on empty tree returns empty array", () => {
    expect(intervalQuery(null, 0, 10)).toEqual([]);
});

test("intervalQuery with large range finds all intervals", () => {
    var tree: IntervalNode<number> | null = null;

    for (let i = 0; i < 5; i++) {
        tree = treeInsertOrUpdate<IntervalNode<number>, [number, number]>(tree, i * 2, [i, i * 2 + 3], makeIntervalNode, cloneIntervalNode, numberComparator);
    }

    // Query a very large range
    expect(intervalQuery(tree, -100, 100).sort()).toEqual([0, 1, 2, 3, 4]);
});

test("intervalQuery with single point on boundary", () => {
    var tree: IntervalNode<string> | null = null;

    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 0, ["A", 3], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 5, ["B", 8], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 10, ["C", 15], makeIntervalNode, cloneIntervalNode, numberComparator);

    // Upper boundary is not included
    expect(intervalQuery(tree, 3, 3)).toEqual([]);
    // Lower boundary is included
    expect(intervalQuery(tree, 0, 0)).toEqual(["A"]);
});

test("intervalQuery works ok with negative time values", () => {
    var tree: IntervalNode<string> | null = null;

    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, -10, ["A", -5], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, -3, ["B", 3], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 5, ["C", 10], makeIntervalNode, cloneIntervalNode, numberComparator);

    // Query [-7, -1] should find A and B
    expect(intervalQuery(tree, -7, -1).sort()).toEqual(["A", "B"]);
});

test("intervalQuery partial overlap", () => {
    var tree: IntervalNode<string> | null = null;

    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 0, ["A", 5], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 7, ["B", 12], makeIntervalNode, cloneIntervalNode, numberComparator);
    tree = treeInsertOrUpdate<IntervalNode<string>, [string, number]>(tree, 3, ["C", 10], makeIntervalNode, cloneIntervalNode, numberComparator);

    // Query [4, 8] overlaps with A, B, and C
    expect(intervalQuery(tree, 4, 8).sort()).toEqual(["A", "B", "C"]);
});
