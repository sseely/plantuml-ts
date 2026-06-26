# T6 — Class renderer: use `interfaceBackground` for interface nodes

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.
>
> Read before implementing:
> - `~/git/plantuml/src/main/java/net/sourceforge/plantuml/svek/image/EntityImageClass.java`
>   — confirm that interface classifier has its own background color distinct
>   from class

## Context

plantuml-js is a TypeScript port of PlantUML (GPL-3.0). Stack: TypeScript +
Vite, Vitest tests (90/90/90 coverage). ESLint. Working directory:
`/Users/scottseely/git/plantuml-js`. Branch: `feat/style-blocks`.

`Theme.colors.graph.interfaceBackground` already exists (added in the skinparam
mission). The class renderer currently returns `theme.colors.graph.classBackground`
for all non-enum classifiers including interfaces. This task fixes that.

Read `src/diagrams/class/renderer.ts` and `tests/unit/class/renderer.test.ts`
fully before editing.

## Task

### Fix `classifierFill`

Current:
```typescript
function classifierFill(geo: ClassifierGeo, theme: Theme): string {
  if (geo.kind === 'enum') return theme.colors.graph.enumBackground;
  return theme.colors.graph.classBackground;
}
```

Updated:
```typescript
function classifierFill(geo: ClassifierGeo, theme: Theme): string {
  if (geo.kind === 'enum')      return theme.colors.graph.enumBackground;
  if (geo.kind === 'interface') return theme.colors.graph.interfaceBackground;
  return theme.colors.graph.classBackground;
}
```

Verify against `EntityImageClass.java` that interfaces genuinely use a
separate background color before making the change. If upstream confirms a
single shared color, document that in the decision journal instead.

## Write-Set

- `src/diagrams/class/renderer.ts`
- `tests/unit/class/renderer.test.ts`

## Read-Set

- `src/diagrams/class/renderer.ts` — read fully
- `tests/unit/class/renderer.test.ts` — read fully

## Acceptance Criteria

- Given `kind = 'interface'` classifier and
  `theme.colors.graph.interfaceBackground = '#AABBCC'`, then classifier
  rect has `fill="#AABBCC"`
- Given `kind = 'class'` classifier, then fill is `classBackground` (no regression)
- Given `kind = 'enum'` classifier, then fill is `enumBackground` (no regression)
- All existing class renderer tests pass (regression)

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.

Commit message:
```
fix(class): use interfaceBackground for interface classifier fill

classifierFill() was returning classBackground for interface nodes.
Confirmed against EntityImageClass.java that interfaces have a distinct
background color property.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
