import IntervalTree from "@flatten-js/interval-tree";
import { NotePin } from "./types";

export class EditableSong {
    sequence = new IntervalTree<string>();
    patterns: Record<string, EditablePattern> = {};
    addPattern(pattern: EditablePattern, time: number) {
        this.sequence
    }
}

export class EditablePattern {
    notes = new IntervalTree<EditableNote>();
    instruments: string[] = [];
}

export class EditableNote {
    pins = new IntervalTree<NotePin>();
    constructor(
        public startPos: number,
        public pitch: number) {

    }
}
