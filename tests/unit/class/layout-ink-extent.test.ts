/**
 * `layout-ink-extent.ts#computeClassDocumentDims` — G2 N5.
 *
 * Jar-verified formula (see the module's own doc comment + `plans/
 * g2-class-svg/ledger.md` N5 for the full derivation, including the
 * debug-instrumented local oracle build trace): ink-extent walk +
 * `.delta(15,15)` + `CucaDiagram` margin (0,5,5,0) + `SvgGraphics
 * #ensureVisible`'s truncating `(int)(v+1)`. The classifier-box ink rule is
 * NOT the classic symmetric `-1`-inset `URectangle` rule — `EntityImageClass`
 * ALSO draws an invisible full-box `UEmpty` reservation that dominates the
 * rect's own max corner by 1px (see `addRectInk`'s own doc comment).
 */
import { describe, it, expect } from 'vitest';
import { computeClassDocumentDims, computeClassInkShift } from '../../../src/diagrams/class/layout-ink-extent.js';
import type { ClassifierGeo, EdgeGeo, NamespaceGeo } from '../../../src/diagrams/class/layout.js';
import type { NoteGeo } from '../../../src/diagrams/class/note-layout.js';

function makeClassifierGeo(overrides?: Partial<ClassifierGeo>): ClassifierGeo {
  return {
    id: 'C',
    kind: 'class',
    x: 0,
    y: 0,
    width: 59.2125,
    height: 48,
    dividerYs: [],
    rows: [],
    ...overrides,
  };
}

describe('computeClassDocumentDims', () => {
  it('returns {width:0, height:0} for an empty diagram (no ink at all)', () => {
    const dims = computeClassDocumentDims([], [], [], []);
    expect(dims).toEqual({ width: 0, height: 0 });
  });

  it('reproduces jar-verified dims for two side-by-side classifiers, no edges (jalexi-21-xoje231)', () => {
    // Jar: `<rect x="7" y="7" width="59.2125" height="48"/>` twice, second at
    // x="101" -- raw (pre-render-anchor) positions are x=0 and x=94 (this
    // port's own +7,+7 render-time anchor is translation-invariant to the
    // dimension math). Jar's real output: width="175px" height="70px".
    const classifiers = [
      makeClassifierGeo({ id: 'foo1', x: 0, y: 0 }),
      makeClassifierGeo({ id: 'foo2', x: 94, y: 0 }),
    ];
    const dims = computeClassDocumentDims(classifiers, [], [], []);
    expect(dims).toEqual({ width: 175, height: 70 });
  });

  it('reproduces jar-verified dims for a vertically stacked pair with a straight edge (bipudo-23-xavu432, single edge slice)', () => {
    // Jar's real output for the full 4-classifier fixture is 155x178; this
    // is the isolated 2-classifier vertical slice (A0 above B0) with no
    // horizontal siblings, jar-verified independently via the same
    // debug-instrumented-oracle method (ledger.md N5).
    const classifiers = [
      makeClassifierGeo({ id: 'A0', x: 0, y: 0, width: 49.15 }),
      makeClassifierGeo({ id: 'B0', x: 0, y: 108, width: 49.15 }),
    ];
    const dims = computeClassDocumentDims(classifiers, [], [], []);
    // Nominal span: x in [0, 49.15], y in [0, 156]. Ink: min corner -1 on
    // each axis, max corner un-inset (the `UEmpty`-reservation dominance) --
    // width = (49.15+1)+15+5+1 floored = 71.15 -> 71; height =
    // (156+1)+15+5+1 floored = 178.
    expect(dims.height).toBe(178);
    expect(dims.width).toBe(71);
  });

  it('a namespace cluster contributes its own bbox with NO `-1` inset (UPath ink rule)', () => {
    const namespaces: NamespaceGeo[] = [
      { id: 'ns', x: 6, y: 6, width: 117.15, height: 113, label: 'p1', wtitle: 25, htitle: 20, baselineOffset: 12.8889 },
    ];
    const dims = computeClassDocumentDims([], namespaces, [], []);
    // Ink span: x in [6, 123.15], y in [6, 119] (no -1 quirk for UPath).
    // width = (117.15)+15+5+1 floored = 138.15 -> 138;
    // height = (113)+15+5+1 floored = 134.
    expect(dims.width).toBe(138);
    expect(dims.height).toBe(134);
  });

  it('edge points widen the box beyond the classifiers alone', () => {
    const classifiers = [makeClassifierGeo({ x: 0, y: 0, width: 40, height: 40 })];
    const edges: EdgeGeo[] = [
      {
        id: 'e0',
        points: [
          { x: 20, y: 40 },
          { x: 20, y: 100 },
          { x: 20, y: 150 },
          { x: 20, y: 200 },
        ],
        targetDecor: 'none',
        sourceDecor: 'none',
        dashed: false,
        from: 'A',
        to: 'B',
      },
    ];
    const withoutEdge = computeClassDocumentDims(classifiers, [], [], []);
    const withEdge = computeClassDocumentDims(classifiers, [], edges, []);
    expect(withEdge.height).toBeGreaterThan(withoutEdge.height);
  });

  it('an edge label point also widens the ink box', () => {
    const edges: EdgeGeo[] = [
      {
        id: 'e0',
        points: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
        ],
        label: { text: 'far', x: 900, y: 5 },
        targetDecor: 'none',
        sourceDecor: 'none',
        dashed: false,
        from: 'A',
        to: 'B',
      },
    ];
    const dims = computeClassDocumentDims([], [], edges, []);
    // maxX dominated by the label (900), not the edge's own points (500).
    expect(dims.width).toBeGreaterThan(900);
  });

  it('notes contribute PLAIN ink (no x-hack) -- Opale.java draws a UPath, not a UPolygon (G2/N14)', () => {
    // G2/N14 CORRECTION: `Opale.java#drawU` draws its outline via `UPath`
    // (every `getPolygonNormal`/`Left`/`Right`/`Up`/`Down` branch), never a
    // `UPolygon` -- so `LimitFinder` dispatches to the PLAIN bbox rule, no
    // `HACK_X_FOR_POLYGON` x-padding. Jar-verified wrong by exactly 10px
    // against `fezugi-39-fujo327` before this fix (see
    // layout-ink-extent.ts's own doc comment for the full derivation).
    const notes: NoteGeo[] = [
      { id: 'n0', x: 0, y: 0, width: 50, height: 30, lines: ['hi'], lineWidths: [], connector: [] },
    ];
    const dims = computeClassDocumentDims([], [], [], notes);
    // Ink span (unpadded): [0,50] x [0,30].
    // width = 50+15+5+1 floored = 71; height = 30+15+5+1 floored = 51.
    expect(dims.width).toBe(71);
    expect(dims.height).toBe(51);
  });

  it('G2/N13: a dropped member-tip note contributes NO ink at all (jar draws nothing for it)', () => {
    const notes: NoteGeo[] = [
      { id: 'n0', x: 0, y: 0, width: 500, height: 500, lines: ['error'], lineWidths: [], connector: [], dropped: true },
    ];
    const dims = computeClassDocumentDims([], [], [], notes);
    expect(dims.width).toBe(0);
    expect(dims.height).toBe(0);
  });
});

