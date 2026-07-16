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
import { computeClassDocumentDims } from '../../../src/diagrams/class/layout-ink-extent.js';
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
      { id: 'ns', x: 6, y: 6, width: 117.15, height: 113, label: 'p1' },
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

  it('notes contribute ink padded by HACK_X_FOR_POLYGON on x only (UPolygon ink rule)', () => {
    const notes: NoteGeo[] = [
      { id: 'n0', x: 0, y: 0, width: 50, height: 30, lines: ['hi'], connector: [] },
    ];
    const dims = computeClassDocumentDims([], [], [], notes);
    // Ink x-span: [0-10, 50+10] = 70 wide; y-span unpadded: [0,30]=30.
    // width = 70+15+5+1 floored = 91; height = 30+15+5+1 floored = 51.
    expect(dims.width).toBe(91);
    expect(dims.height).toBe(51);
  });
});
