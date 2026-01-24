import { expect, test } from "bun:test";
import { Conductor } from "../src/sequencer/conductor";
import { createTempoTreeState } from "../src/sequencer/tempoTree";
import { TempoTrack } from "../src/songFormat";

test("maintain beat position when tempo is hot-swapped", () => {
    const conductor = new Conductor(createTempoTreeState([
        { delta: 0, data: 120 },
        { delta: 32, data: 120 }
    ]));

    // Seek to beat 16
    conductor.beatPos = 16;

    // BPM at beat 16 with 120 BPM tempo
    expect(conductor.curBPM).toEqual(120);

    // Hot-swap to 240 BPM
    conductor.state = createTempoTreeState([
        { delta: 0, data: 240 },
        { delta: 32, data: 240 }
    ]);

    // Beat position should be preserved
    expect(conductor.beatPos).toEqual(16);
    // BPM interpretation is updated to new tempo
    expect(conductor.curBPM).toEqual(240);
});

test("handles multiple hot-swaps", () => {
    const conductor = new Conductor(createTempoTreeState([
        { delta: 0, data: 120 },
        { delta: 32, data: 120 }
    ]));

    // Seek to beat 10
    conductor.beatPos = 10;
    expect(conductor.curBPM).toEqual(120);

    // Swap to 240 BPM
    conductor.state = createTempoTreeState([
        { delta: 0, data: 240 },
        { delta: 32, data: 240 }
    ]);
    expect(conductor.beatPos).toEqual(10);
    expect(conductor.curBPM).toEqual(240);

    // Swap to 60 BPM
    conductor.state = createTempoTreeState([
        { delta: 0, data: 60 },
        { delta: 32, data: 60 }
    ]);
    expect(conductor.beatPos).toEqual(10);
    expect(conductor.curBPM).toEqual(60);
});

test("works with complex tempo patterns after hot-swap", () => {
    const conductor = new Conductor(createTempoTreeState([
        { delta: 0, data: 120 },
        { delta: 32, data: 120 }
    ]));

    // Seek to beat 16
    conductor.beatPos = 16;

    // Hot-swap to complex pattern
    const complexTempo: TempoTrack = [
        { delta: 0, data: 100 },
        { delta: 16, data: 100 },
        { delta: 16, data: 150 },
        { delta: 0, data: 120 },
        { delta: 32, data: 120 },
        { delta: 64, data: 120 },
        { delta: 0, data: 90 },
        { delta: 32, data: 90 }
    ];
    conductor.state = createTempoTreeState(complexTempo);

    // Beat position preserved
    expect(conductor.beatPos).toEqual(16);
    // BPM at beat 16 should be from new pattern (at ramp start, 100 BPM)
    expect(conductor.curBPM).toBeGreaterThanOrEqual(100);
});

test("hot-swapping and then seeking doesn't crash", () => {
    const conductor = new Conductor(createTempoTreeState([
        { delta: 0, data: 120 },
        { delta: 32, data: 120 }
    ]));

    // Hot-swap
    conductor.state = createTempoTreeState([
        { delta: 0, data: 240 },
        { delta: 32, data: 240 }
    ]);

    // Should be able to seek without errors
    conductor.beatPos = 20;
    expect(conductor.curBPM).toEqual(240);
});

test("advances beat position based on tempo", () => {
    const conductor = new Conductor(createTempoTreeState([
        { delta: 0, data: 120 },
        { delta: 32, data: 120 }
    ]));

    conductor.beatPos = 10;

    // Advance by 1 second at 120 BPM = 2 beats
    conductor.advance(1);
    expect(conductor.beatPos).toEqual(12);

    // Hot-swap to 240 BPM
    conductor.state = createTempoTreeState([
        { delta: 0, data: 240 },
        { delta: 32, data: 240 }
    ]);

    // Should have updated BPM
    expect(conductor.curBPM).toEqual(240);

    // Advance by 1 second at 240 BPM = 4 beats
    conductor.advance(1);
    expect(conductor.beatPos).toEqual(16);
});

test("maintains beat position during hot-swap with advance", () => {
    const conductor = new Conductor(createTempoTreeState([
        { delta: 0, data: 120 },
        { delta: 32, data: 120 }
    ]));

    conductor.beatPos = 5;
    conductor.advance(.5); // Advance by 1/2 second = 1 beat, now at 6
    expect(conductor.beatPos).toEqual(6);

    // Hot-swap
    conductor.state = createTempoTreeState([
        { delta: 0, data: 240 },
        { delta: 32, data: 240 }
    ]);

    // Beat position preserved
    expect(conductor.beatPos).toEqual(6);
    expect(conductor.curBPM).toEqual(240);

    // Continue advancing with new tempo
    conductor.advance(.5); // 1/2 second at 240 BPM = 2 beats
    expect(conductor.beatPos).toEqual(8);
});
