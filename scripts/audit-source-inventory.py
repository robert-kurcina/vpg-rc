#!/usr/bin/env python3
"""Read-only inventory of a committed tree; lexical hints, not a dead-code analyzer."""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import PurePosixPath
import posixpath
import re
import subprocess

NAMED = re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\(")
PY_DEF = re.compile(r"(?m)^\s*(?:async\s+)?def\s+\w+\s*\(")
HELPER = re.compile(r"^\s*const\s+\w+\s*=\s*(?:\(?\w+\)?\s*=>\s*)?(JSON\.parse\(JSON\.stringify\(\w+\)\)|JSON\.stringify\(\w+\)===JSON\.stringify\(\w+\)|Object\.prototype\.hasOwnProperty\.call\(\w+,\w+\))\s*;?\s*$")
REQUIRE = re.compile(r"\brequire\(\s*['\"](\.[^'\"]+)['\"]\s*\)")
SCRIPT = re.compile(r"<script\b[^>]*\bsrc\s*=\s*['\"]([^'\"]+)['\"]", re.I)

def git(*args):
    return subprocess.check_output(["git", *args])

def category(path):
    if re.match(r"^core/historical_engine_(?:chunk_|entry\.js$|runtime\.js$)", path):
        return "generated-engine"
    if path in ("core/official_counter_templates.js", "core/support_counter_art_bundle.js"):
        return "generated-art"
    if path == "core/terrain_tiles.js":
        return "mixed-terrain"
    return path.split("/")[0] if "/" in path else "(root)"

def inventory(ref):
    commit = git("rev-parse", "--verify", ref + "^{commit}").decode().strip()
    files = {}
    for record in git("ls-tree", "-rlz", commit).split(b"\0"):
        if not record:
            continue
        meta, path = record.split(b"\t", 1)
        _, kind, _, size = meta.decode().split()
        if kind == "blob":
            files[path.decode()] = int(size)
    totals = defaultdict(Counter)
    metrics, refs, unresolved, helpers = [], [], [], defaultdict(list)
    for path, size in sorted(files.items()):
        group = category(path)
        ext = PurePosixPath(path).suffix
        totals[group].update(files=1, bytes=size)
        if ext not in (".js", ".py", ".html") or group in ("generated-engine", "generated-art"):
            continue
        source = git("show", commit + ":" + path).decode("utf-8", errors="replace")
        lines = source.splitlines()
        metrics.append(dict(path=path, category=group, bytes=size, lines=len(lines),
                            named_markers=len(PY_DEF.findall(source) if ext == ".py" else NAMED.findall(source))))
        if ext == ".js" and group != "mixed-terrain":
            for i, line in enumerate(lines, 1):
                match = HELPER.fullmatch(line)
                if match:
                    signature = re.sub(r"\b(?!JSON\b|Object\b|parse\b|stringify\b|prototype\b|hasOwnProperty\b|call\b)\w+\b", "_", match[1])
                    helpers[signature].append([path, i, line.strip()])
        imports = REQUIRE.findall(source) if ext == ".js" else SCRIPT.findall(source) if ext == ".html" else []
        for target in sorted(set(imports)):
            if "://" in target or target.startswith(("/", "#", "data:")):
                continue
            base = posixpath.normpath(posixpath.join(posixpath.dirname(path), target.split("?")[0].split("#")[0]))
            candidates = [base, base + ".js", base + ".json", base + "/index.js"]
            resolved = next((p for p in candidates if p in files), None)
            (refs if resolved else unresolved).append([path, target, resolved])
    return dict(commit=commit, tracked_files=len(files), tracked_bytes=sum(files.values()),
                groups=dict(totals), source_metrics=metrics, literal_edges=refs,
                unresolved_literal_edges=unresolved,
                repeated_helper_candidates={k:v for k,v in helpers.items() if len(v)>1},
                limitations="Lexical markers only; comments/strings may match. No dynamic/global/CI reachability, AST complexity or dead-code proof. Mixed terrain counted separately.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ref", nargs="?", default="HEAD")
    print(json.dumps(inventory(parser.parse_args().ref), indent=2, sort_keys=True))
