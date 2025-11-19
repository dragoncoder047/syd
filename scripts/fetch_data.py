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

    EditorConfig = ts_utility.find_child(ast, "ClassDeclaration")

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

    ColorConfig = ts_utility.find_child(ast, "ClassDeclaration")

    themes = next(n["initializer"] for n in ColorConfig["members"]
                  if n["kind"] == "PropertyDeclaration"
                  and n["name"]["escapedText"] == "themes")

    themes = ts_utility.to_literal(themes)

    themes["custom"] = (themes["custom"]["templateSpans"]
                        [0]["expression"]["right"]["text"])

    # now, themes is a dict[str, str]

    return themes


(data_dir / "jukebox_presets.json").write_text(json.dumps(presets(), indent=4))
(data_dir / "abyssbox_themes.json").write_text(json.dumps(themes(), indent=4))
