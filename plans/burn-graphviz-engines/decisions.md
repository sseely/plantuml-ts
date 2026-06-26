# Architecture decisions — burn-graphviz-engines

## D1 — Single chokepoint replaces 7 scattered consumers
**Context:** 6 diagram layouts + `auto-layout.ts` consume the seam, via two
different entry points (`core/dot.layout()` and `autoLayout()`).
**Decision:** Introduce `src/core/graph-layout.ts` exporting
`layoutGraph(input: DotInputGraph, opts?: { engine?: string }): DotLayoutResult`
as the *only* seam consumer. All 6 graph diagrams import only this.
**Consequences:** The adapter mission becomes a one-file change. Dark-type
behavior is uniform. `core/dot` can die entirely (no stub-in-place needed).

## D2 — Delete `auto-layout.ts`
**Context:** It is the in-house engine-selection dispatcher (imports all engines).
**Decision:** Delete it; the chokepoint subsumes engine choice (later via
`opts.engine` passed to graphviz-ts). Its 2 consumers (`class`, `component`)
repoint to `graph-layout`.
**Consequences:** BFS-depth heuristic is dropped; re-derive in the adapter if
needed (graphviz-ts may select differently). Reversible via git.

## D3 — Named `PendingGraphvizError` for the stub
**Decision:** `layoutGraph()` throws `PendingGraphvizError` (exported from
`graph-layout.ts`), not a generic `Error`. Loud, greppable; each throw-site is a
work item for the adapter mission.

## D4 — Type names + shapes untouched this mission
**Context:** Should the seam adopt graphviz-ts type names now?
**Decision:** No. Relocate `DotInputNode/Edge/Graph` and `DotLayoutResult` to
`src/core/graph-layout.types.ts` **unchanged** (names and shapes). Drop the
engine-internal working types (`DotNode`, `DotEdge`, `DotWorkingGraph`) — they
die with the engines.
**Consequences:** Renderers compile unchanged (they read `DotLayoutResult`).
Adopting graphviz-ts geometry (`LayoutSnapshot`/`NodeGeometry`/`EdgeGeometry`/
`BoundsGeometry`) changes *shapes*, which forces rewriting all 6 renderers — that
is the adapter mission's job, not the burn's. Input stays `DotInputGraph` (the
adapter serializes it to DOT; graphviz-ts builder types are not our input vocab).

## D5 — Dark-type tests: skip; engine tests: delete; parser tests: keep
**Decision:** Classify each test by **what it imports**, not its name:
- imports `src/core/<engine>` internals → **delete** (code is gone).
- exercises a dark type's layout/render or full pipeline → **`describe.skip`**
  with `// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md`.
- imports only a diagram's parser (`src/diagrams/<type>/parser`) → **keep**
  (parsing is unaffected by the burn).
**Consequences:** `npm test` stays green. Skipped tests are the adapter mission's
restore-list (T6 records them). `json` is a keeper renderer but its layout uses
the seam, so its layout/render/integration tests skip; its parser tests keep.

## D6 — Rollback
Reversible. No data, no migration, no external contract. `git revert` the squash
commit restores everything. The whole mission is one branch, one squash commit.