// G2 N32: `class Foo<T>`'s generic type-parameter tag box -- drawn OUTSIDE
// the classifier's own rect (above-right, `class-stereotype.ts
// #buildGenericTagGeo`'s doc comment), contributing its OWN ink point via
// the "classic" symmetric -1/+1 URectangle rule (`addClassicRectInk`,
// DIFFERENT from the classifier box's own asymmetric `addRectInk` rule --
// see that function's own doc comment). Jar-verified `caboco-62-jula911`:
// canvas width 234 (both "Foo<Param>" and "Bar<P, Q>" side by side).
describe('computeClassDocumentDims — generic tag box (G2 N32)', () => {
  it('the tag\'s 3px top/right overhang widens/heightens the canvas -- ' +
    'jar-verified caboco-62-jula911', () => {
    const classifiers = [
      makeClassifierGeo({
        id: 'Foo', x: 7, y: 10, width: 95.475, height: 48,
        genericTag: {
          text: 'Param', rectX: 61.15, rectY: -3, rectWidth: 37.325, rectHeight: 14,
          textX: 62.15, textY: 7.3333, textWidth: 35.325, fontFamily: 'sans-serif',
        },
      }),
      makeClassifierGeo({
        id: 'Bar', x: 137.53125, y: 10, width: 78.4125, height: 48,
        genericTag: {
          text: 'P, Q', rectX: 58.7875, rectY: -3, rectWidth: 22.625, rectHeight: 14,
          textX: 59.7875, textY: 7.3333, textWidth: 20.625, fontFamily: 'sans-serif',
        },
      }),
    ];
    const dims = computeClassDocumentDims(classifiers, [], [], []);
    expect(dims).toEqual({ width: 234, height: 73 });
  });

  it('without any genericTag, the SAME classifiers produce a narrower canvas ' +
    '(regression guard -- confirms the tag genuinely widens it)', () => {
    const classifiers = [
      makeClassifierGeo({ id: 'Foo', x: 7, y: 7, width: 95.475, height: 48 }),
      makeClassifierGeo({ id: 'Bar', x: 137.53125, y: 7, width: 78.4125, height: 48 }),
    ];
    const dims = computeClassDocumentDims(classifiers, [], [], []);
    expect(dims.width).toBeLessThan(234);
  });
});

