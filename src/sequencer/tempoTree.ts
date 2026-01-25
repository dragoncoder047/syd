import { exp, ln } from "../math/math";
import { AVLNode, Comparator, NodeMaker, combinedHeight, compareNumbers, treeInsertOrUpdate } from "../math/tree/avl";
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
    /** Subtree span in beats */
    readonly len: number;
    /** Subtree span in seconds */
    readonly lenSec: number;
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
        len: (left?.len ?? 0) + (right?.len ?? 0) + ((right?.lb ?? t) - (left?.rb ?? t)),
        rb: right?.rb ?? t,
        lb: left?.lb ?? t,
        rr: right?.rr ?? pt.r,
        ll: left?.ll ?? pt.l,
        lenSec: (left?.lenSec ?? 0) + (right?.lenSec ?? 0) + (left && right ? segmentBeatNumberToTime(right.lb - left.rb, left.rr, right.ll, right.lb - left.rb) : right ? segmentBeatNumberToTime(right.k - t, pt.r, right.ll, right.k - t) : left ? segmentBeatNumberToTime(t - left.k, left.rr, pt.l, t - left.k) : 0),
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


/**
 * Generic helper to find a segment by traversing the tree.
 * @param tree The tree to search
 * @param comparator Returns -1 if searchValue is in left subtree, 0 if in current segment, 1 if in right subtree
 * @returns The segment and accumulated offsets, or undefined if not found
 */
function findSegmentInTree(
    tree: TempoTreeNode | null,
    comparator: (node: TempoTreeNode, accumulatedBeat: number, accumulatedTime: number) => -1 | 0 | 1,
): SegmentWithOffset | undefined {
    // This function may be bugged.
    let node = tree;
    let accumulatedBeat = 0;
    let accumulatedTime = 0;

    while (node) {
        const cmp = comparator(node, accumulatedBeat, accumulatedTime);

        if (cmp === -1) {
            // Search in left subtree
            node = node.l ?? null;
        } else if (cmp === 0) {
            // Found the segment: from this node to its right child
            const rightChild = node.r;
            return {
                l: node.d,
                r: rightChild?.d ?? node.d,
                len: rightChild ? (rightChild.lb - node.k) : 0,
                ab: accumulatedBeat + (node.l?.len ?? 0),
                at: accumulatedTime + (node.l?.lenSec ?? 0),
            };
        } else {
            // Search in right subtree
            const segmentLen = (node.rb ?? node.k) - node.k;
            accumulatedBeat += (node.l?.len ?? 0) + ((node.rb ?? node.k) - (node.lb ?? node.k));
            accumulatedTime += (node.l?.lenSec ?? 0) + segmentBeatNumberToTime(segmentLen, node.d.r, node.rr ?? node.d.r, segmentLen);
            node = node.r ?? null;
        }
    }

    return undefined;
}

/** Find segment containing beat with accumulated offsets */
function findSegmentAndOffsetByBeat(tree: TempoTreeNode | null, beat: number): SegmentWithOffset | undefined {
    return findSegmentInTree(
        tree,
        (node, accBeat, accTime) => {
            // This function may be bugged.
            const beatSpan = (node.rb ?? node.k) - (node.lb ?? node.k);
            const leftBeatLen = node.l?.len ?? 0;
            if (beat < accBeat + leftBeatLen) return -1;
            if (beat < accBeat + leftBeatLen + beatSpan) return 0;
            return 1;
        },
    );
}

/** Find segment containing time with accumulated offsets */
function findSegmentAndOffsetByTime(tree: TempoTreeNode | null, time: number): SegmentWithOffset | undefined {
    return findSegmentInTree(
        tree,
        (node, accBeat, accTime) => {
            // This function may be bugged.
            const beatSpan = (node.rb ?? node.k) - (node.lb ?? node.k);
            const timeSpan = segmentBeatNumberToTime(beatSpan, node.d.r, node.rr ?? node.d.r, beatSpan);
            const leftTimeLen = node.l?.lenSec ?? 0;
            if (time < accTime + leftTimeLen) return -1;
            if (time < accTime + leftTimeLen + timeSpan) return 0;
            return 1;
        },
    );
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
