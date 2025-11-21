import json
import math
import subprocess
from typing import Any


def ts_command(cmd: str, input: str):
    return json.loads(subprocess.check_output(
        [
            "bun",
            "-e",
            ("var ts=require('typescript'),"
             "s='';"
             "for await(var c of process.stdin)s+=c;"
             f"console.log(JSON.stringify({cmd}))")
        ], input=input.encode()).decode())


TYPE_ENUM = ts_command("ts.SyntaxKind", "")


def fix_tree(tree: dict, key) -> dict:
    match tree:
        case int() if key == "kind":
            return TYPE_ENUM[str(tree)]
        case list():
            return [fix_tree(v, None) for v in tree]
        case dict():
            return {k: fix_tree(v, k) for k, v in tree.items()}
        case _:
            return tree


def parse_ts(ts: str, filename: str):
    n_tree = ts_command(f"ts.createSourceFile({filename!r},s,"
                        "ts.ScriptTarget.Latest)", ts)
    return fix_tree(n_tree, None)


def first_of_kind(ast, kind: str) -> Any:
    match ast:
        case dict() if ast["kind"] == kind:
            return ast
        case dict():
            for k in ast:
                if (v := first_of_kind(ast[k], kind)) is not None:
                    return v
        case list():
            for k in ast:
                if (v := first_of_kind(k, kind)) is not None:
                    return v
    return None


def find_class(top: dict, name: str) -> dict:
    return next(n for n in top["statements"] if n["kind"] ==
                "ClassDeclaration" and n["name"]["escapedText"] == name)


def find_enum_to_imap(top: dict, name: str) -> dict:
    enum = next(n for n in top["statements"] if n["kind"] ==
                "EnumDeclaration" and n["name"]["escapedText"] == name)
    return {
        "kind": "ClassDeclaration",
        "members": [{
                "kind": "PropertyDeclaration",
                "initializer": k["name"],
                "name": k["name"]}
            for k in enum["members"]]}


def get_prop_of_class(cls: dict, prop: str) -> Any:
    # print("trying to get", prop)
    return next(n["initializer"] for n in cls["members"]
                if isinstance(n, dict)
                and n["kind"] == "PropertyDeclaration"
                and n["name"]["escapedText"] == prop)


def to_name_map(array):
    out = {}
    for item in array:
        name = item.pop("name")
        out[name] = item
    return out


def to_literal(ast, *, try_eval=False, shallow=False, classes={}) -> Any:
    """basically eval for a TS syntax tree (lol)"""
    if not isinstance(ast, dict):
        return ast
    match ast["kind"]:
        case "ArrayLiteralExpression":
            return [x if shallow else to_literal(
                x, try_eval=try_eval, classes=classes)
                for x in ast["elements"]]
        case "ClassDeclaration":
            return to_literal({
                "kind": "ObjectLiteralExpression",
                "properties": ast["members"]
            }, try_eval=try_eval, classes=classes)
        case "ObjectLiteralExpression":
            # chokes on spread expressions
            # but we can't complete it then can we?
            return {to_literal(p["name"], try_eval=try_eval, classes=classes):
                    (p["initializer"] if shallow else to_literal(
                        p["initializer"], try_eval=try_eval, classes=classes))
                    for p in ast["properties"]}
        case "Identifier":
            return ast["escapedText"]
        case "StringLiteral" | "FirstTemplateToken":
            return ast["text"]
        case ("TrueKeyword" | "FalseKeyword") as a:
            return a == "TrueKeyword"
        # why the hell does typescript parse it this way
        # when it literally has a NumericToken
        case "FirstLiteralToken" if "numericLiteralFlags" in ast:
            x = float(ast["text"])
            if x.is_integer():
                return int(x)
            return x
        case "PrefixUnaryExpression" if not shallow:
            match TYPE_ENUM[str(ast["operator"])]:
                case "MinusToken":
                    return -to_literal(ast["operand"],
                                       try_eval=try_eval, classes=classes)
                case op:
                    raise RuntimeError(
                        f"implement unary operator {op!s}")
        case "BinaryExpression" if not shallow:
            left = to_literal(ast["left"],
                              try_eval=try_eval, classes=classes)
            right = to_literal(ast["right"],
                               try_eval=try_eval, classes=classes)
            match ast["operatorToken"]["kind"]:
                case "SlashToken":
                    return left / right
                case "AsteriskToken":
                    return left * right
                case "MinusToken":
                    return left - right
                case "PlusToken":
                    if isinstance(left, str) or isinstance(right, str):
                        return f"{left!s}{right!s}"
                    return left + right
                case "GreaterThanGreaterThanToken":
                    return left >> right
                case op:
                    raise RuntimeError(
                        f"implement binary operator {op!s}")
        case "TypeAssertionExpression" | "ParenthesizedExpression":
            return to_literal(ast["expression"],
                              try_eval=try_eval, classes=classes)
        case "CallExpression" if try_eval:
            expr = to_literal(ast["expression"],
                              try_eval=True, classes=classes)
            arguments = [to_literal(a, try_eval=True, classes=classes)
                         for a in ast["arguments"]]
            # Hack special case for toNameMap which is used like everywhere
            if expr == "toNameMap":
                expr = to_name_map
            # Hack for wavetables (handled elsewhere)
            if expr in ("centerWave", "centerAndNormalizeWave",
                        "rawChipToIntegrated"):
                expr = identity
            if not callable(expr):
                raise TypeError(
                    "Need to have function resolved, but it was not")
            return expr(*arguments)
        case "PropertyAccessExpression" if try_eval:
            expr = to_literal(
                ast["expression"], try_eval=True, classes=classes)
            name = ast["name"]["escapedText"]
            if "escapedText" in expr:
                expr = expr["escapedText"]
            match expr:
                case list():
                    match name:
                        case "map":
                            return lambda f: list(map(f, expr))
                        case "length":
                            return len(expr)
                        case _:
                            raise ValueError("list method " + name)
                case dict():
                    match name:
                        case "length":
                            return len(expr)
                        case "concat" | "reduce":
                            # Ignore this. We got here from toNameMap anyway...
                            return lambda _: expr
            # print(expr, name)
            return to_literal(get_prop_of_class(classes[expr], name),
                              try_eval=True, classes=classes)
        case "ThisKeyword" if try_eval:
            return "this"
        case "NullKeyword":
            return None
        case "ArrowFunction":
            # only used by Config.justIntonationSemitones,
            # which I don't need, so just do it manually here
            return lambda x: math.log(x) * 12
        case ("PropertyAccessExpression" | "ElementAccessExpression"
              | "CallExpression" | "TemplateExpression"):
            # Not doing these if not trying to eval.
            return ast
        case k:
            print(list(ast.keys()))
            raise NameError(k)


def identity(x):
    return x
