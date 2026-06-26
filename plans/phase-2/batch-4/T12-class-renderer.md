# T12 — Class Diagram Renderer + Plugin Wiring

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Consumes `ClassGeometry` (from T8) and produces an SVG string. Wires the
class diagram into the plugin registry as an `AsyncPlugin`. Uses the new
SVG primitives from T3 and theme graph colors.

Stack: TypeScript 5 strict, Vitest, ESM. No DOM — pure string building.

## Task

Create `src/diagrams/class/renderer.ts` and `src/diagrams/class/index.ts`.
Write unit tests.

## Write-Set

- `src/diagrams/class/renderer.ts`
- `src/diagrams/class/index.ts`
- `tests/unit/class/renderer.test.ts`

## Read-Set

- `src/diagrams/class/ast.ts` — full file
- `src/diagrams/class/layout.ts` — ClassGeometry types
- `src/diagrams/class/parser.ts` — parseClass signature
- `src/core/svg.ts` — all primitives including new ellipse/diamond/group
- `src/core/theme.ts` — Theme interface including colors.graph
- `src/diagrams/sequence/renderer.ts` — pattern for pure-string SVG building
- `src/diagrams/sequence/index.ts` — pattern for plugin wiring
- `decisions.md#D1` — AsyncPlugin interface

## Interface Contracts

```typescript
// src/diagrams/class/index.ts
import type { AsyncPlugin } from '../../core/dispatcher.js';
import type { ClassDiagramAST } from './ast.js';
import type { ClassGeometry } from './layout.js';

export const classPlugin: AsyncPlugin<ClassDiagramAST, ClassGeometry>;
```

The plugin's `accepts()` must match blocks whose first non-empty content line
contains class diagram syntax keywords (`class`, `interface`, `enum`,
`abstract`, `<|--`, `*--`, `o--`) OR whose `@startuml` has no type hint and
contains those keywords.

### Rendering rules

**Classifier box:**
- Background rect: `fill=theme.colors.graph.classBackground` (interfaces use
  `interfaceBackground`, enums use `enumBackground`)
- Header: class name centred, bold for abstract/interface via `<b>` Creole
- Stereotype below name if present: `«stereotype»`
- Horizontal divider line after header
- Member rows: visibility symbol + name + type, left-aligned with indent=8
- Static members: underline via SVG `text-decoration`

**Relationship arrows:**
- `extension` (`<|--`): solid line, closed triangle at target
- `implementation` (`<|..`): dashed line, closed triangle at target
- `composition` (`*--`): solid line, filled diamond at source
- `aggregation` (`o--`): solid line, open diamond at source
- `dependency` (`..>`): dashed line, open arrowhead at target
- `association` (`-->`): solid line, open arrowhead at target

**Root SVG:** `<svg xmlns="http://www.w3.org/2000/svg" width="{totalWidth}" height="{totalHeight}">`

## Acceptance Criteria

- Given ClassGeometry with 2 classifiers, when rendered, then SVG contains
  2 `<rect>` elements for class boxes (plus background)
- Given a member with visibility "+", when rendered, then "+" appears before
  member name in a `<text>` element
- Given an extension relationship, when rendered, then SVG contains a closed
  triangle polygon (inheritance arrowhead)
- Given an interface classifier, when rendered, then box fill is
  `theme.colors.graph.interfaceBackground`
- Given classPlugin registered and `render()` called with
  `"@startuml\nclass Foo\n@enduml"`, then result starts with `"<svg"`
- Given `renderSync()` called with class source, then result contains
  "not supported" (no throw)

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, ≥ 90% coverage
for renderer and index modules.
