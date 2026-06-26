# Architecture Decisions

| ID | Decision | Summary |
|----|----------|---------|
| D1 | Port from Smetana, not C source | Same code path PlantUML executes; skip smetana/core/ emulation layer |
| D2 | Synchronous API | `layout()` is a plain function, not async; enables renderSync() |
| D3 | Immutable input, mutable working graph | Callers never see virtual nodes or reversed edges |
| D4 | TypeScript-native data structures | Object refs, not C-style integer ID arrays |
| D5 | Output matches ElkLayoutResult shape | `{nodes, edges, width, height}` — renderers need zero changes |
| D6 | One module per stage | types, acyclic, rank, mincross, position, splines, index |
| D7 | Replace ELK in Batch 5, not before | Keep ELK working until dot engine passes all integration tests |
| D8 | No label auto-sizing in Batches 1–4 | Node sizes arrive pre-measured; dot engine is pure geometry |

## Details

### D1: Reference source
Use `~/git/plantuml/src/smetana/core/dot15/*.java`. Do NOT port
`smetana/core/` (the C runtime emulation layer — 3,807 lines of pointer
arithmetic emulation). Replace those patterns with native TypeScript.

### D2: Synchronous API
```typescript
export function layout(input: DotInputGraph): DotLayoutResult
```
No Promise, no async. The algorithm has no I/O.

### D3: Working graph
`buildWorkingGraph(input)` converts immutable `DotInputGraph` → mutable
`DotWorkingGraph`. All pipeline stages mutate the working graph in place.
`extractResult(wg)` converts back to `DotLayoutResult`, filtering out
virtual nodes/edges.

### D4: Data structures
No integer-indexed `GD_*`, `ND_*`, `ED_*` arrays from Smetana. Use
object references directly. Use `Map<>` for lookups.

### D5: Output shape
```typescript
interface DotLayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ id: string; points: Array<{ x: number; y: number }> }>;
  width: number;
  height: number;
}
```
Identical to `ElkLayoutResult` — see `src/core/elk-adapter.ts:80-85`.

### D6: Module layout
```
src/core/dot/
  types.ts      ← T1
  acyclic.ts    ← T1
  rank.ts       ← T2
  index.ts      ← T2 (stub), T5 (complete)
  mincross.ts   ← T3
  position.ts   ← T4
  splines.ts    ← T5
```

### D7: ELK removal timing
T1–T5 build the dot engine alongside ELK. T6–T9 migrate each diagram
layout. T10 deletes elk-adapter.ts and removes elkjs from package.json.

### D8: Pre-measured nodes
`DotInputNode.width` and `DotInputNode.height` are set by callers using
`StringMeasurer` (same pattern as the ELK adapter). The dot engine does
not call any text measurement function.
