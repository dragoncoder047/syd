import { nodes } from "../lib";
import { Matrix } from "../matrix";
import { AutomatedValueMethod } from "../runtime/automation";
import * as AST from "./ast";
import { CompileError } from "./errors";
import { AudioProcessorFactory, Rate } from "./nodeDef";
import { Command, CompiledVoiceData, Opcode, Program } from "./prog";

export type NodeCompileData = {
    isParts?: false;
    args: AST.Node[];
    kArgs?: AST.Node[];
    self?: Command;
    argTypes: Rate[],
    result: Rate;
} | {
    // specifically only designed for list/matrix building
    // and maybe conditionals
    isParts: true;
    pre: Program;
    post: Program;
    parts: {
        pre: Program;
        arg: AST.Node;
        type: Rate,
        post: Program;
    }[];
    result: Rate;
}

export interface CompileState {
    registers: string[];
    nodeNames: string[];
    nodeDefs: AudioProcessorFactory[];
    constantValues: Matrix[];
    mods: [name: string, initial: number, mode: AutomatedValueMethod][],
}

export interface CompileResult {
    data: CompiledVoiceData,
    // mapping of PC index => source node
    sourcemap: {
        a: AST.Node[];
        k: AST.Node[];
    }
}


export function newCompileData(): CompileState {
    return {
        registers: [],
        nodeNames: [],
        nodeDefs: nodes(),
        mods: [],
        constantValues: [],
    };
}

export function allocRegister(name: string, state: CompileState): number {
    const i = state.registers.indexOf(name);
    if (i === -1) return state.registers.push(name) - 1;
    return i;
}
export function addConstantMatrix(matrix: Matrix, state: CompileState): number {
    const i = state.constantValues.findIndex(m => m.equals(matrix));
    if (i === -1) return state.constantValues.push(matrix) - 1;
    return i;
}
export function allocNode(name: string, state: CompileState): number {
    return state.nodeNames.push(name) - 1;
}

export function allocMod(name: string, state: CompileState, initial: number, mode: AutomatedValueMethod): number {
    return state.mods.push([name, initial, mode]) - 1;
}

export function compile(node: AST.Node, inState: CompileState): CompileResult {
    // step one: get all nodes' children and stuff and track duplicates
    const frontier = [node];
    const nodeToCompileInfo = new Map<AST.Node, NodeCompileData>();
    const duplicated = new Map<AST.Node, boolean>();
    while (frontier.length > 0) {
        const next = frontier.pop()!;
        if (duplicated.has(next)) {
            duplicated.set(next, true);
            continue;
        }
        duplicated.set(next, false);
        const data = next.compile(inState);
        nodeToCompileInfo.set(next, data);
        frontier.push(...getPointedToNodes(data));
    }
    resolveTypes(nodeToCompileInfo);
    // split into A-rate and K-rate chunks
    const [aRoots, kRoots] = splitAKRate(nodeToCompileInfo);
    // compile all of the code
    var nodeCounter: number, aCode: Program, kCode: Program, aSourcemap: any;
    [aCode, aSourcemap, nodeCounter] = compileFromRoot
    // optimize the code (register optimizations, math optimizations, etc)
    // TODO
    return {
        data: {

        },
        sourcemap: {

        }
    }
}

function getPointedToNodes(data: NodeCompileData) {
    return data.isParts ? data.parts.map(p => p.arg) : data.args;
}

function resolveTypes(map: Map<AST.Node, NodeCompileData>) {
    var sawAnyType = true, changed = false;
    while (sawAnyType) {
        sawAnyType = false;
        var lastNonChangedNode: AST.Node;
        for (var [theNode, data] of map.entries()) {
            // check if it's parts
            var i = 0, didChange = false;
            if (data.isParts) {
                const parts = data.parts;
                const resType = data.result;
                var newResType = resType;
                for (; i < parts.length; i++) {
                    const part = parts[i]!;
                    const node = part.arg, requiredType = part.type;
                    const gottenType = map.get(node)!.result;
                    if (gottenType === Rate.A_RATE) {
                        if (requiredType === Rate.K_RATE) {
                            throw new CompileError("cannot connect a-rate output into k-rate input", node.loc)
                        }
                        newResType = Rate.A_RATE;
                    } else if (gottenType === Rate.ANY_RATE) {
                        sawAnyType = true;
                    }
                }
                if (resType === Rate.ANY_RATE) {
                    data.result = newResType === Rate.ANY_RATE ? (sawAnyType ? Rate.ANY_RATE : Rate.K_RATE) : newResType;
                    didChange = data.result !== resType;
                }
                if (!didChange) {
                    lastNonChangedNode = theNode;
                }
            }
            changed ||= didChange;
        }
        if (sawAnyType && !changed) {
            throw new CompileError("could not resolve type of self-referential expression", lastNonChangedNode!.loc);
        }
    }
}

/** updates the originals to be a-rate node invocations, returns k-rate and a-rate roots for nodes that don't contribute directly to output */
function splitAKRate(nodes: Map<AST.Node, NodeCompileData>): [AST.Node[], AST.Node[]] {
    const arRoots: AST.Node[] = [], krRoots: AST.Node[] = [];
    for (var [ast, node] of nodes.entries()) {
        if (node.isParts) continue; // call expressions never use parts
        if (node.self?.[0] === Opcode.TEMP_OPCODE_FOR_UNIFIED_CALL) {
            // we have a node that can be split
            const aArgs: AST.Node[] = [], kArgs: AST.Node[] = [];
            for (var i = 0; i < node.args.length; i++) {
                const arg = node.args[i]!;
                const type = node.argTypes[i]!;
                switch (type) {
                    case Rate.K_RATE:
                        kArgs.push(arg);
                        break;
                    case Rate.A_RATE:
                        aArgs.push(arg);
                        break;
                    case Rate.ANY_RATE:
                        throw new Error("unreachable.");
                }
            }
            if (aArgs.length > 0) {
                node.args = aArgs;
                arRoots.push(ast);
            } else {
                node.args = [];
            }
            if (kArgs.length > 0) {
                node.kArgs = kArgs;
                krRoots.push(ast);
            }
        }
    }
    return [arRoots, krRoots];
}
