# Mission G1 — description SVG conformance (component + usecase)

**Objective.** Drive the deterministic SVG census from 12/355 conformant to
**100% minus known divergences** (maintainer ruling 2026-07-14, superseding the ≥90% bar: every non-conformant fixture must carry a named DIVERGENCES.md/ledger entry — no anonymous misses) — the first Phase-G "the SVG is the product"
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
| I4c | creole text-CONTENT bugs -- DONE: 4/6 mechanisms fixed (unicode/entity escapes, link-label quote retention, colon/paren-wrapped-display-before-as, literal \n newline escape); 2 ledgered blocked-on-E2-remainder (== heading markers -- needs per-line font cascade; multi-line note/nested creole markup -- ~45-fixture reach, needs full char-atom subsystem) | 6 named + ~45 broader | from I4 ruled-out list; see ledger.md I4c |
| I-scale | `scale N` directive (whole-diagram scaling, unimplemented) | TBD | uniform primitive scaling |
| I5 | `svg/g/g[childCount]` structural — port fallback missing label text (`EntityImagePort.drawU`) | 20 | DONE — sub-classified the full 99+64 childCount family into 9 named sub-families (see ledger.md I5); drilled the largest tractable one (port label) |
| I5b | entity/link multi-stereotype: only the FIRST `<<tag>>` renders, upstream stacks one `<text>` per tag | 12 | DONE — `DescriptiveNode.stereotype` widened to `string[]`; 2 fixtures (mamase-39-buto560, juvucu-92-bugo434) fully closed on the childCount family, usecase mopimi-10-jaco443 partially (blocked on a NEW `hide <<label>> stereotype` unbuilt-command finding); 5 fixtures deferred to I5e (auto-create routing), 4 deferred (archimate sprite-stereotype, unbuilt) — see ledger.md I5b |
| I5c | bracket-body `[Line1\nLine2]` shorthand: literal `\n` not resolved via `finalizeDisplay` for that parse path | 2+ | DONE — `finalizeDisplay` exported + wired into `parseBracketDeclaration`; saxosu-09-nodi002/seguci-13-zure968/zarabi-01-koka785 (bonus) all reach zero-diff, zarabi ratchet-backfilled; surfaced a new component-container-cluster default-border-style gap (see ledger.md I5c) |
| I5d | transparent/near-zero-alpha color (`FontColor transparent`, `BackgroundColor transparent`, `#00000000`) draws the element instead of eliding it | ~14 fixtures / 37 diff instances (25 text + 12 rect) | DONE — condition is EXACTLY alpha===0 (jar-verified, not fuzzy); new `isTransparentColor` (paint.ts) wired into `setupBackcolor`/`textFontColor`; cobadu-43-gabi397 + catari-10-xiza828's targeted families both fully closed — see ledger.md I5d |
| I5e | link-endpoint auto-create stereotype (`Name<<tag>>` on the arrow's target) wrongly drawn as the LINK's own visible `«tag»` label | ~6 | DONE — new `DescriptiveLink.stereotypeIsLinkLabel` discriminator distinguishes the never-drawn pre-colon form from the genuinely-drawn post-colon-embedded form; all 5 fixtures' childCount family fully closed (DOT gate re-verified frozen despite nodesep/ranksep strictness) — see ledger.md I5e |
| I5f | sprite/icon multi-path glyphs (`<$bi-globe>` etc) collapsed to fewer `<path>` elements than jar | 9 diff instances / ~6 fixtures directly observed (23 fixtures corpus-wide use `<$name>` sprites, upper bound) | jar emits one `<path>` per icon sub-glyph; this port likely merges sub-paths into one `d` |
| I5g | content-level `<g>` wrapper count mismatch (`svg/g[childCount]`, both extra and missing, multiple `+N<g>` signatures) | ~20 fixtures combined | unexplained — not diagnosed this iteration; likely 2+ distinct mechanisms (group-anchor artifacts, interface/lollipop shield wrapping, `-[hidden]-` link handling) |
| I5h | `<linearGradient>` def count mismatch | 4 | `svg/defs[childCount]` — gradient dedup/emission-count divergence, not diagnosed |
| I-hideshow | hide/show command family (unconditionally ignored in command-table.ts; structural — unmasks geometry) | 13 | DONE — two mechanisms fixed (entity-level hide via HideOrShow's ordered rule list, draw-time-only; per-label stereotype-visibility, closes I5b's mechanism D); also fixed a co-discovered ink-extent/LimitFinder gap (hidden entities must still reserve canvas space). component/ciboso-93-romi495 + sufedi-40-baki261 reach zero-diff (ratchet-added); mavuxi-16-jafi782/tusugu-95-geju398/7×`hide stereotype` fixtures/mopimi-10-jaco443/zanibo-14-sami874 all mechanism-verified correct, blocked on unrelated pre-existing gaps (I4b color-override, cluster-border-style, title-chrome nesting, sizing-formula, font-baseline) — see ledger.md I-hideshow |
| I6 | `text/@x @y` (206+203 fixtures) | DONE (diagnosis-only, no code changed) — sub-classified: >99% is class A, box-position-inherited (text follows its own box's offset exactly, residual=0 in 91% of directly-matched rect/ellipse cases + the polygon/path/line-outlined remainder) — NOT its own mechanism, IS I7's family; re-measure text/@x,@y after I7 lands. Two narrower sub-mechanisms drilled to root cause but not fixed (layout/graphviz-ts-adjacent, outside safe render-only scope): (B) port-label above/below tie-break for port-only containers (4 fixtures, container min-body-size gap) and (C) ellipse-leaf (actor/usecase) uniform position drift (~1.5px actor / ~1.0px usecase topologies, 18 fixtures, graphviz-ts node-size-rounding candidate, unverified) — see ledger.md I6 | ~200 (99%+ redirects to I7) |
| I7 | rect/ellipse/line geometry (`rect@x/y/w/h`, `ellipse@cx/cy/rx/ry`, `line@x1/y1/x2/y2`) | ~120 | node-shape placement — I6 found this is ALSO the true owner of most `text/@x`/`text/@y` diffs (text is a pure render-time offset from its box); fixing this will likely close a large fraction of I6's family as a side effect |
| I8 | `polygon/@points` (arrowheads etc.) | 149 fixtures / 612 differing elements | DONE (diagnosis-only, no code changed) -- sub-classified into mechanism A (5pt/4pt arrowhead extremities, downstream of I9's spline endpoint/angle -- jar-verified, not its own mechanism) and mechanism B (6pt/7pt node/file/artifact cut-corner decoration polygons, downstream of I7's already-deferred ink-extent-margin/FrontierCalculator mechanisms B/C); exhaustive 0/173 isolation scan confirms no independent polygon-formula bug exists. Surfaced a NEW deferred mechanism: bracket-style link modifiers (`-[thickness=N]>`, `-[dashed]>`, `-[bold]>`, `-[#color]>`) are parsed into `rawStyle` but never applied (prior iteration's documented cut) -- candidate future iteration I-linkstyle -- see ledger.md I8 |
| I-linkstyle | bracket-style link modifiers (`-[thickness=N]>`, `-[dashed]>`, `-[bold]>`, `-[#color]>`) parsed into `DescriptiveLink.rawStyle` but never applied — needs `SvekEdgeInput.style` widening (thickness/color-override) + `strokeForStyle` wiring; feeds `path/@stroke-width @stroke @stroke-dasharray` and `polygon/@stroke-width @stroke` | DONE — `parseArrowStyle` (link-grammar.ts) faithfully ports `WithLinkType.applyOneStyle`; `DescriptiveLink.thicknessOverride`/`.colorOverride` thread through `DescriptionEdgeGeo.styleThickness`/`.styleColor` (replacing a crippled `dashed: boolean` field, also closing a latent unreached queue-char dotted/bold gap) into `SvekEdgeInput.styleThickness`/`.color`; `strokeForStyle` widened (incl. the BOLD-ignores-thickness-override upstream quirk, preserved faithfully). 7 fixtures jar-verified improved (0 regressions, confirmed by an exhaustive full-corpus before/after diff-count scan, not just the census bucket histogram), 0 reach zero-diff (all carry other out-of-scope residual families). Attempted-and-REVERTED: `-[hidden]-` bracket-elision (regresses canvas ink-extent on 2 fixtures — needs I-hideshow's edge-side ink-extent-registration fix as prerequisite). Ledgered, not fixed: `skinparam arrowThickness N` (new, unwired diagram-wide default) and `-[#transparent]-` path-elision (instrumented, root cause not found) — see ledger.md I-linkstyle |
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
