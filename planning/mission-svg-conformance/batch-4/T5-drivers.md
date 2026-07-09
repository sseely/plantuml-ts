# T5 — Per-primitive drivers + UGraphicSvg

## Context
Each `Driver*Svg.java` (~50–185 ln) turns one shape class + the current
`UParam` state (translate, stroke, fill/stroke paint) into SvgGraphics
element calls. `UGraphicSvg.java` (194 ln) registers the driver map and owns
document finalization. This completes the emitter.

## Task
Port to `src/core/klimt/drawing/svg/` (D3′ scope):
- `driver-rectangle-svg.ts` (DriverRectangleSvg.java, 113), `driver-ellipse-
  svg.ts` (97), `driver-line-svg.ts` (86), `driver-polygon-svg.ts` (70),
  `driver-path-svg.ts` (80), `driver-dot-path-svg.ts` (56),
  `driver-text-svg.ts` (185 — the font-attr emission; the FontConfiguration
  seam from T3 feeds it).
- Faithful per-driver behavior: how each applies translate to coords,
  maps UStroke → `stroke-width`/`stroke-dasharray`, resolves fill/stroke
  Paint (via `paintToSvg` at the seam — gradient fills register defs through
  SvgGraphics, per T4's id policy), and handles deltaShadow.
- `u-graphic-svg.ts` (UGraphicSvg.java): driver registration keyed by shape
  class, `UComment`/`UGroup` dispatch into SvgGraphics, document
  finalization → SVG string.
- **Deferred (D3′):** image/pixel/centered-char/sprite drivers — throwing
  stubs naming D3′, each with a test asserting the throw (coverage).

## Write-set
- `src/core/klimt/drawing/svg/driver-{rectangle,ellipse,line,polygon,path,dot-path,text}-svg.ts`
- `src/core/klimt/drawing/svg/u-graphic-svg.ts` (+ deferred stubs file)
- `tests/unit/core/klimt/drivers.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/svg/Driver*.java` (the seven ported ones — read each fully)
- `.../svg/UGraphicSvg.java`
- T2/T3/T4 interfaces (`src/core/klimt/**`)
- `../decisions.md` — D3′, D4′, Paint seam

## Interface contracts (consumed by T6, Brief 2)
```ts
// The renderer-facing surface Brief 2 draws through:
new UGraphicSvg(dim, diagramType) → UGraphic     // T2 interface
  .apply(...)  .draw(shape)                       // drivers fire
  .getSvgString(): string                         // finalized document
```
Exact construction signature may follow UGraphicSvg.java — keep upstream
shape; journal deviations.

## Acceptance criteria
1. Given `draw(URectangle 15×10 rounded 5)` under translate (20,5) with
   stroke 1.5 + fill Paint, then the emitted `<rect>` attrs (x,y,width,
   height,rx,ry,fill,style/stroke form, ordering) match
   DriverRectangleSvg.java's emission against SvgGraphics.
2. Given each of the seven shapes, then per-driver output matches its
   Driver*Svg.java (spot-verified against cached jar SVG fragments).
3. Given a gradient Paint fill, then a `<linearGradient>` def is registered
   once and referenced via `url(#…)` per T4's id policy.
4. Given a deferred shape, then it throws naming D3′ (test asserts).

## Observability / Rollback
N/A. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90; hook-safe (drivers are small).

## Commit
`feat(T5): port svg drivers + UGraphicSvg assembly`
