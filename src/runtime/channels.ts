import { Matrix, scalarMatrix } from "../math/matrix";

export class Channel {
    u = true;
    constructor(public v: Matrix,
        public s: boolean = false) { }
    update() {
        if (!this.s && this.u) {
            this.v.fill(0);
            this.u = false;
        }
    }
}

export class Channels {
    n = new Map<string, number>();
    c: Channel[] = [];
    setup(name: string, sticky: boolean) {
        const i = this.n.get(name)!;
        if (i === undefined) {
            this.n.set(name, this.c.push(new Channel(scalarMatrix(0), sticky)) - 1);
        } else {
            this.c[i]!.s = sticky;
        }
    }
    put(name: string, value: Matrix) {
        const i = this.n.get(name)!;
        if (i === undefined) {
            this.n.set(name, this.c.push(new Channel(value.clone())) - 1);
        } else {
            const c = this.c[i]!;
            c.v.copyFrom(value);
            c.u = true;
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
