import json
import math
import os
import pathlib
import shutil
import subprocess
import time
from typing import Any

# import themefix
import tinycss2
import ts_utility as ts_utility

curdir = pathlib.Path(__file__).parent
data_dir = curdir / "../data/"
if data_dir.exists():
    shutil.rmtree(data_dir)
data_dir.mkdir()

github_repo_dir = curdir / "../beepmods/"
if not github_repo_dir.exists():
    github_repo_dir.mkdir()


def ensure_github_repo(folder: str, repo_id: str):
    repo_folder = github_repo_dir / folder
    if not repo_folder.exists():
        subprocess.check_call(
            ["git", "clone", "https://github.com/" + repo_id,
             repo_folder.resolve().absolute()])
    old_dir = os.getcwd()
    os.chdir(repo_folder)
    try:
        subprocess.check_call(["git", "pull"])
    except subprocess.CalledProcessError as e:
        print("Command failed with exit code", e.returncode)
    finally:
        os.chdir(old_dir)


ensure_github_repo("jukebox", "jukeebox/jukebox_typescript")
ensure_github_repo("abyssbox", "choptop84/abyssbox-source")


def timed(func):
    def inner():
        print("starting", func.__name__)
        start = time.perf_counter_ns()
        result = func()
        end = time.perf_counter_ns()
        print("completed", func.__name__, "in", (end-start)/1e9, "seconds")
        return result
    return inner


def get_beepmod_file(path: str) -> str:
    return (github_repo_dir / path).read_text()


@timed
def presets():
    presets_file = get_beepmod_file("jukebox/editor/EditorConfig.ts")
    ast = ts_utility.parse_ts(presets_file, "EditorConfig.ts")

    categories = []

    EditorConfig = ts_utility.first_of_kind(ast, "ClassDeclaration")

    categories_Call = next(n["initializer"] for n in EditorConfig["members"]
                           if n["kind"] == "PropertyDeclaration"
                           and n["name"]["escapedText"] == "presetCategories")

    categories_Args = categories_Call["arguments"][0]
    toplevel_map = ts_utility.to_literal(categories_Args)
    for obj in toplevel_map:
        name = obj["name"]
        if name == "Custom Instruments":
            continue
        obj = obj["presets"]
        if obj["kind"] == "TypeAssertionExpression":
            obj = obj["expression"]
        obj = obj["arguments"]
        categories.append({
            "name": name,
            "presets": [ts_utility.to_literal(a) for a in obj],
        })

    return categories


@timed
def themes():
    themes_file = get_beepmod_file("abyssbox/editor/ColorConfig.ts")
    ast = ts_utility.parse_ts(themes_file, "ColorConfig.ts")

    ColorConfig = ts_utility.first_of_kind(ast, "ClassDeclaration")

    themes = ts_utility.get_prop_of_class(ColorConfig, "themes")

    themes = ts_utility.to_literal(themes)

    themes["custom"] = (themes["custom"]["templateSpans"]
                        [0]["expression"]["right"]["text"])

    # now, themes is a dict[str, str]

    parsed_themes = []
    for theme in themes:
        css = themes[theme]
        parsed = tinycss2.parse_stylesheet(css, True, True)
        overrides = {}
        resources = {}
        cssvars = {}
        for chunk in parsed:
            match chunk.type:
                case "qualified-rule":
                    rule = tinycss2.serialize(chunk.prelude).strip()
                    contents = tinycss2.parse_blocks_contents(
                        chunk.content, True, True)
                    # process global rules
                    for pair in contents:
                        if pair.type == "error":
                            print(f"[{theme}] {pair.message}")
                            continue
                        name = pair.lower_name
                        values: list = [x for x in pair.value
                                        if x.type != "whitespace"]
                        override = False
                        if name.startswith("--"):
                            name = name.removeprefix("--")
                        else:
                            override = True
                        if rule not in (":root", "*"):
                            override = True
                            name = (".".join(
                                map(lambda x: x.serialize().strip(),
                                    chunk.prelude))
                                    + name)
                        if (values[0].type == "function"
                                and values[0].lower_name == "url"):
                            comp: Any = tinycss2.parse_one_component_value(
                                [values[0]], True)
                            resources[name] = {
                                "kind": "image",
                                "src": comp.arguments[0].value}
                            result = name
                        else:
                            # TODO: parse colors, number, boolean
                            result = tinycss2.serialize(values)
                        if override:
                            overrides[name] = result
                        else:
                            cssvars[name] = result
                case "at-rule":
                    match chunk.at_keyword:
                        case "font-face":
                            contents = tinycss2.parse_blocks_contents(
                                chunk.content, True, True)
                            font_name = (next(
                                [x for x in rule.value
                                 if x.type != "whitespace"]
                                for rule in contents
                                if rule.lower_name == "font-family")
                                [0].value)
                            font_src = next(
                                [x for x in rule.value
                                 if x.type != "whitespace"]
                                for rule in contents
                                if rule.lower_name == "src")
                            resources[font_name] = {"kind": "font", "src": (
                                font_src[0].arguments[0].value)}
                        case str() as a:
                            raise ValueError(a)
                case "error":
                    print(f"[{theme}] {chunk.message}")
                case str() as a:
                    raise NameError(a)
        parsed_themes.append({
            "name": theme,
            "values": cssvars,
            "overrides": overrides,
            "resources": resources
        })

    return parsed_themes


