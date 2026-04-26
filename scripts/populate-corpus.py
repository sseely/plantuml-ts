#!/usr/bin/env python3
"""
Populate tests/corpus/ from ~/git/pdiff and ~/git/plantuml nonreg suite.

Usage: python3 scripts/populate-corpus.py

Output: tests/corpus/<type>/*.puml  (gitignored — regenerate as needed)
"""

import os
import re
import sys

PDIFF_DBHUM = os.path.expanduser("~/git/pdiff/dbhum")
PDIFF_INPUT = os.path.expanduser("~/git/pdiff/input")
NONREG_ROOT = os.path.expanduser("~/git/plantuml/src/test/java/nonreg")
OUT_ROOT = os.path.join(os.path.dirname(__file__), "..", "tests", "corpus")

TYPE_PATTERNS = [
    ("sequence",  [r"^\s*\w[\w ]*->[\w ]", r"^\s*participant ", r"^\s*actor\s+\w",
                   r"autonumber", r"^\s*activate ", r"^\s*deactivate "]),
    ("class",     [r"^\s*class ", r"^\s*interface ", r"^\s*abstract\s+class",
                   r"^\s*abstract\s+\w", r"^\s*enum ", r"<\|--", r"--|>",
                   r"\*--", r"o--", r"^\s*annotation "]),
    ("state",     [r"\[\*\]", r'^\s*state "', r"^\s*state \w+ \{",
                   r"\[H\]", r"\[H\*\]"]),
    ("activity",  [r"^\s*:.+;\s*$", r"^\s*start\s*$", r"^\s*stop\s*$",
                   r"^\s*end\s*$", r"^\s*fork\b", r"^\s*split\b", r"^\s*if \("]),
    ("component", [r"^\s*component ", r"^\s*\[[\w ]+\]", r"^\s*package ",
                   r"^\s*node ", r"^\s*database ", r"^\s*cloud "]),
    ("usecase",   [r"^\s*usecase ", r"^\s*actor \w", r"^\s*\([\w ]+\)",
                   r"<<extend>>", r"<<include>>"]),
    ("object",    [r"^\s*object ", r"^\s*\w+ : \w+"]),
]


def detect_type(body: str) -> str | None:
    for dtype, patterns in TYPE_PATTERNS:
        for p in patterns:
            if re.search(p, body, re.MULTILINE):
                return dtype
    return None


def extract_diagram(raw: str) -> str | None:
    """Strip JSON metadata header and return the @startuml...@enduml block."""
    if raw.startswith("{"):
        end = raw.find("}")
        if end != -1:
            raw = raw[end + 1:].lstrip("\n")
    m = re.search(r"(@startuml.*?@enduml)", raw, re.DOTALL)
    return m.group(1).strip() if m else None


def copy_file(diagram: str, name: str, counts: dict, skipped_ref: list) -> None:
    body = diagram[len("@startuml"):diagram.rfind("@enduml")]
    dtype = detect_type(body)
    if dtype is None:
        skipped_ref[0] += 1
        return
    dst_dir = os.path.join(OUT_ROOT, dtype)
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, name)
    if os.path.exists(dst):
        skipped_ref[0] += 1
        return
    with open(dst, "w") as f:
        f.write(diagram + "\n")
    counts[dtype] = counts.get(dtype, 0) + 1


def main() -> None:
    counts: dict[str, int] = {}
    skipped = [0]

    # pdiff dbhum
    for root, _, files in os.walk(PDIFF_DBHUM):
        for fname in files:
            if not fname.endswith(".puml"):
                continue
            with open(os.path.join(root, fname), errors="replace") as f:
                raw = f.read()
            diagram = extract_diagram(raw)
            if diagram:
                copy_file(diagram, fname, counts, skipped)
            else:
                skipped[0] += 1

    # pdiff input (named fixtures)
    for fname in os.listdir(PDIFF_INPUT):
        if not fname.endswith(".puml"):
            continue
        with open(os.path.join(PDIFF_INPUT, fname), errors="replace") as f:
            raw = f.read()
        # Strip leading URL line
        lines = raw.split("\n")
        if lines and lines[0].startswith("http"):
            raw = "\n".join(lines[1:]).lstrip("\n")
        diagram = extract_diagram(raw)
        if diagram:
            copy_file(diagram, fname, counts, skipped)
        else:
            skipped[0] += 1

    # plantuml nonreg Java test files
    for root, _, files in os.walk(NONREG_ROOT):
        for fname in files:
            if not fname.endswith("_Test.java"):
                continue
            with open(os.path.join(root, fname)) as f:
                text = f.read()
            matches = re.findall(r'"""\s*(.*?)\s*"""', text, re.DOTALL)
            for i, block in enumerate(matches):
                if "@startuml" not in block:
                    continue
                m = re.search(r"(@startuml.*?@enduml)", block, re.DOTALL)
                if not m:
                    continue
                diagram = m.group(1).strip()
                base = os.path.splitext(fname)[0]
                suffix = f"_{i}" if i > 0 else ""
                copy_file(diagram, f"{base}{suffix}.puml", counts, skipped)

    print("tests/corpus/ populated:")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    print(f"  Total: {sum(counts.values())}")
    print(f"  Skipped (unknown type / no diagram / duplicate): {skipped[0]}")


if __name__ == "__main__":
    main()
