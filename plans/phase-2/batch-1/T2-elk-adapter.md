# T2 — ELK Adapter

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js uses ELK.js (`elkjs` package, already in `dependencies`) for graph
layout in Phase 2. Four diagram types (class, component, state, use case) all
need automatic node placement and edge routing. A single shared adapter
eliminates repeated ELK initialisation and provides one testable seam.

Stack: TypeScript 5 strict, Vitest, ESM imports.

## Task

Create `src/core/elk-adapter.ts`: a pure async function that accepts a generic
graph description, runs ELK layout, and returns positioned geometry. Write
unit tests in `tests/unit/elk-adapter.test.ts`.

## Write-Set

- `src/core/elk-adapter.ts` — new file
- `tests/unit/elk-adapter.test.ts` — new file

## Read-Set

- `package.json` — confirm `elkjs` version
- `src/core/measurer.ts` — `StringMeasurer` interface (adapter receives
  pre-measured node sizes, does not measure itself)
- `decisions.md#D3` and `decisions.md#D4` and `decisions.md#D5`

## Architecture Decisions

**D3:** Single shared adapter. Each diagram's `layout.ts` builds the ELK input
and calls `runLayout()`.

**D4:** Nodes arrive pre-measured. The adapter passes `width` and `height` as
fixed node sizes to ELK. ELK only routes; it does not measure text.

**D5:** Compound/parent nodes for packages and namespaces. The adapter must
pass `children` arrays through to ELK correctly.

## Interface Contracts

```typescript
// src/core/elk-adapter.ts

export interface ElkNode {
  id: string;
  width: number;
  height: number;
  /** Set for compound/container nodes (packages, namespaces) */
  children?: ElkNode[];
  /** ELK layout options for this node (optional overrides) */
  layoutOptions?: Record<string, string>;
}

export interface ElkEdge {
  id: string;
  sources: [string];   // single source
  targets: [string];   // single target
  labels?: Array<{ text: string }>;
}

export interface ElkGraph {
  nodes: ElkNode[];
  edges: ElkEdge[];
  /** Root-level ELK layout options (algorithm, direction, spacing) */
  layoutOptions?: Record<string, string>;
}

export interface ElkNodeResult {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: ElkNodeResult[];
}

export interface ElkEdgeResult {
  id: string;
  sections: Array<{
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints?: Array<{ x: number; y: number }>;
  }>;
}

export interface ElkLayoutResult {
  nodes: ElkNodeResult[];
  edges: ElkEdgeResult[];
  width: number;
  height: number;
}

export async function runLayout(graph: ElkGraph): Promise<ElkLayoutResult>;
```

## Acceptance Criteria

- Given a graph with 3 nodes (pre-sized) and 2 edges, when `runLayout()`
  resolves, then every node result has defined x, y, width, height > 0
- Given two disconnected nodes, when `runLayout()` resolves, then their
  bounding boxes do not overlap
- Given a parent node containing 2 children, when `runLayout()` resolves,
  then parent x/y/width/height encompasses all children positions
- Given custom `layoutOptions` on the graph root, then ELK receives them
- Given an empty graph `{ nodes: [], edges: [] }`, when `runLayout()` resolves,
  then result is `{ nodes: [], edges: [], width: 0, height: 0 }` without error

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors. The adapter tests
must exercise real ELK layout (not mocked) to catch ELK API mismatches.
