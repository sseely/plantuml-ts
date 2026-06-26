# T1 — AST + Parser + Block-Extractor Registration + Parser Tests

## Context

plantuml-js is a TypeScript port of PlantUML targeting the JS ecosystem.
It uses a plugin architecture: each diagram type has an `ast.ts`, `parser.ts`,
`layout.ts`, `renderer.ts`, and `index.ts`. Plugins are registered in
`src/index.ts`. The block extractor routes `@start<suffix>` blocks to the
correct plugin via `START_SUFFIX_MAP`.

This task adds the AST types and parser for `@startdot` / `@enddot` blocks.
It does NOT implement layout or rendering — those are Batch 2 and 3.

Test framework: **vitest**. Run tests with `npm test`.

## Task

1. Create `src/diagrams/dot/ast.ts` with the DOT diagram AST and geometry types.
2. Create `src/diagrams/dot/parser.ts` implementing `parseDot(source: string): DotDiagramAST`.
3. Modify `src/core/block-extractor.ts`: add `'dot'` to the `DiagramType` union and `START_SUFFIX_MAP['dot'] = 'dot'`.
4. Create `tests/unit/dot/parser.test.ts` with full unit tests.

## Write-set

- `src/diagrams/dot/ast.ts` (create)
- `src/diagrams/dot/parser.ts` (create)
- `src/core/block-extractor.ts` (modify)
- `tests/unit/dot/parser.test.ts` (create)

## Read-set

- `src/diagrams/files/ast.ts` — structural pattern for AST + geometry types in same file
- `src/core/block-extractor.ts` — existing DiagramType union and START_SUFFIX_MAP pattern
- `src/diagrams/hcl/parser.ts` — example of stripping @start/@end and directives
- `plans/dot-passthrough/decisions.md` — all architecture decisions

## AST types to define in `ast.ts`

```typescript
// Parser output
export type DotGraphType = 'digraph' | 'graph';
export type DotNodeShape = 'ellipse' | 'box' | 'circle' | 'diamond' | 'plaintext';

export interface DotNodeDef {
  id: string;
  label: string;       // defaults to id if not specified
  shape: DotNodeShape; // defaults to 'ellipse'
  widthIn: number | null;  // DOT width attr in inches; null = use measurement
  heightIn: number | null; // DOT height attr in inches; null = use measurement
  rank: 'source' | 'sink' | 'same' | 'min' | 'max' | null;
}

export interface DotEdgeDef {
  id: string;    // generated: `e${index}`
  from: string;
  to: string;
  label: string | null;
  weight: number | null;
  minLen: number | null;
}

export interface DotDiagramAST {
  graphType: DotGraphType;
  strict: boolean;
  name: string | null;
  title: string | null;
  rankDir: 'TB' | 'LR' | 'BT' | 'RL' | null;
  nodeSep: number | null;
  rankSep: number | null;
  skinparamLines: string[]; // raw skinparam lines for layout/renderer to apply
  nodes: DotNodeDef[];      // in declaration order; implicit nodes from edges included
  edges: DotEdgeDef[];
}

// Geometry types (used by layout.ts and renderer.ts — define here to avoid
// circular imports)
export interface DotNodeGeo {
  id: string;
  label: string;
  shape: DotNodeShape;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DotEdgeGeo {
  id: string;
  from: string;
  to: string;
  label: string | null;
  points: Array<{ x: number; y: number }>;
  directed: boolean; // false for 'graph' (undirected) edges
}

export interface DotGeometry {
  nodes: DotNodeGeo[];
  edges: DotEdgeGeo[];
  title: string | null;
  totalWidth: number;
  totalHeight: number;
}
```

## Parser implementation notes

**Pre-processing (before tokenizing):**
1. Strip `@startdot` and `@enddot` lines.
2. Extract `title <text>` lines → `ast.title` (strip them from DOT content).
3. Collect `skinparam …` lines → `ast.skinparamLines` (strip them from DOT content).
4. Strip `//` line comments and `/* */` block comments.

**Tokenizing the DOT block:**
- Find the graph header: optional `strict`, then `digraph` or `graph`, optional name, opening `{`.
- Use a simple character-level scanner (not regex-only): track brace depth to find the closing `}`.
- Inside the graph body, parse statements separated by `;` or newline.

**Statement types:**
- `node [attr-list]` → set default node attributes
- `edge [attr-list]` → set default edge attributes
- `graph [attr-list]` → set graph-level attributes (`rankdir`, `nodesep`, `ranksep`)
- `subgraph { … }` or `{ … }` → recurse; if `rank=…` is in the attr-list or body, apply to contained node ids
- `id -> id -> id [attr-list]` (or `--` for graph) → expand chain to N-1 edges
- `id [attr-list]` → node declaration
- bare `id;` → implicit node declaration (no attrs beyond defaults)

**Attribute list parsing (`[key=value, key=value, …]`):**
- Keys and values are unquoted identifiers, quoted strings, or numbers.
- Strip outer `"` from quoted strings.
- HTML-like labels (`<…>`) → strip tags, keep text content.

**Implicit nodes:** any node id referenced in an edge but not declared as a
node statement must be added to `ast.nodes` with default attributes.

**`strict` deduplication (D3):** after all edges are parsed, deduplicate
by `(from, to)` pair — keep first occurrence.

**Shape normalisation (D1):** map raw shape string to `DotNodeShape`:
- `'box'`, `'rect'`, `'rectangle'` → `'box'`
- `'circle'` → `'circle'`
- `'diamond'` → `'diamond'`
- `'plaintext'`, `'none'` → `'plaintext'`
- anything else (including absent) → `'ellipse'`

## Acceptance criteria

```
Given `digraph G { a -> b }`:
  parser returns 2 nodes ('a', 'b'), 1 edge (a→b), graphType='digraph'

Given `graph G { a -- b -- c }`:
  parser returns 3 nodes, 2 edges (a-b, b-c), graphType='graph'

Given `strict digraph { a->b; a->b; a->b }`:
  parser deduplicates to 1 edge

Given `node [shape=box]; a`:
  node 'a' has shape='box' (default applied)

Given `subgraph { rank=same; x; y }`:
  nodes 'x' and 'y' have rank='same'

Given `title My Diagram` before the graph block:
  ast.title === 'My Diagram'

Given `digraph toto { azerty; }` (corpus fixture 1):
  parses without error; 1 node 'azerty', 0 edges

Given `graph graphname { a -- b -- c; b -- d; }` (corpus fixture 2):
  parses without error; 4 nodes, 3 edges
```

## Quality bar

Run `npm test` before finishing — all tests must pass, including
coverage thresholds (90/90/90). Run `npm run typecheck` and
`npm run lint` — zero errors.
