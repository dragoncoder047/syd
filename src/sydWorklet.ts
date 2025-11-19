import { WorkletSynth } from "./runtime/synthImpl";
import { Message, MessageReply } from "./runtime/synthProxy";

registerProcessor("syd", class extends AudioWorkletProcessor {
    synth: WorkletSynth = new WorkletSynth(1 / sampleRate);
    constructor() {
        super();
        this.port.onmessage = e => this.handleMessage(e.data as Message);
        console.log("[audio worklet thread] setup message handler");
    }
    async handleMessage(m: Message) {
        try {
            console.log("[audio worklet thread] received message", m);
            const result = await (this.synth as any)[m.method](...m.args);
            this.port.postMessage({ id: m.id, result, failed: false } as MessageReply);
        } catch (e) {
            this.port.postMessage({ id: m.id, result: e as Error, failed: true } as MessageReply);
        }
    }
    process(inputs: Float32Array[][], outputs: Float32Array[][]) {
        if (outputs.length > 0)
            (this.synth as any)?.process(outputs[0]![0]!, outputs[0]![1]!);
        return true;
    }
});
