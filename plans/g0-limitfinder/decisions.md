# G0 Architecture Decisions (locked)

Auto-approved under autonomous execution 2026-07-13 (maintainer directive
"start G0"; grind protocol). Contradicting one during execution = STOP.

## D1 — Faithful klimt port, upstream names, quirks included

`src/core/klimt/geom/MinMax.ts` (immutable; `getEmpty(initToZero)`;
constructor arg order `(minX,minY,maxX,maxY)`; NaN throws),
`MinMaxMutable`, `src/core/klimt/drawing/UGraphicNo.ts` (abstract no-op
base), `src/core/klimt/drawing/LimitFinder.ts` with the EXACT per-shape
extent math including the quirks: URectangle min-corner −1 inset +
`deltaShadow*2` on max; UPolygon `HACK_X_FOR_POLYGON=10` both sides;
UText `y -= dim.height − 1.5` then four corners via StringBounder;
UEllipse/UImage −1 on max corner; UEmpty full box; UCenteredCharacter
unhandled (upstream "To be done"); clip-aware `addPoint`; whitelist
`apply()` that throws on unsupported UChange. `TextBlockUtils.getMinMax`
replaces the throwing stub. `Footprint.MyUGraphic` stays as-is (separate
upstream class); do not merge them.

## D2 — Description sizing mirrors SvekResult, at the renderer seam

Replace the consumption of `computeTotalDimensions` (hand-scan,
LAYOUT_MARGIN=12) with the SvekResult recipe: run the SAME draw calls
through LimitFinder (a collect pass before the real UGraphicSvg pass in
`renderDescription`), `moveDelta(6 − minX, 6 − minY)` re-anchor, size =
`minMax.getDimension().delta(15,15)` into `minDim`. `computeTotalDimensions`
itself is NOT deleted (other callers may exist; verify) — the renderer just
stops trusting it for the document box. The klimt `ensureVisible`
(`trunc(x)+1`) is ALREADY faithful — do not touch it. Fidelity guard: the
5-fixture SVG ratchet must stay green; interior geometry of DOT-EQUAL
fixtures must not move (the re-anchor must reproduce, not perturb, current
anchoring — if current layout already anchors at (6,6)-equivalent, the
moveDelta is a no-op; verify empirically and journal).

## D3 — Pragma strip at the two jar write sites; skip narrowed to elk

`scripts/dot-sync-report.ts`: apply `stripLayoutPragma(markup)` (removes
`!pragma layout smetana|vizjs` lines ONLY — elk lines stay) at :131
(canonical .puml) and :169 (in.puml), and narrow the :296 oracle-blind
guard to elk-only. Re-capture invalidates the affected slugs' `.done`
markers only — do NOT regenerate the whole cache. Fixture list = the 42
smetana/vizjs slugs in the five gated types (research report § 3b;
class 28 incl. the one vizjs, component 5, state 6, usecase 3, object 0).

## D4 — Newly-comparable fixtures: EQUAL → golden candidate; non-EQUAL → recorded, not fixed

EQUAL newcomers join the per-type ratchet goldens per each type's
convention (class: EQUAL-only, no size pins; state/object: EQUAL +
`size-backlog.json` entry at measured delta if >0). Non-EQUAL newcomers
are RECORDED in the journal + parity report and left for the per-type DOT
queue missions — G0 does not drill them. docs/parity-report.md is
regenerated; the new numbers become the pinned baseline going forward.

## D5 — Mainframe: attempt via the description-side ink box; escape hatch stands

BigFrame geometry (computeWidth/Height off `getMinMax(original,…,false)`,
`ww = minX>=0 ? maxX : width`, `max(ww+12, titleW+10)` + effectivePadding;
tab path with cornersize 7/10; title at (3,1)) is portable once LimitFinder
exists — but chrome operates on RenderFragment STRINGS, which LimitFinder
cannot walk. T5 therefore evaluates exactly two options: (a) apply BigFrame
inside the description klimt pass (real ink box available) and keep the
divergence TEMPORARY for string-fragment engines; (b) keep the divergence
TEMPORARY everywhere with the updated rationale. NO SVG-string extent
walker is built in this mission (a third measurement mechanism; needs its
own decision). Whichever branch, DIVERGENCES.md is updated to match.

## D6 — Sanctioned DOT-gate movement, once

The T2 re-capture is the ONLY sanctioned numerator/denominator movement.
It lands as its own commit with before/after per-type numbers in the
message and journal. Everything else in the mission must hold the gate
exactly (before T2: old baseline; after T2: new baseline).

## D7 — Scope guard

No changes to: svgRoot engines' dimension computation, graph-layout/svek
DOT emission, `ensureVisible`/`finalizeRootAttributes` rounding, elk
handling, `svg-parity-survey` (triage tool). `unwrapKlimtSvg` may need to
read the new dims — allowed, minimal.

## Operational readiness

Library context — same as G0b: observability N/A (gates + census are the
instruments); rollback = revert the merge commit (the re-captured
test-results/dot-cache is gitignored and regenerable either way; goldens
changes revert with the commit); public API unchanged.
