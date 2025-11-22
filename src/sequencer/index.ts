import { NoteShape, Pattern, TimelineEntry } from "./types";

export interface SequencerEvent {
    kind: SequencerEventType;
    isMod: boolean;
    target: string | number;
    value: number;
}

export enum SequencerEventType {
    NOTE_ON,
    NOTE_OFF,
    PITCH_BEND,
    EXPR_BEND,
}

export class Sequencer {
    time = 0;
    paused = true;
    constructor(
        public patterns: Pattern[],
        public noteShapes: NoteShape[],
        public timeline: TimelineEntry[],
        public tempoMod: string) {
        // TODO: extract tempo mod channel and convert to absolute integral of beats vs. time
        // TODO: convert all notes to 
    }
    play() {
        this.paused = false;
    }
    stop() {
        this.pause();
        this.time = 0;
    }
    pause(): SequencerEvent[] {
        this.paused = true;
        // TODO: clear active note array and return NOTE_OFF for all of them
    }
    advance(dt: number): SequencerEvent[] {
        if (this.paused) return [];
        return this.seek(this.time + dt, true);
    }
    seek(time: number, close: boolean): SequencerEvent[] {
        // Make NOTE_OFF for notes that are no longer under the playhead
        // Make NOTE_ON for notes that are newly appeared under the playhead
        // Then process the BEND events
    }
}
