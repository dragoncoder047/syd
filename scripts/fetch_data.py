import json
import os
import pathlib
import shutil
import subprocess

# import themefix
# import tinycss2
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
    subprocess.check_call(["git", "pull"])
    os.chdir(old_dir)


ensure_github_repo("jukebox", "jukeebox/jukebox_typescript")
ensure_github_repo("abyssbox", "choptop84/abyssbox-source")


def get_beepmod_file(path: str) -> str:
    return (github_repo_dir / path).read_text()


def presets():
    presets_file = get_beepmod_file("jukebox/editor/EditorConfig.ts")
    ast = ts_utility.parse_ts(presets_file, "EditorConfig.ts")

    categories = {}

    EditorConfig = ts_utility.find_by_kind(ast, "ClassDeclaration")

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
        categories[name] = [ts_utility.to_literal(a) for a in obj]

    return categories


def themes():
    themes_file = get_beepmod_file("abyssbox/editor/ColorConfig.ts")
    ast = ts_utility.parse_ts(themes_file, "ColorConfig.ts")

    ColorConfig = ts_utility.find_by_kind(ast, "ClassDeclaration")

    themes = next(n["initializer"] for n in ColorConfig["members"]
                  if n["kind"] == "PropertyDeclaration"
                  and n["name"]["escapedText"] == "themes")

    themes = ts_utility.to_literal(themes)

    themes["custom"] = (themes["custom"]["templateSpans"]
                        [0]["expression"]["right"]["text"])

    # now, themes is a dict[str, str]

    return themes


def config():
    presets_file = get_beepmod_file("jukebox/synth/SynthConfig.ts")
    ast = ts_utility.parse_ts(presets_file, "SynthConfig.ts")
    data = {}

    TypePresets = ts_utility.find_by_kind(ast, "FirstStatement")
    data["instrumentTypes"] = ts_utility.to_literal(
        ast=TypePresets["declarationList"]["declarations"][0]["initializer"])

    Config = next(n for n in ast["statements"] if n["kind"] ==
                  "ClassDeclaration" and n["name"]["escapedText"] == "Config")
    rawChipWaves = next(n for n in Config["members"]
                        if n["name"]["escapedText"] == "rawChipWaves")
    waves = ts_utility.to_literal(
        rawChipWaves["initializer"]["arguments"][0])
    waves_by_name = {}
    for wave in waves:
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

    unisons = next(n for n in Config["members"]
                   if n["name"]["escapedText"] == "unisons")
    unison_ele = ts_utility.to_literal(
        unisons["initializer"]["arguments"][0])
    unisons_by_name = {}
    for unison in unison_ele:
        offsets = []
        voices = unison["voices"]
        divisor = max(1, voices - 1)
        for i in range(int(voices)):
            # Copied formula from line 12640 of jukebox synth.ts and
            # special handling of voice 0 from line 12632
            offsets.append(
                pow(2,
                    (unison["offset"] + unison["spread"]
                     - ((2 * i * unison["spread"] / divisor) if i > 0 else 0))
                    / 12))
        unisons_by_name[unison["name"]] = {
            "expression": unison["expression"],
            "voiceDetunes": offsets
        }
    data["unisons"] = unisons_by_name
    return data


(data_dir / "jukebox_presets.json").write_text(json.dumps(presets(), indent=4))
(data_dir / "abyssbox_themes.json").write_text(json.dumps(themes(), indent=4))
(data_dir / "config.json").write_text(json.dumps(config(), indent=4))
