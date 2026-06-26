# T6 — State Diagram AST + Parser

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js uses a `DiagramPlugin<AST, Geo>` pattern. The state diagram parser
reads PlantUML state diagram source and produces a typed AST covering simple
states, composite states, pseudostates, and transitions.

Stack: TypeScript 5 strict, Vitest, ESM.

## Task

Create `src/diagrams/state/ast.ts` and `src/diagrams/state/parser.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/state/ast.ts`
- `src/diagrams/state/parser.ts`
- `tests/unit/state/parser.test.ts`

## Read-Set

- `src/diagrams/sequence/parser.ts` — pattern to follow
- `src/core/block-extractor.ts` — `Block` type
- `planning/diagram-types.md` (State Diagrams section)

## Interface Contracts

```typescript
// src/diagrams/state/ast.ts

export type StateKind =
  | 'normal' | 'initial' | 'final'
  | 'history' | 'deepHistory'
  | 'fork' | 'join' | 'choice' | 'junction';

export interface State {
  id: string;
  display: string;
  kind: StateKind;
  children: State[];           // for composite states
  concurrentRegions: State[][];// for concurrent (--) regions
  color?: string;
  stereotype?: string;
}

export interface Transition {
  from: string;    // state id; '[*]' for initial/final pseudostates
  to: string;
  guard?: string;
  action?: string;
  label?: string;  // guard + action combined if both present
}

export interface StateDiagramAST {
  states: State[];
  transitions: Transition[];
}
```

The parser must treat `[*]` as a reserved pseudostate id that can appear on
either side of a transition.

## Acceptance Criteria

- Given `"[*] --> Active"`, when parsed, then Transition from="[*]" to="Active"
- Given `"state 'My State' as MS"`, when parsed, then State id="MS"
  display="My State"
- Given `"Active --> [*] : done"`, when parsed, then Transition to="[*]"
  label="done"
- Given `"state Composite { A --> B }"`, when parsed, then Composite State
  with children [A, B] and a transition A→B
- Given `"state S { [*] --> A\n--\n[*] --> B }"`, when parsed, then
  concurrent regions [[A], [B]] in composite state S
- Given `"state choice <<choice>>"`, when parsed, then kind="choice"

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% branch
coverage for the parser module.
