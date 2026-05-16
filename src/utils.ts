// export const mapObject = <T, U>(obj: Record<string, T>, func: (value: T, key: string) => U): Record<string, U> =>
//     Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, func(value, key)]));

// export const isNull = (x: any): x is null => x === null;
// export const isEmpty = (x: any[]): x is [] => x.length === 0;
// type Predicate<T, U extends T> = (x: T) => x is U;
// type AssertedType<F> = F extends (x: any) => x is infer U ? U : never;
// type UnionOfPredicates<T, Fns extends readonly ((x: T) => x is any)[]> = AssertedType<Fns[number]>;
// export const any = <T, const Fns extends readonly Predicate<T, any>[]>(x: T, ...funcs: Fns): x is UnionOfPredicates<T, Fns> => funcs.some(f => f(x));
// export const isObject = is("object") as (x: any) => x is Record<string, any>;

var gensymCounter = 0;
export function gensym(): `$${number}` {
    return `$${gensymCounter++}`;
}
