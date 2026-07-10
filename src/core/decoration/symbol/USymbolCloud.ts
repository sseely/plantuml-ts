import type { TextBlock } from '../../klimt/shape/TextBlock.js';
import type { UGraphic } from '../../klimt/UGraphic.js';
import type { StringBounder } from '../../klimt/font/StringBounder.js';
import { HorizontalAlignment } from '../../klimt/geom/HorizontalAlignment.js';
import { XDimension2D } from '../../klimt/geom/XDimension2D.js';
import { XPoint2D } from '../../klimt/geom/XPoint2D.js';
import { CoordinateChange } from '../../klimt/geom/CoordinateChange.js';
import { UTranslate } from '../../klimt/UTranslate.js';
import { UPath } from '../../klimt/shape/UPath.js';
import { USymbol, Margin } from './USymbol.js';
import type { SName } from './USymbol.js';
import type { SymbolContext } from './SymbolContext.js';
import { TextBlockUtils } from '../../klimt/shape/TextBlockUtils.js';

/**
 * JavaRandom — a bit-for-bit reimplementation of `java.util.Random`'s
 * 48-bit linear congruential generator (JDK spec: `next(bits)` updates
 * `seed = (seed * 0x5DEECE66D + 0xB) & ((1<<48)-1)` then returns the
 * top `bits` bits; `nextDouble()` combines `next(26)`/`next(27)`).
 *
 * NOT a port of any PlantUML source file — `USymbolCloud.java`
 * constructs a plain `java.util.Random(seed)` (a JDK class with no
 * `net.sourceforge.plantuml` source to port). It is reimplemented here,
 * scoped locally to this file (no other class in this port's write-set
 * needs it), because `USymbolCloud`'s entire bump-layout algorithm is
 * only byte-identical to the real jar if this generator's exact output
 * STREAM matches the JDK's for the same seed — a JS `Math.random()`
 * substitute would produce a structurally-similar but numerically
 * different cloud outline. `seed` arithmetic is done via `bigint`
 * because the 48-bit multiply-then-mask step overflows
 * `Number.MAX_SAFE_INTEGER` in plain `number` arithmetic; the final
 * `next(bits)` result (`bits` is always 26 or 27 here) and the
 * `nextDouble()` combination both fit in `Number.MAX_SAFE_INTEGER`
 * exactly, so only the internal seed state needs `bigint`.
 */
class JavaRandom {
  private static readonly MULTIPLIER = 0x5deece66dn;
  private static readonly ADDEND = 0xbn;
  private static readonly MASK48 = (1n << 48n) - 1n;

  private seed: bigint;

  constructor(seed: number) {
    this.seed = (BigInt(Math.trunc(seed)) ^ JavaRandom.MULTIPLIER) & JavaRandom.MASK48;
  }

  private next(bits: number): number {
    this.seed = (this.seed * JavaRandom.MULTIPLIER + JavaRandom.ADDEND) & JavaRandom.MASK48;
    return Number(this.seed >> BigInt(48 - bits));
  }

  nextDouble(): number {
    const hi = this.next(26);
    const lo = this.next(27);
    return (hi * 134217728 + lo) * 2 ** -53;
  }
}

const NEW = true;
const DEBUG = false;

function rndDouble(rnd: JavaRandom, a: number, b: number): number {
  return rnd.nextDouble() * (b - a) + a;
}

function rndPoint(rnd: JavaRandom, pt: XPoint2D, v: number): XPoint2D {
  const x = pt.getX() + v * rnd.nextDouble();
  const y = pt.getY() + v * rnd.nextDouble();
  return new XPoint2D(x, y);
}

function mvX(pt: XPoint2D, dx: number): XPoint2D {
  return new XPoint2D(pt.getX() + dx, pt.getY());
}

function mvY(pt: XPoint2D, dy: number): XPoint2D {
  return new XPoint2D(pt.getX(), pt.getY() + dy);
}

