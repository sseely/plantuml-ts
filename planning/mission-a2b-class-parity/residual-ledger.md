# Residual Ledger — Class DOT Parity (paused 2026-07-06 at 20%)

Mission paused after banking a verified **20% EQUAL (137/680, up from 1%)** and
merging to `main`. This ledger lets a future session resume precisely. Every
entry is grounded in instrumented evidence (`evidence.md`) + the execution
findings (`decision-journal.md`). The recurring lesson: **each lever is a
parser/AST feature a layer deeper than the distance-to-EQUAL histogram implies,
usually gated behind a per-function CCN "unblock" refactor. Verify against
`~/git/plantuml` + the oracle cache before coding — the briefs assumed and were
wrong repeatedly.**

## What is DONE and merged
- **nodesep=35** (ADR-6): the 1%→20% lever. Load-bearing, do not touch.
- **Parser gaps** (`Class::member` ports, `note as`, `[Qualifier]` parse),
  **association-class misroute** fix, **parser.ts split** under 500 lines.
- **B0**: `layoutClass`/`measureClassifier` decomposed under CCN 10 → `layout.ts`
  is editable. New `class-layout-helpers.ts` holds measurement helpers.
- **B1 groundwork** (`3cd5cf6`): class `layout.ts buildDotClusters` populates
  `DotInputGraph.clusters` from `ast.namespaces`; svek-dot-emit emits recognized
  `subgraph cluster<N>`. Correct but inert until the parser produces namespaces.

## Remaining levers (ranked by single-check-fail count; true cost noted)

### L1 — Clustering (clusterOk): mostly DONE — EQUAL 20%→24%, clusterOk 106→61
Worked in session 2026-07-06 (branch `refactor/l1-parseclass-decompose`, 6
commits `a5db217`..`6e4b823`). The ledger's "34 single-fail" was really FIVE
interlocking sub-features, not one; landed as gated increments:
- **DONE** parseClass/ensureClassifier decompose (unblocked CCN/NLOC/500-line
  hooks — three gates, not just parseClass CCN 12 as recorded). `a5db217`
- **DONE** `package` rule (159 fixtures, no rule existed). 20%→22%. `57b45de`
- **DONE** empty-package skip in buildDotClusters — oracle drops member-less
  subgraphs (mujopi-30-zadi566). clusters-over 5→0. `830c756`
- **DONE** color/stereotype decoration on pkg/ns lines (`#DDDDDD`). `e57c756`
- **DONE** dotted-name nesting: `parentId` on Namespace, split dotted ids
  (namespace decls + class decls + relationship endpoints) via the single
  `ensureClassifier` choke point; `set [namespace]separator` (default `.`,
  `none` disables); `!pragma useIntermediatePackages false`; subtree-aware
  empty filter; a guard rejecting decoration-polluted ids so URL/style dots
  don't spawn spurious clusters. 22%→24%, clusters-over 14→1. `6e4b823`

**REMAINING L1 tail — the hard 4 (bivevo-25, paziji-13, lozijo-52, pukuzu-30):**
relative nesting INSIDE a namespace block (`namespace classic.collections {
java.lang.Object <|-- ArrayList }` → java/lang nested under collections).
- pukuzu = relative nesting only (no name collision) — tractable, +1.
- bivevo/paziji/lozijo need **fully-qualified classifier identity**:
  `classic.collections.ArrayList` ≠ `net.sourceforge.plantuml.ArrayList`, but
  our parser keys classifiers by SHORT id, so two `class ArrayList` collide.
  This is a data-model change (classifier identity → qualified) touching
  relationship resolution + dedup + layout. High blast radius for 3 fixtures.
  **Deferred as its own mission — do NOT bolt onto L1.**
- Also surfaced: `note <pos> of X` BLOCK notes don't set pendingNote, so their
  text leaks to dispatch (jiceke-84 `i.e. DD.MM.YYYY` → spurious clusters).
  Pre-existing note-parser bug, separate from clustering.

### L2 — Edge labels (labelOk): 21 single-fail | 89 total
`labelOk` = label COUNT multiset on edges (`labelCounts`, svek-dot.ts). Emit the
labels/xlabels/taillabel/headlabel oracle emits — association labels and
multiplicities (`"1" -- "0..*"` → taillabel/headlabel). Layout-local
(`layout.ts buildEdgeGeos`/dotEdges — unblocked by B0). Mirror `Link.java`.
Recon not yet done — verify label emission model against oracle before coding.

### L3 — Narrow plaintext (shapeOk): 19 single-fail | 197 total
Emit `shape=plaintext` ONLY for the three real triggers (qualifier-shield,
`Class::member` port target, lollipop circle) as a generic shield/port table
(NOT T3's compartment table). Parser already records `fromPort/toPort/qualifier`
(batch 3). Also folds in association-class node emission (the `(A,B)` couple →
`shape=circle` connector node + edges — parse+emit, from the T5b finding) and
oracle's `zaent [shape=point]` anchors which parseSvekDot counts as shapes.
Touches `layout.ts` + `svek-dot-emit.ts`.

### L4 — minlen per relationship type (minlenOk): 15 single-fail | 262 total
Emit per-type `minlen` matching upstream `Link.getLength` (extension/
implementation/composition defaults differ). Small, additive, layout-local.

### Not a lever — countMismatch (~158–192): mostly UNFIXABLE
Oracle-emits-0-DOT vs we-emit-1. Heterogeneous: genuine graphviz-skips + oracle
capture failures (`!include <tupadr3>`, `!pragma smetana`, `<style>`) + parser
divergence. No clean structural predicate (evidence.md). Largely a
harness-classification concern, not a feature gap. Do NOT spend a lever here.

## Ceiling
Fixing L1–L4 flips up to the 89 single-fail fixtures (+ some of the 42 two-fail)
→ **~33–40% EQUAL**. 90% is unreachable (the other 250 fixtures fail 3–7 checks;
much of countMismatch is oracle-side). Ledger, do not chase.

## Housekeeping / debt
- **Inert change to revert (optional):** `graph-layout.ts` cluster-naming in
  `3cd5cf6` (`cluster_${id}`→`cluster${n}`) does nothing for the metric (parity
  uses `svek-dot-emit.ts`, not `graph-layout.ts`). Harmless, green. Revert for
  tidiness when next touching that file.
- **CCN walls (hook blocks edits until fixed):** `parser.ts parseClass` CCN 12
  (blocks L1). `layout.ts` is clear (B0). Check others before editing.
- `.agent-notes/B1-class-cluster-parser-gap.md` (gitignored) has the B1 agent's
  detailed parser-gap notes.

## Resume recipe
1. Re-read `evidence.md` + this ledger. Re-measure: `npx tsx scripts/dot-sync-report.ts class`.
2. Start with **L1** (decompose parseClass → add package/dotted-namespace → nest
   clusters), since its groundwork is already in. Then L4 (cheap), L2, L3.
3. Verify each premise against oracle before coding. Gate: full suite + ratchet;
   confirm no cross-type regression on any shared-file change.
