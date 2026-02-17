import { beatToTime, fixAbsoluteTimeMarkers, getBPMAtBeat, TempoControlData, timeToBeat } from "./tempoController";

/**
 * Playback conductor that maintains beat position relative to a tempo tree.
 * Works with TempoTree for beat-based playback with variable tempo.
 * Supports hot-swapping tempo state mid-playback.
 * 
 * advance() accurately handles tempo ramps by integrating through segments,
 * avoiding precision loss from repeated instantaneous BPM calculations.
 */
export class Conductor {
    #state: TempoControlData[];
    #bPos: number = 0;
    #curBPM: number = 120;

    constructor(tempoState: TempoControlData[]) {
        this.#curBPM = getBPMAtBeat(this.#state = fixAbsoluteTimeMarkers(tempoState), this.#bPos);
    }

    /** Replace the tempo state (hot-swap). Beat position stays the same. */
    set state(newState: TempoControlData[]) {
        this.#curBPM = getBPMAtBeat(this.#state = fixAbsoluteTimeMarkers(newState), this.#bPos);
    }

    get state(): readonly TempoControlData[] {
        return this.#state;
    }

    get beatPos() {
        return this.#bPos;
    }

    set beatPos(beat: number) {
        this.#bPos = beat;
        this.#curBPM = getBPMAtBeat(this.state, this.#bPos);
    }
    get curBPM() {
        return this.#curBPM;
    }
    /** Advance playback by deltaSeconds, accurately integrating through tempo segments. */
    advance(deltaSeconds: number): void {
        this.beatPos = timeToBeat(this.state, beatToTime(this.state, this.beatPos) + deltaSeconds);
    }
}
