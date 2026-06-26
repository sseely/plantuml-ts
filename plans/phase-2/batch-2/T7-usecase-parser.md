# T7 — Use Case Diagram AST + Parser

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js uses a `DiagramPlugin<AST, Geo>` pattern. The use case parser
reads PlantUML use case source and produces a typed AST covering actors,
use cases, containers, and relationships.

Stack: TypeScript 5 strict, Vitest, ESM.

## Task

Create `src/diagrams/usecase/ast.ts` and `src/diagrams/usecase/parser.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/usecase/ast.ts`
- `src/diagrams/usecase/parser.ts`
- `tests/unit/usecase/parser.test.ts`

## Read-Set

- `src/diagrams/sequence/parser.ts` — pattern to follow
- `src/core/block-extractor.ts` — `Block` type
- `planning/diagram-types.md` (Use Case Diagrams section)

## Interface Contracts

```typescript
// src/diagrams/usecase/ast.ts

export type UCNodeKind =
  | 'actor' | 'usecase'
  | 'package' | 'rectangle' | 'node' | 'folder' | 'frame'
  | 'cloud' | 'database';

export interface UCNode {
  id: string;
  display: string;
  kind: UCNodeKind;
  children: UCNode[];   // for container kinds
  stereotype?: string;
  color?: string;
}

export type UCLinkStyle = 'solid' | 'dashed';

export interface UCLink {
  from: string;
  to: string;
  label?: string;
  stereotype?: string;   // 'include' | 'extend' | custom
  style: UCLinkStyle;
}

export interface UseCaseDiagramAST {
  nodes: UCNode[];    // top-level only; children nested
  links: UCLink[];
}
```

## Acceptance Criteria

- Given `"actor User"`, when parsed, then UCNode kind="actor" display="User"
- Given `":Admin Actor:"`, when parsed, then kind="actor" display="Admin Actor"
- Given `"(Login)"`, when parsed, then kind="usecase" display="Login"
- Given `"usecase UC1 as 'Do Thing'"`, when parsed, then id="UC1"
  display="Do Thing"
- Given `"User --> (Login)"`, when parsed, then UCLink style="solid"
  from="User" to="Login"
- Given `"(Login) ..> (Validate) : <<include>>"`, when parsed, then
  style="dashed" stereotype="include"
- Given `"rectangle System { (Login) (Logout) }"`, when parsed, then
  container kind="rectangle" with children [Login, Logout]

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% branch
coverage for the parser module.
