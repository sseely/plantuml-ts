# T3 — Description AST

## Context

Upstream models component / use-case / deployment elements as one type carrying a
`USymbol` shape. The current `ComponentNode` and `UCNode` differ only in their
`kind` union and one link field — so this is a union, not a redesign.

## Task

Create `src/diagrams/description/ast.ts` with:

```ts
import type { USymbol } from '../../core/descriptive-keywords.js';

export interface DescriptiveNode {
  id: string;
  display: string;
  symbol: USymbol;
  children: DescriptiveNode[]; // non-empty only for container symbols
  stereotype?: string;
  color?: string;
}
export type DescriptiveLinkStyle = 'solid' | 'dashed';
export interface DescriptiveLink {
  from: string;
  to: string;
  label?: string;
  stereotype?: string;          // <<include>> / <<extend>> etc.
  style: DescriptiveLinkStyle;
  arrowHead?: 'open' | 'filled' | 'none';
}
export interface DescriptionDiagramAST {
  nodes: DescriptiveNode[];     // top-level only; children nested
  links: DescriptiveLink[];
}
```

Types only — no runtime logic. Mirror the doc-comment style of the existing
`component/ast.ts` and `usecase/ast.ts`.

## Read-set

- `src/diagrams/component/ast.ts`, `src/diagrams/usecase/ast.ts` (the two shapes
  being unified).
- `src/core/descriptive-keywords.ts` (T1 — `USymbol`).

## Architecture decisions

D1 (one type), D2 (`symbol: USymbol`). Locked.

## Interface contract (consumed by T4, T5, T6, T7)

The three exported types above. `children` is `DescriptiveNode[]`; `symbol` is
`USymbol`; `DescriptiveLink.stereotype` carries include/extend.

## Acceptance criteria

- Given `DescriptiveNode`, when typechecked, then `symbol: USymbol` and
  `children: DescriptiveNode[]`.
- Given `DescriptiveLink`, when typechecked, then optional `stereotype` and
  required `style`.
- Given `pnpm typecheck`, then clean (file compiles standalone).

## Observability

N/A — type definitions.

## Rollback

Reversible — delete the file; no consumers until T4.

## Quality bar

`pnpm typecheck && pnpm lint` green. One commit:
`feat(T3): add unified description-diagram AST`.
