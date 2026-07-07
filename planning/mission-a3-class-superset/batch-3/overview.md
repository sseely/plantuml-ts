# Batch 3 — Containers (package / rectangle / database / component / stack / node)

**Prereq:** Batch 2 landed.

## Goal
Accept the container/box descriptive keywords. Two sub-cases per the Batch-0 table:
- **Group containers** (`package`, `rectangle` with a `{ }` body) → clusters
  (reuse the existing `buildDotClusters` + `Namespace` machinery from L1/B1).
- **Box leaves** (`database`, `component`, `stack`, `node` as plain declarations)
  → rect (or rect-with-icon per the shape table; structural DOT compares shape
  multiset, so an icon variant still counts as its base shape — confirm in Batch 0).

## Targets
rakuci-96, xenere-07 (package + rectangle), givofi-11, popesa-39 (database),
lojiga-09 (component + stack; the `point=1` is a group anchor — reuse the
zaent/package-anchor mechanism from the association-class + B1 work).

## Tasks

| id | task | gate |
|----|------|------|
| T3.1 | Accept `package`/`rectangle` `"name" { ... }` as class-engine groups → clusters. Reuse `class-namespace.ts` cluster emission; do not fork a new clustering path. | full dual-corpus gate |
| T3.2 | Accept `database`/`component`/`stack`/`node` leaf declarations → rect per the shape table. | gate |
| T3.3 | Handle the group anchor (`point=1` in lojiga/sijisi) via the existing package-endpoint-anchor mechanism (`class-layout-helpers.ts`). | gate |
| T3.4 | Re-measure; land Tier-3. Record deltas. | dual-corpus diff = 0 REGRESSED |

## Exit criterion
Container keywords produce the oracle cluster/node/point structure; Tier-3
fixtures match; zero description regression.
