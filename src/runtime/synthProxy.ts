import { Matrix } from "../math/matrix";
import { str } from "../utils";
import { Synth } from "./synth";

export function newSynth(context: AudioContext): SynthRPCProxy {
    try {
        return makeSynthProxy(new AudioWorkletNode(context, "syd", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] }));
    } catch (e: any) {
        if (e.name === "InvalidStateError") {
            throw new Error("failed to create Syd synthesizer node. Did you call initWorklet() and await the result?", { cause: e })
        }
        throw e;
    }
}

function makeSynthProxy(audioNode: AudioWorkletNode): SynthRPCProxy {
    var idCounter = 0;
    const resolvers = new Map<number, ReturnType<PromiseConstructor["withResolvers"]>>();
    const tickHandlers = new Set<Parameters<ProxyObject["onTick"]>[0]>();
    audioNode.port.onmessage = event => {
        const data: MessageReply = event.data;
        if (data.t) {
            const resurrected = Object.fromEntries(data.w.map(([k, v]) => [k, Matrix.resurrect(v)]));
            tickHandlers.forEach(h => h(data.dt, resurrected));
            return;
        }
        console.log("[main thread] received message reply", data);
        const p = resolvers.get(data.i);
        if (p) {
            if (data.e) p.reject(data.r);
            else p.resolve(data.r);
        }
        resolvers.delete(data.i);
        // reuse message IDs when possible
        if (resolvers.size === 0) idCounter = 0;
    };
    return new Proxy<ProxyObject>({
        audioNode,
        onTick(cb) {
            tickHandlers.add(cb);
            return {
                cancel() {
                    tickHandlers.delete(cb);
                }
            }
        },
    }, {
        get(target: any, m: keyof SynthRPCProxy) {
            if (m in target) return target[m];
            return (...a: Message["a"]) => {
                const id = idCounter++;
                const p = Promise.withResolvers();
                resolvers.set(id, p);
                audioNode.port.postMessage({ n: id, m, a } as Message);
                return p.promise;
            };
        },
        set(_, p) {
            throw new TypeError(`Cannot set property of ProxiedSynth ${str(p)} which is read-only`);
        }
    }) as SynthRPCProxy;
}

type SynthMethod = {
    [K in keyof Synth]: Synth[K] extends Function ? K : never;
}[keyof Synth];

type PromiseFunction<T extends (...args: any) => any> = (...args: Parameters<T>) => Promise<ReturnType<T>>;

export type Message<T extends SynthMethod = SynthMethod> = {
    m: T;
    n: number;
    a: Parameters<Synth[T]>;
};
export type MessageReply<T extends SynthMethod = SynthMethod> = {
    i: number;
    r: ReturnType<Synth[T]>;
    e: false;
    t: false;
} | {
    i: number;
    r: Error;
    e: true;
    t: false;
} | {
    t: true;
    w: [string, { rows: number, cols: number, data: Float32Array }][];
    dt: number;
};

type ProxyObject = {
    audioNode: AudioWorkletNode;
    onTick(cb: (dt: number, watchedChannels: Record<string, Matrix>) => void): { cancel(): void };
}
export type SynthRPCProxy = ProxyObject & {
    [K in SynthMethod]: PromiseFunction<Synth[K]>
}
