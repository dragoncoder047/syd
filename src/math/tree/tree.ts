import { AVLNode, combinedHeight, NodeCopier, NodeMaker } from "./avl";

export const makeTreeNode = (<T>(time: number, data: T, left: AVLNode<T> | null, right: AVLNode<T> | null): AVLNode<T> => ({
    t: time, d: data, l: left, r: right,
    h: combinedHeight(left, right)
})) satisfies NodeMaker<AVLNode<any>, any>;

export const cloneTreeNode = (<T>({t, d}: AVLNode<T>, left: AVLNode<T> | null, right: AVLNode<T> | null): AVLNode<T> => ({
    t, d, l: left, r: right,
    h: combinedHeight(left, right)
})) satisfies NodeCopier<AVLNode<any>>;
