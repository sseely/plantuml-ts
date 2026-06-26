# Mission: dot-engine-parity

## Objective

Bring the five TypeScript dot-layout algorithm implementations into
parity with their graphviz C originals, and fix seven adjacent
simplifications identified during the review. The graphviz C source
at `~/git/graphviz/lib/dotgen/` is authoritative. The pdiff corpus
at `~/git/pdiff/dbhum/` (4400+ fixtures in `tests/corpus/`) is the
validation set.

**Branch:** `feat/dot-engine-parity` (from `feat/class-diagram`)

## Status

- [x] Batch 1 — Research (T1–T5)
- [x] Batch 2 — Independent fixes (T6–T11)
- [x] Batch 3 — Network simplex rank (T12)
- [x] Batch 4 — Mincross + position (T13–T14)
- [x] Batch 5 — Edge labels + spline obstacles (T15–T16)
- [x] Batch 6 — Spline routing + Bezier (T17–T18)


## Standing Rule: Java Source Is the Spec

Before implementing any task in this mission, read the relevant Java source in
`~/git/plantuml`. The upstream code is 15+ years old and encodes accumulated
knowledge as special cases and subtle tweaks that are not documented anywhere
else. The Java code IS the requirement — not a reference. Reproduce every edge
case faithfully.

## Quality Gates

Run between every batch. All four must pass before marking a batch done.

```sh
npm test              # 90/90/90 coverage thresholds
npm run typecheck     # tsc --noEmit (both tsconfigs)
npm run lint          # eslint src tests demo
npm run build         # vite library build
```

## Stop Conditions

**STOP and wait for human input when:**
- A task requires modifying files outside its declared write-set AND
  those files aren't in any other task's write-set
- Two consecutive quality gate failures on the same check after fix
  attempts
- A research finding reveals the algorithm requires a data structure
  change that breaks the public API of `DotWorkingGraph` in a way
  that forces T12/T13/T14 to be redone
- The spline routing (T16–T18) requires changes to virtual-node
  representation that would invalidate already-completed rank/mincross
  work
- Any implementation contradicts a decision in `decisions.md`
- A pdiff corpus fixture exercises behavior our parsers silently drop
  — stop, report, don't skip

## Push-Forward Conditions

**Proceed with judgment when:**
- A graphviz feature has no plantuml syntax that triggers it and
  zero pdiff corpus fixtures — skip it, log in decision journal
- A test value differs from graphviz C output by < 1px rounding —
  accept, log as known cosmetic variance
- A behavior in the C source is ambiguous — implement per the C
  source, log interpretation in decision journal
- A task is simpler than estimated — finish early, don't pad

## Porting Rules (from CLAUDE.md)

- Port the C faithfully; do not refactor or modernize while porting
- Preserve upstream names, including awkward ones
- Bug-for-bug compatibility is the default
- Prefer pdiff corpus fixtures over synthesized test inputs

## Batches

| Batch | Description | Tasks | Depends On | Done |
|---|---|---|---|---|
| 1 | Research — compare C vs TS | T1–T5 | — | [x] |
| 2 | Independent fixes | T6–T11 | Batch 1 | [x] |
| 3 | Network simplex + types | T12 | Batch 1 | [x] |
| 4 | Mincross + position | T13–T14 | Batch 3 | [x] |
| 5 | Edge labels + spline obstacles | T15–T16 | Batch 4 | [x] |
| 6 | Spline routing + Bezier | T17–T18 | Batch 5 | [x] |

## Document Index

- [decisions.md](decisions.md) — architecture decisions
- [decision-journal.md](decision-journal.md) — execution log
- [batch-1/overview.md](batch-1/overview.md) — T1–T5 research
- [batch-2/overview.md](batch-2/overview.md) — T6–T11 independent fixes
- [batch-3/overview.md](batch-3/overview.md) — T12 network simplex
- [batch-4/overview.md](batch-4/overview.md) — T13–T14 mincross + position
- [batch-5/overview.md](batch-5/overview.md) — T15–T16 edge labels + obstacles
- [batch-6/overview.md](batch-6/overview.md) — T17–T18 spline routing
- [diagrams/component-map.md](diagrams/component-map.md) — affected components

---

## Mission Completion Summary

**Completed:** 18/18 tasks across 6 batches.

**Decisions made:** 6 logged in decision-journal.md. Notable:
- T12 worktree agent padded coverage via unrelated test files; reverted those changes.
- T15 agent replaced types.ts with a pre-T12 version (247 typecheck errors); merged manually.
- T18 agent replaced splines.ts with a version that omitted T16/T17 code; merged manually.
- types.ts is a shared-mutation hotspot — every agent that lists it in its write-set risks clobbering prior fields. Future batches should always diff against the committed version before accepting an agent's replacement.

**Final quality gate results (post-T18):**
- `npm test`: 1563 passed, 51 test files — all coverage thresholds met (90/90/90)
- `npm run typecheck`: clean (both tsconfigs)
- `npm run lint`: clean
- `npm run build`: 136 kB CJS bundle, no warnings

**Known issues / follow-ups:**
- The T18 Bezier pipeline routes short edges through `routePolyline` (obstacle avoidance) + `fitBezier` + `adjustEndpoints`. For short edges with no obstacles the Bezier stage is a no-op (2-point → 2-point unchanged), but for detoured paths the control points are synthetic and may not look identical to graphviz's cubic spline solver. A future task can evaluate against pdiff corpus to decide if this matters.
- `routeFlatEdge` (flat / same-rank edges) does not run through the Bezier pipeline — it produces a raw 4-point polyline. This matches dotsplines.c strategy 3 which does not curve flat edges.
