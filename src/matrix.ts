import { max } from "./math";

export class Matrix {
    /** zero-indexed and stored in row-major order,
     * the element at row `i` and column `j` is at index `i * cols + j` */
    data: Float32Array;
    constructor(public rows = 1, public cols = 1) {
        this.data = new Float32Array(rows * cols);
    }
    get isScalar() {
        return this.rows == 1 && this.cols == 1;
    }
    toScalar(): number {
        if (!this.isScalar) throw new Error(`Cannot convert ${this.rows}x${this.cols} matrix to scalar`);
        return this.data[0]!;
    }
    asColumn(): this {
        if (this.rows == 1) this.transpose();
        if (this.cols != 1)
            throw new Error("expected a column vector, but got a matrix");
        return this;
    }
    get isColumnVector() {
        return this.cols == 1;
    }
    equals(other: Matrix) {
        if (other.rows != this.rows || other.cols != this.cols) return false;
        const r = other.rows, c = other.cols;
        for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) if (this.get(i, j) != other.get(i, j)) return false;
        return true;
    }
    get dims() {
        return [this.rows, this.cols];
    }
    resize(rows: number, cols: number): this {
        if (rows < 1 || cols < 1) throw new Error(`invalid dimensions: ${rows}x${cols}`);
        const newLen = rows * cols;
        if (this.data.length < newLen) {
            const newData = new Float32Array(newLen);
            newData.set(this.data);
            this.data = newData;
        }
        this.rows = rows;
        this.cols = cols;
        return this;
    }
    smear(rows: number | null, cols: number | null): this {
        var lastIndex = this.rows * this.cols;
        const last = this.data[lastIndex - 1]!;
        rows ??= this.rows;
        cols ??= this.cols;
        this.resize(rows, cols);
        for (; lastIndex < rows * cols; lastIndex++) {
            this.data[lastIndex] = last;
        }
        return this;
    }
    setScalar(value: number): this {
        this.resize(1, 1);
        this.data[0] = value;
        return this;
    }
    static scalar(x: number): Matrix {
        const m = new this(1, 1);
        m.data[0] = x;
        return m;
    }
    static ofVector(x: number[]) {
        const m = new this(x.length, 1);
        m.data.set(x);
        return m;
    }
    static resurrect(x: { rows: number, cols: number, data: Float32Array }) {
        return new Matrix().copyFrom(x as Matrix);
    }
    static of2DList(xs: number[][]) {
        const rows = xs.length;
        const cols = xs.reduce((m, r) => r.length > m ? r.length : m, 0);
        const m = new this(rows, cols);
        for (var r = 0; r < rows; r++) {
            m.data.set(xs[r]!, r * cols);
        }
        return m;
    }

    copyFrom(other: Matrix) {
        this.resize(other.rows, other.cols);
        this.data.set(other.data);
        return this;
    }
    put(row: number, col: number, data: number) {
        if (row >= this.rows || col >= this.cols) throw new Error(`row ${row}, col ${col} out of range for ${this.rows}x${this.cols} matrix`);
        this.data[row * this.cols + col] = data;
    }
    get(row: number, col: number) {
        if (row >= this.rows || col >= this.cols) throw new Error(`row ${row}, col ${col} out of range for ${this.rows}x${this.cols} matrix`);
        return this.data[row * this.cols + col]!;
    }
    cut(top: number, left: number, source: Matrix) {
        if (source.cols < left + this.cols || source.rows < top + this.rows)
            throw new Error(`not enough room to cut from ${this.rows}x${this.cols} matrix into ${source.rows}x${source.cols} at ${top},${left}`);
        for (var selfRow = 0, sourceRow = top; selfRow < this.rows; selfRow++, sourceRow++)
            for (var selfCol = 0, sourceCol = left; selfCol < this.cols; selfCol++, sourceCol++)
                this.put(selfRow, selfCol, source.get(sourceRow, sourceCol));
    }
    paste(top: number, left: number, target: Matrix) {
        if (target.cols < left + this.cols || target.rows < top + this.rows)
            throw new Error(`not enough room to paste ${this.rows}x${this.cols} matrix into ${target.rows}x${target.cols} at ${top},${left}`);
        for (var selfRow = 0, targetRow = top; selfRow < this.rows; selfRow++, targetRow++)
            for (var selfCol = 0, targetCol = left; selfCol < this.cols; selfCol++, targetCol++)
                target.put(targetRow, targetCol, this.get(selfRow, selfCol));
    }
    clone() {
        return new (this.constructor as typeof Matrix)(this.rows, this.cols).copyFrom(this);
    }
    applyUnary(op: (x: number, row: number, col: number) => number): this {
        for (var i = 0; i < this.rows; i++)
            for (var j = 0; j < this.cols; j++)
                this.put(i, j, op(this.get(i, j), i, j));
        return this;
    }
    applyBinary(op: (x: number, y: number, row: number, col: number) => number, right: Matrix): this {
        zipsize([this, right]);
        const rows = this.rows, cols = this.cols;
        for (var i = 0; i < rows; i++)
            for (var j = 0; j < cols; j++)
                this.put(i, j, op(this.get(i, j), right.get(i, j), i, j));
        return this;
    }
    matMul(right: Matrix): Matrix {
        if (this.cols != right.rows) {
            throw new Error(`dimension mismatch for matrix multiply (${this.rows}x${this.cols} and ${right.rows}x${right.cols})`);
        }
        const aNumRows = this.rows,
            aNumCols = this.cols,
            bNumCols = right.cols,
            m = new (this.constructor as typeof Matrix)(aNumRows, bNumCols);
        for (var r = 0; r < aNumRows; r++) {
            for (var c = 0; c < bNumCols; c++) {
                var sum = 0;
                for (var i = 0; i < aNumCols; i++) sum += this.get(r, i) * right.get(i, c);
                m.put(r, c, sum);
            }
        }
        return m;
    }
    private static _transposePermutationCache: Map<number, Map<number, number[]>> = new Map;
    private static _getPermuter(r: number, c: number): number[] {
        const cache = this._transposePermutationCache;
        var colcache = cache.get(r);
        if (colcache) {
            const cached = colcache.get(c);
            if (cached) return cached;
        } else {
            colcache = new Map;
            cache.set(r, colcache);
        }
        const n = r * c;
        const map = new Array(n);
        for (var ri = 0; ri < r; ri++)
            for (var ci = 0; ci < c; ci++) map[ci * r + ri] = ri * c + ci;
        colcache.set(c, map);
        return map;
    }
    transpose(): this {
        const r = this.rows;
        const c = this.cols;
        const data = this.data;
        if (r == 1 || c == 1) {
            // special case for row / column vector: do nothing
        } else if (r == c) {
            // special case for square matrix
            for (var i = 0; i < r; i++) {
                for (var j = i + 1; j < r; j++) {
                    const a = i * r + j;
                    const b = j * r + i;
                    const tmp = data[a]!;
                    data[a] = data[b]!;
                    data[b] = tmp;
                }
            }
        } else {
            const order = Matrix._getPermuter(r, c);
            const temp = new Float32Array(this.data);
            for (var i = 0; i < order.length; i++) {
                this.data[i] = temp[order[i]!]!;
            }
        }
        this.rows = c;
        this.cols = r;
        return this;
    }
    // For debugging
    dump(): string {
        var out = "";
        for (var row = 0; row < this.rows; row++) {
            if (row > 0) out += "\n";
            out += this.data.subarray(row * this.cols, (row + 1) * this.cols).join("\t");
        }
        return out;
    }
}

