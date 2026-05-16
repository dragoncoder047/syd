import { abs, max, min } from "lib0/math";
import { exp, ln } from "../math/math";
import { TempoTrack } from "../songFormat";

/**
 * Each point represents the boundary between two regions of
 * smooth tempo interpolation. If l != r, the tempo does a
 * step change at this control point.
 */
export interface TempoControlPoint {
    /** Abolute position in beats */
    readonly t: number;
    /** BPM on left side of point */
    readonly l: number;
    /** BPM on right side of point */
    readonly r: number;
}

export interface TempoControlData {
    readonly p: TempoControlPoint;
    /** Time in seconds position of this control point */
    readonly ts: number;
}

export function createTempoControlState(baseTrack: TempoTrack): TempoControlData[] {
    if (baseTrack.length < 2) return [];
    if (baseTrack[0]!.delta !== 0) throw new Error("first delta must be zero to set the initial tempo");
    var beatPos = 0;
    const data: TempoControlData[] = []

    for (var { delta, data: [l, r] } of baseTrack) {
        beatPos += delta;
        data.push({ ts: null as any, p: { t: beatPos, l, r } });
    }
    return fixAbsoluteTimeMarkers(data, 0);
}

/**
 * Returns a new track with the known-bad datapoints recalculated.
 */
export function fixAbsoluteTimeMarkers(track: TempoControlData[], firstKnownBadIndex: number): TempoControlData[] {
    track = track.slice();
    for (var i = firstKnownBadIndex; i < track.length; i++) {
        const here = track[i]!;
        const prev = track[i - 1]!;
        const len = i === 0 ? 0 : here.p.t - prev.p.t;
        track[i] = {
            p: here.p,
            ts: i === 0 ? 0 : prev.ts + assertNotNaN(segmentBeatNumberToTime(len, prev.p.r, here.p.l, len), len, prev.p.r, here.p.l),
        }
    }
    return track;
}

function assertNotNaN(x: number, len: number, left: number, right: number): number {
    if (isNaN(x)) throw `NAN: ${len} ${left} ${right}`;
    return x;
}

export function segmentBeatNumberToTime(
    beatPos: number,
    bpmStart: number,
    bpmEnd: number,
    lenBeats: number,
): number {

    /*
    octave:1> pkg load symbolic
    octave:2> syms s n d b t real positive % cSpell: ignore syms
    Symbolic pkg v3.2.1: Python communication link active, SymPy v1.14.0.
    octave:3> int(60/(s+(n-s)*b/d), b, 0, t)
    ans = (sym)

    60⋅d⋅log(-d⋅s)   60⋅d⋅log(-d⋅s + t⋅(-n + s))
    ────────────── - ───────────────────────────
        -n + s                 -n + s

    octave:4> simplify(ans)
    ans = (sym)

    60⋅d⋅(-log(-d⋅s) + log(-d⋅s - t⋅(n - s)))
    ─────────────────────────────────────────
                        n - s
    */
    const spbStart = 60 / bpmStart;
    if (bpmStart === bpmEnd) {
        // prevent divide by zero
        return beatPos * spbStart;
    } else {
        const nms = bpmEnd - bpmStart;
        const nds = lenBeats * bpmStart;
        // Why the abs()'es fix this I have no idea.
        return 60 * lenBeats * (-ln(nds) + ln(abs(-nds - beatPos * nms))) / nms;
    }
}

