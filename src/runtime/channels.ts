import { Matrix, scalarMatrix } from "../matrix";

export class Channels {
    n = new Map<string, number>();
    c: Matrix[] = [];
    put(name: string, value: Matrix) {
        if (!this.n.has(name)) {
            this.n.set(name, this.c.push(value.clone()) - 1);
        } else {
            this.c[this.n.get(name)!]!.copyFrom(value);
        }
    }
    reset() {
        for (var i = 0; i < this.c.length; i++) {
            this.c[i]!.fill(0);
        }
    }
    get(name: string): Matrix {
        if (!this.n.has(name)) this.put(name, scalarMatrix(0));
        return this.c[this.n.get(name)!]!;
    }
}
