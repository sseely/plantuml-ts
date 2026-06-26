# T10 — State diagram history pseudostates

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js TypeScript port. State diagrams support shallow history
`[H]` and deep history `[H*]` pseudostates. These are standard UML
and appear in the pdiff corpus. The state parser does not currently
recognize them.

Upstream rendering: a circle with "H" (shallow) or "H*" (deep)
inside it, same size as other pseudostates (initial/final).

## Task

1. Add `HistoryPseudostate` to `src/diagrams/state/ast.ts` with
   a `depth: 'shallow' | 'deep'` field
2. Parse `[H]` and `[H*]` in `src/diagrams/state/parser.ts`
3. Render the history pseudostate shape in `src/diagrams/state/renderer.ts`:
   - Circle of the same radius as initial pseudostate
   - "H" or "H*" text centered inside the circle
   - No fill (outline only), matching upstream appearance

Consult `~/git/plantuml/src/main/java/net/sourceforge/plantuml/statediagram/`
for upstream shape details.

## Write-set

- `src/diagrams/state/ast.ts`
- `src/diagrams/state/parser.ts`
- `src/diagrams/state/renderer.ts`
- `tests/unit/state/parser.test.ts`
- `tests/unit/state/renderer.test.ts`

## Read-set

- `src/diagrams/state/ast.ts`
- `src/diagrams/state/parser.ts`
- `src/diagrams/state/renderer.ts`
- `tests/unit/state/parser.test.ts`
- `tests/unit/state/renderer.test.ts`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/statediagram/`
- `tests/corpus/state/*.puml` (scan for [H] and [H*] usage)

## Acceptance Criteria

- Given `"[H]"` in a state diagram, when parsed, then produces a
  `HistoryPseudostate` node with `depth: 'shallow'`
- Given `"[H*]"`, when parsed, then produces `depth: 'deep'`
- Given a shallow history node, when rendered, then SVG contains a
  `<circle>` with `<text>H</text>` centered inside; no fill
- Given a deep history node, when rendered, then SVG contains a
  `<circle>` with `<text>H*</text>` centered inside; no fill
- Given a state diagram with no history nodes, when rendered, then
  output is identical to before this change

## Quality Bar

`npm test` passes. `npm run typecheck` clean. All existing state
diagram tests must still pass.
