#!/usr/bin/env python3
"""
Compile PlantUML built-in themes into src/core/themes-builtin.ts.

Reads .puml theme files from the plantuml source tree and extracts:
  - BackgroundColor  -> colors.background
  - FontColor        -> colors.text
  - LineColor        -> colors.border + colors.arrow
  - FontName         -> fontFamily

Outputs a TypeScript module that maps theme names to Partial<Theme>.
"""

import re
import os
import sys

THEMES_DIR = os.path.expanduser('~/git/plantuml/src/main/resources/themes/')
OUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'src', 'core', 'themes-builtin.ts')

# ---------------------------------------------------------------------------
# Manual overrides for themes whose variables can't be easily auto-extracted.
# Values from inspecting the theme files directly.
# ---------------------------------------------------------------------------
MANUAL = {
    'aws-orange': {
        'bg': 'transparent', 'fg': '#232F3E', 'lc': '#FF9900', 'fn': None,
    },
    'cloudscape-design': {
        'bg': 'transparent', 'fg': '#000716', 'lc': '#0972D3', 'fn': None,
    },
    'reddress-darkblue': {
        'bg': '#2e2e2e', 'fg': '#ffffff', 'lc': '#1b1b1b', 'fn': 'Verdana',
    },
    'reddress-darkgreen': {
        'bg': '#2e2e2e', 'fg': '#ffffff', 'lc': '#1b1b1b', 'fn': 'Verdana',
    },
    'reddress-darkorange': {
        'bg': '#2e2e2e', 'fg': '#ffffff', 'lc': '#1b1b1b', 'fn': 'Verdana',
    },
    'reddress-darkred': {
        'bg': '#2e2e2e', 'fg': '#ffffff', 'lc': '#1b1b1b', 'fn': 'Verdana',
    },
    'reddress-lightblue': {
        'bg': '#eeeeee', 'fg': '#222222', 'lc': '#888888', 'fn': 'Verdana',
    },
    'reddress-lightgreen': {
        'bg': '#eeeeee', 'fg': '#222222', 'lc': '#888888', 'fn': 'Verdana',
    },
    'reddress-lightorange': {
        'bg': '#eeeeee', 'fg': '#222222', 'lc': '#888888', 'fn': 'Verdana',
    },
    'reddress-lightred': {
        'bg': '#eeeeee', 'fg': '#222222', 'lc': '#888888', 'fn': 'Verdana',
    },
    'sunlust': {
        'bg': '#fdf6e3', 'fg': '#657b83', 'lc': '#657b83', 'fn': 'Dejavu Serif',
    },
    'carbon-gray': {
        'bg': 'transparent', 'fg': '#f4f4f4', 'lc': '#4d4d4d', 'fn': 'IBM Plex Sans',
    },
    'toy': {
        'bg': '#DDDDDD', 'fg': '#333333', 'lc': '#333333', 'fn': None,
    },
    'vibrant': {
        'bg': '#FFFFFF', 'fg': '#333333', 'lc': '#333333', 'fn': None,
    },
    'mars': {
        'bg': '#F9F9F9', 'fg': '#191919', 'lc': '#191919', 'fn': None,
    },
    'black-knight': {
        'bg': 'transparent', 'fg': '#fff200', 'lc': '#1c1c1c', 'fn': None,
    },
}

# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def strip_front_matter(content: str) -> str:
    """Remove YAML front matter block (--- ... ---)."""
    return re.sub(r'^---.*?---\s*', '', content, flags=re.DOTALL)


def extract_vars(content: str) -> dict[str, str]:
    """
    Extract simple !$VAR = "value" or !$VAR = value declarations.
    Resolves one level of $OTHERVAR references.
    """
    vars: dict[str, str] = {}
    for line in content.split('\n'):
        s = line.strip()
        # Match: !$VARNAME = "value" or !$VARNAME = value
        m = re.match(r'!\$([A-Z_0-9]+)\s*=\s*["\']?(#[0-9A-Fa-f]{3,8}|[a-zA-Z][a-zA-Z0-9_]*|\$[A-Z_0-9]+)["\']?\s*$', s)
        if m:
            k, v = m.group(1), m.group(2)
            if v.startswith('$'):
                v = vars.get(v[1:], v)
            vars[k] = v
    return vars


def extract_root_style(content: str, vars: dict[str, str]) -> dict[str, str | None]:
    """Extract colors from <style> root { ... } block."""
    result: dict[str, str | None] = {'bg': None, 'fg': None, 'lc': None, 'fn': None}
    m = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if not m:
        return result
    style = m.group(1)
    in_root = False
    for line in style.split('\n'):
        s = line.strip()
        if re.match(r'root\s*\{', s):
            in_root = True
        elif in_root and s == '}':
            break
        elif in_root:
            for prop, key in [('BackgroundColor', 'bg'), ('FontColor', 'fg'),
                               ('LineColor', 'lc'), ('FontName', 'fn')]:
                if s.lower().startswith(prop.lower()):
                    val = s[len(prop):].strip().strip('"\'')
                    if val.startswith('$'):
                        val = vars.get(val[1:], val)
                    # Resolve one more level
                    if val.startswith('$'):
                        val = vars.get(val[1:], val)
                    result[key] = val
    return result


