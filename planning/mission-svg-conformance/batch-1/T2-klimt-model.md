# T2 — klimt model core: UGraphic state chain

## Context
Upstream renderers draw through `UGraphic`, an immutable-state drawing
context: `apply(UChange)` returns a new context with translate/stroke/color
state changed; `draw(UShape)` dispatches the shape to the active backend's
driver with the current `UParam` state. This is the root of the emission
architecture (D2′) — everything in Batches 2–4 hangs off these types.

## Task
Port to `src/core/klimt/` (upstream names verbatim):
- `UShape.ts`, `UChange.ts` — marker interfaces.
- `UTranslate.ts` — dx/dy, `compose`, `getTranslated` per UTranslate.java.
- `UStroke.ts` — thickness + dash per UStroke.java (used by drivers for
  `stroke-width` / `stroke-dasharray`).
- `UParam.ts` — current state: stroke, colors, translate components.
  **Adaptation seam (pre-decided, journal the mapping):** color fields carry
  the existing `Paint` (`src/core/paint.ts`) where Java carries `HColor`
  (`getColor()`/`getBackcolor()` → `stroke`/`fill` Paint). No HColor port.
- `UGraphic.ts` — interface: `apply(change: UChange): UGraphic`,
  `draw(shape: UShape): void`, `getParam(): UParam` (+ translate accessors
  as `AbstractCommonUGraphic` exposes).
- `AbstractCommonUGraphic.ts` — the copy-on-apply state chain, faithful to
  AbstractCommonUGraphic.java (translate composition, stroke/color changes;
  clip may stub-throw if out of D3′ scope — journal).
Color-change `UChange`s: port upstream's `HColors.changeColor`-style change
objects as small classes (e.g. `UChangeColor`/`UChangeBackColor` equivalents
under their upstream names where they exist as classes).

Test at `tests/unit/core/klimt/model.test.ts` (vitest glob: tests/ only).

## Write-set
- `src/core/klimt/{UShape,UChange,UTranslate,UStroke,UParam,UGraphic,AbstractCommonUGraphic}.ts` (+ color-change classes, upstream-named)
- `tests/unit/core/klimt/model.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/UGraphic.java`, `AbstractCommonUGraphic.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/{UParam,UTranslate,UStroke,UShape,UChange}.java`
- `src/core/paint.ts` — the Paint type used at the seam
- `../decisions.md` — D2′, adaptation seams

## Interface contracts (consumed by T3, T4, T5)
`UGraphic` exactly as above; `UParam` getters for stroke/fill Paint, UStroke,
and composed translate (dx, dy). Downstream drivers read state ONLY through
`UParam` — do not add side channels.

## Acceptance criteria
1. Given `ug.apply(new UTranslate(10,5)).apply(new UTranslate(2,0))`, when
   drawing, then the driver sees translate (12,5) and the original `ug`
   still sees (0,0) — immutability.
2. Given a stroke change then a color change, when read via `getParam()`,
   then both are present (state accumulates across applies).
3. Given `draw(shape)`, then the registered driver for that shape's class
   receives (shape, param) — dispatch fidelity to AbstractUGraphic.java.

## Observability / Rollback
N/A — pure library, zero consumers this brief. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90. Names verbatim (PascalCase files match
upstream class names — deviation from repo camelCase convention is
intentional per D2′; journal it once).

## Commit
`feat(T2): port klimt UGraphic model core (state chain + dispatch)`
