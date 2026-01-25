import { expect, test } from "bun:test";
import { Edit, UndoRedo } from "../src/editor/undo";

const increment: Edit<number> = {
    doIt(n) {
        return n + 1;
    },
    trivial: false,
    repeatable: true,
}

const double: Edit<number> = {
    doIt(n) {
        return n * 2;
    },
    trivial: false,
    repeatable: true,
}

const log: Edit<number> = {
    doIt(n) {
        console.log("log:", n);
        return n;
    },
    trivial: true,
    repeatable: true,
}

test("undo redo", () => {
    const doc = new UndoRedo<number>(0);
    doc.doEdit(increment);
    doc.doEdit(double);
    expect(doc.canUndo).toBeTrue();
    expect(doc.canRepeat).toBeTrue();
    expect(doc.curDoc).toEqual(2);
    doc.undo();
    expect(doc.curDoc).toEqual(1);
    doc.redo();
    expect(doc.curDoc).toEqual(2);
    doc.redo();
    expect(doc.curDoc).toEqual(4);
    doc.undo();
    doc.undo();
    doc.undo();
    expect(doc.canUndo).toBeFalse();
    expect(doc.curDoc).toEqual(0);
    expect(() => doc.undo()).not.toThrow();
    expect(doc.curDoc).toEqual(0);
});

test("undoing trivial edits get batched", () => {
    const doc = new UndoRedo<number>(0);
    doc.doEdit(increment);
    doc.doEdit(double);
    doc.doEdit(log);
    doc.doEdit(log);
    doc.doEdit(double);
    expect(doc.curDoc).toEqual(4);
    expect(doc.canUndo).toBeTrue();
    doc.undo();
    expect(doc.curDoc).toEqual(2);
    expect(doc.canUndo).toBeTrue();
    doc.undo();
    expect(doc.curDoc).toEqual(1);
});