function bubbleLine(rnd: JavaRandom, points: XPoint2D[], p1: XPoint2D, p2: XPoint2D, bubbleSize: number): void {
  const change = CoordinateChange.create(p1, p2);
  const length = change.getLength();
  let nb = Math.trunc(length / bubbleSize);
  if (nb === 0) {
    bubbleSize = length / 2;
    nb = Math.trunc(length / bubbleSize);
  }
  for (let i = 0; i < nb; i++) {
    points.push(rndPoint(rnd, change.getTrueCoordinate((i * length) / nb, 0), bubbleSize * 0.2));
  }
}

function specialLine(bubbleSize: number, rnd: JavaRandom, points: XPoint2D[], p1: XPoint2D, p2: XPoint2D): void {
  const change = CoordinateChange.create(p1, p2);
  const length = change.getLength();
  const middle = change.getTrueCoordinate(length / 2, -rndDouble(rnd, 1, 1 + Math.min(12, bubbleSize * 0.8)));
  if (DEBUG) {
    /* v8 ignore start -- `DEBUG` (see the module doc comment below) is a
       hardcoded-false constant upstream; this branch is dead code,
       ported bug-for-bug for parity with `USymbolCloud.java`. */
    points.push(middle);
    points.push(p2);
    /* v8 ignore stop */
  } else {
    bubbleLine(rnd, points, p1, middle, bubbleSize);
    bubbleLine(rnd, points, middle, p2, bubbleSize);
  }
}

function simple(
  rnd: JavaRandom,
  points: XPoint2D[],
  bubbleSize: number,
  pointA: XPoint2D,
  pointB: XPoint2D,
  pointC: XPoint2D,
  pointD: XPoint2D,
): void {
  specialLine(bubbleSize, rnd, points, pointA, pointB);
  specialLine(bubbleSize, rnd, points, pointB, pointC);
  specialLine(bubbleSize, rnd, points, pointC, pointD);
  specialLine(bubbleSize, rnd, points, pointD, pointA);
  // #lizard forgives -- 7 params mirrors USymbolCloud.java#simple's own
  // 4-corner-point signature exactly (decoration/symbol/USymbolCloud
  // .java); splitting the corner points into a single object would
  // diverge from upstream's own parameter list.
}

function complex(
  rnd: JavaRandom,
  points: XPoint2D[],
  bubbleSize: number,
  pointA: XPoint2D,
  pointB: XPoint2D,
  pointC: XPoint2D,
  pointD: XPoint2D,
): void {
  const margin2 = 7;
  specialLine(bubbleSize, rnd, points, mvX(pointA, margin2), mvX(pointB, -margin2));
  points.push(mvY(pointB, margin2));
  specialLine(bubbleSize, rnd, points, mvY(pointB, margin2), mvY(pointC, -margin2));
  points.push(mvX(pointC, -margin2));
  specialLine(bubbleSize, rnd, points, mvX(pointC, -margin2), mvX(pointD, margin2));
  points.push(mvY(pointD, -margin2));
  specialLine(bubbleSize, rnd, points, mvY(pointD, -margin2), mvY(pointA, margin2));
  points.push(mvX(pointA, margin2));
  // #lizard forgives -- 7 params mirrors USymbolCloud.java#complex's own
  // 4-corner-point signature exactly (decoration/symbol/USymbolCloud
  // .java); splitting the corner points into a single object would
  // diverge from upstream's own parameter list.
}

function addCurve(rnd: JavaRandom, path: UPath, p1: XPoint2D, p2: XPoint2D): void {
  const change = CoordinateChange.create(p1, p2);
  const length = change.getLength();
  const coef = rndDouble(rnd, 0.25, 0.35);
  const middle = change.getTrueCoordinate(length * coef, -length * rndDouble(rnd, 0.4, 0.55));
  const middle2 = change.getTrueCoordinate(length * (1 - coef), -length * rndDouble(rnd, 0.4, 0.55));
  path.cubicTo(middle, middle2, p2);
}

