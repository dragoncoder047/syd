import { max } from "../math";
import { Matrix, scalarMatrix } from "../matrix";
import { id, isinstance, str } from "../utils";
import { processArgsInCall } from "./call";
import { makeCodeMacroExpander } from "./codemacro";
import { addConstantMatrix, allocNode, allocRegister, CompileState, NodeCompileData } from "./compile";
import { CompileError, ErrorNote, LocationTrace, RuntimeError } from "./errors";
import { EvalState, pushNamed } from "./evalState";
import { Rate } from "./nodeDef";
import { OPERATORS } from "./operator";
import { Opcode } from "./prog";

export abstract class Node {
    id: number;
    constructor(public loc: LocationTrace) { this.id = id(this); }
    abstract edgemost(left: boolean): Node;
    abstract pipe(fn: (node: Node) => Promise<Node>): Promise<Node>;
    abstract eval(state: EvalState): Promise<Node>;
    abstract compile(state: CompileState): NodeCompileData;
    static checkImmediate(x: Node): x is Value | Symbol | ContainerNode {
        return isinstance(x, Value) || isinstance(x, Symbol) || (isinstance(x, ContainerNode) && x.isImmediate());
    }
    static getValueOf(x: Node): any | undefined {
        if (Node.checkImmediate(x)) {
            if (isinstance(x, Value) || isinstance(x, Symbol)) return x.value;
            return x.toImmediate();
        }
    }
}

export abstract class NotCodeNode extends Node {
    compile(state: CompileState): NodeCompileData {
        throw new CompileError("how did we get here ?!? (" + this.constructor.name + ")", this.loc);
    }
}

export abstract class Leaf extends NotCodeNode {
    edgemost() { return this; }
    async pipe() { return this; }
    async eval(_: EvalState): Promise<Node> { return this; }
}

export class AnnotatedValue extends NotCodeNode {
    constructor(trace: LocationTrace, public attributes: Node[], public value: Node | null = null) { super(trace); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new AnnotatedValue(this.loc, await asyncNodePipe(this.attributes, fn), this.value ? await fn(this.value) : null); }
    edgemost(left: boolean): Node { return left ? (this.attributes.length > 0 ? this.attributes[0]!.edgemost(left) : this) : (this.value ?? this); }
    async eval(state: EvalState) {
        var v = this.value;
        for (var attr of this.attributes) {
            var args: Node[] | null = null;
            var name: string;
            if (isinstance(attr, Call) || isinstance(attr, Name)) {
                name = attr.name;
                const a = state.annotators.find(a => a.name === name);
                if (!a) {
                    throw new RuntimeError("unknown annotation " + str(name), attr.loc, stackToNotes(state.callstack));
                }
                if (isinstance(attr, Call)) {
                    args = attr.args;
                }
                v = await a.apply(v, args, state);
            } else {
                throw new RuntimeError("illegal annotation", attr.loc, stackToNotes(state.callstack));
            }
        }
        return v!;
    }
}

export class Value extends Leaf {
    constructor(trace: LocationTrace, public value: string | number | Matrix) { super(trace); };
    async eval(state: EvalState): Promise<Node> {
        if (isinstance(this.value, Node)) return this.value;
        return this;
    }
    compile(state: CompileState): NodeCompileData {
        const [m] = toMatrix(this);
        return {
            self: [Opcode.PUSH_CONSTANT, addConstantMatrix(m, state)],
            args: [],
            argTypes: [],
            result: Rate.ANY_RATE,
        }
    }
}

export class Symbol extends Value {
    declare value: string;
    constructor(trace: LocationTrace, value: string) { super(trace, value); };
    async eval(): Promise<this> {
        return this;
    }
}

export class Assignment extends NotCodeNode {
    constructor(trace: LocationTrace, public target: Node, public value: Node) { super(trace); };
    edgemost(left: boolean): Node { return left ? this.target.edgemost(left) : this.value.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Assignment(this.loc, await fn(this.target), await fn(this.value)); }
    async eval(state: EvalState) {
        if (!isinstance(this.target, Name)) {
            throw new RuntimeError("cannot assign to this", this.target.loc);
        }
        const name = this.target.name;
        const scope = scopeForName(name, state);
        var b = scope[name];
        if (!b) {
            b = new LateBinding(this.loc, name);
            scope[name] = b;
        }
        const result = scope[name] = await this.value.eval(state);
        if (isinstance(b, LateBinding)) {
            b.boundValue = result;
        }
        return result;
    }
}