def extract_skinparam(content: str, vars: dict[str, str]) -> dict[str, str | None]:
    """Extract top-level skinparam BackgroundColor / DefaultFontName / FontColor."""
    result: dict[str, str | None] = {'bg': None, 'fg': None, 'fn': None}
    for line in content.split('\n'):
        s = line.strip()
        for pat, key in [
            (r'skinparam\s+BackgroundColor\s+(.+)', 'bg'),
            (r'skinparam\s+(?:Default)?FontColor\s+(.+)', 'fg'),
            (r'skinparam\s+(?:Default)?FontName\s+(.+)', 'fn'),
        ]:
            mm = re.match(pat, s, re.IGNORECASE)
            if mm and result[key] is None:
                val = mm.group(1).strip().strip('"\'')
                if val.startswith('$'):
                    val = vars.get(val[1:], val)
                result[key] = val
    return result


def normalize_color(val: str | None) -> str | None:
    """Normalize a color value: add # prefix if missing, handle 'transparent'."""
    if val is None:
        return None
    v = val.strip().strip('"\'')
    if not v or v == '?':
        return None
    if v.lower() == 'transparent':
        return 'transparent'
    if v.lower() in ('white', 'black', 'red', 'blue', 'green', 'yellow', 'orange'):
        return v.lower()
    # Add # if it's a bare hex
    if re.match(r'^[0-9A-Fa-f]{3,8}$', v):
        return '#' + v
    if v.startswith('#'):
        return v.upper() if len(v) == 7 else v
    return None  # Unresolved variable or complex expression


def parse_theme(fname: str) -> dict[str, str | None]:
    """Parse a .puml theme file and return {bg, fg, lc, fn}."""
    content = open(fname).read()
    content = strip_front_matter(content)
    vars = extract_vars(content)
    root = extract_root_style(content, vars)
    skp = extract_skinparam(content, vars)

    # Merge: root style takes priority, skinparam fills gaps
    return {
        'bg': root['bg'] or skp['bg'],
        'fg': root['fg'] or skp['fg'],
        'lc': root['lc'],
        'fn': root['fn'] or skp['fn'],
    }


# ---------------------------------------------------------------------------
# TypeScript emission
# ---------------------------------------------------------------------------

def ts_string(v: str | None) -> str:
    if v is None:
        return 'undefined'
    return f"'{v}'"


def emit_theme_entry(name: str, props: dict) -> list[str]:
    """Emit a TypeScript object entry for one theme."""
    bg = normalize_color(props.get('bg'))
    fg = normalize_color(props.get('fg'))
    lc = normalize_color(props.get('lc'))
    fn = props.get('fn')
    if fn:
        fn = fn.strip().strip('"\'')

    lines = [f"  '{name}': {{"]
    if fn:
        lines.append(f"    fontFamily: '{fn}',")
    color_lines = []
    if bg:
        color_lines.append(f"      background: '{bg}',")
    if fg:
        color_lines.append(f"      text: '{fg}',")
    # border and arrow both come from LineColor
    if lc:
        color_lines.append(f"      border: '{lc}',")
        color_lines.append(f"      arrow: '{lc}',")
    if color_lines:
        lines.append("    colors: {")
        lines.extend(color_lines)
        lines.append("    },")
    lines.append("  },")
    return lines


def main() -> None:
    if not os.path.isdir(THEMES_DIR):
        print(f"ERROR: themes directory not found: {THEMES_DIR}", file=sys.stderr)
        sys.exit(1)

    entries: dict[str, list[str]] = {}

    for fname in sorted(os.listdir(THEMES_DIR)):
        if not fname.endswith('.puml') or fname == 'puml-theme-_none_.puml':
            continue
        theme_name = fname.replace('puml-theme-', '').replace('.puml', '')
        fpath = os.path.join(THEMES_DIR, fname)

        if theme_name in MANUAL:
            props = MANUAL[theme_name]
        else:
            props = parse_theme(fpath)

        entry_lines = emit_theme_entry(theme_name, props)
        entries[theme_name] = entry_lines

    # Write TypeScript file
    out = [
        "/**",
        " * Built-in PlantUML theme definitions.",
        " * Auto-generated by scripts/compile-themes.py — do not edit by hand.",
        " * Re-run the script when upstream themes change.",
        " */",
        "",
        "import type { ThemeOverride } from './theme.js';",
        "",
        "/** Partial Theme overrides for each built-in PlantUML theme name. */",
        "export const BUILTIN_THEMES: Record<string, ThemeOverride> = {",
    ]

    for name, lines in entries.items():
        out.extend(lines)

    out.append("};")
    out.append("")

    with open(OUT_FILE, 'w') as f:
        f.write('\n'.join(out))

    print(f"Written {len(entries)} themes to {OUT_FILE}")
    for name in entries:
        print(f"  {name}")


if __name__ == '__main__':
    main()