export function scalarMatrix(n: number): Matrix {
    return Matrix.scalar(n);
}

/** ensures all of the matrices are all the same size or expands 1x1s to match */
export function zipsize(l1: Matrix[], l2?: Matrix[], l3?: Matrix[]) {
    var w = 0, h = 0, i = 0, len1 = l1.length, len2 = l2?.length, len3 = l3?.length;
    for (; i < len1; i++) {
        w = max(l1[i]!.cols, w);
        h = max(l1[i]!.rows, h);
    }
    if (l2) for (i = 0; i < len2!; i++) {
        w = max(l2[i]!.cols, w);
        h = max(l2[i]!.rows, h);
    }
    if (l3) for (i = 0; i < len3!; i++) {
        w = max(l3[i]!.cols, w);
        h = max(l3[i]!.rows, h);
    }
    checkOrSmear(l1, w, h);
    if (l2) checkOrSmear(l2, w, h);
    if (l3) checkOrSmear(l3, w, h);
}

function checkOrSmear(l: Matrix[], w: number, h: number) {
    var i, len = l.length;
    for (i = 0; i < len; i++) {
        const m = l[i]!;
        if (m.rows === 1 && m.cols === 1) m.smear(h, w);
        else if (m.rows !== h && m.cols !== w) {
            throw new Error(`matrix size mismatch. expected ${h}x${w} or 1x1 but got ${m.rows}x${m.cols}`);
        }
    }
}
