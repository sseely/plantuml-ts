# T5 — Component Diagram AST + Parser

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js uses a `DiagramPlugin<AST, Geo>` pattern. The component diagram
parser reads PlantUML component source and produces a typed AST. Component
and deployment diagram share the same parser entry point.

Stack: TypeScript 5 strict, Vitest, ESM.

## Task

Create `src/diagrams/component/ast.ts` and `src/diagrams/component/parser.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/component/ast.ts`
- `src/diagrams/component/parser.ts`
- `tests/unit/component/parser.test.ts`

## Read-Set

- `src/diagrams/sequence/parser.ts` — pattern to follow
- `src/core/block-extractor.ts` — `Block` type
- `planning/diagram-types.md` (Component Diagrams section)

## Interface Contracts

```typescript
// src/diagrams/component/ast.ts

export type ComponentKind =
  | 'component' | 'interface' | 'node' | 'package' | 'folder'
  | 'frame' | 'cloud' | 'database' | 'storage';

export interface ComponentNode {
  id: string;
  display: string;
  kind: ComponentKind;
  children: ComponentNode[];   // for container kinds
  stereotype?: string;
  color?: string;
}

export type LinkStyle = 'solid' | 'dashed';

export interface ComponentLink {
  from: string;
  to: string;
  label?: string;
  style: LinkStyle;
  arrowHead?: 'open' | 'filled' | 'none';
}

export interface ComponentDiagramAST {
  nodes: ComponentNode[];     // top-level nodes only; children nested
  links: ComponentLink[];
}
```

## Acceptance Criteria

- Given `"[MyComponent]"`, when parsed, then ComponentNode kind="component"
  display="MyComponent" id="MyComponent"
- Given `"() Interface1"`, when parsed, then kind="interface"
  display="Interface1"
- Given `"component Foo as F"`, when parsed, then id="F" display="Foo"
- Given `"package P { [A] [B] }"`, when parsed, then package node kind="package"
  with children A and B
- Given `"[A] --> [B] : uses"`, when parsed, then ComponentLink style="solid"
  label="uses" from="A" to="B"
- Given `"[A] ..> [B]"`, when parsed, then style="dashed"
- Given container kinds (node, folder, frame, cloud, database, storage),
  when parsed, then kind matches the keyword

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% branch
coverage for the parser module.
