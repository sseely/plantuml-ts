# Mission G5 — StringMeasurer width calibration

**Authorization.** Maintainer, follow-up to G4 ("Start work on the
StringMeasurer calibration gap"). Branch: `feat/g5-measurer-calibration`.

**Founding evidence.** `plans/g4-state-svg/ledger.md` §S13: three
independent attempts (S4, S12, S13) at the composite-internal-labeled-
transition edge-label-ink mechanism all failed on the SAME wall — a
divergence between this port's own computed edge-label width and jar's
real rendered label box. S13's own root-cause analysis named it a
"text-measurement calibration gap": this port's `StringMeasurer`
(`WidthTableMeasurer`/`LutTextMeasurer`, depending on call site) was
reported to measure `bemena-23-zebu249`'s `"EvNewValueSaved"` label at
120.05px vs jar's real `textLength` of 111.475px (~7% overestimate), and
S13 speculated this compounds with a label-placement divergence to explain
the mechanism's ~10.6px right-edge error.

**C0's finding — the mission's premise does not survive verification.**
`WidthTableMeasurer` (the `DeterministicMeasurer` used everywhere jar
comparisons happen) is NOT miscalibrated. It is jar-exact (0.000% mean
error, floating-point-noise-only max error) across 13,564 in-scope oracle
text samples spanning component/usecase/class/object/state at every
observed font-size/weight/style combination. **120.05 IS the measurer's
correct, exact answer for `"EvNewValueSaved"` at font-size 14 — the jar's
real value (111.475) is ALSO this exact measurer's exact answer, but at
font-size 13.** The "calibration gap" is a caller-side bug: the call site
building this edge label's `FontSpec` uses `theme.fontSize` (14, the
`FontParam.STATE` body-text default) instead of upstream's
`FontParam.ARROW` default (13) for arrow/transition/relationship label
text. See `ledger.md` §C0 for the full jar-verified derivation and the
five call sites (spanning THREE diagram engines — state, class/object,
description) carrying the identical bug.

**Consequence for scope.** The fix lives in `src/diagrams/state/*.ts` and
`src/diagrams/class/*.ts` (and `src/diagrams/description/layout.ts`) —
all explicitly OUTSIDE this iteration's write-set
(`src/core/** measurer/font-metrics modules only`). Per
`~/.claude/rules/autonomous-execution.md`'s STOP conditions ("a task
requires modifying files outside its declared write-set AND those files
aren't in any other task's write-set either"), C0 did NOT modify any
`src/` file — there is no in-scope measurer bug to fix. See "Next
iteration" below.

## Gates table (re-verified fresh at C8 end -- DOT gate/censuses/golden
## ratchets/size-backlog ALL byte-identical to C7's baseline; C8 re-landed
## C6's proven stack (font-fix + label-ink fold + HTML injection + floor
## removal), individually root-caused all six residual fixtures (per-
## fixture mechanism, not a shared one), then REVERTED IN FULL per protocol
## since none of the six close without widening `size-backlog.json` (see
## ledger.md §C8))

| Gate | Value |
| --- | --- |
| `npm run typecheck` | clean (both configs) |
| `npm run lint` | clean |
| `npm test -- --run` | 10150 passed \| 5 skipped (381 files) — C7's own 4 `graph-layout.test.ts` + 2 `layout.test.ts` new cases; the 5 skipped are UNCHANGED, still C1's reverted sites 2/3 evidence |
| DOT gate | component 262/262 · usecase 90/90 · class 708/708 · object 78/80 · state 267/267 (unchanged) |
| `state-dot-parity.test.ts` (size-backlog ratchet) | 268/268 (unchanged) |
| `description.golden.ratchet.test.ts` | 51 tests (unchanged) |
| `class.golden.ratchet.test.ts` | 305 tests (unchanged) |
| `object.golden.ratchet.test.ts` | 24 tests (unchanged) |
| `state.golden.ratchet.test.ts` | 54 tests (unchanged) |
| description census (no-arg) | 48/355 (unchanged) |
| class census | 303/718 (unchanged) |
| object census | 22/80 (unchanged) |
| state census | 52/271 (unchanged) |
| `oracle/goldens/state/size-backlog.json` | 93 entries (unchanged from C4; C5-C7 touched no `node.width`/`node.height`-affecting code that qualified for tightening) |

