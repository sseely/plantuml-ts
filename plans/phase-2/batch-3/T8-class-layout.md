# T8 — Class Diagram Layout

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

The class layout task takes a `ClassDiagramAST` (from T4), pre-measures all
nodes using `StringMeasurer`, builds an ELK graph, runs layout via
`elk-adapter.ts` (T2), and returns `ClassGeometry` — the coordinate data the
renderer (T12) will consume.

Stack: TypeScript 5 strict, Vitest, ESM. Layout is async (returns Promise).

## Task

Create `src/diagrams/class/layout.ts` and `tests/unit/class/layout.test.ts`.

## Write-Set

- `src/diagrams/class/layout.ts`
- `tests/unit/class/layout.test.ts`

## Read-Set

- `src/diagrams/class/ast.ts` — full file (input types)
- `src/core/elk-adapter.ts` — full file (ElkGraph, ElkLayoutResult, runLayout)
- `src/core/measurer.ts` — `StringMeasurer` interface
- `src/core/theme.ts` — Theme interface (font, colors.graph)
- `decisions.md#D3`, `decisions.md#D4`, `decisions.md#D5`

## Interface Contracts

```typescript
// src/diagrams/class/layout.ts

export interface ClassifierGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** y-offsets of divider lines within the box (after header row) */
  dividerYs: number[];
  /** Rows of text: [header, ...members] — y offset from box top */
  rows: Array<{ text: string; y: number; indent: number }>;
}

export interface EdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  /** Arrow decoration at the target end */
  targetDecor: 'triangle' | 'open' | 'diamond' | 'filledDiamond' | 'none';
  /** Arrow decoration at the source end */
  sourceDecor: 'diamond' | 'filledDiamond' | 'none';
  dashed: boolean;
}

export interface NamespaceGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface ClassGeometry {
  totalWidth: number;
  totalHeight: number;
  classifiers: ClassifierGeo[];
  edges: EdgeGeo[];
  namespaces: NamespaceGeo[];
}

export async function layoutClass(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): Promise<ClassGeometry>;
```

### Sizing rules (D4)
- Header row height: `theme.fontSize * 1.4 + 8` (text + padding)
- Member row height: `theme.fontSize * 1.4`
- Node width: `max(minWidth=100, longestMemberText + 20)`
- Node height: header + (members.length × memberRowHeight) + 8 (bottom pad)
- Namespace ELK compound node: children sizes determine parent size (D5)

### ELK options
```json
{
  "algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "50",
  "elk.spacing.nodeNode": "30",
  "elk.edgeRouting": "ORTHOGONAL"
}
```

## Acceptance Criteria

- Given 3 classes with 2 relationships, when layout resolves, then all
  ClassifierGeo entries have x, y, width, height > 0
- Given two unrelated classes, when layout resolves, then their bounding
  boxes do not overlap
- Given a class with 5 members, when layout resolves, then
  `height > 5 × memberRowHeight`
- Given a namespace containing 2 classes, when layout resolves, then
  NamespaceGeo x/y/width/height encompasses both ClassifierGeo positions
- Given a `Foo <|-- Bar` relationship, when layout resolves, then an
  EdgeGeo exists with targetDecor="triangle" and dashed=false

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, layout tests pass,
≥ 90% coverage for the layout module.