function getSpecificFrontierForCloudNew(width: number, height: number): UPath {
  const rnd = new JavaRandom(Math.trunc(width) + 7919 * Math.trunc(height));
  const points: XPoint2D[] = [];

  let bubbleSize = 11;
  if (Math.max(width, height) / bubbleSize > 16) {
    bubbleSize = Math.max(width, height) / 16;
  }

  const margin1 = 8;

  const pointA = new XPoint2D(margin1, margin1);
  const pointB = new XPoint2D(width - margin1, margin1);
  const pointC = new XPoint2D(width - margin1, height - margin1);
  const pointD = new XPoint2D(margin1, height - margin1);

  if (width > 100 && height > 100) {
    complex(rnd, points, bubbleSize, pointA, pointB, pointC, pointD);
  } else {
    simple(rnd, points, bubbleSize, pointA, pointB, pointC, pointD);
  }

  points.push(points[0]!);

  const result = UPath.none();
  result.moveTo(points[0]!);
  for (let i = 0; i < points.length - 1; i++) {
    if (DEBUG) {
      /* v8 ignore start -- see `specialLine`'s identical `DEBUG` note
         above; dead code under a hardcoded-false constant, ported
         bug-for-bug. */
      result.lineTo(points[i + 1]!);
      /* v8 ignore stop */
    } else {
      addCurve(rnd, result, points[i]!, points[i + 1]!);
    }
  }
  return result;
}

/**
 * `getSpecificFrontierForCloud`'s pre-`NEW` legacy body — a fixed,
 * non-random 10px-per-bump loop over each of the four sides in turn.
 * `NEW` (see the module doc comment below) is a hardcoded-`true`
 * constant upstream that is never reassigned, so this function is
 * dead code, ported bug-for-bug rather than silently dropped.
 */
/* v8 ignore start -- unreachable: `NEW` is always `true` (see
   `getSpecificFrontierForCloud` below), matching
   `USymbolCloud.java`'s own hardcoded `NEW` flag. */
function getSpecificFrontierForCloudLegacy(width: number, height: number): UPath {
  const path = UPath.none();
  path.moveTo(0, 10);
  let x = 0;
  for (let i = 0; i < width - 9; i += 10) {
    path.cubicTo(i, -3 + 10, 2 + i, -5 + 10, 5 + i, -5 + 10);
    path.cubicTo(8 + i, -5 + 10, 10 + i, -3 + 10, 10 + i, 10);
    x = i + 10;
  }
  let y = 0;
  for (let j = 10; j < height - 9; j += 10) {
    path.cubicTo(x + 3, j, x + 5, 2 + j, x + 5, 5 + j);
    path.cubicTo(x + 5, 8 + j, x + 3, 10 + j, x, 10 + j);
    y = j + 10;
  }
  for (let i = 0; i < width - 9; i += 10) {
    path.cubicTo(x - i, y + 3, x - 3 - i, y + 5, x - 5 - i, y + 5);
    path.cubicTo(x - 8 - i, y + 5, x - 10 - i, y + 3, x - 10 - i, y);
  }
  for (let j = 0; j < height - 9 - 10; j += 10) {
    path.cubicTo(-3, y - j, -5, y - 2 - j, -5, y - 5 - j);
    path.cubicTo(-5, y - 8 - j, -3, y - 10 - j, 0, y - 10 - j);
  }
  return path;
}
/* v8 ignore stop */

function getSpecificFrontierForCloud(width: number, height: number): UPath {
  /* v8 ignore start -- unreachable: `NEW` is always `true`, so the
     `else` branch below (the pre-`NEW` legacy path) never executes;
     the whole `if`/`else` is excluded from branch coverage rather than
     only the dead arm, since v8's coverage remapping attributes the
     branch decision to the full statement span. */
  if (NEW) {
    return getSpecificFrontierForCloudNew(width, height);
  } else {
    return getSpecificFrontierForCloudLegacy(width, height);
  }
  /* v8 ignore stop */
}

function drawCloud(ug: UGraphic, width: number, height: number, shadowing: number): void {
  const shape = getSpecificFrontierForCloud(width, height);
  shape.setDeltaShadow(shadowing);
  ug.apply(UTranslate.dy(0)).draw(shape);
}

