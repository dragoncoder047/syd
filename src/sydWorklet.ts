import { Synth } from "./runtime/synth";
import { Message, MessageReply } from "./runtime/synthProxy";

registerProcessor("syd", class extends AudioWorkletProcessor {
    synth: Synth = new Synth(1 / sampleRate, this.port);
    constructor() {
        super();
        this.port.onmessage = e => this.handleMessage(e.data as Message);
        console.log("[audio worklet thread] setup message handler");
    }
    async handleMessage(m: Message) {
        try {
            console.log("[audio worklet thread] received message", m);
            const result = await (this.synth as any)[m.m](...m.a);
            this.port.postMessage({ i: m.n, r: result, e: false, t: false } as MessageReply);
        } catch (e) {
            this.port.postMessage({ i: m.n, r: e as Error, e: true, t: false } as MessageReply);
        }
    }
    process(_: Float32Array[][], outputs: Float32Array[][]) {
        if (outputs.length > 0)
            (this.synth as any)?.process(outputs[0]![0]!, outputs[0]![1]!);
        return true;
    }
});
