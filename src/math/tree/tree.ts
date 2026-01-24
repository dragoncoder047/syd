import { AVLNode, combinedHeight, NodeCopier, NodeMaker } from "./avl";

export const makeTreeNode = (<K, D>(time: K, data: D, left: AVLNode<K, D> | null, right: AVLNode<K, D> | null): AVLNode<K, D> => ({
    t: time, d: data, l: left, r: right,
    h: combinedHeight(left, right)
})) satisfies NodeMaker<AVLNode<any, any>, any, any>;

export const cloneTreeNode = (<K, D>({ t, d }: AVLNode<K, D>, left: AVLNode<K, D> | null, right: AVLNode<K, D> | null): AVLNode<K, D> => ({
    t, d, l: left, r: right,
    h: combinedHeight(left, right)
})) satisfies NodeCopier<AVLNode<any, any>>;
