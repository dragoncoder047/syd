import { EventSequence, NoteShape, Pattern } from "./types";

export interface SequencerEvent {
    kind: SequencerEventType;
    isMod: boolean;
    targetInstrument: string | number;
    value: number;
    duration: number;
}

export enum SequencerEventType {
    NOTE_ON,
    NOTE_OFF,
    PITCH_BEND,
    EXPR_BEND,
}

export class Sequencer {
    beatPos = 0; // position in beats
    paused = true;
    constructor(
        public patterns: Pattern[],
        public noteShapes: NoteShape[],
        public timeline: EventSequence<number>,
        public tempo: number) {
    }
    private _pt: number | null = 0;
    play() {
        this.paused = false;
        if (this._pt !== null) {
            this.beatPos = this._pt;
            this._pt = null;
        }
    }
    stop() {
        const events = this.pause();
        this.beatPos = 0;
        this._pt = null;
        return events;
    }
    pause() {
        if (!this.paused) {
            this._pt = this.beatPos;
        }
        this.paused = true;
        return this.seek(0);
    }
    /** dt is in SECONDS */
    advance(dt: number): SequencerEvent[] {
        if (this.paused) return [];
        return this.seek(this.beatPos + dt * this.tempo / 60);
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
