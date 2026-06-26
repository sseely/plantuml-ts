#!/usr/bin/env bash
# Capture both oracle reference artifacts for one .puml in a single jar run:
# the DOT(s) PlantUML feeds graphviz (svek-*.dot) and the rendered SVG.
# Usage: oracle/capture.sh <file.puml> [out-dir]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
JAR="$HERE/dist/plantuml-oracle.jar"
puml="${1:?usage: capture.sh <file.puml> [out-dir]}"
out="${2:-./oracle-ref}"

[ -f "$JAR" ] || { echo "oracle jar missing — run oracle/build-oracle.sh first"; exit 1; }
mkdir -p "$out"

# One pass: -DPLANTUML_DUMP_DOT emits svek-*.dot; -tsvg writes the .svg.
java -DPLANTUML_DUMP_DOT="$out" -jar "$JAR" -tsvg -o "$out" "$puml"

dots=$(ls "$out"/svek-*.dot 2>/dev/null | wc -l | tr -d ' ')
svgs=$(ls "$out"/*.svg 2>/dev/null | wc -l | tr -d ' ')
echo "captured -> $out : ${dots} DOT, ${svgs} SVG"
