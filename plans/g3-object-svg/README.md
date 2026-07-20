# Mission G3 — object diagram SVG conformance

**Authorization.** Maintainer, 2026-07-19: "start G3."

**Objective.** Drive the object SVG census to **100% minus known
divergences** (2026-07-14 ruling: every non-conformant fixture carried by
a named DIVERGENCES.md/ledger entry — no anonymous misses). Object
diagrams route through the CLASS engine, so this mission inherits every
G2 subsystem (uids/phantom burns, box chrome, notes, creole, URLs, edge
machinery, style cascades, wrap) — expect a high starting baseline and a
short drill focused on object-SPECIFIC mechanisms (map tables, field
rows, object-specific commands).

- Branch: `feat/g3-object-svg` (from main @ post-G2 merge d740d91)
- Merge: merge commit; orchestrator owns all commits (one per iteration).
- Agents: NEVER git checkout/reset/stash/clean in this repo — NO
  EXCEPTIONS (disposable `git worktree` or the ratchet.json manifest are
  the snapshot methods); no commits.
- Protocol: `plans/dot-oracle-sync/loop-protocol.md`; G2's ledger
  (plans/g2-class-svg/ledger.md) is precedent for shared mechanisms.

## Corpus & oracle (verified fresh 2026-07-19)

```
test-results/dot-cache/object/ — 80 fixtures, cache dated 2026-07-11
(POST-deterministic-text-patch; spot-verified byte-identical to a live
jar run — no re-capture needed, unlike G2's N3).
DOT gate baseline: object 78/80 (the 2 non-equal are pre-existing,
carried since G0; the gate FREEZES at exactly these five counts:
component 262/262 · usecase 90/90 · class 708/708 · object 78/80 ·
state 267/267 — ANY movement = stop condition).
CLASS SVG GATE (new): the 292-fixture class ratchet
(tests/oracle/svg-conformance/class.golden.ratchet.test.ts) must stay
green and the class census zero-diff set identical — object work rides
the class engine; regressions there are regressions, full stop.
DESCRIPTION SVG GATE: the 48-fixture set identical + ratchet green.
Gates per iteration: npm test · typecheck · lint · build ·
dot-sync-report (frozen) · class census (292 set intact) · description
census (48 set intact) · object census (non-dropping).
```

## Iteration queue

