import { exp, ln } from "../math/math";
import { AVLNode, leftmostLeaf, treeGetBookends, treeInsertOrUpdate, Comparator, numberComparator } from "../math/tree/avl";
import { cloneTreeNode, makeTreeNode } from "../math/tree/tree";
import { TempoTrack } from "../songFormat";

/**
 * Precomputed data for a single tempo segment.
 * 
 * These are stored in an AVL tree at their beat positions;
 * on their own they form a doubly linked list.
 * 
 * Each point represents the boundary between two regions of
 * smooth tempo interpolation. If l != r, the tempo does a
 * step change at this control point.
 */
export interface TempoControlPoint {
    /** Absolute beat position */
    t: number;
    /** BPM on left side of point */
    l: number;
    /** BPM on right side of point */
    r: number;
    /** Previous point */
    p: TempoControlPoint | null;
    /** Next point */
    n: TempoControlPoint | null;
    /** Duration since previous point in seconds (precalculated for speed) */
    d: number;
}

export type TempoTreeNode = AVLNode<TempoControlPoint, null>;

export const compareTempoTreeNodes: Comparator<TempoControlPoint> = (a, b) => numberComparator(a.t, b.t);

export function createTempoTreeState(baseTrack: TempoTrack): TempoTreeNode | null {
    if (baseTrack.length < 2) return null;
    if (baseTrack[0]!.delta !== 0) throw new Error("first delta must be zero to set the initial tempo");
    var beatPos = 0;
    var prevBPM = baseTrack[0]!.data;
    var tree: TempoTreeNode | null = null;
    var prevPt: TempoControlPoint | null = null;

    for (var { delta, data } of baseTrack.slice(1)) {
        if (delta === 0) {
            // Instantaneous tempo change: modify the previous point's right BPM
            if (prevPt) prevPt.r = data;
        } else {
            // Normal segment: add a new control point
            const durationSeconds = segmentBeatNumberToTime(delta, prevBPM, data, delta);
            const nextPt: TempoControlPoint = {
                t: beatPos,
                l: prevBPM,
                r: data,
                p: prevPt,
                n: null,
                d: durationSeconds,
            };
            if (prevPt) prevPt.n = nextPt;
            tree = treeInsertOrUpdate(
                tree,
                nextPt,
                null,
                makeTreeNode,
                cloneTreeNode,
                compareTempoTreeNodes
            );
            prevPt = nextPt;
            beatPos += delta;
        }
        prevBPM = data;
    }

    return tree;
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
        const nds = -lenBeats * bpmStart;
        return 60 * lenBeats * (-ln(nds) + ln(nds - beatPos * nms)) / nms;
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
export function beatToTime(track: TempoTreeNode | null, beat: number): number | undefined {
    const result = findSegmentAndOffsetByBeat(track, beat);
    if (!result) return;
    const { l: { r: bpmStart }, r: { l: bpmEnd }, len, ab: accumulatedBeat, at: accumulatedTime } = result;
    return accumulatedTime + segmentBeatNumberToTime(beat - accumulatedBeat, bpmStart, bpmEnd, len);
}

/**
 * Convert time in seconds to beat position using the tree.
 */
export function timeToBeat(track: TempoTreeNode | null, time: number): number | undefined {
    const result = findSegmentAndOffsetByTime(track, time);
    if (!result) return;
    const { l: { r: bpmStart }, r: { l: bpmEnd }, len, ab: accumulatedBeat, at: accumulatedTime } = result;
    return accumulatedBeat + segmentTimeToBeatPosition(time - accumulatedTime, bpmStart, bpmEnd, len);
}

interface SegmentWithOffset {
    l: TempoControlPoint;
    r: TempoControlPoint;
    len: number;
    ab: number;
    at: number;
}

/** Find segment containing beat with accumulated offsets */
function findSegmentAndOffsetByBeat(tree: TempoTreeNode | null, beat: number): SegmentWithOffset | undefined {
    if (!tree) return;
    throw "TDO";
}

/** Find segment containing time with accumulated offsets */
function findSegmentAndOffsetByTime(tree: TempoTreeNode | null, time: number): SegmentWithOffset | undefined {
    if (!tree) return;
    throw "TODO";
}

/**
 * Get BPM at a specific beat position using the tree.
 */
export function getBPMAtBeat(tree: TempoTreeNode | null, beat: number): number | undefined {
    const result = findSegmentAndOffsetByBeat(tree, beat);
    if (!result) return undefined;

    const { l: { r: bpmStart }, r: { l: bpmEnd }, len, ab: accumulatedBeat } = result;
    const beatOffset = beat - accumulatedBeat;
    const beatSpan = len;
    const progress = beatOffset / beatSpan;
    return bpmStart + (bpmEnd - bpmStart) * progress;
}