export class Name extends Leaf {
    constructor(trace: LocationTrace, public name: string) { super(trace); };
    async eval(state: EvalState) {
        const val = state.env[this.name];
        if (!val) {
            return scopeForName(this.name, state)[this.name] = new LateBinding(this.loc, this.name);
        }
        return val;
    }
}

export class LateBinding extends Name {
    boundValue: Node | undefined = undefined;
    async eval() {
        return this.boundValue ?? this;
    }
    compile(): NodeCompileData {
        if (!this.boundValue) {
            throw new CompileError(`${this.name} was never assigned to in this scope`, this.loc);
        }
        return {
            args: [this.boundValue],
            argTypes: [Rate.ANY_RATE],
            result: Rate.ANY_RATE
        }
    }
}

export class Call extends Node {
    constructor(trace: LocationTrace, public name: string, public args: Node[]) { super(trace); };
    edgemost(left: boolean): Node { return left ? this : this.args.at(-1)?.edgemost(left) ?? this; }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Call(this.loc, this.name, await asyncNodePipe(this.args, fn)); }
    async eval(state: EvalState): Promise<Node> {
        const funcImpl = state.functions.find(f => f.name === this.name);
        if (funcImpl) {
            const newState: EvalState = { ...state, callstack: state.callstack.concat(this) };
            return funcImpl.expand(this.args, newState);
        }
        const nodeImpl = state.nodes.find(n => n.name === this.name);
        if (!nodeImpl) {
            throw new RuntimeError("undefined node or function " + this.name, this.loc, stackToNotes(state.callstack));
        }
        if (nodeImpl.stateless && this.args.every(x => Node.checkImmediate(x))) {
            return new Value(this.loc, nodeImpl.make(null as any).updateSample(this.args.map(m => toMatrix(m as any)[0])));
        }
        return new Call(this.loc, nodeImpl.name, await processArgsInCall(state, true, this.loc, this.args, nodeImpl));
    }
    compile(state: CompileState): NodeCompileData {
        const nodeImpl = state.nodeDefs.find(n => n.name === this.name);
        if (!nodeImpl) {
            throw new CompileError(`cannot find node ${this.name} (should be unreachable!!)`, this.loc);
        }
        return {
            args: this.args,
            argTypes: nodeImpl.inputs.map(arg => arg.rate),
            self: [Opcode.TEMP_OPCODE_FOR_UNIFIED_CALL, allocNode(this.name, state)],
            result: nodeImpl.outputRate
        }
    }
}

abstract class ContainerNode extends Node {
    abstract isImmediate(): boolean;
    abstract toImmediate(): any | undefined;
    static fromImmediate(trace: LocationTrace, m: any): List | Value | Mapping {
        return Array.isArray(m)
            ? new List(trace, m.map(r => ContainerNode.fromImmediate(trace, r)))
            : typeof m === "object"
                ? new Mapping(trace, Object.entries(m).map(([k, v]) =>
                    ({ key: new Symbol(trace, k), val: ContainerNode.fromImmediate(trace, v) })))
                : new Value(trace, m);
    }
}

export class List extends ContainerNode {
    constructor(trace: LocationTrace, public values: Node[]) { super(trace); };
    edgemost(left: boolean): Node { return this.values.length > 0 ? left ? this.values[0]!.edgemost(left) : this.values.at(-1)!.edgemost(left) : this; }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new List(this.loc, await asyncNodePipe(this.values, fn)); }
    async eval(state: EvalState) {
        const values: Node[] = [];
        for (var v of this.values) {
            const v2 = await v.eval(state);
            if (isinstance(v2, SplatValue) && isinstance(v2.value, List)) {
                values.push(...v2.value.values);
            } else {
                values.push(v2);
            }
        }
        return new List(this.loc, values);
    }
    hasSplats() {
        return this.values.some(v => isinstance(v, SplatValue));
    }
    isImmediate(): boolean {
        return this.values.every(v => isinstance(v, Value) || (isinstance(v, ContainerNode) && v.isImmediate()));
    }
    toImmediate(): any[] | undefined {
        if (this.isImmediate()) {
            return this.values.map(v => Node.getValueOf(v));
        }
    }
    compile(state: CompileState): NodeCompileData {
        const [mat, inst] = toMatrix(this);
        return {
            isParts: true,
            result: Rate.ANY_RATE,
            pre: [[Opcode.PUSH_CONSTANT, addConstantMatrix(mat, state)]],
            post: [],
            parts: inst.flatMap((rowV, rowN) => rowV.flatMap((v, col) => {
                return v == null ? [] : [{
                    arg: v,
                    type: Rate.ANY_RATE,
                    pre: [],
                    post: [[Opcode.SET_MATRIX_EL, rowN, col]],
                }]
            })),
        }
    }
}


