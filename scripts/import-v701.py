#!/usr/bin/env python3
"""Import the exact v701 archive into a local checkout; dry-run by default."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import stat
import zipfile

EXPECTED = "9939007e0a82536fb406cba5d911393551021a5c4cd8ecc9b792a945423e7927"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if not (root / ".git").exists():
        parser.error("run from a Git checkout")
    with args.archive.open("rb") as source:
        if hashlib.file_digest(source, "sha256").hexdigest() != EXPECTED:
            parser.error("archive is not the exact recorded v701 baseline")
    pending = []
    seen = set()
    with zipfile.ZipFile(args.archive) as archive:
        for entry in archive.infolist():
            path = PurePosixPath(entry.filename)
            if path.is_absolute() or ".." in path.parts or ".git" in path.parts or "\\" in entry.filename:
                parser.error(f"unsafe archive path: {entry.filename}")
            if entry.is_dir():
                continue
            if stat.S_ISLNK(entry.external_attr >> 16):
                parser.error(f"symlink in archive: {entry.filename}")
            if str(path) in {"LICENSE", ".gitignore"}:
                continue
            if str(path) in {"README.md", "PLAN.md"}:
                path = PurePosixPath("docs/baseline-v701") / path
            target = root.joinpath(*path.parts)
            if not target.resolve().is_relative_to(root) or any(p.is_symlink() for p in (target, *target.parents) if p != root):
                parser.error(f"unsafe destination: {target}")
            if target in seen:
                parser.error(f"duplicate archive destination: {target}")
            seen.add(target)
            data = archive.read(entry)
            if target.exists():
                if not target.is_file() or target.read_bytes() != data:
                    parser.error(f"conflicting existing file: {target}")
            else:
                pending.append((target, entry))
        print(f"{len(pending)} new files; {'apply' if args.apply else 'dry run'}")
        if args.apply:
            for target, entry in pending:
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as output:
                    output.write(archive.read(entry))
            print("Local import complete. No files staged, committed or pushed.")
            print("Review third-party rights and git status before publishing.")
        else:
            print("Use --apply to extract locally. Do not publish unlicensed source assets.")

if __name__ == "__main__":
    main()
