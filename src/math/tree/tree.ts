import { AVLNode, combinedHeight, NodeMaker } from "./avl";

export const makeTreeNode = (<K, D>(time: K, data: D, left: AVLNode<K, D> | null, right: AVLNode<K, D> | null): AVLNode<K, D> => ({
    k: time, d: data, l: left, r: right,
    h: combinedHeight(left, right)
})) satisfies NodeMaker<AVLNode<any, any>, any, any>;
