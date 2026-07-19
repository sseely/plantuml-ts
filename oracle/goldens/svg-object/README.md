# svg-object conformance ratchet

Regression-proof gate for object diagrams (`object`/`map`/`json` leaves in
`src/diagrams/class/`), mission G3. Object diagrams have **no separate
engine upstream** — `ClassDiagramFactory` registers the object/map commands
alongside the class ones, so every object fixture routes through the SAME
class engine (`parseClass` -> `layoutClass` -> `renderClass`) G2 already
built and ratcheted (`oracle/goldens/svg-class/`). A fixture ratchets in
once it renders byte-for-byte identical to the jar oracle under a
**deterministic** text measurer; the ratchet test then holds it forever.
See `tests/oracle/svg-conformance/object.golden.ratchet.test.ts`.

## Why a deterministic measurer, not production

Same rationale as `oracle/goldens/svg-class/README.md` and
`oracle/goldens/svg-description/README.md`: production (`renderSync`)
always measures text with `jarMeasurer` (AWT font metrics via the cached
jar), a pre-existing, already-documented apples-to-oranges gap (D12), not
evidence of a rendering bug. This ratchet reuses `render-fixture-
class.ts#renderFixtureClass` VERBATIM (G2/N0, extended G3/O0) — object
fixtures need no dedicated render helper since they share the class
engine's exact pipeline; see that file's own doc comment.

## Layout

```
oracle/goldens/svg-object/
  ratchet.json                 <- the manifest (source of truth for CI)
  README.md                    <- this file
  <slug>/
    in.puml                    <- fixture source (committed, offline)
    golden.svg                 <- committed jar SVG, copied verbatim from
                                   test-results/dot-cache/object/<slug>/in.svg
```

Object fixtures have no `<type>` subdirectory level (mirrors svg-class,
not svg-description's `<type>/<slug>/`) — every entry here is drawn from
the `object` dot-cache bucket, whether the underlying classifier kind is
`object`, `map`, `json`, or (as with `gizini-87-vuve916`, a fixture from
the `object` issue-corpus bucket that happens to declare zero `object`-
keyword entities) plain `class`. `in.puml` and `golden.svg` are committed
copies so the ratchet test runs fully offline — no dependency on the
gitignored, regenerable `test-results/dot-cache/` tree at test time.

## Current state (G3/O0, 2026-07-19)

**5 fixtures pinned** at harness-stand-up: `oracle/goldens/object/` (the
DOT-parity ratchet) already inherited 78/80 DOT-EQUAL from G0; SVG
conformance (`DeterministicMeasurer`) started at **1/80** zero-diff
(`gizini-87-vuve916` — a `class`-only fixture from the `object` corpus
bucket, riding G2's already-fixed class engine, unrelated to object-kind
rendering) before this iteration's own fix. O0 diagnosed and fixed a
`headerRows()` mechanism (`class-object-map-sizing.ts`, shared by
`measureObjectClassifier`/`measureMapClassifier`/`class-json-sizing.ts
#measureJsonClassifier`): the object/map/json name+stereotype header text
drew flush-left (`indent: 0`) with a naive half-height Y (`nameH/2`) and
**no** `textLength`/`lengthAdjust` at all — jar's own
`EntityImageObject#getLayout`/`PlacementStrategyY1Y2` CENTERS every header
block within the classifier's FINAL box width and draws each at its own
ascent-from-top baseline. Fixed to `indent = (boxWidth - rawWidth) / 2`,
`y = stereoHeight + namePadding + (fontSize - descent)` (name) /
`y = fontSize - descent` (stereo, no margin), `width = rawWidth` (feeds
`textLength`) — jar-verified against 6 independent samples spanning all
three kinds (object with/without stereotype, map, json). Corpus effect:
**1/80 -> 5/80** zero-diff (+4: `niloru-34-nuve651`, `pagidu-67-doxa131`,
`sobosi-40-xuda813`, `vozomu-86-rodo657` — every plain single-object,
no-stereotype, no-or-minimal-field fixture in the corpus). See
`plans/g3-object-svg/ledger.md` O0 for the full family classification and
the O1+ queue (the SAME missing-textLength/wrong-baseline pattern is
still present, unfixed, in object FIELD rows, map DATA rows, and json
entry rows — a related but functionally separate mechanism, deferred).
All 5 are `dotEqual: true` per `parity-object.json` (regenerated
2026-07-19, `conformant:5, structural-match:7, diverged:68`).

## Add rule

A fixture may be added to `ratchet.json` only when **both** hold:

1. **Conformant** — rendering the fixture's `in.puml` through
   `renderFixtureClass` with `DeterministicMeasurer` produces an SVG that
   is zero-diff (`compareSvg(ours, golden, 'deterministic').pass === true`)
   against the jar's `in.svg`.
2. **DOT-EQUAL** — the fixture's DOT emission is structurally `EQUAL`
   against the oracle DOT. Object DOT sits at 78/80 (frozen gate, 2
   pre-existing non-equal since G0), so this condition is near-universally
   satisfied once (1) holds — but is still enforced by the suite itself
   via `tests/oracle/svg-conformance/parity-object.json`, mirroring
   svg-class's own `parity-class.json` eligibility gate. Regenerate via
   `npx jiti scripts/svg-parity-survey.ts --out tests/oracle/svg-
   conformance/parity-object.json object` after any render-side change,
   before adding new slugs (N0/G2 added the `--out`/positional-type args,
   additive, default invocation unchanged — does NOT touch the shared
   component/usecase `parity.json` or class's `parity-class.json`).

To add a slug:

1. Confirm both conditions above (e.g. via `npx tsx scripts/svg-
   conformance-census.ts object` and `parity-object.json`).
2. Copy `test-results/dot-cache/object/<slug>/in.puml` and `in.svg` into
   `oracle/goldens/svg-object/<slug>/` (renaming `in.svg` to `golden.svg`).
3. Append `{ slug, addedAt, source: "dot-cache" }` to `ratchet.json`.

## Remove rule

Removal is **maintainer-only** — see `oracle/goldens/svg-description/
README.md`'s identical rule; the same rationale applies verbatim.
