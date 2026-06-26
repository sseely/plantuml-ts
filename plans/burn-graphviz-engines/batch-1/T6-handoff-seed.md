# T6 — Write the adapter-mission hand-off seed

## Context
The burn produced the adapter mission's work-list as a side effect. Capture it so
a later human-run `/plan-mission` is grounded in real findings, not predictions.

## Task
Write `plans/burn-graphviz-engines/handoff-adapter.md` containing:

1. **Throw-sites (the work-list).** The single `layoutGraph()` call in
   `src/core/graph-layout.ts` is the one place to wire. List each of the 6 diagram
   layouts that call it (these light back up once wired).
2. **Skipped tests to restore.** The exact list T4 recorded (file + `describe`
   name), grouped by diagram type.
3. **Renderer-shape migration.** The 6 renderers currently read `DotLayoutResult`
   (`{ nodes:[{id,x,y,width,height,xlabelX?}], edges:[{id,points,...}], width,
   height }`). The adapter switches the chokepoint output to graphviz-ts
   `LayoutSnapshot` (`{ bounds, nodes:NodeGeometry[], edges:EdgeGeometry[] }`,
   `name` not `id`, points/y-down). Each renderer must migrate field reads.
4. **Type-adoption plan.** Output: re-export `LayoutSnapshot`, `NodeGeometry`,
   `EdgeGeometry`, `BoundsGeometry` from `graphviz-ts/api`. Input: keep
   `DotInputGraph`; the adapter serializes it to DOT for `graphviz-ts`.
5. **Oracle gate.** The adapter is verified by `oracle/` (DOT parity first via
   the staged fail-fast gate, then tolerant SVG). Point at `oracle/README.md`.
6. **Open question for the adapter mission:** engine selection — `auto-layout`'s
   BFS-depth heuristic was dropped (D2); decide whether to reconstruct it or pass
   an explicit `engine` from each diagram.

Keep it under 120 lines — it is a seed, not a brief.

## Write-set
- `plans/burn-graphviz-engines/handoff-adapter.md` (create)

## Read-set
- T4's recorded skip list; `src/core/graph-layout.ts`; `oracle/README.md`;
  `decisions.md#d4`

## Acceptance criteria
- Given the file, when read, then it lists the chokepoint throw-site, the skipped
  tests, the renderer-shape delta, and the type-adoption plan.
- Given the file, when handed to `/plan-mission`, then it is sufficient to scope
  the adapter mission without re-investigating the burn.

## Observability
N/A.

## Rollback
Reversible — delete the file.

## Quality bar
File exists and is self-contained. Commit: `docs(layout): seed graphviz-ts
adapter mission`.
