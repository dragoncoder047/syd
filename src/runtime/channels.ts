import { Matrix, scalarMatrix } from "../math/matrix";

export enum ChannelMode {
    ZEROED,
    STICKY,
}

export class Channel {
    constructor(public v: Matrix,
        public m: ChannelMode = ChannelMode.ZEROED) { }
    update() {
        if (this.m === ChannelMode.ZEROED) {
            this.v.fill(0);
        }
    }
}

export class Channels {
    n = new Map<string, number>();
    c: Channel[] = [];
    setup(name: string, mode: ChannelMode) {
        if (!this.n.has(name)) {
            this.n.set(name, this.c.push(new Channel(scalarMatrix(0), mode)) - 1);
        } else {
            this.c[this.n.get(name)!]!.m = mode;
        }
    }
    put(name: string, value: Matrix) {
        if (!this.n.has(name)) {
            this.n.set(name, this.c.push(new Channel(value.clone())) - 1);
        } else {
            this.c[this.n.get(name)!]!.v.copyFrom(value);
        }
    }
    clear() {
        this.c = [];
        this.n.clear();
    }
    get(name: string): Matrix {
        if (!this.n.has(name)) this.put(name, scalarMatrix(0));
        return this.c[this.n.get(name)!]!.v;
    }
    update() {
        for (var i = 0; i < this.c.length; i++) {
            this.c[i]!.update();
        }
    }
}