export class Mapping extends ContainerNode {
    constructor(trace: LocationTrace, public mapping: { key: Node, val: Node }[]) { super(trace); }
    edgemost(left: boolean): Node { return this.mapping.length > 0 ? left ? this.mapping[0]!.key.edgemost(left) : this.mapping.at(-1)!.val.edgemost(left) : this; }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Mapping(this.loc, await asyncNodePipe(this.mapping, async ({ key, val }) => ({ key: await fn(key), val: await fn(val) }))); }
    async eval(state: EvalState) {
        return new Mapping(this.loc, await Promise.all(this.mapping.map(async ({ key, val }) => ({ key: await key.eval(state), val: await val.eval(state) }))));
    }
    isImmediate() {
        return this.mapping.every(m => Node.checkImmediate(m.key) && Node.checkImmediate(m.val));
    }
    toImmediate() {
        if (this.isImmediate()) {
            const out: Record<string, any> = {};
            const imm = Node.getValueOf;
            for (var { key, val } of this.mapping) {
                out[imm(key)] = imm(val);
            }
            return out;
        }
    }
    compile(): never {
        throw new CompileError("Cannot convert mapping to matrix!", this.loc);
    }
}

export class Definition extends NotCodeNode {
    constructor(trace: LocationTrace, public name: string, public outMacro: boolean, public parameters: Node[], public body: Node) { super(trace); };
    edgemost(left: boolean): Node { return left ? this.parameters.length > 0 ? this.parameters[0]!.edgemost(left) : this : this.body.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Definition(this.loc, this.name, this.outMacro, await asyncNodePipe(this.parameters, fn), await fn(this.body)); }
    async eval(state: EvalState) {
        pushNamed(state.functions, { name: this.name, argc: this.parameters.length, expand: makeCodeMacroExpander(this.name, this.outMacro, this.parameters, this.body) });
        return new Value(this.loc, undefined as any);
    }
}

export class ParameterDescriptor extends NotCodeNode {
    constructor(trace: LocationTrace, public name: string, public enumOptions: Mapping, public defaultValue: Node, public lazy: boolean) { super(trace) }
    edgemost(left: boolean): Node { return left ? this : this.defaultValue.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new ParameterDescriptor(this.loc, this.name, await fn(this.enumOptions) as Mapping, await fn(this.defaultValue), this.lazy) }
    async eval(state: EvalState): Promise<never> {
        throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
    }
}

export class Template extends NotCodeNode {
    constructor(trace: LocationTrace, public result: Node) { super(trace); };
    edgemost(left: boolean): Node { return this.result.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Template(this.loc, await fn(this.result)); }
    async eval(state: EvalState) {
        const replaceTrace = async (arg: Node): Promise<Node> => {
            const val = await arg.pipe(replaceTrace);
            val.loc = new LocationTrace(arg.loc.line, arg.loc.col, arg.loc.file, ["note: expanded from template:", this.loc]);
            return val;
        }
        const recur = async (arg: Node, depth: number): Promise<Node> => {
            if (isinstance(arg, Template)) return arg.pipe(n => recur(n, depth + 1));
            if (isinstance(arg, InterpolatedValue)) {
                if (depth <= 1) {
                    return replaceTrace(await arg.value.eval(state));
                } else {
                    const val = await arg.pipe(n => recur(n, depth - 1));
                    if (isinstance(val, InterpolatedValue) && isinstance(val.value, Value)) return val.value;
                    return val;
                }
            }
            return arg.pipe(n => recur(n, depth));
        }
        return recur(await replaceTrace(this.result), 1);
    }
}