function getMargin(): Margin {
  /* v8 ignore start -- unreachable: `NEW` is always `true`, matching
     `USymbolCloud.java`'s own hardcoded `NEW` flag, so the `else`
     branch below never executes; the whole `if`/`else` is excluded
     from branch coverage rather than only the dead arm (see the
     identical note in `getSpecificFrontierForCloud` above). */
  if (NEW) {
    return new Margin(15, 15, 15, 15);
  } else {
    return new Margin(10, 10, 10, 10);
  }
  /* v8 ignore stop */
}

/**
 * USymbolCloud — a "bumpy" cloud outline generated at draw time from a
 * seeded-random bezier-curve loop around the box's four sides (a
 * deterministic per-(width,height) `java.util.Random` seed, NOT a
 * fixed path — see `JavaRandom`'s doc comment above for why this port
 * needed its own JDK-`Random`-compatible generator, and
 * `getSpecificFrontierForCloudNew`'s `width > 100 && height > 100`
 * check for why larger clouds switch from the 4-segment `simple` bump
 * layout to the 8-segment-with-corner-anchors `complex` one).
 *
 * Upstream: decoration/symbol/USymbolCloud.java (233 ln).
 */
export class USymbolCloud extends USymbol {
  getSNames(): readonly SName[] {
    return ['cloud'];
  }

  asSmall(
    _name: TextBlock,
    label: TextBlock,
    stereotype: TextBlock,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    function calculateDimension(stringBounder: StringBounder): XDimension2D {
      const dimLabel = label.calculateDimension(stringBounder);
      const dimStereo = stereotype.calculateDimension(stringBounder);
      return getMargin().addDimension(dimStereo.mergeTB(dimLabel));
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = symbolContext.apply(ug);
        drawCloud(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
        const margin = getMargin();
        const tb = TextBlockUtils.mergeTB(stereotype, label, HorizontalAlignment.CENTER);
        tb.drawU(ug.apply(new UTranslate(margin.getX1(), margin.getY1())));
      },
    };
    // #lizard forgives -- the `drawU` closure faithfully ports
    // `USymbolCloud.java#asSmall`'s anonymous `TextBlock` body verbatim
    // (dimension recompute, symbolContext.apply, drawCloud, margin
    // translate) -- upstream deliberately omits `UGraphicStencil.create`
    // here (unlike every other `asSmall` in this family): `drawCloud`'s
    // bump path is generated FROM `dim`, so wrapping `ug` in a stencil
    // clipped to that same `dim` would be a no-op, and upstream's own
    // source has no such call in this one method.
  }

  asBig(
    title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    stereotype: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
    _stereoAlignment: HorizontalAlignment,
  ): TextBlock {
    function calculateDimension(_stringBounder: StringBounder): XDimension2D {
      return new XDimension2D(width, height);
    }

    return {
      calculateDimension,
      drawU(ug: UGraphic): void {
        const dim = calculateDimension(ug.getStringBounder());
        ug = symbolContext.apply(ug);
        drawCloud(ug, dim.getWidth(), dim.getHeight(), symbolContext.getDeltaShadow());
        const dimStereo = stereotype.calculateDimension(ug.getStringBounder());
        const dimStereoWidth = dimStereo.getWidth();
        const dimStereoHeight = dimStereo.getHeight();
        const posStereo = (width - dimStereoWidth) / 2;
        stereotype.drawU(ug.apply(new UTranslate(posStereo, 13)));
        const dimTitle = title.calculateDimension(ug.getStringBounder());
        const dimTitleWidth = dimTitle.getWidth();
        const posTitle = (width - dimTitleWidth) / 2;
        title.drawU(ug.apply(new UTranslate(posTitle, 13 + dimStereoHeight)));
      },
      // #lizard forgives -- 7 params mirrors USymbol#asBig's abstract
      // signature (decoration/symbol/USymbol.java) exactly; cannot be
      // reduced without breaking the interface contract every USymbol*
      // subclass implements.
    };
  }
}
