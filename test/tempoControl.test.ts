import { expect, test } from "bun:test";
import { beatToTime, createTempoControlState, getBPMAtBeat, timeToBeat } from "../src/sequencer/tempoController";

test("creates tempo tree correctly", () => {
    const state = createTempoControlState([
        { delta: 0, data: [120, 120] },
        { delta: 32, data: [120, 120] }
    ]);

    expect(state).toEqual([
        {
            p: {
                l: 120,
                r: 120,
                t: 0,
            },
            ts: 0
        },
        {
            p: {
                l: 120,
                r: 120,
                t: 32,
            },
            ts: 16
        }
    ]);
});

test("handles constant tempo", () => {
    const state = createTempoControlState([
        { delta: 0, data: [120, 120] },
        { delta: 32, data: [120, 120] }
    ]);

    // At 120 BPM, 1 beat = 0.5 seconds
    // 32 beats = 16 seconds
    expect(beatToTime(state, 32)).toEqual(16);

    // Reverse lookup
    expect(timeToBeat(state, 16)).toEqual(32);
});

test("handles step tempo changes", () => {
    const state = createTempoControlState([
        { delta: 0, data: [120, 120] },
        { delta: 32, data: [120, 240] },
        { delta: 32, data: [240, 240] }
    ]);

    // First 32 beats at 120 BPM = 16 seconds
    expect(beatToTime(state, 32)).toEqual(16);

    // Next 32 beats at 240 BPM = 8 seconds (half the time)
    // Total = 24 seconds at beat 64
    expect(beatToTime(state, 64)).toEqual(24);

    // Reverse lookup
    expect(timeToBeat(state, 24)).toEqual(64);
});

test("handles linear tempo ramps", () => {
    const state = createTempoControlState([
        { delta: 0, data: [120, 120] },
        { delta: 32, data: [240, 240] }
    ]);

    // Check midpoint (beat 16)
    const timeMidRamp = beatToTime(state, 16)!;
    expect(timeMidRamp).toEqual(6);

    // round-trip at midpoint
    const beatMid = timeToBeat(state, timeMidRamp);
    expect(beatMid).toEqual(16);
});

test("can get BPM at any beat position", () => {
    const state = createTempoControlState([
        { delta: 0, data: [100, 100] },
        { delta: 100, data: [200, 200] }
    ]);

    // At start
    expect(getBPMAtBeat(state, 0)).toEqual(100);

    // 1/4 of the way through
    expect(getBPMAtBeat(state, 25)).toEqual(125);

    // At midpoint of ramp
    expect(getBPMAtBeat(state, 50)).toEqual(150);

    // 3/4 of the way through
    expect(getBPMAtBeat(state, 75)).toEqual(175);

    // At end of ramp
    expect(getBPMAtBeat(state, 100)).toEqual(200);
});

test("handles complex tempo patterns", () => {
    const state = createTempoControlState([
        { delta: 0, data: [100, 100] },
        { delta: 16, data: [100, 100] },
        { delta: 16, data: [150, 150] },
        { delta: 32, data: [120, 120] },
        { delta: 64, data: [120, 120] },
        { delta: 32, data: [90, 90] }
    ]);

    // Verify roundtripping at various points
    const testBeats = [0, 16, 32, 64, 128, 160];
    for (const beat of testBeats) {
        expect(timeToBeat(state, beatToTime(state, beat)!)).toEqual(beat);
    }

    // Verify BPM transitions
    expect(getBPMAtBeat(state, 0)).toEqual(100);
    expect(getBPMAtBeat(state, 24)).toEqual(125);
    expect(getBPMAtBeat(state, 48)).toEqual(135);
    expect(getBPMAtBeat(state, 64)).toEqual(120);
});
