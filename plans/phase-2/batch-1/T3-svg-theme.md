# T3 — SVG Primitives + Theme Graph Colors

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

Phase 2 diagram types need SVG shapes not used in Phase 1: ellipses (actors,
use case ovals), diamonds (fork/join/choice nodes in state diagrams), and a
group wrapper for compound SVG elements. The theme also needs color fields for
class boxes, interface backgrounds, and actor strokes.

Stack: TypeScript 5 strict, Vitest, ESM imports.

## Task

Add `ellipse()`, `diamond()`, and `group()` to `src/core/svg.ts`. Add graph
diagram color fields to the `Theme` interface and both built-in themes in
`src/core/theme.ts`. Update unit tests for both files.

## Write-Set

- `src/core/svg.ts` — add ellipse, diamond, group functions
- `src/core/theme.ts` — add graph color fields to interface + both themes
- `tests/unit/svg.test.ts` — extend with new primitive tests
- `tests/unit/theme.test.ts` — extend with new field coverage

## Read-Set

- `src/core/svg.ts` — full file (existing primitive signatures to match)
- `src/core/theme.ts` — full file (existing interface + themes to extend)
- `tests/unit/svg.test.ts` — full file (existing tests)
- `tests/unit/theme.test.ts` — full file (existing tests)

## Interface Contracts

### New SVG primitives

```typescript
// Add to src/core/svg.ts

/** SVG <ellipse> element */
export function ellipse(
  cx: number, cy: number,
  rx: number, ry: number,
  attrs?: SvgAttrs,
): string;

/**
 * Diamond shape as <polygon> — 4 points at top/bottom/left/right of
 * a bounding box centred at (cx, cy) with half-size `size`.
 */
export function diamond(
  cx: number, cy: number,
  size: number,
  attrs?: SvgAttrs,
): string;

/** Wraps children in a <g> element with optional transform */
export function group(children: string, attrs?: SvgAttrs): string;
```

### New theme color fields

```typescript
// Add to Theme.colors in src/core/theme.ts
graph: {
  classBackground: string;       // class box fill
  interfaceBackground: string;   // interface box fill
  enumBackground: string;        // enum box fill
  actorStroke: string;           // actor/stick-figure stroke
  packageBackground: string;     // package/namespace fill
  packageBorder: string;         // package/namespace border
  edgeLabel: string;             // relationship label text
};
```

Default theme values (light):
- `classBackground: '#FEFECE'`
- `interfaceBackground: '#B4D7ED'`
- `enumBackground: '#FEFECE'`
- `actorStroke: '#181818'`
- `packageBackground: 'none'`
- `packageBorder: '#999999'`
- `edgeLabel: '#444444'`

Dark theme: inherit from defaultTheme.colors.graph (no visual override needed
for Phase 2; can be refined later).

## Acceptance Criteria

- Given `ellipse(50, 50, 30, 20, { fill: '#fff' })`, then output contains
  `<ellipse cx="50" cy="50" rx="30" ry="20" fill="#fff"/>`
- Given `diamond(40, 40, 10, { fill: '#000' })`, then output is a `<polygon>`
  with 4 points and the correct centre/size
- Given `group('<rect/>',  { transform: 'translate(10,20)' })`, then output
  wraps the rect in `<g transform="translate(10,20)">...</g>`
- Given `resolveTheme('dark')`, then `result.colors.graph.classBackground`
  is a defined non-empty string
- Given a `Partial<Theme>` with `colors.graph.classBackground` set, then
  `resolveTheme()` deep-merges it correctly

## Quality Bar

`pnpm typecheck && pnpm lint && pnpm test` — zero errors, new fields covered
by tests, `resolveTheme` branch coverage maintained.
