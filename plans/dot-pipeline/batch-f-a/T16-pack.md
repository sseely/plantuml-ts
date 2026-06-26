# T16 — pack/

## Context

plantuml-js is a TypeScript port of PlantUML dot layout. The pack library
packs disconnected graph components tightly together after each component is
laid out independently. Without it, disconnected components are all placed at
origin (0,0) and overlap.

Stack: TypeScript, vitest, project root `~/git/plantuml-js`.

## Task

Port the Smetana-included pack files to `src/core/pack/`:

| C source | Output TS file |
|----------|---------------|
| `~/git/graphviz/lib/pack/pack.c` | `src/core/pack/pack.ts` |
| `~/git/graphviz/lib/pack/ccomps.c` | `src/core/pack/ccomps.ts` |

Also create `src/core/pack/index.ts` re-exporting the public API.

Key function: `packSubgraphs(graphs, packMode, margin)` — given a list of
already-laid-out sub-graphs (from decompose in T2), compute offsets to pack
them into a rectangle without overlap.

## Write-set

- `src/core/pack/pack.ts` (create)
- `src/core/pack/ccomps.ts` (create)
- `src/core/pack/index.ts` (create)
- `tests/unit/pack/pack.test.ts` (create)

## Read-set

- `~/git/graphviz/lib/pack/pack.c`
- `~/git/graphviz/lib/pack/ccomps.c`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/core/smetana/gen/lib/pack/pack.java`
- `src/core/dot/decomp.ts` — T2 output (how components are produced)

## Interface contracts

```typescript
export interface PackedComponent {
  nodes: Array<{ id: string; x: number; y: number }>;
  xOffset: number;
  yOffset: number;
}
export function packSubgraphs(
  components: DotWorkingGraph[],
  margin: number,
): PackedComponent[];
```

## Acceptance criteria

- Given two components each 100x100, when `packSubgraphs` runs with margin=10,
  then the packed bounding box is ≤220 wide (two boxes + margin).
- Given a single component, when `packSubgraphs` runs, then it returns with
  xOffset=0, yOffset=0.
- Given components of different heights, when `packSubgraphs` runs, then they
  are aligned to the top row and do not overlap.

## Quality bar

`npm test && npm run typecheck && npm run lint` must pass.