export class BinaryOp extends Node {
    constructor(trace: LocationTrace, public op: string, public left: Node, public right: Node, public noLift: boolean = false, public assign?: LocationTrace | undefined) { super(trace); };
    edgemost(left: boolean): Node { return this[left ? "left" : "right"].edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new BinaryOp(this.loc, this.op, await fn(this.left), await fn(this.right), this.noLift, this.assign); }
    async eval(state: EvalState) {
        return this._applied(await this.left.eval(state), await this.right.eval(state));
    }
    private _applied(left: Node, right: Node) {
        var fn: (typeof OPERATORS)[keyof typeof OPERATORS]["cb"] | undefined;
        var imm = true, a, b;
        if (Node.checkImmediate(left)) {
            a = Node.getValueOf(left);
        } else {
            imm = false;
        }
        if (Node.checkImmediate(right)) {
            b = Node.getValueOf(right);
        } else {
            imm = false;
        }
        if ((fn = OPERATORS[this.op]?.cb) && imm) {
            return ContainerNode.fromImmediate(this.loc, fn(a, b))
        }
        // Special case for comparing in/equality of 2 symbols
        if (isinstance(left, Symbol) && isinstance(right, Symbol) && /^[!=]=$/.test(this.op)) {
            return ContainerNode.fromImmediate(this.loc, fn!(left.value, b.value));
        }
        return new BinaryOp(this.loc, this.op, left, right);
    }
    compile(): NodeCompileData {
        return {
            args: [this.left, this.right],
            argTypes: [Rate.ANY_RATE, Rate.ANY_RATE],
            result: Rate.ANY_RATE,
            self: [Opcode.BINARY_OP, this.op]
        }
    }
}

export class UnaryOp extends Node {
    constructor(trace: LocationTrace, public op: string, public value: Node) { super(trace); };
    edgemost(left: boolean): Node { return left ? this : this.value.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new UnaryOp(this.loc, this.op, await fn(this.value)); }
    async eval(state: EvalState) {
        return this._applied(await this.value.eval(state));
    }
    private _applied(val: Node): Node {
        var fn: (typeof OPERATORS)[keyof typeof OPERATORS]["cu"] | undefined;
        var imm = true, value;
        if (Node.checkImmediate(val)) {
            value = Node.getValueOf(val);
        } else {
            imm = false;
        }
        if (imm && (fn = OPERATORS[this.op]?.cu)) {
            return ContainerNode.fromImmediate(this.loc, fn(value));
        }
        return new UnaryOp(this.loc, this.op, val);
    }
    compile(): NodeCompileData {
        return {
            args: [this.value],
            argTypes: [Rate.ANY_RATE],
            result: Rate.ANY_RATE,
            self: [Opcode.UNARY_OP, this.op]
        }
    }
}

export class DefaultPlaceholder extends Leaf {
    async eval(state: EvalState): Promise<never> {
        throw new RuntimeError("cannot evaluate", this.loc, stackToNotes(state.callstack));
    }
}

export class KeywordArgument extends NotCodeNode {
    constructor(trace: LocationTrace, public name: string, public arg: Node) { super(trace); }
    edgemost(left: boolean): Node { return left ? this : this.arg.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new KeywordArgument(this.loc, this.name, await fn(this.arg)); }
    async eval(state: EvalState) {
        return new KeywordArgument(this.loc, this.name, await this.arg.eval(state));
    }
}

export class Conditional extends Node {
    constructor(trace: LocationTrace, public cond: Node, public caseTrue: Node, public caseFalse: Node) { super(trace); }
    edgemost(left: boolean): Node { return (left ? this.cond : this.caseFalse).edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Conditional(this.loc, await fn(this.cond), await fn(this.caseTrue), await fn(this.caseFalse)); }
    async eval(state: EvalState): Promise<Node> {
        const cond = await this.cond.eval(state);
        if (isinstance(cond, Value)) {
            return (!cond.value ? this.caseFalse : this.caseTrue).eval(state);
        }
        const ct = await this.caseTrue.eval(state);
        const cf = await this.caseFalse.eval(state);
        return new Conditional(this.loc, cond, ct, cf);
    }
    compile(): NodeCompileData {
        return {
            args: [this.cond, this.caseTrue, this.caseFalse],
            self: [Opcode.CONDITIONAL_SELECT],
            argTypes: [Rate.ANY_RATE, Rate.ANY_RATE, Rate.ANY_RATE],
            result: Rate.ANY_RATE
        }
    }
}

