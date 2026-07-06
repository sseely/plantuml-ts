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

### L1 — Clustering (clusterOk): 34 single-fail | 106 total
**Real fix (verified against all 34):** `parser.ts` has a `namespace` rule but
**no `package X { }` rule** → `ast.namespaces=[]` for the targets. Upstream also
derives NESTED namespaces from dotted ids (`a.b.c` → nested clusters), which the
flat `Namespace` AST (no `parentId`) cannot represent.
- Work: add `package` rule to `parser.ts`; split dotted ids into implicit nested
  namespaces; add `parentId` to `Namespace` (`ast.ts`); extend `buildDotClusters`
  (layout.ts, DONE for flat) to nest via `parentId`; match member-count multiset.
- **Prereq:** `parseClass` is CCN 12 → `parser.ts` is hook-blocked. Decompose it
  first (B0-style, coverage-guarded).
- Groundwork done: layout cluster population (3cd5cf6). Watch: adding clusters
  must NOT change nodeCount/shapeOk on the single-fail fixtures.

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
