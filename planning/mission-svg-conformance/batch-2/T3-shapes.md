# T3 — Primitive shapes (UShape data classes)

## Context
Upstream shapes are dumb data holders the drivers serialize: a `UPath` is a
recorded op list (moveTo/lineTo/cubicTo/…), a `URectangle` is w/h/rounding,
etc. The render-fidelity mission already ports *geometry that draws through
these semantics* (usymbol-shapes emits UPath-shaped cubics) — this task
gives those semantics their real upstream home.

## Task
Port to `src/core/klimt/shape/` (names verbatim, one class per file):
- `UPath.ts` (UPath.java, 250 ln): op list — `moveTo`, `lineTo`, `cubicTo`,
  `arcTo` (if present), `closePath`; `deltaShadow`; iteration order preserved.
- `UEllipse.ts` (111), `ULine.ts` (100), `URectangle.ts` (217 — incl.
  `.rounded(r)` / rx/ry semantics), `UPolygon.ts` (183 — points list +
  convex-hull helpers only if drivers need them; defer the rest with a
  journal note), `UText.ts` (98 — text + FontConfiguration reference; port
  the minimal font-config surface the SVG text driver reads: family, size,
  style flags, color — journal the seam).
- `UComment.ts`, `UGroup.ts` (tiny: comment text / group-type map — these
  become `<!--…-->` and `<g …>` in Brief 2's decorated output).
- `DotPath.ts` — the svek edge spline shape; port the point/bezier-list
  surface `DriverDotPathSvg` serializes (defer label-position extras with a
  journal note if unreferenced by the driver).

All implement/extend `UShape` (T2). Where a Java shape references AWT
geometry (`XPoint2D`, `XDimension2D`), use plain `{x,y}`/`{width,height}`
object types locally — journal once.

## Write-set
- `src/core/klimt/shape/{UPath,UEllipse,ULine,URectangle,UPolygon,UText,UComment,UGroup,DotPath}.ts`
- `tests/unit/core/klimt/shapes.test.ts`

## Read-set
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/UPath.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/shape/{UEllipse,ULine,URectangle,UPolygon,UText,UComment,UGroup,DotPath}.java`
- `src/core/klimt/{UShape,UChange}.ts` — T2 interfaces
- `../decisions.md` — D2′, D3′

## Interface contracts (consumed by T4/T5 drivers)
Each shape exposes exactly the getters its `Driver*Svg.java` reads (op list,
w/h/rx/ry, points, text+font). Keep upstream method names.

## Acceptance criteria
1. Given `moveTo(0,10); cubicTo(0,0,w/2,0,w/2,0); …; closePath()`, when the
   op list is read, then ops and operand order match UPath.java exactly.
2. Given `URectangle.build(15,10).rounded(5)`, then w=15, h=10, rx=ry per
   URectangle.java's rounding semantics.
3. Given a UPolygon of N points, then point iteration order is insertion
   order (drivers depend on it).
4. Given deltaShadow set on UPath/URectangle, then it round-trips (drivers
   emit shadow filters from it — Brief 2 uses this).

## Observability / Rollback
N/A — pure data classes. / Reversible.

## Quality bar
Standard gates green; ≥90/90/90. Files are small; the hook should be quiet.

## Commit
`feat(T3): port klimt primitive shapes (UPath/UEllipse/…/DotPath)`
