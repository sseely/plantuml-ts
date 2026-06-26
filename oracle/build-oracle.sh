#!/usr/bin/env bash
# Build the patched PlantUML oracle jar from the fork's dot-output branch.
# Stock behavior + DOT dump via -DPLANTUML_DUMP_DOT. See oracle/README.md.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FORK="${PLANTUML_FORK:-$HOME/git/plantuml}"
PIN_SHA="59ddb5313f4680acea6198f1db7120c8d5258631"   # pin.json:upstreamSha

[ -d "$FORK/.git" ] || { echo "fork not found at $FORK (set PLANTUML_FORK)"; exit 1; }

git -C "$FORK" switch dot-output

# The seam must sit on the pinned upstream tree. dot-output~1 is the pristine
# base; warn (don't fail) if it has drifted from the pin so a rebase is obvious.
base_tree="$(git -C "$FORK" rev-parse 'dot-output~1^{tree}')"
pin_tree="$(git -C "$FORK" rev-parse "${PIN_SHA}^{tree}" 2>/dev/null || true)"
if [ -n "$pin_tree" ] && [ "$base_tree" != "$pin_tree" ]; then
  echo "WARN: dot-output base tree != pinned upstream tree — rebase dot-output and update pin.json"
fi

( cd "$FORK" && ./gradlew jar -x test --console=plain )

jar="$(ls -t "$FORK"/build/libs/plantuml-*.jar | head -1)"
mkdir -p "$HERE/dist"
cp "$jar" "$HERE/dist/plantuml-oracle.jar"
echo "oracle jar -> $HERE/dist/plantuml-oracle.jar  (from $(basename "$jar"))"
