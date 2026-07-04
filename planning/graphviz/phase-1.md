# Phase 1 — Data Structures + Acyclic + Network Simplex Ranking

## Goal

Implement the first two pipeline stages and all shared types. By the end
of Phase 1, given a graph with node sizes, the engine assigns each node
a `rank` (integer layer 0, 1, 2, …) that satisfies edge constraints and
minimizes total edge span. Tests verify rank correctness; no x/y positions
yet.

## Write-set

```
src/core/dot/types.ts        — shared graph types (create)
src/core/dot/acyclic.ts      — cycle removal via edge reversal (create)
src/core/dot/rank.ts         — network simplex ranking (create)
src/core/dot/index.ts        — entry point, partial (create, stubs for later phases)
tests/unit/dot/acyclic.test.ts   — (create)
tests/unit/dot/rank.test.ts      — (create)
```

## Read-set

- `~/git/plantuml/src/smetana/core/dot15/acyclic__c.java` — reference impl
- `~/git/plantuml/src/smetana/core/dot15/rank__c.java` — reference impl
- `planning/graphviz/decisions.md` — D1–D8
- `planning/graphviz/algorithm.md` — data model and stage descriptions

## Architecture Decisions (relevant)

- **D1**: Port from Smetana; do not port `smetana/core/` emulation layer
- **D2**: Synchronous API — `layout()` is a plain function, not async
- **D3**: Mutable working graph built from immutable input
- **D4**: TypeScript-native data structures (object refs, not integer IDs)
- **D6**: Each stage is its own module

## Interface Contracts

### `src/core/dot/types.ts`

```typescript
export interface DotInputNode {
  id: string;
  width: number;
  height: number;
  attributes?: {
    rank?: 'source' | 'sink' | 'same' | 'min' | 'max';
  };
}

export interface DotInputEdge {
  id: string;
  from: string;
  to: string;
  attributes?: {
    weight?: number;   // default 1
    minLen?: number;   // default 1
  };
}

export interface DotInputGraph {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  rankDir?: 'TB' | 'LR' | 'BT' | 'RL'; // default 'TB'
  nodeSep?: number;  // default 36
  rankSep?: number;  // default 36
}

// Internal working node — mutated by pipeline stages
export interface DotNode {
  id: string;
  width: number;
  height: number;
  // Set by acyclic:
  // (no new fields — edges track reversal)
  // Set by rank:
  rank: number;        // initialized to -1
  // Set by mincross:
  order: number;       // initialized to -1
  // Set by position:
  x: number;           // initialized to 0
  y: number;           // initialized to 0
  virtual: boolean;    // true for dummy nodes inserted by rank stage
}

export interface DotEdge {
  id: string;
  from: DotNode;
  to: DotNode;
  weight: number;
  minLen: number;
  reversed: boolean;   // set by acyclic stage
  // virtual chain for long edges:
  virtualNodes?: DotNode[];
  // set by splines:
  points: Array<{ x: number; y: number }>;
}

export interface DotWorkingGraph {
  nodes: DotNode[];
  edges: DotEdge[];
  rankDir: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSep: number;
  rankSep: number;
}

export interface DotLayoutResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ id: string; points: Array<{ x: number; y: number }> }>;
  width: number;
  height: number;
}
```

### `src/core/dot/acyclic.ts`

```typescript
export function removeAcyclic(graph: DotWorkingGraph): void;
// Mutates edge.reversed in place. DFS-based; marks back edges.
```

### `src/core/dot/rank.ts`

```typescript
export function assignRanks(graph: DotWorkingGraph): void;
// Mutates node.rank for every node in graph.nodes.
// Adds virtual nodes + edges for long edges (rank span > minLen).
// Network simplex algorithm.
```

## Acceptance Criteria

### Acyclic stage

- **Given** a graph with no cycles, **when** `removeAcyclic()` runs,
  **then** zero edges are marked reversed.
- **Given** a graph with one cycle A→B→C→A, **when** `removeAcyclic()`,
  **then** exactly one edge is marked reversed and the graph is a DAG.
- **Given** a graph with a self-loop A→A, **when** `removeAcyclic()`,
  **then** that edge is reversed.
- **Given** a graph with two separate cycles, **when** `removeAcyclic()`,
  **then** at least one edge per cycle is reversed, leaving a DAG.
- **Given** a reversed edge, **when** the working graph is inspected,
  **then** `edge.from` and `edge.to` are swapped and `edge.reversed` is true.

### Rank stage

- **Given** a linear chain A→B→C with `minLen=1`, **when** `assignRanks()`,
  **then** `rank(A)=0, rank(B)=1, rank(C)=2`.
- **Given** two paths to the same sink (A→C, B→C), **when** `assignRanks()`,
  **then** `rank(C) > rank(A)` and `rank(C) > rank(B)`.
- **Given** an edge with `minLen=2`, **when** `assignRanks()`,
  **then** `rank(to) - rank(from) >= 2`.
- **Given** a diamond graph A→B, A→C, B→D, C→D, **when** `assignRanks()`,
  **then** `rank(D) - rank(A) = 2` (optimal, not 3).
- **Given** ranks are assigned, **when** inspecting virtual nodes for a
  long edge (span > minLen), **then** one virtual node exists per
  intermediate rank.
- **Given** an empty graph, **when** `assignRanks()`, **then** no error
  and no nodes to rank.

## Quality Bar

- `npm test` — all tests pass (including pre-existing 993)
- `npm run typecheck` — zero errors
- `npm run lint` — zero errors
- New test files achieve 90%+ line and branch coverage for acyclic.ts
  and rank.ts

## Implementation Notes

### Acyclic

The DFS approach in `acyclic__c.java` uses three vertex states:
- **white** (0): unvisited
- **gray** (1): in current DFS stack (on the path)
- **black** (2): fully processed

A back edge is any edge u→v where v is gray. Mark it reversed, then
swap `edge.from`/`edge.to` so the working graph becomes a DAG.

### Network Simplex (rank)

The algorithm as implemented in `rank__c.java` (Gansner et al. 1993):

1. **Initial feasible tree**: Run DFS and pick tree edges such that
   `rank(to) - rank(from) = minLen` for each tree edge. Initialize
   ranks along this spanning tree.

2. **Cut values**: For each tree edge e=(u,v), the cut value = (sum of
   weights of edges going from the head component to the tail component)
   minus (sum going from tail to head). A tree edge with negative cut value
   can be swapped with a non-tree edge to improve total rank span.

3. **Pivot**: Find the non-tree edge f=(x,y) that "enters" the component
   of the negative-cut-value tree edge e, and swap e out / f in. Update
   ranks and cut values.

4. **Normalize**: Shift all ranks so the minimum is 0.

5. **Virtual nodes**: For each edge where `rank(to) - rank(from) > minLen`,
   insert virtual (dummy) nodes at each intermediate rank and replace the
   long edge with a chain of unit-length edges.

The `rank__c.java` implementation uses "postorder traversal" and "lim/low"
arrays for efficient cut value computation. Port these as properties on
DotNode rather than separate arrays.
