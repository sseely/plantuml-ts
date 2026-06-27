# Mission: Consolidate `component` + `usecase` → one descriptive engine

## Objective

Upstream PlantUML renders component, use-case, and deployment diagrams through
**one** engine — `DescriptionDiagramFactory` (`UmlDiagramType.DESCRIPTION`),
keyed by `CommandCreateElementFull.ALL_TYPES`, with each element carrying a
`USymbol` shape and a single renderer that switches on shape. plantuml-ts
diverged by splitting this into two plugins (`src/diagrams/component/` ~1280 LOC,
`src/diagrams/usecase/` ~1643 LOC) with incomplete, overlapping `accepts()`
keyword coverage. The split lets `class.accepts` (`/^interface\s/i`) and
`sequence.accepts` (`actor`) steal descriptive diagrams — the `cocice` fixture
(one of every element keyword, incl. `interface interface`) collapses into the
class renderer.

This mission re-mirrors upstream's single engine. Per `.claude/CLAUDE.md`
("Upstream architecture is authoritative — and rewrites are allowed"), the
diverged split is the bug; the fix is structural, not another `accepts()` patch.

## Branch

`feat/consolidate-description-engine` (off `main`). Merge strategy: **merge
commit** (mission brief — preserve per-task commit IDs referenced in the
decision journal).

## Phasing

- **Phase 1 (Batches 1–2)** — Dispatch faithfulness. Independently shippable;
  closes the `cocice` misclassification with a shared keyword guard. Can merge
  as its own PR before Phase 2 begins.
- **Phase 2 (Batches 3–7)** — Engine merge. Build deep: ast → parser → layout →
  renderer → plugin, each gated.
- **Phase 3 (Batch 8)** — Cutover: register `descriptionPlugin`, delete the two
  old plugins, migrate tests, update catalog + `DiagramType` union.

## Quality gates (run after every batch)

| Command | Pass |
|---------|------|
| `npm run typecheck` (`tsc --noEmit`, both tsconfigs) | exit 0 |
| `npm run lint` (eslint src tests demo) | exit 0 |
| `npm test` (vitest --coverage, 90/90/90) | exit 0 |
| `npm run build` (vite library build) | exit 0 |
| `git diff --name-only` vs batch write-set | only declared files |

Phase-specific extra gate (Batches 7–8): re-run the oracle DOT-gate on the
component+usecase corpus buckets (`npx tsx scripts/oracle-gap.ts`) — node/edge/
cluster counts must hold vs the pre-merge baseline.

## Constraints

**STOP and wait for human input when:**
- A task needs to modify a file outside its declared write-set (and not in
  another task's write-set).
- Two consecutive quality-gate failures on the same check, or the same code
  location changed ≥3 times for the same failure.
- The implementation would contradict an architecture decision in
  `decisions.md`, or would diverge from upstream behavior in a way not already
  approved (D2's rect-fallback is the only approved visual divergence).
- The oracle DOT-gate regresses node/edge/cluster counts and the cause is not an
  intended, documented change.

**PUSH FORWARD with judgment when:**
- The choice is stylistic and doesn't affect rendered output or classification.
- A task is simpler than scoped (log a decision-journal entry).
- A merged-parser edge case maps cleanly to an upstream `CommandCreateElementFull`
  branch — port it faithfully without asking.

## Batches

| # | Phase | Tasks | Status |
|---|-------|-------|--------|
| [batch-1](batch-1/overview.md) | 1 | T1 shared keyword table | [x] |
| [batch-2](batch-2/overview.md) | 1 | T2 class+sequence accepts guard | [x] |
| [batch-3](batch-3/overview.md) | 2 | T3 description AST | [x] |
| [batch-4](batch-4/overview.md) | 2 | T4 merged parser | [x] |
| [batch-5](batch-5/overview.md) | 2 | T5 symbol-aware layout | [x] |
| [batch-6](batch-6/overview.md) | 2 | T6 symbol-dispatched renderer | [x] |
| [batch-7](batch-7/overview.md) | 2 | T7 plugin + integration | [x] |
| [batch-8](batch-8/overview.md) | 3 | T8 cutover (register/delete/migrate) | [x] |

## Index

- [decisions.md](decisions.md) — architecture decisions D1–D5 (approved)
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — affected components
- [diagrams/data-flow.md](diagrams/data-flow.md) — dispatch + render flow

## Reference (read-only)

- Upstream: `~/git/plantuml/src/main/java/net/sourceforge/plantuml/descdiagram/`
  — `DescriptionDiagramFactory.java`, `command/CommandCreateElementFull.java`
  (`ALL_TYPES`), and `PSystemBuilder.java` factory order
  (`sequence < class < activity < description < state`, trial-parse first-clean-wins).
- Merge source: existing `src/diagrams/component/`, `src/diagrams/usecase/`.
- Seam: `src/core/graph-layout.ts`.

---

## Mission summary (2026-06-26)

**Status: COMPLETE.** All 8 tasks done; all quality gates green
(`typecheck` / `lint` / `test` 3070 passing at 90/90/90 / `build`).

- **Phase 1 (B1–B2):** shared keyword table + class/sequence descriptive
  guard — closed the `cocice` misclassification.
- **Phase 2 (B3–B7):** built the engine deep — AST → merged parser → layout
  → renderer → plugin. Mid-mission the layout was **rebuilt** to the faithful
  upstream model after the maintainer confirmed upstream routes edges as
  graphviz bezier splines (not center-to-center): single-pass cluster-aware
  layout over a new seam capability (`layoutGraph` now forwards `clusters` to
  graphviz-ts), with container-endpoint edges clipped to the cluster rectangle
  (`SvekEdge.simulateCompound`).
- **Phase 3 (B8):** atomic cutover — registered `descriptionPlugin`, deleted
  the two old plugins + suites, updated `DiagramType` + catalog.

**Decisions of note:** see decision-journal.md. Highlights — npm switch
(infra); single-pass spline rebuild (supersedes a center-to-center draft);
seam `clusters` forwarding (additive, zero blast radius); accepts excludes
bare `actor`/`interface` (route to sequence/class).

**Oracle gate:** holds + improves vs pre-merge baseline (matches 9→11,
no-candidate 20→11, graph-count 7→7 — no node/edge/cluster regression).

**Known follow-ups (out of scope, logged):**
- Auto-create link-only endpoints (`(A) ..> (B)`) — pre-existing gap in both
  old parsers; `.agent-notes/description-autocreate-link-endpoints.md`.
- `applyStyleMap` monolith — relocated verbatim to `style-map-theme.ts`,
  needs splitting; `.agent-notes/applystylemap-monolith.md`.
- Visual-QA pass through the new engine (the brief's visual-reference gate)
  is the natural next validation against plantuml.com.
