# Mission Brief: Graphviz dot Layout Engine

## Objective

Port the Graphviz `dot` layout algorithm from Smetana (PlantUML's Java
translation of Graphviz 2.38.0) into a clean TypeScript implementation,
then replace ELK.js as the layout engine for all four graph diagram types
(class, component, state, use case). Result: pixel-comparable output to
PlantUML, synchronous layout, no WASM dependency.

## Branch

Work on: `feat/graphviz-dot-layout`
Base: `main`


## Standing Rule: Java Source Is the Spec

Before implementing any task in this mission, read the relevant Java source in
`~/git/plantuml`. The upstream code is 15+ years old and encodes accumulated
knowledge as special cases and subtle tweaks that are not documented anywhere
else. The Java code IS the requirement — not a reference. Reproduce every edge
case faithfully.

## Quality Gates (run after every batch)

```
npm test          # all tests pass, 90/90/90 coverage
npm run typecheck # zero type errors
npm run lint      # zero lint errors
```

Batch 6 also runs: `npm run build`

## Stop Conditions

STOP and wait for human when:
- Any file outside declared write-set needs changes
- 2 consecutive quality gate failures on the same check
- Implementation contradicts a D1–D8 decision
- Smetana reference behavior conflicts with acceptance criteria
- >3 unexpected files need changes during Batch 5 ELK migration
- `npm run build` fails after package.json changes in T10

Push forward with judgment when:
- Smetana Java idiom translates more cleanly to a different TS pattern (log it)
- A redundant test case can be skipped
- Integration tests need trivial async→sync wrapper updates
- index.ts stub needs minor restructuring in Batch 4

## Batches

| # | Description | Tasks | Depends On | Done |
|---|-------------|-------|-----------|------|
| 1 | Types + Acyclic | T1 | — | [x] |
| 2 | Network simplex ranking | T2 | T1 | [x] |
| 3 | Mincross + Position (parallel) | T3, T4 | T2 | [x] |
| 4 | Splines + wire layout() | T5 | T3, T4 | [x] |
| 5 | Migrate 4 diagram layouts (parallel) | T6–T9 | T5 | [x] |
| 6 | Remove ELK | T10 | T6–T9 | [x] |

## Links

- [decisions.md](decisions.md) — architecture decisions D1–D8
- [decision-journal.md](decision-journal.md) — judgment log (append during execution)
- [diagrams/data-flow.md](diagrams/data-flow.md) — pipeline sequence diagram
- [diagrams/component-map.md](diagrams/component-map.md) — component relationships
- [batch-1/overview.md](batch-1/overview.md) — T1
- [batch-2/overview.md](batch-2/overview.md) — T2
- [batch-3/overview.md](batch-3/overview.md) — T3, T4
- [batch-4/overview.md](batch-4/overview.md) — T5
- [batch-5/overview.md](batch-5/overview.md) — T6–T9
- [batch-6/overview.md](batch-6/overview.md) — T10

## Completion Summary

**Date:** 2026-04-22

**Tasks completed:** 10/10 (T1–T10)

**Decisions made:** 8 architecture decisions (D1–D8), 0 flagged for review

**Quality gate results (final):**
- `npm test`: 1013 tests passing (34 test files)
- `npm run typecheck`: zero errors
- `npm run lint`: zero errors
- `npm run build`: success (103.78 kB JS, 69.07 kB CJS)

**Known issues / follow-ups:**
- LSP diagnostics show stale `await` warnings in some `layout.test.ts`
  files (80007) — these are IDE cache artifacts; `tsc --noEmit` confirms
  zero real errors
- pnpm is the actual package manager (not npm); T10 spec said `npm install`
  but `pnpm install` was required — logged in decision-journal.md

**Bundle size reduction:** elkjs was ~470 kB of the bundle; removed.

## Reference Source

Smetana: `~/git/plantuml/src/smetana/core/dot15/`
- `acyclic__c.java` (146 lines) — cycle removal
- `rank__c.java` (785 lines) — network simplex
- `mincross__c.java` (2,003 lines) — crossing minimization
- `position__c.java` (1,954 lines) — coordinate assignment
- `dotsplines__c.java` (2,391 lines) — spline routing
