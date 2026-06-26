# T5 — acyclic.c vs acyclic.ts: Findings

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Verdict

**Two bugs found.** The critical one causes missed back-edges in cyclic graphs.
A secondary bug causes duplicate edges instead of merged ones for multi-edge cycles.

---

## 1. DFS Traversal Order

| Aspect | graphviz (acyclic.c:44) | plantuml-js (acyclic.ts:21–23) |
|--------|------------------------|-------------------------------|
| Node visitation | DFS from each unvisited node in `GD_nlist` order | DFS from each unvisited node in `graph.nodes` array order |
| Edge iteration within node | Per-node adjacency list `ND_out(n).list[i]` | Global `graph.edges` filtered by `edge.from.id === node.id` |

**Impact**: Minor. Node order is deterministic in both; edge order within a node's
outgoing set may differ. Both produce valid acyclic graphs; which edges get reversed
may differ for graphs with multiple equally-valid reversal choices.

---

## 2. Loop Counter After Reversal (CRITICAL BUG)

**graphviz** (acyclic.c:44–48):
```c
for (i = 0; (e = ND_out(n).list[i]); i++) {
    w = aghead(e);
    if (ND_onstack(w)) {
        reverse_edge(e);
        i--;  // ← re-examine after reverse_edge may insert new edges
    }
```

**plantuml-js** (acyclic.ts:26–40):
```typescript
if (targetState === GRAY) {
    edge.reversed = true;
    const tmp = edge.from;
    edge.from = edge.to;
    edge.to = tmp;
    i++;  // ← increments, skips one edge
```

**Root cause**: `reverse_edge()` in graphviz calls `find_fast_edge()` (lines 22–31)
and may insert a new edge into the adjacency list via `virtual_edge()`. The `i--`
re-examines position `i` to catch newly inserted edges. Our `i++` advances past the
next edge, potentially missing a back-edge.

**Concrete divergence**:
- Graph: A→B, B→A, A→C (A→B and B→A form a cycle).
- DFS(A): examine A→B first; DFS(B): examine B→A → back-edge. Reverse B→A to A←B.
  - graphviz: `i--` → re-examines slot `i` (now empty or next edge from B). Continues.
  - TS: `i++` → skips the next outgoing edge from B if there were one.
- In a graph with B→A and B→C: after reversing B→A, TS increments and examines B→C.
  This is correct here. But if reversing B→A caused a new edge to be inserted at position
  `i`, TS would skip it.

**Fix**: Change acyclic.ts line with `i++` after reversal to `i--`.

---

## 3. Multi-Edge Handling

**graphviz** (acyclic.c:22–31 in `reverse_edge`):
```c
void reverse_edge(edge_t * e) {
    edge_t *f;
    if ((f = find_fast_edge(aghead(e), agtail(e))))
        merge_oneway(e, f);    // Merge reversed edge into existing opposite edge
    else
        virtual_edge(aghead(e), agtail(e), e);  // Create virtual if no existing edge
}
```

When reversing A→B: if B→A already exists, merge them (accumulate weight) instead of
creating a duplicate.

**plantuml-js**: Simple in-place swap of `edge.from` / `edge.to`. No collision check.
If A→B and B→A both exist, both get swapped when their respective back-edges are found,
potentially creating duplicate edges in the same direction.

**Impact**: Downstream rank assignment sees incorrect edge count and weights for
multi-edge graphs. Layout may produce different (incorrect) rank assignments.

**Fix**: After reversing an edge, check whether a same-direction edge already exists
between the new from/to pair. If so, accumulate `edge.weight` and remove the duplicate.

---

## 4. Self-Loops

Both implementations: a self-loop A→A with `ND_onstack(A)` (or GRAY state) triggers
reversal → A→A reversed is still A→A (swap from↔to on same node = no change).
`edge.reversed = true` is set.

No divergence. ✓

---

## 5. Already-Acyclic Graphs

Both: DFS visits all nodes; no back-edges found; no mutations. No divergence. ✓

---

## 6. Reversed Flag Semantics

- **graphviz**: Physically restructures graph (creates new edge in opposite direction
  or merges). Original edge has `ED_reversed(e) = true`.
- **plantuml-js**: Swaps `edge.from` / `edge.to` in place and sets `edge.reversed = true`.

Both mark the edge and flip its direction. Downstream rank/mincross/position/splines code
must read `edge.reversed` to undo the swap when rendering. Current splines.ts (line 209):
```typescript
if (edge.reversed) {
    edge.points = edge.points.slice().reverse();
}
```
Semantics match. ✓

---

## Summary

| Issue | Severity | Fix |
|-------|----------|-----|
| `i++` after reversal (should be `i--`) | **Critical** | Change acyclic.ts: after reversing edge, decrement loop counter |
| Multi-edge merging missing | **High** | After reversal, check for existing reverse edge; if found, merge weight and remove duplicate |
| DFS edge order differs | Low | No fix needed — valid layouts differ, not incorrect ones |
