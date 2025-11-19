import subprocess
import json
import typing


def ts_command(cmds: str, input: str):
    return json.loads(subprocess.check_output(
        [
            "bun",
            "-e",
            ("var ts=require('typescript'),"
             "s='';"
             "for await(var c of process.stdin)s+=c;"
             "console.log(JSON.stringify((()=>{" + cmds + "})()))")
        ], input=input.encode()).decode())


TYPE_ENUM = ts_command("return ts.SyntaxKind", "")


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
    n_tree = ts_command("var f="+repr(filename)+";"
                        "return ts.createSourceFile(f,s,"
                        "ts.ScriptTarget.Latest)",
                        ts)
    return fix_tree(n_tree, None)


def find_by_kind(ast, kind: str) -> typing.Any:
    match ast:
        case dict() if ast["kind"] == kind:
            return ast
        case dict():
            for k in ast:
                if (v := find_by_kind(ast[k], kind)) is not None:
                    return v
        case list():
            for k in ast:
                if (v := find_by_kind(k, kind)) is not None:
                    return v
    return None


def to_literal(ast) -> typing.Any:
    match ast["kind"]:
        case "ArrayLiteralExpression":
            return [to_literal(x) for x in ast["elements"]]
        case "ObjectLiteralExpression":
            # chokes on spread expressions
            # but we can't complete it then can we?
            return {to_literal(p["name"]): to_literal(p["initializer"])
                    for p in ast["properties"]}
        case "Identifier":
            return ast["escapedText"]
        case "StringLiteral" | "FirstTemplateToken":
            return ast["text"]
        case "TrueKeyword" | "FalseKeyword":
            return ast == "TrueKeyword"
        case "FirstLiteralToken" if "numericLiteralFlags" in ast:
            return float(ast["text"])
        case "PrefixUnaryExpression"  \
                if ast["operator"] == TYPE_ENUM["MinusToken"]:
            return -to_literal(ast["operand"])
        case "BinaryExpression":
            op = ast["operatorToken"]["kind"]
            match op:
                case "SlashToken":
                    return to_literal(ast["left"]) / to_literal(ast["right"])
                case "MinusToken":
                    return to_literal(ast["left"]) - to_literal(ast["right"])
                case _:
                    raise RuntimeError("implement operator " + op)
        case _:
            return ast