export class InterpolatedValue extends NotCodeNode {
    constructor(trace: LocationTrace, public value: Node) { super(trace); }
    edgemost(left: boolean): Node { return this.value.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new InterpolatedValue(this.loc, await fn(this.value)); }
    async eval(state: EvalState): Promise<never> {
        throw new RuntimeError("too many &'s", this.loc, stackToNotes(state.callstack));
    }
}

export class SplatValue extends NotCodeNode {
    constructor(trace: LocationTrace, public value: Node) { super(trace); }
    edgemost(left: boolean): Node { return this.value.edgemost(left); }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new SplatValue(this.loc, await fn(this.value)); }
    async eval(state: EvalState) {
        return new SplatValue(this.loc, await this.value.eval(state));
    }
}

export class PipePlaceholder extends Leaf {
    async eval(state: EvalState): Promise<never> {
        throw new RuntimeError("not valid outside of a pipe expression", this.loc, stackToNotes(state.callstack));
    }
}

export class Block extends NotCodeNode {
    constructor(trace: LocationTrace, public body: Node[]) { super(trace); }
    edgemost(left: boolean): Node { return this.body.length > 0 ? left ? this.body[0]!.edgemost(left) : this.body.at(-1)!.edgemost(left) : this; }
    async pipe(fn: (node: Node) => Promise<Node>): Promise<Node> { return new Block(this.loc, await asyncNodePipe(this.body, fn)); }
    async eval(state: EvalState): Promise<Node> {
        var last: Node = new Value(this.loc, undefined as any);
        for (var v of this.body) {
            if (isinstance(v, DefaultPlaceholder)) last = new Value(v.loc, undefined as any);
            else last = await v.eval(state);
        }
        return last;
    }
}

async function asyncNodePipe<T>(nodes: T[], fn: (node: T) => Promise<T>): Promise<T[]> {
    return await Promise.all(nodes.map(fn));
}

export function stackToNotes(stack: Call[]): ErrorNote[] {
    const out: ErrorNote[] = [];
    for (var s of stack) {
        out.push(new ErrorNote(`note: while evaluating function ${str(s.name)}`, s.loc));
    }
    return out.reverse();
}

function scopeForName(name: string, state: EvalState) {
    return Object.hasOwn(state.env, name) ? state.env : Object.hasOwn(state.globalEnv, name) ? state.globalEnv : state.env;
}

function toMatrix(x: List | Value): [Matrix, (Node | null)[][]] {
    if (isinstance(x, Value)) {
        return [isinstance(x.value, Matrix) ? x.value : typeof x.value === "string" ? Matrix.ofVector(new Array(x.value.length).fill(0).map((_, i) => (x.value as string).codePointAt(i)!)) : scalarMatrix(x.value), []];
    }
    const rows = x.values.length;
    const cols = x.values.map((v: any) => v.values.length ?? v.value.length ?? 1).reduce((x, y) => max(x, y), 0);
    const d = [];
    const m = new Matrix(rows, cols);
    for (var row = 0; row < rows; row++) {
        const r: (Node | null)[] = [];
        d.push(r);
        const rv = x.values[row]!;
        var rowvalues: ArrayLike<Node | number>;
        if (isinstance(rv, Value)) rowvalues = toMatrix(rv)[0].data;
        else {
            if (!isinstance(rv, List)) throw new CompileError("can't convert this to matrix row", rv.loc);
            rowvalues = rv.values.map(v => {
                if (isinstance(v, Value)) {
                    if (typeof v.value !== "number") throw new CompileError("can only use string as the entire row of a matrix", v.loc);
                    return v.value;
                }
                return v;
            });
        }
        for (var col = 0; col < cols; col++) {
            const elem = rowvalues[col];
            switch (typeof elem) {
                case "number": m.put(row, col, elem); break;
                case "undefined": break;
                default: r[col] = elem;
            }
        }
    }
    return [m, d];
}

