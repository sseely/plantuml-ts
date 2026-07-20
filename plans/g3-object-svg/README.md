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
| O4 | **Mission-closing.** Landed all six small/well-scoped mechanisms O3's assessment named, largest-first: `skinparam tabSize` tab-stop expansion (`nufoju-44-dabi767`), `<style> <sname> { header { BackgroundColor/FontColor/FontSize } } }` nested selector (`soxufi-98-nita528` + bonus `lijoda-62-teci632`), `hide <entity\|kind> stereotypes` (`kocupi-02-ripa662`), object bodies wired into the class-kind enhanced-body engine (`linazi-45-gevo553` — also fixed a genuine `==` double-line gap shared with class, +1 bonus class fixture `rizexu-84-xujo903`), `skinparam style strictuml` object-header underline (mechanism landed + unit-tested, but `jotaga-99-fatu830` itself stays non-conformant — a pre-existing, independently-instrumented DOT canvas-rounding residual, unrelated to the fix), and always-stroke-only object field visibility icons (`xuvesu-44-laru205`). Census 16/80 -> 22/80. Corrected a 79/80 arithmetic gap inherited from O3's own attribution table (`fafozi-27-reja300` was omitted). Refreshed the full 80/80 attribution table. See `plans/g3-object-svg/ledger.md` O4 for the full mechanism writeups, the refreshed attribution table, and the mission-closing summary. | done |

## Standing rules

Upstream spec: jar cached SVGs + `~/git/plantuml/src/main/java/net/`
(objectdiagram/ + the shared svek/cucadiagram machinery; grep `net/`).
Fix at origin; G2's named mechanisms are precedent — if an object diff
matches a G2-ledgered gvts-genuine/awaiting-maintainer item, ATTRIBUTE
it, don't re-drill. SVG-channel standing rule (maintainer 2026-07-17)
applies. Complexity playbook, TDD, ledger:
plans/g3-object-svg/ledger.md.

## Mission-closing summary (O4, 2026-07-19)

**Status: CLOSED.** Every push-forward item identified in prior
iterations has been attempted or explicitly deferred with a stated
reason; the accounting bar (2026-07-14 ruling — every non-conformant
fixture carried by a named ledger entry, no anonymous misses) is met.

### Trajectory

| Checkpoint | Object census | Notes |
|---|---|---|
| TRUE baseline (O0, pre-fix) | 1/80 | The single zero-diff fixture rides G2's class engine, not object-kind rendering |
| O0 (header-row centering) | 5/80 | |
| O1 (data-row baseline + skinparam BackgroundColor) | 10/80 | |
| O2 (empty-body ink-extent + stacked stereo + style FontColor) | 13/80 | |
| O3 (map/json divider mechanics + hide-by-kind) | 16/80 | |
| O4 (six small mechanisms, mission-closing) | **22/80** | |

Object DOT gate held at `78/80` (2 pre-existing non-equal since G0)
throughout every iteration — never touched, per the frozen-gate contract.
Object ratchet: 24 tests (22 AC1 + 1 AC2 + 1 AC3), from a standing start
of 0 at O0's harness stand-up.

### Landed mechanisms, per iteration

- **O0**: object/map/json header-row centering, baseline, and `textLength`
  (`headerRows`, shared by all three kinds).
- **O1**: data-row (object field / map cell / json entry) baseline +
  `textLength`; `skinparam {object,map,json}BackgroundColor` cascade.
- **O2**: object empty-body ink-extent (1px width-axis correction);
  multi-stacked `<<stereotype>>` header rows; `<style> objectDiagram {
  object { ... } } }` nested-selector FontColor/BackgroundColor cascade.
- **O3**: map/json row-divider draw mechanics (full-width, fixed
  stroke-width, interleaved vertical dividers); `hide <TYPE_KEYWORD>
  circle|members|fields|methods` directive (shared with class, +1 class
  census fixture).