## Protected sets (movement rules, per mission brief)

- DOT gate: movement in EITHER direction on any of the five counts = STOP
  and report to orchestrator. C1 confirmed all five call sites individually
  keep this gate byte-identical (262/90/708/78/267) — the size-driven risk
  materialized elsewhere (the size-backlog ratchet, below), not here.
- `size-backlog.json`: tighten-only (entries may only shrink/pass). C1
  found this rule DOES bind in practice: sites 2/3 (state composite)
  regressed it (16-17/103 entries) despite the DOT gate staying clean —
  reverted per this rule, not per the DOT-gate rule above. Treat the two
  protected sets as INDEPENDENT checks, not one proxy for the other.
- Four censuses: each may grow, none may shrink. C1: unchanged (0 growth,
  0 shrink) at all landed sites.
- `npm test -- --run`: must stay green; ratchet test files may only gain
  tests (new pins), never lose them. C1's own new test files (not ratchet
  files) may be freely edited/skipped by the iteration that authored them.
- C6: reconfirmed the `size-backlog.json` tighten-only rule binds even
  when a change is a clear NET improvement (10/15 control-set PASS vs.
  C4's 9/15, 7/8 backlog regressions fixed) — 6 residual failures still
  meant a full revert, no partial credit. Also established a new
  diagnostic technique worth reusing: toggling a candidate dead-code path
  (the `Math.max` floor) across the FULL corpus, not just the named
  control set, to get a corpus-wide dead/live proof rather than an
  inference from 15-23 samples.
- C7: the DOT-parity comparator (`tests/oracle/svek-dot.ts#parseClusters`)
  was ALREADY built anticipating protection-wrapper nesting (its own doc
  comment names the exact `clusterNp0/clusterN/clusterNp1` shape) — landing
  wrapper subgraphs moved the DOT gate NOT AT ALL, confirming that specific
  pre-built tolerance rather than needing a fresh STOP-and-report decision.

## Iteration log

- **C0**: harness (`scripts/measurer-calibration-report.ts`),
  full corpus-wide characterization, jar-verified diagnosis (mechanism
  found: font-size 14-vs-13 caller bug, NOT a measurer defect). Zero `src/`
  changes — no in-scope fix exists. See `ledger.md` §C0 and
  `decision-journal.md` for the full record.
- **C1**: landed 3 of 5 call sites (state flat pipeline,
  class relationship labels, description edge labels — the last requiring
  a mandatory 500-line file split, `layout.ts`→`layout-dot-tree.ts`, plus
  a materially more careful fix than a constant swap, since that site's
  `fontSpec` is shared with node/title measurement). Reverted 2 sites
  (state composite pipeline, `addLevelEdges`/`sweepOrphanEdges`) after a
  jar-verified `state-dot-parity.test.ts` size-backlog regression, traced
  to an ALREADY-NAMED, pre-existing gap in `state-composite-autonom.ts`
  (unrelated to this mission, predates it) — see `ledger.md` §C1 for the
  full mechanism, bisection evidence, and the edge-label-ink
  re-attemptability assessment (still blocked; a third compounding gap
  identified). All protected sets (DOT gate, four censuses, four golden
  ratchets) verified byte-identical to baseline at every site landing and
  in the final state.
- **C2**: landed chunk 1 — `layoutGraph()`'s
  `DotLayoutResult` now exposes real per-cluster geometry
  (`graphviz-ts` 0.1.26072115's new `getLayout().clusters`, TDD, 4 new
  tests, additive/no-consumer-yet). Deep jar-verified diagnosis of
  mechanism 16 (entity-vs-cluster wrap)'s RENDER half found it blocked on
  a graphviz-ts programmatic-builder-API gap (no supported way to
  construct an HTML-table cluster label outside DOT-text parsing) — filed
  `docs/graphviz-issues/07-html-label-mark-not-exported.md`, with a
  jar-verified 19px header-height constant (18/19 real fixtures exact, the
  19th fully explained by a `scale` pragma) and a confirmed-working (but
  not-yet-sanctioned) marker-based technique that reproduces it exactly.
  Re-examined C1's own sites-2/3 hypothesis ("cluster geometry might
  unblock the `buildPlainAutonomSpec` floor") and found it does NOT hold —
  the founding fixture's autonom composite has zero nested clusters; the
  real, unrelated blocker is the already-3-strike-parked G4 S11-S13
  edge-label-ink mechanism. Zero `src/diagrams/state/*.ts` changes (per
  the mission's own "do not force" guidance) — see `ledger.md` §C2 for the
  full derivation, evidence trail, and C3+ queue.
- **C3**: landed mechanism 16's SHAPE half — DOT-side `setHtmlAttr` seam
  (opt-in via new `DotInputCluster.titleTableWidth`/`titleTableHeight`
  fields), real cluster-bbox sizing wired into the state composite path, a
  NEW jar-verified `renderClusterMeasured` render shape, and a document-
  nesting fix (a cluster's children render as flat SIBLINGS, not nested,
  matching jar's real DOM structure) — for the eligibility-gated majority
  case (single-line title, default font-size, no border points, top-level
  pass only; nested-inside-autonom clusters explicitly excluded after a
  jar-verified size-backlog regression traced to the SAME parked
  `buildPlainAutonomSpec#Math.max` floor C1/C2 already named). Tightened
  `size-backlog.json` 103→92 entries (13 shrunk, 10 removed at 0) — a real,
  independent size-accuracy win. Discovered TWO new, precisely-scoped open
  items blocking true byte-exact ratchet pins (document order for
  cluster/autonom/leaf siblings; a conditional body-fill path for
  content-less clusters) — neither closed this iteration; the
  entrypoint/exitpoint family remains deferred pending both. 0 new golden-
  ratchet pins; all four protected censuses and the DOT gate re-verified
  byte-identical. See `ledger.md` §C3 for the full derivation, the
  corpus-wide 134-sample probe, and the C4+ queue.

- **C4** (maintainer sign-off 2026-07-21, "Attempt the ink mechanism" —
  fourth attempt at the G4 S4/S12/S13 edge-label-ink mechanism): derived and
  landed a principled mechanism -- HTML `<TABLE FIXEDSIZE>` edge labels via
  `GvEdge.setHtmlAttr` (mirrors `SvekEdge.appendTable`, C3's public-API
  precedent extended from subgraphs to edges) sized with C1's jar-exact
  13pt measurement, plus reading graphviz's own real `labelX`/`labelY`
  back for render placement (via `textAscent()`, an EXISTING convention,
  not a new formula) instead of the pre-existing perpendicular-offset
  approximation. Re-landed C1's sites 2/3 font-size fix verbatim
  (un-skipped its TDD tests, all passing). Measured against the S12/S13
  control set (15 unique fixtures): 9/15 improved (including the S13
  founding fixture `bemena-23-zebu249`, now well inside its size-backlog
  allowance, and two fixtures S13 itself had proven "unrelated to this
  mechanism at all 3 variants" also improved) but 6/15 regressed — same
  already-4-times-attempted `buildPlainAutonomSpec#Math.max(geometry.width,
  result.width)` floor (C1/C3's own named gap), now precisely re-confirmed
  as the SOLE remaining blocker for three independent, otherwise-working
  mechanisms. Per the mission's own explicit protocol ("if this attempt
  fails the control set, journal it and stop; do not try formula variants
  past your first principled derivation"), REVERTED IN FULL (7 files
  restored byte-for-byte to the C3 HEAD commit) rather than widen any
  `size-backlog.json` entry. All protected sets (DOT gate, four censuses,
  four golden ratchets, size-backlog ratchet) re-verified byte-identical
  to the C3 baseline after the revert. See `ledger.md` §C4 for the full
  derivation, the 15-fixture control-set table, the jar-verified mechanism
  of the 6 regressions, and the C5+ queue.

- **C5** (this iteration's own scope: C3's two authorized, not-blocked
  cluster items -- sibling document order + conditional body-fill -- plus
  the entrypoint/exitpoint family if they cleared it): landed BOTH items,
  each jar-verified from source (`GraphvizImageBuilder.java`/
  `Bibliotekon.java`/`RoundedContainer.java`/`RoundedSouth.java`) and
  corpus-anchored (35+ samples for document order, 82 for body-fill).
  Document order also needed a discovered, not-pre-named sibling fix for
  TRANSITIONS/edges (the SAME jar mechanism, `Bibliotekon.allLines()`),
  since a cluster's own internal edges share its container pass. Despite
  all three sub-fixes being independently correct and non-regressing (DOT
  gate, four censuses, four golden ratchets, size-backlog ratchet all
  byte-identical to C4's baseline), **0 new zero-diff pins** -- landing
  items 1/2 UNMASKED a THIRD, newly-confirmed, pre-existing gap (graphviz's
  own 8pt default cluster margin vs jar's real ~16px side margin,
  confirmed on 5/5 samples checked, not just the two named fixtures) that
  is now the SOLE blocker for every eligible cluster fixture. Entrypoint/
  exitpoint family correctly NOT attempted -- blocked by this SAME newly-
  found gap (not by items 1/2, which are themselves fully resolved) plus
  its own still-undeived WithLabel-branch width formula. See `ledger.md`
  §C5 for the full derivation, the corpus evidence, and the C6+ queue.

- **C6** (maintainer sign-off 2026-07-21, "Attempt the floor fix" — fifth
  attempt at the edge-label-ink mechanism, targeted precisely at C4's own
  isolated root: `geometry.width` never folded label ink in at all): landed
  a jar-faithful fold (new `TransitionGeo.labelInk`, real graphviz
  `labelX`/`labelY` centered box + jar-exact width/height), re-landed C1's
  font-fix (sites 2/3) and C4's HTML-FIXEDSIZE injection verbatim, then
  PROVED the `Math.max(geometry.width, result.width)` floor is fully dead
  code — corpus-wide (267/268 fixtures), not just the 15-fixture control
  set, removing it changes NOTHING. Materially better than C4: 10/15
  control-set fixtures pass (up from 9/15, including `bunade-42-fudu910`,
  which C4 could not clear), and 7 of C4's own 8 non-control-set backlog
  regressions are now fixed. But 6/268 `state-dot-parity.test.ts` fixtures
  still fail — `bajelo-54-dixe684`/`rovese-43-tadu368`/`beguxu-19-tize774`
  byte-identical to C4's own numbers (this iteration's ink-fold contributes
  NOTHING to them, proving their regression is C4's injection/font-fix
  package alone, unrelated to the floor), `pesita-10-dene726` WORSE than
  C4, `nimana-36-veco708`/`fotuje-06-fifa085` improved but still short.
  REVERTED IN FULL per the mission's own protocol (9 files restored
  byte-for-byte to the C5 HEAD commit) rather than widen any `size-
  backlog.json` entry. All protected sets re-verified byte-identical to
  the C5 baseline after the revert. See `ledger.md` §C6 for the full
  derivation, the 15-fixture control-set table, the corpus-wide floor-dead
  proof, and the precisely-scoped C7+ queue (the floor question is now
  CLOSED; the real remaining blocker is C4's injection package's own
  interaction with 3 specific, already-partially-characterized fixtures).


- **C7** (this iteration's own scope: C5's item 0/1, the cluster SIDE-
  margin gap — "TEST THIS HYPOTHESIS FIRST", per the task's own p0/p1
  wrapper hint): confirmed and derived the REAL mechanism from source
  (`ClusterDotString.java`'s "i"/"p1" protection-wrapper nesting, each an
  ordinary graphviz cluster subgraph carrying its own default 8pt
  `CL_OFFSET` margin, compounding to 16px untouched / 24px touched —
  "touched" being `isGroupTouched`, the SAME condition already driving the
  pre-existing zaent-anchor mechanism, confirmed corpus-wide 84/84 zero
  mismatches). Landed `DotInputCluster.innerMarginLevels`/`unwrappedNodeId`
  (opt-in, `titleTableEligible`-gated) — `graph-layout-build.ts#addClusters`
  emits the matching nested wrapper subgraphs; `state-composite-geo.ts`/
  `renderer-composite-box.ts` needed NO changes (C3's own `DotLayoutResult
  .clusters` seam already consumes graphviz's real bbox automatically).
  Verified EXACT width match (not inference) on all 5 of C5's own named
  margin samples via direct execution — `gojuja-90-pune699` 87==87,
  `cakaxu-97-nexe753` 159==159, `fevida-60-kope208` 88==88, `decede-10-
  buvu414` ~exact (overall height delta 1px, down from a pre-fix double-
  digit gap), `bujuta-44-rovo666` correctly excluded (entrypoint family).
  DOT gate confirmed UNMOVED (the wrapper naming deliberately avoids the
  comparator's `^cluster\d+$` pattern — `tests/oracle/svek-dot.ts`'s own
  pre-existing doc comment already anticipated this exact fix). But **0 new
  zero-diff pins**: discovered a NEW, previously-masked vertical/height
  residual (~1-6px, NOT proportional to margin-level count — `gojuja`/
  `cakaxu` at 6px/4.5px despite `innerMarginLevels=2`, `fevida` at 6px
  despite `innerMarginLevels=1`, `decede` at only ~1px despite the SAME
  `innerMarginLevels=1`) that is now the SOLE new blocker for the whole
  cluster family, layered on top of the two ALREADY-NAMED unrelated gaps
  (`class="entity"` vs jar's `class="cluster"`; `decede`'s own `<style>
  stateDiagram{}</style>` cascade). Entrypoint/exitpoint family and the
  remaining cluster-title queue correctly NOT attempted (the margin fix did
  not fully clear the path). Measured (not re-attempted) `bajelo-54-
  dixe684`/`rovese-43-tadu368` per the task's own explicit instruction:
  BOTH deltas byte-identical to their pre-fix pinned values (0.944445 /
  0.6388889999999998) — a FOURTH independent confirmation these two
  fixtures are unrelated to every mechanism this mission has derived so
  far (font-size, HTML injection, edge-label-ink fold, cluster margin). See
  `ledger.md` §C7 for the full derivation, the jar-source proof, the
  corpus-wide 84/84 zero-mismatch validation, the width-exact verification
  table, and the precisely-scoped C8+ queue.

- **C8** (maintainer sign-off 2026-07-21, "the sixth attempt at the
  edge-label-ink complex with the margin fix in place"): re-landed C6's
  proven stack VERBATIM (font-size fix at sites 2/3, `TransitionGeo
  .labelInk` box-fold into `layout-ink-extent.ts#addTransitionInk`, C4's
  HTML-FIXEDSIZE edge-label injection via `GvEdge.setHtmlAttr`, the
  `Math.max(geometry.*, result.*)` floor REMOVED from
  `state-composite-autonom.ts#buildPlainAutonomSpec`) — confirmed
  byte-identical re-derivation (same 262/268 pass count, same six
  failing fixtures, same per-fixture deltas as C6's own table). Then
  root-caused EACH of the six residual fixtures INDIVIDUALLY (per the
  task's own "no formula variants — per-fixture root-causing only"
  boundary), via direct render-output comparison against the real oracle
  SVG (`data-qualified-name`-matched box extraction, mirroring C7's own
  technique) plus source-level classifier probes — not assumed, not
  guessed:
  - **bajelo-54-dixe684**: COMPOUND. `Track_FSM.Run` (a `'cluster'`-
    classified composite) is excluded from `titleTableEligible` by the
    pre-existing `ctx.insideAutonomPass !== true` gate (`Run` resolves
    INSIDE `Track_FSM`'s own autonom child pass, since `Track_FSM` is
    itself autonom) — AND, independently, `Run` carries action-zone text
    (`entry`/`exit` lines) that `CLUSTER_TITLE_TABLE_HEIGHT`'s hardcoded
    single-line-title-only calibration (`= 3`) was never derived for
    (jar's own real title-table `HEIGHT` for `Run` is 42, not a constant
    3). Either gap alone would keep `Run` off the real-cluster-geometry
    path, cascading a large size gap into `Track_FSM`'s own outer bbox.
  - **rovese-43-tadu368**: SINGLE mechanism. `SharedMemory.Virtual_Config`
    and `SharedMemory.Data_Space` (both single-line titles, no own action
    text) are excluded SOLELY by the SAME `ctx.insideAutonomPass` gate
    (both resolve inside `SharedMemory`'s own autonom child pass) — a
    clean, isolated instance of the mechanism C3's own doc comment already
    named (and had jar-verified NECESSARY, under pre-C6 conditions, citing
    this SAME fixture).
  - **fotuje-06-fifa085**: SAME `ctx.insideAutonomPass` mechanism as
    rovese, larger blast radius — `XA5`/`XA7`/`XA9`/`XA10`/`XA16` (5
    nested clusters, all single-line titles) all resolve inside `XA4`'s
    own autonom child pass, all excluded identically.
  - **pesita-10-dene726**: the entrypoint/exitpoint family's ALREADY-
    NAMED, ALREADY-DEFERRED gap (C3/C5/C7's own repeated queue item) —
    `AA` carries a DIRECT border-point child (`aa_ok_ex <<exitpoint>>`),
    permanently excluded from `titleTableEligible` via
    `hasBorderPointChildren` (unrelated to `insideAutonomPass`). Verified
    the mechanism is severe, not cosmetic: `AA`'s own fallback-formula
    bbox collapses to a near-zero 36×36px box (its only child is the
    excluded border point, so the pre-mechanism-16 flat-bbox formula has
    nothing measurable left to size around), cascading into
    `nasreq_auth`'s own outer real-cluster bbox. A source-level classifier
    probe (`classifyDiagram`/`hasBorderPointDescendant`) DISPROVED this
    iteration's own first hypothesis (a top-level autarky-classification
    mismatch) before landing on this mechanism — `nasreq_auth` IS
    correctly classified `'cluster'` by this port, matching jar; the
    `class="entity"` attribute on its own rendered `<g>` is a SEPARATE,
    already-named, cosmetic-only renderer-convention gap (this port never
    emits `class="cluster"` for ANY state composite, regardless of real
    classification), not a sizing defect.
  - **nimana-36-veco708** and **beguxu-19-tize774**: BOTH manifestations
    of G4 S13's own already-named, three-times-attempted "gap 1" (label-
    PLACEMENT divergence — `attachTransitionLabel`'s perpendicular-
    offset-from-spline-midpoint formula was never reconciled against
    jar's real `SvekEdge.java` placement algorithm; S13 tried three
    formula variants, all failed differently, and this mission's own
    "no formula variants" boundary correctly excludes a fourth attempt
    here). Direct box measurement: `nimana`'s `"yes"` composite is 10px
    SHORT in height (matches `maxSizeDeltaIn=0.138889in` exactly);
    `beguxu`'s `"a"`/`"b"` composites are 2px short each (matches
    `maxSizeDeltaIn=0.027778in` exactly) — NEITHER fixture touches a
    `'cluster'`-classified composite at all (both are pure `'autonom'`
    cases), confirming this is a genuinely different mechanism from the
    other four fixtures above.

  **None of the three underlying mechanisms (the `insideAutonomPass`
  gate, the entrypoint/exitpoint family's unimplemented WithLabel
  formula, S13's label-placement gap) are fixable within this iteration's
  authorized scope** — each requires either relaxing a gate previously
  verified necessary (needing its own full regression sweep under the NEW
  ink-fold+floor-removal substrate), porting jar's real `SvekEdge.java`
  placement algorithm (S13's own "substantial, SvekEdge.java-scale
  undertaking"), or building the WithLabel port-block sizing formula from
  scratch (C3's own unresolved item) — all explicitly named as requiring
  their OWN separately-scoped, sign-off-gated iterations. Since landing
  the stack as final state would require WIDENING all six fixtures'
  `size-backlog.json` ceilings (each currently FAILS its pinned
  allowance) — explicitly forbidden by the mission's own "tighten every
  improved entry; widen NONE" bar — **REVERTED IN FULL**, mirroring
  C4/C6's identical protocol (`git show HEAD:<path> > <path>` for all 9
  touched files, disposable probes deleted, `git status --short`/`git
  diff --stat` verified EMPTY before re-running gates). All protected
  sets re-verified byte-identical to the C7 baseline after the revert.
  See `ledger.md` §C8 for the full derivation, the per-fixture evidence
  (render-output box comparisons + source probes), and the C9+ queue.

## Next iteration (C9) — recommended scope

0. **PRIORITY, newly characterized this iteration**: the cluster VERTICAL/
   height-margin residual (~1-6px, NOT proportional to
   `innerMarginLevels`'s own level count — a DIFFERENT variable than the
   side-margin mechanism C7 just closed). Confirmed on 4/4 samples checked.
   Plausible mechanism (unverified): graphviz's cluster RANK-separation
   formula (`~/git/graphviz/lib/dotgen/position.c:780`, `d1 = rank[r+1].ht2
   + rank[r].ht1 + CL_OFFSET`, "cluster sep") rather than the flat
   per-level margin C7's own fix already correctly applies horizontally.
   See `ledger.md` §C7's own "NEW residual" section for the full evidence
   table.
1. **After (0) closes**: re-verify `gojuja-90-pune699`/`decede-10-buvu414`/
   `cakaxu-97-nexe753`/`fevida-60-kope208` reach true zero-diff — modulo two
   ALREADY-NAMED, unrelated gaps: `class="entity"` vs jar's
   `class="cluster"` (a renderer-wide convention gap, not mechanism 16) and
   `decede`'s own `<style>stateDiagram{}</style>` cascade (C5's item 4).
2. **Entrypoint/exitpoint family** (20 fixtures): reachable once (0)/(1)
   close AND the family's own `portRanksLabelOnEe`/WithLabel-branch
   WIDTH/rank-chain shape is derived (C3's own unresolved item, unchanged).
3. **Multi-line/action-text/stereotype cluster titles**: unchanged from
   C5's own queue (`gap=47` starting data point), orthogonal to the margin
   mechanism (gated by `titleTableEligible`'s `lineCount === 1` check, not
   by anything C7 touched).
4. **NEW finding this iteration**: some fixtures carry MULTIPLE top-level
   `'cluster'`-classified composites (`zaloga-87-lonu477`,
   `zumuje-46-gufe080` — `comp1`+`comp2`), correcting C5's own "this port's
   corpus never has two" assumption — flagged for whoever picks up (0)/(1),
   not investigated further this iteration.
5. **Nested-cluster (inside another cluster) margin composition**: C7's
   own explicit scoping gap (`DotInputCluster.innerMarginLevels`'s doc
   comment) — a nested child cluster attaches to the OUTER (unwrapped)
   level of its parent, not the wrapped level, unverified against a real
   corpus fixture requiring it (the 2 nested-but-width-exact spot checks
   found this iteration are encouraging but not a proof).
6. **CLOSED this iteration: the cluster SIDE-margin gap.** C7 derived and
   verified the exact jar mechanism (2-3 levels of protection-wrapper
   nesting, each graphviz's own default `CL_OFFSET`), landed it, and
   confirmed WIDTH-exact on all 5 of C5's own named samples. Do NOT
   re-derive; `DotInputCluster.innerMarginLevels`/`unwrappedNodeId` is the
   correct, jar-verified final mechanism for `titleTableEligible` clusters.
7. **Sites 2/3, edge-label-ink mechanism — C8 CLOSED the open question**
   from C6's own queue: the six residual fixtures do NOT share one
   mechanism. C8's per-fixture diagnosis found THREE independent, already-
   named, already-deferred mechanisms: (a) the `ctx.insideAutonomPass`
   gate in `state-composite-cluster.ts#resolveClusterComposite`'s
   `titleTableEligible` test — bajelo/rovese/fotuje (3 of 6) — a nested
   `'cluster'` composite resolved inside an ancestor's own autonom child
   pass never reaches the real-cluster-geometry path at all; (b) the
   entrypoint/exitpoint family's unimplemented WithLabel port-block sizing
   formula (C3's own unresolved item) — pesita (1 of 6), severe enough to
   collapse a member composite's own bbox to near-zero; (c) G4 S13's own
   label-PLACEMENT divergence ("gap 1", 3 prior formula attempts, all
   failed differently) — nimana/beguxu (2 of 6), a genuine but SMALL
   (2-10px) height shortfall in a pure-autonom (non-cluster) composite. A
   seventh attempt at ANY of these needs its own separately-scoped
   investigation and sign-off — (a) needs a full regression sweep of
   relaxing `insideAutonomPass` under the NOW-landed ink-fold+floor-
   removal substrate (untested combination); (b) needs the WithLabel
   formula built from scratch; (c) needs jar's real `SvekEdge.java`
   placement algorithm ported, not another geometric-box approximation.
   See `ledger.md` §C8 for the full per-fixture evidence.
8. **Unchanged from C0-C6**: `gutute-00-gaki684` (component port-label
   divergence) finding remains unresolved, low priority; `class="entity"`
   vs jar's `class="cluster"` convention gap, logged for a future
   iteration — C8 confirmed (via a direct classifier probe) this gap is
   PURELY cosmetic/renderer-convention, not a sizing defect: this port
   never emits `class="cluster"` for ANY state composite regardless of its
   real `'cluster'`/`'autonom'` classification, but the classification
   ITSELF (which DOES drive sizing) was independently verified correct on
   `nasreq_auth` (pesita's own top-level composite, `kind='cluster'`,
   matching jar exactly).
