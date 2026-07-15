# Mission G1d — unify chrome DOM shape across all diagram types

**Authorization.** Maintainer, 2026-07-15: "unify the chrome dom shape
across all diagram types" — resolving the G0b/T4 deliberate divergence in
favor of the jar's shape. This closes the 19-fixture chrome
sibling-`<g>` family in the description census and normalizes every
engine's annotated output.

**The divergence (two coupled mechanisms, both in shared
`src/core/annotations/chrome.ts`):**
1. **Sibling composition.** `decorateEntityImage` wraps the body in its
   own `<g transform>` and adds each annotation slot as a SEPARATE
   sibling `<g class="title">` etc — 2 top-level `<g>`s. The jar nests
   title/legend/caption/header/footer INSIDE the same single content
   `<g>` the diagram body uses: one top-level `<g>` total. (G1 ledger
   § I1 "chrome's extra top-level `<g>`", full mechanism.)
2. **Transform wrappers vs baked coords.** Upstream bakes each block's
   final absolute x/y into its own `<text>` coordinates via
   `UGraphic.apply(UTranslate)` coordinate-context threading, so a jar
   `<g class="title">` never carries a `transform`. This port nests
   `<g transform="translate(x,y)">` wrappers because `RenderFragment`
   is a flat string. (chrome.ts's own doc comment, the G0b/T4 note.)

- Branch: `feat/g1d-chrome-dom` (from main @ post-E2r merge)
- Merge: merge commit; orchestrator owns all commits.
- Agents: NEVER git checkout/reset/stash/clean; no commits.

## Baseline (2026-07-15, post-E2r merge)

```
48 / 355 conformant · 1-3: 28 · 4-10: 82 · 11-30: 61 · 31+: 135 · errors: 1
Ratchet: 48 pinned.
DOT gate FROZEN: component 262/262 · usecase 90/90 · class 708/708 ·
object 78/80 · state 267/267 (chrome is render-side; the gate cannot
legitimately move).
Gates: npm test · typecheck · lint · build · dot-sync-report (frozen) ·
census (zero-diff set + ratchet = tripwire; NOTE none of the 19 chrome
fixtures are currently conformant, so correct unification can only move
non-tripwire fixtures — but ANNOTATED fixtures in the ratchet, if any,
must stay byte-identical only if their chrome was already jar-shaped;
verify which ratchet fixtures carry annotations before starting).
```

## Scope

All engines route chrome through `core/annotations/chrome.ts`
(G0b: plugins return RenderFragment; chrome + svgRoot assemble
centrally). Unify to the jar's shape:
- One top-level content `<g>`; annotation blocks nested inside it in the
  jar's order (title/caption/legend/header/footer per
  DiagramChromeFactory.create stacking).
- Annotation `<g class="...">` elements carry NO transform; coordinates
  are baked absolute into the text/graphic elements, mirroring
  upstream's UTranslate coordinate-context threading (the eager-arithmetic
  equivalent is fine — the SHAPE must match, the mechanism note in
  chrome.ts explains the existing eager collapse).
- Non-description engines (class/state/sequence/json/chart/yaml/...)
  keep rendering correctly: their own unit/integration tests
  (G0b's +194 annotation tests, tests/integration/annotations.e2e.test.ts)
  are the guard; update assertions/goldens ONLY where the assertion
  pinned the OLD divergent shape (each such change cites the jar shape).

## Iteration queue

| Iter | Scope | Reach | Status |
|---|---|---|---|
| M1 | The unification in chrome.ts + fragment plumbing; per-engine verification; census re-measure; ratchet pass; accounting update; mission-closing summary | 19 census fixtures + every engine's annotated output | done |

## Standing rules

Upstream spec: `~/git/plantuml/src/main/java/net/` —
DiagramChromeFactory.java:137-149/320-413, svek/DecorateEntityImage.java,
and the jar's cached annotated SVGs (test-results/dot-cache/... — the 18
I1 fixtures' in.svg show the exact target shape). Fix at origin in
chrome.ts / the fragment contract — no post-hoc SVG string surgery
outside the chrome composition itself. Complexity playbook, TDD,
git-archive baselines. Ledger: plans/g1d-chrome-dom/ledger.md.


## Mission-closing summary (M1, 2026-07-15)

**Result:** `svg[childCount]` and `g/@transform` fully closed for all 19
named chrome fixtures and every OTHER engine's annotated output (chrome.ts
is shared code) — ONE top-level content `<g>` per annotated document,
annotation `<g class="...">` slots carry no transform, coordinates baked
via `coord-shift.ts#shiftFragmentBody` (the eager-arithmetic equivalent of
`UGraphic.apply(UTranslate)`).

**Census:** 48/355 conformant before -> 48/355 after (byte-identical
zero-diff SET, not just count). Bucket movement (1-3: 28->23, 4-10: 82->72,
11-30: 61->66, 31+: 135->145) is entirely the expected "childCount-bail
unmasking" — every newly-visible diff family traces to a pre-existing,
already-ledgered mechanism (I-hideshow, I5/I6/I7 geometry-cascade) or a
newly-named-but-out-of-scope one (chrome-block text styling, see ledger).
Ratchet: 48/48 pinned, byte-identical. DOT gate: unchanged (frozen,
component 262/262, usecase 90/90, class 708/708, object 78/80, state
267/267).

**Gates:** `npm test -- --run` (322 files / 8635 tests), typecheck, lint,
build all pass.

**Follow-ups (not this mission's scope, named in the ledger):**
- Chrome-block text styling gap (`blocks.ts#drawLine`: `SansSerif` vs
  `sans-serif`, `black` vs hex, `<tspan>` wrapper, missing
  `lengthAdjust`/`textLength`) — 9 of 19 fixtures. Likely a G1-I2 extension.
- I-hideshow's hidden-link-still-drawn gap (already tracked) now visible
  on `balopu` specifically (was masked by the closed childCount diff).
- I5/I6/I7 geometry-cascade families (already tracked) now visible on
  several of the 19 (was masked the same way).

See `plans/g1d-chrome-dom/ledger.md` for the full design write-up,
per-engine verification table, and 4-fixture element-by-element jar
verification.