export function segmentTimeToBeatPosition(
    timeOffset: number,
    bpmStart: number,
    bpmEnd: number,
    lenBeats: number,
): number {
    /*
    octave:5> syms time real positive
    octave:6> solve(ans == time, t)
    ans = (sym)

        ⎛ n⋅time    s⋅time⎞  -s⋅time
        ⎜ ──────    ──────⎟  ────────
        ⎜  60⋅d      60⋅d ⎟    60⋅d
    d⋅s⋅⎝ℯ       - ℯ      ⎠⋅ℯ
    ─────────────────────────────────
                    n - s

    octave:7> simplify(ans)
    ans = (sym)

        ⎛ n⋅time    s⋅time⎞  -s⋅time
        ⎜ ──────    ──────⎟  ────────
        ⎜  60⋅d      60⋅d ⎟    60⋅d
    d⋅s⋅⎝ℯ       - ℯ      ⎠⋅ℯ
    ─────────────────────────────────
                    n - s
    */
    const bpsStart = bpmStart / 60;
    if (bpmStart === bpmEnd) {
        // prevent divide by zero
        return timeOffset * bpsStart;
    } else {
        const d60 = 60 * lenBeats;
        const sTerm = exp(bpmStart * timeOffset / d60);
        return lenBeats * bpmStart * (exp(bpmEnd * timeOffset / d60) - sTerm) / sTerm / (bpmEnd - bpmStart);
    }
}


/**
 * Convert beat position to time in seconds using the tree.
 */
export function beatToTime(track: readonly TempoControlData[], beat: number): number {
    if (!track) throw new Error("empty conductor track");
    const first = track[0]!, last = track.at(-1)!;
    if (first.p.t >= beat) return first.ts + 60 / first.p.l * (beat - first.p.t); // off the left side
    if (last.p.t <= beat) return last.ts + 60 / last.p.r * (beat - last.p.t); // off the right side
    const { l: { p: { r: bpmStart, t: accumulatedBeat }, ts: accumulatedTime }, r: { p: { l: bpmEnd, t: nextBeat } } } = findRegion(track, beat, p => p.p.t);
    const len = nextBeat - accumulatedBeat;
    return accumulatedTime + segmentBeatNumberToTime(beat - accumulatedBeat, bpmStart, bpmEnd, len);
}

/**
 * Convert time in seconds to beat position using the tree.
 */
export function timeToBeat(track: readonly TempoControlData[], time: number): number {
    if (!track) throw new Error("empty conductor track");
    const first = track[0]!, last = track.at(-1)!;
    if (first.ts >= time) return first.p.t + first.p.l * (time - first.ts) / 60; // off the left side
    if (last.ts <= time) return last.p.t + last.p.r * (time - last.ts) / 60; // off the right side
    const { l: { p: { r: bpmStart, t: accumulatedBeat }, ts: accumulatedTime }, r: { p: { l: bpmEnd, t: nextBeat } } } = findRegion(track, time, p => p.ts);
    const len = nextBeat - accumulatedBeat;
    return accumulatedBeat + segmentTimeToBeatPosition(time - accumulatedTime, bpmStart, bpmEnd, len);
}

/**
 * Get BPM at a specific beat position using the tree.
 */
export function getBPMAtBeat(track: readonly TempoControlData[], beat: number): number {
    if (!track) throw new Error("empty conductor track");
    const first = track[0]!, last = track.at(-1)!;
    if (first.p.t >= beat) return first.p.l; // off the left side
    if (last.p.t <= beat) return last.p.r; // off the right side
    const { l: { p: { r: bpmStart, t: accumulatedBeat } }, r: { p: { l: bpmEnd, t: nextBeat } } } = findRegion(track, beat, p => p.p.t);
    const len = nextBeat - accumulatedBeat;
    return bpmStart + (bpmEnd - bpmStart) * (beat - accumulatedBeat) / len;
}

interface SegmentBounds<T> { l: T, r: T }
function findRegion<T>(track: readonly T[], value: number, key: (p: T) => number): SegmentBounds<T> {
    const len = track.length;
    const lm1 = len - 1;
    var probe = len >> 1;
    var step = len >> 2 || 1;
    for (; step > 0; step >>= 1) {
        const k = key(track[probe]!);
        if (k === value) break;
        probe = k < value ? min(lm1, probe + step) : max(0, probe - step);
    }
    // sanity corrections
    while (probe > 0 && key(track[probe]!) > value) probe--;
    while (probe < lm1 && key(track[probe + 1]!) <= value) probe++;
    return probe === lm1 ? {
        l: track[lm1 - 1]!,
        r: track[lm1]!,
    } : {
        l: track[probe]!,
        r: track[probe + 1]!,
    }
}
