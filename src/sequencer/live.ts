import IntervalTree, { Interval } from "@flatten-js/interval-tree";
import { eventsToAbsolute } from "./hydrate";
import { EventSequence, InstrumentName, Note, NotePin } from "./types";

export class LivePattern {
    notes = new IntervalTree<LiveNote>();
    constructor(
        public instrument: InstrumentName[],
        public start: number,
        notes: EventSequence<Note>
    ) {
        for (var [stamp, event] of eventsToAbsolute(notes)) {
            const note = new LiveNote(stamp, event);
            this.notes.insert(note.span(), note);
        }
    }
    public span() {
        return new Interval(this.start, this.start + this.getLength());
    }
}

export class LiveNote {
    pins = new IntervalTree<NotePin>();
    pitch: number;
    constructor(
        public startPos: number,
        data: Note) {

    }
}
