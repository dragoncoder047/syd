import { EventSequence, NoteShape, Pattern } from "./types";

export interface SequencerEvent {
    kind: SequencerEventType;
    isMod: boolean;
    target: string | number;
    value: number;
    time: number;
}

export enum SequencerEventType {
    NOTE_ON,
    NOTE_OFF,
    PITCH_BEND,
    EXPR_BEND,
}

export class Sequencer {
    time = 0; // position in beats
    pauseTime: number | null = 0;
    paused = true;
    constructor(
        public patterns: Pattern[],
        public noteShapes: NoteShape[],
        public timeline: EventSequence<number>,
        public tempo: number) {
    }
    play() {
        this.paused = false;
        if (this.pauseTime !== null) {
            this.time = this.pauseTime;
            this.pauseTime = null;
        }
    }
    stop() {
        const events = this.pause();
        this.time = 0;
        this.pauseTime = null;
        return events;
    }
    pause() {
        if (!this.paused) {
            this.pauseTime = this.time;
        }
        this.paused = true;
        return this.seek(0);
    }
    /** dt is in SECONDS */
    advance(dt: number): SequencerEvent[] {
        if (this.paused) return [];
        return this.seek(this.time + dt * 60 / this.tempo);
    }
    /** time is in BEATS */
    seek(time: number): SequencerEvent[] {
        // Make NOTE_OFF for notes that are no longer under the playhead
        // Make NOTE_ON for notes that are newly appeared under the playhead
        // Then process the BEND events
    }
    getAtPlayhead(): unknown {

    }
}
