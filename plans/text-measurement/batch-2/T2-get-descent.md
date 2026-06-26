# T2 — Add getDescent to StringMeasurer interface + all implementations

> **Java source is the spec.** Before writing any code, read the relevant Java
> source in `~/git/plantuml`. The upstream code is 15+ years old and encodes
> accumulated knowledge as special cases and subtle tweaks that exist nowhere
> else. The Java code IS the requirement — not a reference. Reproduce every
> edge case faithfully.

## Context

plantuml-js is a TypeScript port of PlantUML. GPL-3.0. Stack: TypeScript + Vite,
Vitest tests (90/90/90 coverage). Porting discipline: port Java faithfully.

This task follows T1 (WIDTH table + height fix). The file has already been
updated — read the current state before editing.

## Task

Add `getDescent(font: FontSpec, text: string): number` to the `StringMeasurer`
interface, then implement it on all three measurer classes.

### Java reference

```java
// StringBounderFixed.java
public double getDescent(UFont font, String text) {
    return font.getSize2D() / 4.5;
}

// StringBounderTeaVM.java — note: text IS used here (fontBoundingBoxDescent)
// but our CanvasMeasurer defers this to a future task; use formula for now.
```

### Changes to make

1. **Extend** `StringMeasurer` interface:
   ```typescript
   getDescent(font: FontSpec, text: string): number;
   ```

2. **Implement** on `FormulaMeasurer`:
   ```typescript
   getDescent(font: FontSpec, _text: string): number {
     return font.size / 4.5;
   }
   ```

3. **Implement** on `CanvasMeasurer` (formula-based for now, text unused):
   ```typescript
   getDescent(font: FontSpec, _text: string): number {
     return font.size / 4.5;
   }
   ```

4. **Implement** on `FixedMeasurer`:
   ```typescript
   getDescent(_font: FontSpec, _text: string): number {
     return this.lineHeight / 4.5;
   }
   ```

## Write-Set

- `src/core/measurer.ts`
- `tests/unit/measurer.test.ts`

## Read-Set

- `src/core/measurer.ts` — read fully; note T1 changes already applied
- `tests/unit/measurer.test.ts` — read fully

## Architecture Decisions

See `plans/text-measurement/decisions.md#d2-getdescent-signature`:
- Include `text: string` parameter for future CanvasMeasurer wiring
- Formula implementations ignore `text` for now

## Acceptance Criteria

- Given `size=14`, `FormulaMeasurer.getDescent` returns `14 / 4.5 ≈ 3.111`
- Given `size=12`, `FormulaMeasurer.getDescent` returns `12 / 4.5 ≈ 2.667`
- Given `size=14`, `CanvasMeasurer.getDescent` returns `14 / 4.5` (same formula)
- Given `lineHeight=16`, `FixedMeasurer.getDescent` returns a positive number
- `const m: StringMeasurer = new FormulaMeasurer()` — calling `m.getDescent`
  compiles without error
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass

## Quality Bar

`npm test && npm run typecheck && npm run lint && npm run build`. Coverage ≥ 90/90/90.
