#!/usr/bin/env bash
# Batch-(re)generate oracle goldens for a tree of fixtures.
#
# For every `input.puml` found under the goldens root, runs the oracle jar once
# to emit, beside it, the DOT(s) PlantUML feeds graphviz (`svek-*.dot`) and the
# rendered `input.svg`. Idempotent: stale svek/svg artifacts are cleared first,
# so re-running re-baselines (do this whenever pin.json's upstreamSha changes).
#
# Usage: oracle/capture-corpus.sh [goldens-root]   (default: oracle/goldens)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
JAR="$HERE/dist/plantuml-oracle.jar"
root="${1:-$HERE/goldens}"

[ -f "$JAR" ] || { echo "oracle jar missing — run oracle/build-oracle.sh first"; exit 1; }
[ -d "$root" ] || { echo "no goldens root at $root"; exit 1; }

total=0
fails=0
while IFS= read -r puml; do
  dir="$(dirname "$puml")"
  rm -f "$dir"/svek-*.dot "$dir"/*.svg
  # </dev/null: keep java off the loop's stdin (the find stream), else it
  # swallows the remaining fixtures and the loop exits after the first.
  if ! java -DPLANTUML_DUMP_DOT="$dir" -jar "$JAR" -tsvg -o "$dir" "$puml" </dev/null >/dev/null 2>&1; then
    echo "FAIL  ${dir#"$root"/}"
    fails=$((fails + 1))
    continue
  fi
  # find (not `ls svek-*.dot`) so a no-match doesn't trip set -e/pipefail.
  # 0 DOT is legitimate: PlantUML skips graphviz for a single isolated node.
  dots=$(find "$dir" -maxdepth 1 -name 'svek-*.dot' | wc -l | tr -d ' ')
  echo "ok    ${dir#"$root"/}  (${dots} DOT)"
  total=$((total + 1))
done < <(find "$root" -name input.puml | sort)

echo "---"
echo "captured ${total} fixtures, ${fails} failures"
[ "$fails" -eq 0 ]
