import re
import pathlib
import json
import shutil
import subprocess
import os

import yaml
import themefix as themefix

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

    CATEGORY_HEADER = re.compile(r"""name:\s+"(.+)",\s+presets:""")

    all_data = {}

    current_category = None
    for line in presets_file.splitlines():
        stripline = line.strip()
        if stripline.startswith("//"):
            pass
        elif stripline.startswith("])"):
            current_category = None
        elif (m := CATEGORY_HEADER.search(stripline)):
            current_category = m.group(1)
        elif current_category and "name: \"" in stripline:
            chopped = stripline[:stripline.rfind(",")]
            data = yaml.load(chopped, yaml.SafeLoader)
            all_data.setdefault(current_category, []).append(data)

    return all_data


def themes():
    themes_file = get_beepmod_file("abyssbox/editor/ColorConfig.ts")

    THEME_HEADER = re.compile(r""""(.+?)": `""")
    RULE_LINE = re.compile(r"""(.+?)\s*\{""")
    CSS_LINE = re.compile(r"""([\w-]+?):\s*(.+?);$""")

    current_theme = None
    current_rule = None
    all_themes = {}
    skipping = False
    for line in themes_file.splitlines():
        stripline = line.strip()
        if "/*" in line:
            skipping = True
        if "*/" in line:
            skipping = False
        if skipping:
            continue
        if (m := THEME_HEADER.search(stripline)):
            themename = m.group(1)
            if themename == "custom":
                break
            current_theme = all_themes[themename] = {}
            if ":root {" in stripline:
                # Hack cause some themes open with the `:root on the first line
                current_rule = current_theme[":root"] = {}
        elif current_theme is not None and (m := RULE_LINE.search(stripline)):
            current_rule = current_theme[m.group(1)] = {}
        elif current_rule is not None and (m := CSS_LINE.search(stripline)):
            value = m.group(2)
            if value in ("true", "false"):
                value = {"true": True, "false": False}[value]
            elif value.removeprefix("-").replace(".", "").isnumeric():
                value = float(value)
                if value.is_integer():
                    value = int(value)
            current_rule[m.group(1)] = value
        elif stripline.startswith("}"):
            current_rule = None
        elif "`," in stripline:
            current_theme = None
        # if "public static readonly pageMargin" in stripline:
        #     break

    return themefix.fix(all_themes)


(data_dir / "jukebox_presets.json").write_text(json.dumps(presets(), indent=4))
(data_dir / "abyssbox_themes.json").write_text(json.dumps(themes(), indent=4))
