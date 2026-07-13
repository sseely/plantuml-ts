# T1 — Port MinMax / MinMaxMutable / UGraphicNo / LimitFinder / getMinMax

## Context

plantuml-ts (TS port of PlantUML; vitest in tests/unit/, strict tsc). The
klimt layer (src/core/klimt/) already has: UGraphic interface
(UGraphic.ts:50-56 — apply/draw/getParam/getTranslate/getStringBounder),
AbstractCommonUGraphic (driver registry, clone-on-apply), UGraphicSvg, 7
SVG drivers, shape classes (URectangle, UEllipse, ULine, UPolygon, UPath
(with its own local MinMaxState accumulator), DotPath, UText, UEmpty…),
and a POINT-COLLECTOR precedent: Footprint.MyUGraphic
(src/core/svek/image/Footprint.ts:50-127). TextBlockUtils.getMinMax is a
throwing stub (src/core/klimt/shape/TextBlockUtils.ts:116-121). Port the
real machinery from ~/git/plantuml (grep the whole net/ tree). Faithful
port: preserve names, preserve quirks, no cleanups.

## Task

1. `src/core/klimt/geom/MinMax.ts` — port
   `net/sourceforge/plantuml/klimt/geom/MinMax.java`: immutable; private
   canonical ctor arg order (minX,minY,maxX,maxY); NaN → throw;
   `getEmpty(initToZero)` (true → 0,0,0,0; false → ±MAX_VALUE);
   `addPoint(x,y)`; `addMinMax`; `translate(UTranslate)`; `enlarge(dx,dy)`
   (grows MAX corner only); `fromMutable/fromMax/fromDim`;
   `getWidth/getHeight/getDimension/getMinX/getMinY/getMaxX/getMaxY`;
   `isInfinity` semantics via MinMaxMutable. Port `MinMaxMutable` too
   (same file or sibling, mirror upstream file layout).
2. `src/core/klimt/drawing/UGraphicNo.ts` — abstract no-op base: holds
   stringBounder + translate; empty startUrl/startGroup/etc. equivalents
   (match OUR UGraphic interface surface — where upstream methods don't
   exist in our interface, omit and document); protected getTranslate().
3. `src/core/klimt/drawing/LimitFinder.ts` — extends UGraphicNo.
   `create(stringBounder, initToZero)`. Clip-aware
   `addPoint` (only if inside stored UClip if our klimt has UClip — check;
   if no UClip exists in the port, document the omission, don't invent).
   `apply(UChange)`: UTranslate composes; whitelist per upstream (accept
   the changes OUR klimt has: UTranslate, UBackground, UForeground,
   UStroke, …); anything unknown throws. `draw(shape)` per-shape math
   EXACTLY (LimitFinder.java:106-225):
   - URectangle: addPoint(x−1, y−1); addPoint(x+w−1+shadow*2, y+h−1+shadow*2)
   - ULine: (x,y) and (x+dx, y+dy)
   - UPolygon: minX−10 / maxX+10 (HACK_X_FOR_POLYGON), minY/maxY unpadded
   - UPath: shape's own min/max offsets
   - DotPath: via its MinMax (wire DotPath.getMinMax — currently dropped
     at DotPath.ts:118; implement it now using the real MinMax, mirroring
     upstream DotPath.getMinMax)
   - UText: dim = stringBounder.calculateDimension(font, text);
     y −= dim.height − 1.5; add all four corners
   - UEllipse/UImage-equivalents: (x,y) + (x+w−1+shadow*2, y+h−1+shadow*2)
     / (x+w−1, y+h−1)
   - UEmpty: full box; TextBlock: recurse tb.drawU(this);
     UCenteredCharacter: no-op (upstream "To be done"); UComment: no-op;
     unknown: throw.
4. `TextBlockUtils.getMinMax(tb, stringBounder, initToZero)` — replace the
   throwing stub with the 3-line real impl (create LimitFinder, drawU,
   getMinMax; infinity → getEmpty(true)).
5. Wire the shape-side getMinMax gaps ONLY where LimitFinder needs them
   (DotPath). Leave URectangle.getMinMax/UPolygon.getMinMax dropped unless
   LimitFinder's math requires them (it reads UPolygon.getMinX/getMaxX —
   check those exist; add narrowly if missing, upstream-faithful).
6. Tests (tests/unit/klimt-limitfinder.test.ts): every per-shape rule
   above pinned with exact numbers (including the −1/+shadow*2, the
   polygon ±10, the text −1.5, the initToZero duality, translate
   composition, unknown-shape throw). Test getMinMax on a small TextBlock
   tree via the existing driverBounder/measurer seams (FixedMeasurer).

NO callers change in this task — the stub's replacement must be
behavior-invisible (nothing calls it successfully today).

## Read-set

- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/geom/MinMax.java`, `MinMaxMutable.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/drawing/{LimitFinder,UGraphicNo,TextLimitFinder}.java`
- `~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/shape/TextBlockUtils.java:138-142`
- `src/core/klimt/{UGraphic.ts,UChange.ts,AbstractCommonUGraphic.ts}`, `src/core/svek/image/Footprint.ts:50-127`
- `src/core/klimt/shape/{TextBlockUtils.ts,UPath.ts,DotPath.ts,UPolygon.ts,URectangle.ts}`
- Project memory: complexity-hook playbook (no raw double-quotes in src,
  string-built regexes for <>{}, #lizard forgives near fn end, 500-line cap,
  tests in tests/unit/).

## Interface contract (consumed by T3/T5)

```ts
MinMax.getEmpty(initToZero: boolean): MinMax; addPoint/translate/enlarge/getDimension/…
LimitFinder.create(sb: StringBounder, initToZero: boolean): LimitFinder; getMinMax(): MinMax;
getMinMax(tb: UDrawable, sb: StringBounder, initToZero: boolean): MinMax;  // TextBlockUtils
```

## Acceptance criteria

- Given a URectangle 100×50 with deltaShadow 0 drawn at translate (10,10), minmax = (9,9)→(109,59) exactly (the −1 quirk).
- Given a UText at (0,20) whose measured dim is 40×14, minmax = (0, 20−14+1.5=7.5)→(40, 21.5).
- Given initToZero=true and nothing drawn, getMinMax = (0,0,0,0); given false and nothing drawn, getMinMax collapses to getEmpty(true).
- Given the full existing suite, ZERO behavior change (7,837 tests still pass untouched).
- New-module coverage ≥90/90/90; every symbol carries @see to its Java origin.

## Quality bar: gates green; DOT gate at the CURRENT baseline (T2 may land first — read the journal for which baseline applies).
## Observability: N/A. Rollback: Reversible.
## Commit: `feat(T1): port MinMax/LimitFinder/UGraphicNo ink-extent machinery`
