import { Matrix, scalarMatrix } from "../math/matrix";

export class Channel {
    constructor(public v: Matrix,
        public s: boolean = false) { }
    update() {
        if (!this.s) {
            this.v.fill(0);
        }
    }
}

export class Channels {
    n = new Map<string, number>();
    c: Channel[] = [];
    setup(name: string, sticky: boolean) {
        if (!this.n.has(name)) {
            this.n.set(name, this.c.push(new Channel(scalarMatrix(0), sticky)) - 1);
        } else {
            this.c[this.n.get(name)!]!.s = sticky;
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
