# Architecture Decisions — Graphviz dot Port

## D1: Port from Smetana (Java), not from Graphviz C source

**Decision:** Use `~/git/plantuml/src/smetana/` as the primary reference,
not the original Graphviz 2.38.0 C source.

**Rationale:** Smetana is already structured as methods and classes (even
though mechanically generated from C). The C source uses pointer arithmetic,
union types, and macro-heavy patterns that would require more interpretation.
Smetana is the exact code path PlantUML executes — divergences from C are
irrelevant as long as we match Smetana's behavior.

**Constraint:** Do not port `smetana/core/` (the C runtime emulation layer).
Replace its data structure patterns with idiomatic TypeScript.

---

## D2: Synchronous API

**Decision:** The dot engine exposes a synchronous `layout(graph)` function,
not an async one.

**Rationale:** The primary motivation for replacing ELK is to make
`renderSync()` work correctly for graph diagram types. ELK requires async
(it uses Web Workers or WASM). A pure TypeScript algorithm has no async
I/O and runs synchronously. This also simplifies the plugin interface.

**Impact:** `DiagramPlugin.layoutSync()` can call dot layout directly.
The async `render()` path calls the same synchronous function.

---

## D3: Immutable input, mutable working graph

**Decision:** The `layout()` function accepts a read-only input graph
(nodes + edges + attributes). Internally it builds a mutable working graph
(with virtual nodes, reversed edges, rank assignments, etc.) and returns
a plain output geometry object.

**Rationale:** The dot algorithm needs to freely mutate the graph during
processing (adding virtual nodes, reversing edges for acyclicity, etc.).
Exposing that mutation to callers would be surprising. A separate internal
representation also makes the phases cleanly separable for testing.

---

## D4: TypeScript-native data structures

**Decision:** Use plain TypeScript interfaces and arrays for all graph data.
No classes that mirror C structs. No pointer-like ID lookups through arrays.

**Rationale:** Smetana emulates C pointers with arrays and integer IDs.
TypeScript has object references. Using direct object references is cleaner,
avoids the off-by-one and null-ID sentinel patterns in Smetana, and lets
the TypeScript compiler track nullability properly with `strictNullChecks`.

---

## D5: Output format compatible with current GeometryResult

**Decision:** The dot layout function returns `{ nodes: NodeGeo[], edges: EdgeGeo[], width: number, height: number }` — the same shape as ELK adapter output.

**Rationale:** The diagram renderers (class, component, state, use case)
already consume this shape. Keeping the interface identical means the
renderers need no changes in Phase 4 — only the layout call site changes.

---

## D6: Phase 1 through 3 are standalone modules

**Decision:** Each phase lives in its own module under `src/core/dot/`:
- `src/core/dot/types.ts` — shared graph types
- `src/core/dot/acyclic.ts` — edge reversal
- `src/core/dot/rank.ts` — network simplex
- `src/core/dot/mincross.ts` — crossing minimization
- `src/core/dot/position.ts` — Brandes-Köpf
- `src/core/dot/splines.ts` — edge routing
- `src/core/dot/index.ts` — public `layout()` entry point

**Rationale:** Each phase can be tested independently. A failing test in
Phase 2 doesn't require Phase 1 to run. The entry point composes them.

---

## D7: Replace ELK in Phase 4, not before

**Decision:** Phases 1-3 build and test the dot engine in isolation.
Phase 4 wires it into the plantuml-js plugin system, replacing ELK
adapter calls in the layout modules.

**Rationale:** ELK is currently the working layout engine. Replacing it
mid-development would break tests and make it hard to isolate failures.
Keep the existing ELK path working until the dot engine passes all
integration tests.

---

## D8: No label auto-sizing in Phase 1-3

**Decision:** Initial implementation treats all node sizes as pre-measured
inputs (same as the ELK adapter today). Label/text measurement is the
caller's responsibility.

**Rationale:** The StringMeasurer interface already handles this. Dot's
`label` attribute handling can be added later as a separate concern. This
keeps the algorithm pure: geometry in, geometry out.
