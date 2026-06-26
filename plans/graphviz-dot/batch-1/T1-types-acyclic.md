# T1 — Shared Types + Acyclic Stage

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript library that renders PlantUML diagrams to SVG
strings. It uses a plugin registry pattern: each diagram type has a parser,
layout engine, and renderer. Graph diagram types (class, component, state,
use case) currently use ELK.js for layout. This task begins a port of the
Graphviz `dot` layout algorithm from Smetana (PlantUML's Java translation
of Graphviz 2.38.0) to replace ELK with a synchronous TypeScript engine.

**Stack:** TypeScript 5 strict mode (`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`), Vitest for tests, ESLint 9 flat config.
Test framework: Vitest with `describe`/`it`/`expect`. No Jest.

**Reference source:** `~/git/plantuml/src/smetana/core/dot15/acyclic__c.java`
Do NOT port `smetana/core/` (C runtime emulation). Use native TypeScript.

## Task

Create two new source files and one test file:

1. **`src/core/dot/types.ts`** — all shared TypeScript interfaces for the
   dot engine (input graph, working graph, output result)

2. **`src/core/dot/acyclic.ts`** — DFS-based cycle removal. Exports a
   single function `removeAcyclic(graph: DotWorkingGraph): void` that
   marks back edges as reversed and swaps their from/to so the graph
   becomes a DAG.

3. **`tests/unit/dot/acyclic.test.ts`** — unit tests for acyclic.ts

## Write-set

```
src/core/dot/types.ts           (create)
src/core/dot/acyclic.ts         (create)
tests/unit/dot/acyclic.test.ts  (create)
```

## Read-set

- `~/git/plantuml/src/smetana/core/dot15/acyclic__c.java` — reference impl
- `src/core/elk-adapter.ts:54-85` — ElkLayoutResult shape (D5: output must match)
- `src/diagrams/usecase/layout.ts:1-57` — example of how a layout module uses the adapter

## Architecture Decisions

- **D2**: `layout()` is synchronous — no async/Promise anywhere in the dot engine
- **D3**: Input is immutable (`DotInputGraph`); working graph (`DotWorkingGraph`) is mutable
- **D4**: Object references, not integer IDs. `Map<>` not parallel arrays.
- **D6**: types.ts and acyclic.ts are separate modules under `src/core/dot/`

## Interface Contracts

### `src/core/dot/types.ts` — export all of these:

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
    weight?: number;  // default 1
    minLen?: number;  // default 1
  };
}

export interface DotInputGraph {
  nodes: DotInputNode[];
  edges: DotInputEdge[];
  rankDir?: 'TB' | 'LR' | 'BT' | 'RL'; // default 'TB'
  nodeSep?: number;  // default 36
  rankSep?: number;  // default 36
}

export interface DotNode {
  id: string;
  width: number;
  height: number;
  rank: number;      // -1 until set by rank stage
  order: number;     // -1 until set by mincross stage
  x: number;         // 0 until set by position stage
  y: number;         // 0 until set by position stage
  virtual: boolean;  // true for dummy nodes inserted by rank stage
}

export interface DotEdge {
  id: string;
  from: DotNode;
  to: DotNode;
  weight: number;
  minLen: number;
  reversed: boolean;
  virtualNodes?: DotNode[];
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
export function removeAcyclic(graph: DotWorkingGraph): void
```

Mutates `edge.reversed` and swaps `edge.from`/`edge.to` for back edges.
Uses DFS with three states: white (unvisited), gray (on stack), black (done).
A back edge is any edge u→v where v is gray. After reversal, `edge.from`
and `edge.to` are swapped so the working graph is a DAG.

## Acceptance Criteria

- **Given** a graph with no cycles, **when** `removeAcyclic()`, **then** all edges have `reversed=false`
- **Given** cycle A→B→C→A, **when** `removeAcyclic()`, **then** exactly 1 edge is `reversed=true` and the graph has no cycles
- **Given** self-loop A→A, **when** `removeAcyclic()`, **then** that edge has `reversed=true`
- **Given** two separate cycles, **when** `removeAcyclic()`, **then** ≥1 edge reversed per cycle, result is a DAG
- **Given** a reversed edge, **when** inspected, **then** `edge.from.id` and `edge.to.id` are swapped from the input

## TDD Workflow

Write tests BEFORE implementation — strictly red/green:
1. Write `acyclic.test.ts` first with one `it()` per acceptance criterion — all fail
2. Run `npm test` to confirm tests fail (red)
3. Write `types.ts` (no logic to test — just types)
4. Write minimum `acyclic.ts` to make the first test pass (green)
5. Run `npm test` — confirm that test passes, others still fail
6. Continue test-by-test until all pass
7. Refactor if needed — tests must stay green

Do not write implementation code that isn't driven by a failing test.

## Quality Bar

```
npm test        # all tests pass (including pre-existing 993+)
npm run typecheck
npm run lint
```

No comments in code unless explaining a non-obvious algorithm invariant.
Test file uses `describe`/`it`/`expect` (Vitest). Import with `.js` extension:
`import { removeAcyclic } from '../../../src/core/dot/acyclic.js'`
