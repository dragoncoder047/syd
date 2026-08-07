import { ceil, max, min } from "lib0/math";

// With apologies to Zack Freedman
type voidstar = number;
type size_t = number;

const nextHighest16 = (n: number) => (n + 15) & ~15;
const nullptr: voidstar = 0;

type FreelistChunk = [start: voidstar, end: voidstar];

function mergeChunks(prev: FreelistChunk | undefined, cur: FreelistChunk, next: FreelistChunk | undefined) {
    const items: FreelistChunk[] = [];
    if (prev) {
        if (prev[1] === cur[0]) cur[0] = prev[0];
        else items.push(prev);
    }
    items.push(cur);
    if (next) {
        if (next[0] === cur[1]) cur[1] = next[1];
        else items.push(next);
    }
    return items;
}

function memcpy(buffer: ArrayBuffer, from: voidstar, to: voidstar, nBytes: size_t) {
    new Uint8Array(buffer).set(new Uint8Array(buffer, from, nBytes), to);
}

export class Malloc {
    freelist: FreelistChunk[] = [];
    allocated = new Map<voidstar, size_t>();
    heapTop: voidstar;
    constructor(public heap: WebAssembly.Memory, public bss: voidstar = 1024) {
        this.heapTop = bss;
    }
    #ensure(bytes: size_t) {
        const have = this.heap.buffer.byteLength;
        if (bytes > have) this.heap.grow(ceil((bytes - have) / 65536));
    }
    malloc(bytes: size_t): voidstar {
        if (bytes < 1) return nullptr;
        bytes = nextHighest16(bytes);
        const freelist = this.freelist;
        for (var i = 0; i < freelist.length; i++) {
            const chunk = freelist[i]!;
            const size = chunk[1] - chunk[0];
            if (size >= bytes) {
                const ptr = chunk[0];
                if (size === bytes) freelist.splice(i, 1);
                else chunk[0] += bytes;
                this.allocated.set(ptr, bytes);
                return ptr;
            }
        }
        const ptr = this.heapTop;
        this.#ensure(this.heapTop += bytes);
        this.allocated.set(ptr, bytes);
        return ptr;
    }
    free(ptr: voidstar) {
        if (!ptr) return;
        const size = this.allocated.get(ptr);
        if (!size) return; // easy double free protection
        const freelist = this.freelist;
        var i = freelist.findIndex(b => b[0] > ptr);
        if (i === -1) i = freelist.length;
        freelist.splice(i > 0 ? i - 1 : 0, i > 0 ? 2 : 1, ...mergeChunks(freelist[i - 1], [ptr, ptr + size], freelist[i]));
        this.allocated.delete(ptr);
    }
    realloc(ptr: voidstar, bytes: size_t): voidstar {
        if (!ptr) return this.malloc(bytes);
        if (!bytes) return this.free(ptr), nullptr;
        bytes = nextHighest16(bytes);
        const oldBytes = this.allocated.get(ptr)!;
        const change = bytes - oldBytes;
        const oldEnd = oldBytes + ptr;
        const freelist = this.freelist;
        const i = freelist.findIndex(b => b[0] === oldEnd);
        if (i >= 0) {
            const b = freelist[i]!;
            const nbs = b[1] - b[0];
            if (nbs === change) freelist.splice(i, 1);
            else if (nbs > change) b[0] += change;
            this.allocated.set(ptr, bytes);
            this.#ensure(bytes);
            return ptr;
        }
        if (ptr + oldBytes === this.heapTop) {
            // last chunk grows for free
            this.allocated.set(ptr, bytes);
            this.#ensure(this.heapTop += change);
            return ptr;
        }
        // else free and re-malloc
        const new_ = this.malloc(bytes);
        if (!new_) return nullptr;
        memcpy(this.heap.buffer, ptr, new_, min(bytes, oldBytes));
        this.free(ptr);
        return new_;
    }
}
