export interface Edit<T> {
    doIt(document: T): T;
    trivial: boolean;
    repeatable: boolean;
}

export class UndoRedo<T> {
    private undoStack: T[] = [];
    private redoStack: T[] = [];
    private lastEdit: Edit<T> | null = null;
    changed: number = Number.MIN_SAFE_INTEGER;
    constructor(public curDoc: T) { }
    /**
     * Performs an edit on the document and saves the state, unless the edit is trivial.
     * @param edit Edit operation to transform the document
     */
    doEdit(edit: Edit<T>) {
        if (!edit.trivial) {
            this.redoStack = [];
            this.undoStack.push(this.curDoc);
        }
        this.lastEdit = edit.repeatable ? edit : null;
        this.curDoc = edit.doIt(this.curDoc);
        this.changed++;
    }
    /** True if undo() will do something. */
    get canUndo(): boolean {
        return this.undoStack.length > 0;
    }
    /** True if redo() will do something. */
    get canRedo(): boolean {
        return this.redoStack.length > 0;
    }
    /** True if redo() will repeat the last edit instead of returning to a previously-undone edit. */
    get canRepeat(): boolean {
        return this.lastEdit !== null;
    }
    /** Returns to the previous document state created by the most recent nontrivial edit. */
    undo() {
        if (!this.canUndo) return;
        this.redoStack.push(this.curDoc);
        this.curDoc = this.undoStack.pop()!
        this.changed++;
    }
    /** Returns to a previously-undone state, or if there are no redo states available and the most recent operation is repeatable, repeat it. */
    redo() {
        if (!this.canRedo) {
            if (this.canRepeat) this.doEdit(this.lastEdit!);
            return;
        }
        this.undoStack.push(this.curDoc);
        this.curDoc = this.redoStack.pop()!;
        this.changed++;
    }
}
