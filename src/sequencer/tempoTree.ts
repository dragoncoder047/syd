import { exp, ln } from "../math/math";
import { AVLNode, Comparator, NodeMaker, combinedHeight, compareNumbers, treeGetBookends, treeInsertOrUpdate } from "../math/tree/avl";
import { TempoTrack } from "../songFormat";

/**
 * Each point represents the boundary between two regions of
 * smooth tempo interpolation. If l != r, the tempo does a
 * step change at this control point.
 */
export interface TempoControlPoint {
    /** BPM on left side of point */
    readonly l: number;
    /** BPM on right side of point */
    readonly r: number;
}

export interface TempoTreeNode extends AVLNode<number, TempoControlPoint> {
    /** Left subtree span from leftmost to center in seconds */
    readonly lt: number;
    /** Right subtree span from center to rightmost in seconds */
    readonly rt: number;
    /** rightmost child t in beats */
    readonly rb: number;
    /** leftmost child t in beats */
    readonly lb: number;
    /** Rightmost child's right bpm */
    readonly rr: number;
    /** Leftmost child's left bpm */
    readonly ll: number;
}

export const createTempoTreeNode: NodeMaker<TempoTreeNode, TempoControlPoint, number> = (t, pt, left, right) => {
    return {
        k: t,
        d: pt,
        l: left,
        r: right,
        h: combinedHeight(left, right),
        rb: right?.rb ?? t,
        lb: left?.lb ?? t,
        rr: right?.rr ?? pt.r,
        ll: left?.ll ?? pt.l,
        lt: left ? left.lt + left.rt + segmentBeatNumberToTime(t - left.rb, left.rr, pt.l, t - left.rb) : 0,
        rt: right ? right.lt + right.rt + segmentBeatNumberToTime(right.lb - t, pt.r, right.ll, right.lb - t) : 0,
    }
}

export function createTempoTreeState(baseTrack: TempoTrack): TempoTreeNode | null {
    if (baseTrack.length < 2) return null;
    if (baseTrack[0]!.delta !== 0) throw new Error("first delta must be zero to set the initial tempo");
    var beatPos = 0;
    var tree: TempoTreeNode | null = null;

    for (var { delta, data: [l, r] } of baseTrack) {
        beatPos += delta;
        tree = treeInsertOrUpdate(tree, beatPos, { l, r }, createTempoTreeNode, compareNumbers);
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
export function beatToTime(track: TempoTreeNode | null, beat: number): number {
    if (!track) throw new Error("empty conductor track");
    if (track.lb > beat || track.rb < beat) throw new Error("beat out of range of track");
    const result = findSegmentAndOffsetByBeat(track, beat);
    const { l: { r: bpmStart }, r: { l: bpmEnd }, len, ab: accumulatedBeat, at: accumulatedTime } = result;
    return accumulatedTime + segmentBeatNumberToTime(beat - accumulatedBeat, bpmStart, bpmEnd, len);
}

/**
 * Convert time in seconds to beat position using the tree.
 */
export function timeToBeat(track: TempoTreeNode | null, time: number): number {
    if (!track) throw new Error("empty conductor track");
    if (time < 0 || time > (track.lt + track.rt)) throw new Error("beat out of range of track");
    const result = findSegmentAndOffsetByTime(track, time);
    const { l: { r: bpmStart }, r: { l: bpmEnd }, len, ab: accumulatedBeat, at: accumulatedTime } = result;
    return accumulatedBeat + segmentTimeToBeatPosition(time - accumulatedTime, bpmStart, bpmEnd, len);
}

interface SegmentWithOffset {
    /** Left tempo control point in the segment bounding the requested time or beat */
    l: TempoControlPoint;
    /** Right tempo control point in the segment bounding the requested time or beat */
    r: TempoControlPoint;
    /** Length of the segment in beats */
    len: number;
    /** Accumulated beats since the beginning to the start of the segment */
    ab: number;
    /** Accumulated seconds since the beginning to the start of the segment */
    at: number;
}

function findSegmentHelper(tree: TempoTreeNode, shouldGoLeft: (accumulatedBeat: number, accumulatedTime: number) => boolean): SegmentWithOffset {
    var left: TempoTreeNode = null as any;
    var right: TempoTreeNode = null as any;
    var accumulatedSeconds = 0;
    var accumulatedBeat = 0;

    while (tree) {
        console.log("loop", left, right, accumulatedBeat, accumulatedSeconds);
        if (shouldGoLeft(tree.k, accumulatedSeconds + tree.lt)) {
            tree = (right = tree).l!;
            console.log("go left");
        } else {
            accumulatedSeconds += tree.lt;
            accumulatedBeat = tree.lb;
            tree = (left = tree).r!;
            console.log("go right");
        }
    }
    console.log("final", left, right, accumulatedBeat, accumulatedSeconds);
    return {
        l: left.d,
        r: right.d,
        len: right.k - left.k,
        ab: accumulatedBeat,
        at: accumulatedSeconds
    }
}

/** Find segment containing beat with accumulated offsets */
function findSegmentAndOffsetByBeat(tree: TempoTreeNode, beat: number): SegmentWithOffset {
    console.log("find segment by beat", beat);
    return findSegmentHelper(tree, searchBeat => searchBeat > beat)
}

/** Find segment containing time with accumulated offsets */
function findSegmentAndOffsetByTime(tree: TempoTreeNode, time: number): SegmentWithOffset {
    console.log("find segment by time", time);
    return findSegmentHelper(tree, (_, searchTime) => searchTime > time);
}

/**
 * Get BPM at a specific beat position using the tree.
 */
export function getBPMAtBeat(tree: TempoTreeNode | null, beat: number): number {
    if (!tree) throw new Error("empty conductor track");
    if (tree.lb > beat || tree.rb < beat) throw new Error("beat out of range of track");
    const result = findSegmentAndOffsetByBeat(tree, beat);
    const { l: { r: bpmStart }, r: { l: bpmEnd }, len, ab: accumulatedBeat } = result;
    return bpmStart + (bpmEnd - bpmStart) * (beat - accumulatedBeat) / len;
}
