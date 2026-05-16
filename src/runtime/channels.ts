import { Matrix, Matrix_clone, Matrix_copyFrom, Matrix_fill_i, Matrix_fromScalar } from "@r47onfire/game-math";

export class Channel {
    u = true;
    constructor(public v: Matrix,
        public s: boolean = false) { }
    update() {
        if (!this.s && this.u) {
            Matrix_fill_i(this.v, 0);
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
            this.n.set(name, this.c.push(new Channel(Matrix_fromScalar(0), sticky)) - 1);
        } else {
            this.c[i]!.s = sticky;
        }
    }
    put(name: string, value: Matrix) {
        const i = this.n.get(name)!;
        if (i === undefined) {
            this.n.set(name, this.c.push(new Channel(Matrix_clone(value))) - 1);
        } else {
            const c = this.c[i]!;
            Matrix_copyFrom(c.v, value);
            c.u = true;
        }
    }
    clear() {
        this.c = [];
        this.n.clear();
    }
    get(name: string): Matrix {
        if (!this.n.has(name)) this.put(name, Matrix_fromScalar(0));
        return this.c[this.n.get(name)!]!.v;
    }
    update() {
        for (var i = 0; i < this.c.length; i++) {
            this.c[i]!.update();
        }
    }
}