@timed
def config():
    presets_file = get_beepmod_file("jukebox/synth/SynthConfig.ts")
    ast = ts_utility.parse_ts(presets_file, "SynthConfig.ts")
    data = {}

    TypePresets = ts_utility.first_of_kind(ast, "FirstStatement")
    data["instrumentTypes"] = ts_utility.to_literal(
        ast=TypePresets["declarationList"]["declarations"][0]["initializer"])

    Config = ts_utility.find_class(ast, "Config")
    rawChipWaves = ts_utility.get_prop_of_class(Config, "rawChipWaves")
    rawChipWaves_dictarray = ts_utility.to_literal(
        rawChipWaves["arguments"][0])
    waves_by_name = {}
    for wave in rawChipWaves_dictarray:
        operation = wave["samples"]["expression"]["escapedText"]
        name = wave["name"]
        samples = ts_utility.to_literal(
            wave["samples"]["arguments"][0])
        expression = wave["expression"]
        # no need to center wave as integral processing removes
        # DC offset on its own
        # normalize wave, then premultiply by expression
        avg = (sum(map(abs, samples)) / len(samples)
               if "Normalize" in operation else 1)
        samples = [sample / avg * expression for sample in samples]
        waves_by_name[name] = samples
    data["chipWaves"] = waves_by_name

    unisons = ts_utility.get_prop_of_class(Config, "unisons")
    unisons_dictarray = ts_utility.to_literal(
        unisons["arguments"][0])
    unisons_by_name = []
    for unison in unisons_dictarray:
        offsets = []
        voices = unison["voices"]
        divisor = max(1, voices - 1)
        for i in range(int(voices)):
            # Copied formula from line 12640 of jukebox synth.ts and
            # special handling of voice 0 from line 12632
            offsets.append({
                "freq": pow(2,
                            (unison["offset"] + unison["spread"]
                             - ((2 * i * unison["spread"] / divisor)
                                if i > 0 else 0)) / 12),
                "expr": unison["expression"] * (unison["sign"]
                                                if i > 0 else 1)
            })
        unisons_by_name.append({
            "name": unison["name"],
            "voices": offsets
        })
    data["unisons"] = unisons_by_name

    classes = {
        "Config": Config,
        "this": Config,
        "EffectType": ts_utility.find_enum_to_imap(ast, "EffectType"),
        "GranularEnvelopeType": ts_utility.find_enum_to_imap(
            ast, "GranularEnvelopeType"),
        "EnvelopeComputeIndex": ts_utility.find_enum_to_imap(
            ast, "EnvelopeComputeIndex"),
        "InstrumentType": ts_utility.find_enum_to_imap(
            ast, "InstrumentType"),
        "Math": {
            "members": ([
                {
                        "kind": "PropertyDeclaration",
                        "name": {
                            "kind": "Identifier",
                            "escapedText": k},
                        "initializer": f}
                for k in dir(math)
                if callable(f := getattr(math, k))
            ]
                + [
                {
                    "kind": "PropertyDeclaration",
                    "name": {
                            "kind": "Identifier",
                            "escapedText": k},
                    "initializer": f}
                for k, f in {
                    "round": round
                }.items()]
            )
        }
    }

    # holy shit i made this powerful
    modulators_by_name = ts_utility.to_literal(
        ts_utility.get_prop_of_class(Config, "modulators"),
        classes=classes, try_eval=True)
    data["mods"] = modulators_by_name

    envelopes_by_name = ts_utility.to_literal(
        ts_utility.get_prop_of_class(Config, "instrumentAutomationTargets"),
        classes=classes, try_eval=True)
    data["envs"] = envelopes_by_name

    fm_4op_algos = ts_utility.to_literal(
        ts_utility.get_prop_of_class(Config, "algorithms"),
        classes=classes, try_eval=True)
    fm_4op_feedbacks = ts_utility.to_literal(
        ts_utility.get_prop_of_class(Config, "feedbacks"),
        classes=classes, try_eval=True)
    fm_6op_algos = ts_utility.to_literal(
        ts_utility.get_prop_of_class(Config, "algorithms6Op"),
        classes=classes, try_eval=True)
    fm_6op_feedbacks = ts_utility.to_literal(
        ts_utility.get_prop_of_class(Config, "feedbacks6Op"),
        classes=classes, try_eval=True)
    data["fmAlgos"] = {
        "4": {
            "forward": fm_4op_algos,
            "feedback": fm_4op_feedbacks,
        },
        "6": {
            "forward": fm_6op_algos,
            "feedback": fm_6op_feedbacks,
        },
    }

    return data


(data_dir / "jukebox_presets.json").write_text(json.dumps(presets(), indent=4))
(data_dir / "abyssbox_themes.json").write_text(json.dumps(themes(), indent=4))
(data_dir / "config.json").write_text(json.dumps(config(), indent=4))