- **O4**: `skinparam tabSize` tab-stop expansion in object field text;
  `<style> <sname> { header { BackgroundColor/FontColor/FontSize } } }`
  nested selector for object/map/json; `hide <entity|kind>
  stereotype(s)` (GENDER/PORTION form, distinct from the pre-existing
  label-pattern command); object bodies wired into the class-kind
  enhanced-body engine (`--`/`==`/`..`/`__` separators, `|_` tree lists)
  — plus a genuine, generically-applicable `==` double-line fix (+1
  bonus class census fixture); `skinparam style strictuml` object-header
  underline convention (mechanism landed and unit-verified at the text
  level, though its own target fixture stays non-conformant on an
  unrelated, pre-existing residual); always-stroke-only object field
  visibility icons.

12 distinct, independently jar-verified, unit-tested mechanisms across
5 iterations. Zero regressions at any checkpoint: the class census
zero-diff set only ever grew (292 -> 293 -> 294, both bonus additions
verified via a full pinned-vs-current diff, never a swap), the
description 48-set stayed intact throughout, and the DOT gate never
moved from its five frozen counts.

### Final residue table (58/80 non-conformant, all named)

| Category | Fixtures | Count |
|---|---|---|
| `gvts-blocked` — edge-spline `path/@d` (graphviz-ts numeric divergence, pending ADR-1 dot-engine cutover) | 40 fixtures | 40 |
| `gvts-blocked` — adjacent-node separation / canvas-dimension rounding, no edges | 6 fixtures | 6 |
| `awaiting-maintainer` — legacy tag-scoped `objectBackgroundColor<<X>>` | `majake-62-pero492` | 1 |
| `awaiting-maintainer` — DOT-topology, namespace/package nesting | `meloxo-38-jeti489`, `tusiri-92-catu943` | 2 |
| Creole `~`-escape + `#`-ordered-list markup (cross-cutting, unbuilt) | 3 fixtures | 3 |
| Creole `*`/`**` unordered bullet-list markup | `donoki-79-riku189` | 1 |
| Creole table syntax (`\|=`) in object body | `pikuba-31-faxo766` | 1 |
| `!procedure`-nested-diagram-in-map-value + creole font tags | 2 fixtures | 2 |
| `<style> json/map { MaximumWidth/MinimumWidth/Margin/Padding }` | `maxosa-84-juci042` | 1 |
| Edge uid-assignment order, mixed inline-color/style arrows | `sajege-04-zuce784` | 1 |
| **Total non-conformant** | | **58** |
| **Total conformant** | | **22** |
| **Grand total** | | **80** |

See `plans/g3-object-svg/ledger.md` O4's own attribution table for the
full per-fixture slug listing behind each row.

### Reopeners (for a future mission, if object diagrams are revisited)

Ranked roughly by expected reach if a future maintainer wants to pick
object diagrams back up:

1. **`gvts-blocked` (46/80 combined)** — resolved only by the dot-engine
   ADR-1 cutover (graphviz-ts numeric-layout parity), out of scope for
   any near-term object-specific iteration; this is the dominant residue
   category across BOTH object and class census.
2. **Creole engine gaps (5/80)** — ordered-list (`#`), unordered
   bullet-list (`*`/`**`), and table syntax (`|=`) markup, plus the
   `~`-escape interaction with the first — genuinely unbuilt, cross-
   cutting every diagram type's text rendering, not object-specific.
   Largest remaining IN-SCOPE feature gap by fixture count.
3. **`!procedure`-nested-diagram-in-map-value (2/80)** — an embedded-
   sub-diagram-as-map-value feature plus creole `<font:...>` tag support;
   confirmed the same mechanism across both its fixtures.
4. **`<style> json/map` dimension cascade (1/80)** — `MaximumWidth`/
   `MinimumWidth`/`Margin`/`Padding` style overrides, entirely unbuilt
   for `class-map-sizing.ts`/`class-json-sizing.ts`.
5. **Edge uid-assignment ordering (1/80)** — a mixed inline-color/style
   arrow-directive edge-creation-order divergence; not traced to a
   specific G2-ledgered uid-ordering mechanism.
6. **`awaiting-maintainer` items (3/80)** — legacy tag-scoped skinparam
   color lookup and DOT-topology namespace/package nesting; both require
   a maintainer scoping decision before any implementation work.

No further small/well-scoped items remain — every item above is either
`gvts-blocked` (architectural, not iterative) or a genuinely larger
feature (creole markup engine, embedded-diagram support, a new
dimension-style-cascade tier) appropriately sized for its own future
mission, not a G3 continuation.