| Iter | Scope | Status |
|---|---|---|
| O0 | Harness: extend svg-conformance-census.ts's renderFixtureFor to dispatch `object` through the class pipeline (G2 N0 precedent — check how object fixtures parse: the class engine's object commands); object ratchet harness (oracle/goldens/svg-object/ + object.golden.ratchet.test.ts + parity-object.json via svg-parity-survey's type args); TRUE baseline + `--families` classification + the opening queue table. Landed the `headerRows()` centering/baseline/textLength fix (object/map/json header rows) — census 1/80 -> 5/80. See `plans/g3-object-svg/ledger.md` O0 for the full family table (O1+ queue). | done |
| O1 | Fixed family #2 (DATA-row baseline+textLength, object field/map cell/json entry — same shape as O0's header fix) and the `skinparam {object,map,json}BackgroundColor` cascade (near-zero-harvest) — census 5/80 -> 10/80. Split `class-map-sizing.ts` out of `class-object-map-sizing.ts` (500-line cap). See `plans/g3-object-svg/ledger.md` O1 for the full writeup, deferred mechanisms (tag-scoped BackgroundColor, `~`-stripped object display names, remaining near-zero fixtures), and the O2+ queue. | done |
| O2 | Object empty-body ink-extent (`addRectInkEmptyBody`, object-only): a suppressed-fields classifier's ink contribution loses 1px on the WIDTH axis only (jar-verified via `LimitFinder#drawRectangle`'s native `-1`/`-1` inset, `EntityImageObject`'s `TextBlockUtils.empty(0,0)` fields path) — fixed `kexica-21-gega428`/`janoma-30-dovo501`. Multi-stacked-stereotype header rows (`fafozi-27-reja300`'s object side): generalized `headerRows` to N stacked lines via `class-stereotype.ts#splitStereotypeLabels`/`measureStereoLabelWidths` (reused, not reimplemented) — mechanism now matches class's own precedent exactly (3 diffs -> 1, the residual is an unrelated graphviz-ts float-rounding artifact, gvts-attributed). `<style> objectDiagram { object { ... } } }` nested-selector recognition (`collectElementStyleBuckets`) + `theme.colors.elements[kind].font` consumption in `renderRowText` (new, falls through to `classCascadeFontColor` for root-level rules — a genuine regression was caught and fixed mid-iteration, see ledger) — fixed `figeze-77-fozi735`. Census 10/80 -> 13/80. Assessed and reconfirmed OUT OF SCOPE: the `~`-leading-char object-display-name strip (`linuxu-41-cogo780`, thorough fresh re-search across every `isVisibilityCharacter`/`manageGuillemet` call site, genuinely not root-caused), the legacy tag-scoped `objectBackgroundColor<<X>>` skinparam form (confirmed via `FromSkinparamToStyle`'s constructor: a GENERIC universal `<<stereo>>`-to-style-cascade conversion, not a narrow extension of `classBorderThicknessByStereo`), and `gatefi-65-curu360` (reclassified: a graphviz-ts node-separation numeric divergence between two empty maps, not a render-side width bug). See `plans/g3-object-svg/ledger.md` O2 for the full writeup and the O3+ queue. | done |
| O3 | Landed 2 mechanisms: map/json row-divider draw mechanics (`TextBlockMap#drawU`/`TextBlockCucaJSon` bypass the classifier's own border-stroke UGraphic context entirely — full-width, fixed stroke-width 1, vertical divider interleaved per-row, not batched — `renderer-classifier-box.ts#MAP_JSON_DIVIDER_STROKE_WIDTH`/`mapColumnDividerEntries`) and the `hide <TYPE_KEYWORD> circle\|members\|fields\|methods` directive (`CommandHideShowByGender`'s OTHER GENDER alternative, `class-directives.ts#parseHideShowKindDirective`/`applyHideShowKindDirectives`, scoped to the 6 upstream keywords with a 1:1 `ClassifierKind` mapping) — fixed `juciri-29-tamu404`/`sinepa-64-beze711`/`beruju-17-jigi548`; `bepafe-03-teda035` improved 20 diffs -> 3 (residual gvts-attributed). Census 13/80 -> 16/80. Bonus: the hide-by-kind mechanism is shared with class, +1 class census fixture (`nujiga-81-peno983`, 292 -> 293, zero regressions, ratchet green). Root-caused (not fixed) the `~`-leading-char "strip": jar-probed, it's a GENERIC creole `~`-escape suppressing `#`-triggered ordered-list markup — neither feature exists in this port — cross-cutting every diagram type, reclassified from "object quirk" to "creole engine gap". Produced the full 80/80 per-fixture attribution table (accounting bar met per the 2026-07-14 ruling) — 19 newly-or-previously-named non-gvts mechanisms, 9 discovered this iteration (6 small/well-scoped: tabSize, underline-convention, nested style selector, stereotype hide-portion, enhanced-body-for-object, visibility-icon-fill-for-object). See `plans/g3-object-svg/ledger.md` O3 for the full mechanism writeups, the attribution table, and the mission-closing assessment (orchestrator's call: close now, or queue a focused O4 for the 6 small items first). | done |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(objectdiagram/ + the shared svek/cucadiagram machinery; grep `net/`).
Fix at origin; G2's named mechanisms are precedent — if an object diff
matches a G2-ledgered gvts-genuine/awaiting-maintainer item, ATTRIBUTE
it, don't re-drill. SVG-channel standing rule (maintainer 2026-07-17)
applies. Complexity playbook, TDD, ledger:
plans/g3-object-svg/ledger.md.