describe('computeClassInkShift', () => {
  // G2 N11: `SvekResult#calculateDimension`'s own `moveDelta(6 - minMax
  // .getMinX(), 6 - minMax.getMinY())` side effect (svek/SvekResult.java:
  // 133) -- the uniform translate this port's class layout never applied
  // to already-laid-out positions (see `layout-ink-extent.ts`'s own doc
  // comment for the full derivation and jar citation).

  it('returns {dx:0, dy:0} for an empty diagram (no ink at all)', () => {
    const shift = computeClassInkShift([], [], [], []);
    expect(shift).toEqual({ dx: 0, dy: 0 });
  });

  it('reproduces the jar-verified (+7,+7) shift for two side-by-side classifiers, no edges (jalexi-21-xoje231)', () => {
    // Raw (pre-shift) positions: foo1 at (0,0), foo2 at (94,0) -- a bare
    // rect's own ink-min corner is `(x-1, y-1)` (addRectInk), so the
    // diagram's raw ink minX/minY = (-1,-1); jar-verified real output:
    // `<rect x="7" y="7".../><rect x="101" y="7".../>` -- EXACTLY `(+7,+7)`
    // on BOTH boxes (uniform, not per-element), matching `6 - (-1) = 7`.
    const classifiers = [
      makeClassifierGeo({ id: 'foo1', x: 0, y: 0 }),
      makeClassifierGeo({ id: 'foo2', x: 94, y: 0 }),
    ];
    const shift = computeClassInkShift(classifiers, [], [], []);
    expect(shift).toEqual({ dx: 7, dy: 7 });
  });

  it('a namespace-only diagram shifts by 6 minus its own raw (un-inset) corner (UPath ink rule)', () => {
    // UPath ink has NO -1 inset (addPlainInk), so the raw ink-min corner
    // IS the namespace's own (x,y) -- shift = (6 - x, 6 - y) directly.
    const namespaces: NamespaceGeo[] = [
      { id: 'ns', x: 3, y: 2, width: 100, height: 80, label: 'p1', wtitle: 25, htitle: 20, baselineOffset: 12.8889 },
    ];
    const shift = computeClassInkShift([], namespaces, [], []);
    expect(shift).toEqual({ dx: 3, dy: 4 });
  });

  it('an edge point below every classifier dominates the min-corner walk on that axis', () => {
    const classifiers = [makeClassifierGeo({ x: 0, y: 10, width: 40, height: 40 })];
    const edges: EdgeGeo[] = [
      {
        id: 'e0',
        points: [
          { x: 20, y: -4 },
          { x: 20, y: 10 },
        ],
        targetDecor: 'none',
        sourceDecor: 'none',
        dashed: false,
        from: 'A',
        to: 'B',
      },
    ];
    // Without the edge: raw ink-min-y = classifier's own -1 inset = 9,
    // shift.dy = 6 - 9 = -3. With the edge's own y=-4 point (plain point,
    // no inset) dominating the min side: shift.dy = 6 - (-4) = 10.
    const withoutEdge = computeClassInkShift(classifiers, [], [], []);
    const withEdge = computeClassInkShift(classifiers, [], edges, []);
    expect(withoutEdge.dy).toBe(-3);
    expect(withEdge.dy).toBe(10);
  });

  it('composes with computeClassDocumentDims to reproduce jar-verified absolute rect positions (jalexi-21-xoje231)', () => {
    // Applying BOTH the (translation-invariant) dims AND the shift together
    // is exactly what `layout.ts#assembleShiftedGeometry` does -- this test
    // locks that composition against the real jar output: canvas 175x70,
    // rect x/y = (7,7) and (101,7).
    const classifiers = [
      makeClassifierGeo({ id: 'foo1', x: 0, y: 0 }),
      makeClassifierGeo({ id: 'foo2', x: 94, y: 0 }),
    ];
    const dims = computeClassDocumentDims(classifiers, [], [], []);
    const shift = computeClassInkShift(classifiers, [], [], []);
    expect(dims).toEqual({ width: 175, height: 70 });
    expect(classifiers.map((c) => ({ x: c.x + shift.dx, y: c.y + shift.dy }))).toEqual([
      { x: 7, y: 7 },
      { x: 101, y: 7 },
    ]);
  });
});
