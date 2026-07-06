# Architecture Decisions — Class DOT Parity (re-plan, 2026-07-06)

Grounded in `evidence.md`. These SUPERSEDE `planning/mission-a2-class/decisions.md`.

## Falsified premises (do not revive)
- **ADR-1/ADR-2 (old): "classes are plaintext HTML-compartment nodes."** FALSE.
  Oracle draws ordinary classes as `shape=rect,label=""`; compartments are
  painted in a later SVG pass, never via Graphviz. `shape=plaintext` occurs in
  only 43/544 files, exclusively for qualifier-shield / `Class::member`-port /
  lollipop-interface triggers. (`EntityImageClass.getShapeType`,
  `SvekNode.appendShape/isShielded`.)
- **ADR-3 (old): "newpage → 158 graph-count mismatches."** FALSE. Zero multi-page
  class fixtures exist. The mismatch bucket is heterogeneous and largely
  oracle-side/unfixable (see evidence.md).

## Verified foundation (already landed on `feat/a2-class-dot-sync`)
- **ADR-6: graph-attr parity.** `nodeSep=35, rankSep=60` — matches oracle. DONE
  (1%→20%). Do not touch.
- Parser gaps fixed (`Class::member` ports, `note as`, `[Qualifier]` parse),
  association-class misroute fixed, `parser.ts` split under the 500-line cap.
  DONE (batch 3). Banked per-check gains but few EQUAL flips (10-way AND).

## New decisions (the re-planned levers, ranked by distance-to-EQUAL)

### ADR-A1 — Prioritize by single-check-fail count, not by total-fail count
Target the checks that are the SOLE failure for the most fixtures (evidence.md):
clusterOk (34), labelOk (21), shapeOk (19), minlenOk (15). Each fix flips whole
fixtures to EQUAL. Ignore total-fail counts (e.g. minlen 262) — those are mostly
multi-fail fixtures that won't flip from one lever.

### ADR-A2 — Clustering first (biggest single-fail lever: 34)
Port package/namespace → DOT cluster emission so `clusterOk` (cluster-size
multiset = per-logical-cluster member-node count) matches. Mirror upstream
`GroupPngMakerImage` / `CucaDiagramFileMakerSvek`. See ADR-A5 for the complexity
prerequisite (B0). **Recon findings (verified 2026-07-06 — bake into B1):**
- `parseClusters` (`svek-dot.ts:109-123`) counts ONLY subgraphs named exactly
  `^cluster\d+$`, and COLLAPSES oracle's protection wrappers
  (`clusterNp0/p1/a/i`) into the one logical `clusterN`. So we need NOT replicate
  oracle's 5-level nesting — just the logical cluster with the right member count.
- **Naming blocker:** our emitter writes `subgraph cluster_${id}` (`graph-layout.ts`
  `addClusters`), and the description engine uses ids `c0,c1` → `cluster_c0`, which
  does NOT match `^cluster\d+$`. **Our clusters are currently invisible to the
  comparator.** B1 must emit `cluster<digits>` names (no underscore, numeric id)
  OR adjust so parseClusters recognizes them. This touches SHARED emitter naming
  (`graph-layout.ts`/`svek-dot-emit.ts`, used by component/usecase) → **full
  regression + confirm component 90%/usecase 68% don't drop.**
- Oracle puts `zaent####  [shape=point,width=.01]` anchor nodes inside clusters;
  `parseClusters` counts them as members, and `parseSvekDot` may count them as
  nodes/shapes too → clustering interacts with nodeCount/shapeOk. Verify against a
  clusterOk-single-fail fixture (e.g. `bajotu-30-soku184`): match its cluster-size
  multiset WITHOUT breaking its (currently-passing) nodeCount/shape.
- Write-set widens: class `layout.ts` (populate `DotInputGraph.clusters` from
  `ast.namespaces`) + shared `graph-layout.ts`/`svek-dot-emit.ts` (naming/anchors).
  STOP if the shared naming change regresses another type.

### ADR-A3 — Edge label counts (21)
`labelOk` compares label COUNTS on edges (`labelCounts`, svek-dot.ts). Emit the
edge labels/xlabels/taillabel/headlabel that oracle emits (association labels,
multiplicities `"1" -- "0..*"` → taillabel/headlabel). Match count, not string.
Mirror `Link.java` / `SvekLine` label emission.

### ADR-A4 — Narrow plaintext shapes (19) + minlen-per-type (15)
- shapeOk: emit `shape=plaintext` ONLY for the three real triggers
  (qualifier-shield, `Class::member` port target, lollipop circle) using a
  generic shield/port table (NOT T3's compartment table). The parser already
  records `fromPort/toPort/qualifier` (batch 3). Mirror `SvekNode` shield/port.
- minlenOk: emit per-relationship-type `minlen` matching upstream `Link.getLength`
  (extension/implementation/composition default lengths differ). Small, additive.

### ADR-A5 — PREREQUISITE: decompose `layoutClass` before editing layout.ts
`layoutClass` is CCN 16, `measureClassifier` CCN 14 (>10) — the complexity hook
BLOCKS every edit to `layout.ts`. Any lever that touches layout (clustering,
shapes) requires a behavior-preserving decomposition of these functions FIRST
(extract helpers, guarded by the existing class tests — same pattern as the
successful `parser.ts` split T5c). This is a real, un-brief'd cost; budget for it.

### ADR-A6 — Ceiling is ~33–40%, not 90%; ledger the rest
Do NOT chase 90% (unreachable — evidence.md). Target the ~89 single-fail
fixtures. After the four levers, re-measure and ledger the multi-fail residual
(the 250 fixtures failing 3–7 checks) and the oracle-side unfixable bucket.

## Rollback
All reversible (one commit per lever). Goldens additive. The `feat/a2-class-dot-sync`
branch is green and mergeable at any point.
