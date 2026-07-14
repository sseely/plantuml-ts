# Mission G1 — description SVG conformance (component + usecase)

**Objective.** Drive the deterministic SVG census from 12/355 conformant to
**≥90% + every miss ledgered** — the first Phase-G "the SVG is the product"
depth pass. Protocol: `plans/dot-oracle-sync/loop-protocol.md` (sequential
iterations, one mechanism each, diagnosis.md discipline, fix at origin,
grow the SVG ratchet as fixtures hit zero-diff, ledger the unfixable).

- Branch: `feat/g1-description-svg` (from main @ ce5cf25)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean; read-only git.

## Baseline (2026-07-14, census with stdlib store wired)

```
12 / 355 conformant · 1-3: 13 · 4-10: 97 · 11-30: 73 · 31+: 152 · errors: 8
DOT gate FROZEN THROUGHOUT: component 262/262 · usecase 90/90 · class
708/708 · object 78/80 · state 266/267 (G1 is render-side only — ANY DOT
movement is a stop condition).
Gates per iteration: npm test (≥90/90/90) · typecheck · lint · build ·
dot-sync-report (frozen) · census (conformant must not DROP; record delta).
Measure: npx tsx scripts/svg-conformance-census.ts [--families]
```

## Iteration queue (family table, census --families 2026-07-14; re-derive each iteration)

| Iter | Family | Reach | Notes |
|---|---|---|---|
| I0 | harness: image-href normalize rule (deliberate divergence, DIVERGENCES.md § raster pass-through) + errors 8→n triage (incl. xusuxe gvts crash, ledgered) | 1 + 8 | compare must not flag `image/@xlink:href` bytes; assert dims/position only |
| I1 | svg ROOT attrs on ANNOTATED fixtures (`@version @preserveAspectRatio @zoomAndPan @xmlns:xlink @contentStyleType svg[childCount]`) | 18 | the G0b-flagged unwrapKlimtSvg/assembleSvg root-attr loss — one mechanism |
| I2 | text style constants: `@font-size` (71) `@font-weight` (71) `@fill` (45) `@font-family` (6) | ~75 | likely emission-format/default constants |
| I3 | element `@id` conventions (`g/@id` 83, `path/@id` 10) | ~85 | jar's id naming scheme |
| I4 | `text/@textLength` value | 94 | both sides deterministic — a rounding/format mechanism |
| I4b | per-element FontSize/StereotypeFontSize skinparam + <style> wiring (renderer-symbol textFont is global-constant today) | ~25 | from I4 diagnosis; dominant textLength/font-size driver |
| I4c | creole text-CONTENT bugs (unicode-escape placeholders, quote retention, == heading markers, literal \n, multi-line note collapse, colon-wrapped actor names) | TBD | from I4 ruled-out list |
| I-scale | `scale N` directive (whole-diagram scaling, unimplemented) | TBD | uniform primitive scaling |
| I5 | `g[childCount]` + `svg/g[childCount]` structural | 129+64 | sub-classify FIRST (which child kinds are missing/extra); likely several mechanisms — split |
| I6 | `text/@x @y` | ~200 | text anchoring math |
| I7 | rect/ellipse/line geometry (`rect@x/y/w/h`, `ellipse@cx/cy/rx/ry`, `line@x1/y1/x2/y2`) | ~120 | node-shape placement |
| I8 | `polygon/@points` (arrowheads etc.) | 131 | 3,193 diffs |
| I9 | `path/@d` (splines) | 151 | 5,625 diffs — the monster; expect several mechanisms |
| I10+ | `@viewBox/@width/@height` residue | re-measure | mostly downstream of interiors; whatever remains after I1-I9 is real |

Colors/strokes (`@stroke`, `@stroke-width`, `@stroke-dasharray`, `@fill` on
shapes) fold into whichever iteration owns the emitting element.

## Standing rules

Upstream spec: the jar's cached SVGs (test-results/dot-cache/<type>/<slug>/
in.svg, deterministic-text capture) + `~/git/plantuml/src/main/java/net/`
(SvgGraphics.java is the emitter oracle). Fix at origin in the klimt
drivers/emitters — never post-hoc string surgery. The 8-fixture SVG ratchet
(tests/oracle/svg-conformance/) grows every iteration (add newly-zero-diff
fixtures to ratchet.json + goldens... verify the existing add procedure).
Complexity-hook playbook per project memory. Tests in tests/unit/ +
tests/oracle/. Ledger: plans/g1-description-svg/ledger.md (loop format).
Known deliberate divergences the compare must accommodate (normalize rule +
ledger, not fixes): image href bytes; annotated-fixture chrome DOM shape
(g-transform vs baked coords — IF the census flags it, decide baked-coords
port vs normalize at I1 with jar evidence).
