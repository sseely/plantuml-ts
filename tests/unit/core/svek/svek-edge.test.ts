/**
 * svek-edge.test.ts — T13: conformance and unit tests for `SvekEdge`
 * (spline body + extremity decorations + label/stereotype placement)
 * and the reachable `svek/extremity/*` decor classes.
 *
 * AC1/AC2 (conformance): render a `SvekEdge` standalone through
 * `UGraphicSvg` and compare its `<g class="link">...</g>` subtree
 * against a real jar SVG fragment, following the fragment-embedding
 * pattern established by `tests/unit/core/decoration/
 * symbols-component.test.ts` (`compareSvg`, `wrapFragment`).
 *
 * Fragment provenance: every reference fragment below is extracted
 * VERBATIM from `test-results/dot-cache/component/*\/in.svg` — cached
 * real jar (`plantuml-1.2026.7beta3.jar -tsvg -pipe`) output for the
 * project's pdiff/nonreg fixture corpus (see `.claude/CLAUDE.md`) —
 * never from this port's own emitter. Three attributes are stripped
 * from each reference `<g class="link">` before comparison, each for a
 * documented, out-of-this-task's-scope reason (see the `stripAttrs`
 * helper below): `data-source-line` (needs `LineLocation` threaded
 * through the parser into edge geometry — not part of `SvekEdgeInput`),
 * `data-link-type` (needs `LinkType#getLinkTypeName`, not ported), and
 * the `<path>`'s own `id` (the already-ported `DriverDotPathSvg`
 * — T2/T3-era, outside this task's write-set — never reads `DotPath
 * #getComment()`/`getCodeLine()` at all, so no id could ever appear
 * regardless of what this task's `SvekEdge` does).
 *
 * AC3 (unit-level polygon/point math): for every LinkDecor this port's
 * description-diagram parser can produce (`link-decor.ts`'s reachable
 * set), resolve the raw token through `lookupDecors1`/`lookupDecors2`
 * -> `buildExtremityFactory` -> `createUDrawable`, draw it standalone,
 * and assert the exact rendered coordinates against hand-derived
 * expected values (computed independently in Python from each Java
 * class's own formula — see the mission report for the derivation
 * script). `p0=(100,100)`, `angle=0` throughout (the "head-side, purely
 * horizontal, angle=0" case SvekEdge would pass as `dotPath
 * .getEndAngle()`), chosen because most (not all) of these decors'
 * internal `angle - PI/2` / `angle + PI/2` offsets cancel cleanly at
 * angle=0, keeping expected values exact integers rather than
 * transcendental floats (PARENTHESIS/CIRCLE_CONNECT/CIRCLE/CIRCLE_LINE
 * are the deliberate exceptions — non-integer floats, asserted with
 * `toBeCloseTo`).
 */
import { describe, expect, test } from 'vitest';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';
import { Fore } from '../../../../src/core/klimt/Fore.js';
import { SvekEdge } from '../../../../src/core/svek/SvekEdge.js';
import type { SvekEdgeInput } from '../../../../src/core/svek/SvekEdge.js';
import {
  buildExtremityFactory,
  lookupDecors1,
  lookupDecors2,
} from '../../../../src/core/svek/extremity/link-decor.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const stubBounder: DriverStringBounder = {
  calculateDimension(_font, text) {
    // Only real jar-measured widths appear here (AC1's "use" label,
    // matching `symbols-component.test.ts`'s own convention).
    if (text === 'use') return { width: 20.9625 };
    return { width: 0 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stubBounder);
}

const LABEL_FONT: FontConfiguration = { family: 'sans-serif', size: 13, color: '#000000', styles: new Set() };

/** Wraps a fragment (ours or the jar's) in the same minimal document on
 *  both sides — root attrs are therefore never compared, only the
 *  fragment's own shapes (mirrors `symbols-component.test.ts`). */
function wrapFragment(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><g>${inner}</g></svg>`;
}

/** Strips the three attributes this task's `SvekEdgeInput` does not
 *  model (see the module doc comment's provenance note) from a real
 *  jar `<g class="link">...</g>` fragment before comparison. */
function stripAttrs(jarFragment: string): string {
  return jarFragment
    .replace(/ data-source-line="\d+"/, '')
    .replace(/ data-link-type="[^"]*"/, '')
    .replace(/(<path\b[^>]*) id="[^"]*"/, '$1');
}

/** Renders a `SvekEdge` standalone and extracts everything inside the
 *  document's own top-level `<g>...</g>` (our `<g class="link">`
 *  subtree, since `startGroup`/`closeGroup` nest one). */
function render(input: SvekEdgeInput): string {
  const ug = newGraphic();
  new SvekEdge(input).drawU(ug);
  const svg = ug.getSvgString();
  const match = /<g>([\s\S]*)<\/g><\/svg>$/.exec(svg);
  if (match === null) throw new Error('render: no top-level <g>...</g></svg> found');
  const inner = match[1];
  if (inner === undefined) throw new Error('render: capture group did not match');
  return inner;
}

function expectConformant(ours: string, jarFragment: string): void {
  const { pass, diffs } = compareSvg(wrapFragment(ours), wrapFragment(stripAttrs(jarFragment)), 'deterministic');
  expect(pass, `first diff: ${JSON.stringify(diffs[0])}`).toBe(true);
}

// ---------------------------------------------------------------------------
// AC1 — plain dependency edge (real jar: babafi-51-dixi026, "a -> b: use")
// ---------------------------------------------------------------------------

const JAR_PLAIN_EDGE =
  '<g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="6" data-link-type="dependency">' +
  '<path d="M59.11,53.5 C74.93,53.5 90.74,53.5 110.71,53.5" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/>' +
  '<polygon points="115.71,53.5,106.71,49.5,110.71,53.5,106.71,57.5,115.71,53.5" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
  '<text x="77.43" y="46.6111" fill="#000000" font-size="13" lengthAdjust="spacing" textLength="20.9625" font-family="sans-serif">use</text>' +
  '</g>';

describe('SvekEdge (T13, AC1) — plain dependency edge', () => {
  test('renders conformant vs. the jar fragment (spline + ARROW extremity + label)', () => {
    const input: SvekEdgeInput = {
      id: 'lnk3',
      points: [
        { x: 59.11, y: 53.5 },
        { x: 74.93, y: 53.5 },
        // cp2 and endpoint both shift under the ARROW trim (DotPath
        // .moveEndPoint moves x2/y2 AND ctrlx2/ctrly2 together — verified
        // against upstream DotPath.java, same for moveStartPoint/ctrl1)
        // — so the pre-trim (fed-in) values are the jar's rendered
        // 90.74/110.71 plus the 5px trim: 95.74/115.71.
        { x: 95.74, y: 53.5 },
        { x: 115.71, y: 53.5 },
      ],
      from: 'ent0001',
      to: 'ent0002',
      style: 'solid',
      headDecor: '>',
      color: '#181818',
      backgroundColor: '#FFFFFF',
      label: { text: 'use', x: 77.43, y: 46.6111 },
      labelFont: LABEL_FONT,
    };
    expectConformant(render(input), JAR_PLAIN_EDGE);
  });
});

// ---------------------------------------------------------------------------
// AC2 — dashed dependency edge (real jar: cukafa-49-fona812,
// "interface-backto-component2" — a reversed vertical dashed link)
// ---------------------------------------------------------------------------

const JAR_DASHED_EDGE =
  '<g class="link" data-entity-1="ent0002" data-entity-2="ent0004" id="lnk5" data-source-line="18" data-link-type="dependency">' +
  '<path d="M190.5,45.32 C190.5,61.13 190.5,91.05 190.5,114.56" style="stroke:#181818;stroke-width:1;stroke-dasharray:7,7;" fill="none" id="interface-backto-component2"/>' +
  '<polygon points="190.5,40.32,186.5,49.32,190.5,45.32,194.5,49.32,190.5,40.32" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
  '</g>';

describe('SvekEdge (T13, AC2) — dashed dependency edge', () => {
  test('renders conformant vs. the jar fragment (dash pattern + tail-side ARROW extremity)', () => {
    const input: SvekEdgeInput = {
      id: 'lnk5',
      points: [
        { x: 190.5, y: 40.32 }, // untrimmed start — arrow points UP at the start (reversed link)
        // cp1 shifts under the ARROW start-trim too (same DotPath
        // .moveStartPoint/ctrl1 pairing as the moveEndPoint note above):
        // jar's rendered 61.13 plus the 5px trim = 56.13.
        { x: 190.5, y: 56.13 },
        { x: 190.5, y: 91.05 },
        { x: 190.5, y: 114.56 },
      ],
      from: 'ent0002',
      to: 'ent0004',
      style: 'dashed',
      tailDecor: '<',
      color: '#181818',
      backgroundColor: '#FFFFFF',
    };
    expectConformant(render(input), JAR_DASHED_EDGE);
  });
});

// ---------------------------------------------------------------------------
// AC3 — unit-level polygon/point math per mapped LinkDecor
// ---------------------------------------------------------------------------

const P0 = { x: 100, y: 100 };
const WHITE = '#FFFFFF';

type DecorLookup = typeof lookupDecors1 | typeof lookupDecors2;

/** Resolves `token` through the given side's lookup table (upstream's
 *  `LinkDecor.lookupDecors1`/`lookupDecors2`), builds its
 *  `ExtremityFactory`, and draws the result standalone at `P0` with
 *  `angle=0` — see the module doc comment for why `angle=0` keeps the
 *  expected geometry mostly-integer. */
const LINE_COLOR = '#181818';

function drawDecor(token: string, lookup: DecorLookup): { svg: string; decorationLength: number } {
  const name = lookup(token);
  if (name === undefined) throw new Error(`no LinkDecor for token ${token}`);
  const factory = buildExtremityFactory(name, WHITE);
  const drawable = factory.createUDrawable(P0, 0, null);
  const ug = newGraphic();
  // Fill-driven classes (Diamond, Triangle-family via the outer SvekEdge
  // drawRainbow mechanism, Arrow, ExtendsLike's DefinedBy dots) read the
  // CURRENT foreground color off `ug.getParam().getColor()` to decide
  // their filled-with-line-color look — matching what SvekEdge.ts's own
  // `drawExtremity` sets up (`ug.apply(new Fore(this.input.color))`)
  // before ever calling an extremity's `drawU`.
  drawable.drawU(ug.apply(new Fore(LINE_COLOR)));
  return { svg: ug.getSvgString(), decorationLength: drawable.getDecorationLength() };
}

describe('link-decor.ts + extremity classes (T13, AC3) — reachable LinkDecor point math', () => {
  test('ARROW (>) — filled polygon at the contact point, decorationLength=5', () => {
    const { svg, decorationLength } = drawDecor('>', lookupDecors2);
    expect(decorationLength).toBe(5);
    expect(svg).toContain('points="100,100,91,96,95,100,91,104,100,100"');
  });

  test('ARROW_TRIANGLE (>>) — hollow polygon, decorationLength=8', () => {
    const { svg, decorationLength } = drawDecor('>>', lookupDecors2);
    expect(decorationLength).toBe(8);
    expect(svg).toContain('points="100,100,92,97,92,103,100,100"');
  });

  test('EXTENDS (|>) — large hollow triangle, decorationLength=18', () => {
    const { svg, decorationLength } = drawDecor('|>', lookupDecors2);
    expect(decorationLength).toBe(18);
    expect(svg).toContain('points="100,100,82,94,82,106,100,100"');
  });

  test('AGGREGATION (o) — hollow diamond, decorationLength=12', () => {
    const { svg, decorationLength } = drawDecor('o', lookupDecors2);
    expect(decorationLength).toBe(12);
    expect(svg).toContain('points="100,100,94,96,88,100,94,104,100,100"');
  });

  test('COMPOSITION (*) — filled diamond, same polygon as AGGREGATION', () => {
    const { svg, decorationLength } = drawDecor('*', lookupDecors2);
    expect(decorationLength).toBe(12);
    expect(svg).toContain('points="100,100,94,96,88,100,94,104,100,100"');
    expect(svg).toContain('fill="#181818"');
  });

  test('CROWFOOT (}/{) — three fan lines from the contact point, decorationLength=8', () => {
    const { svg, decorationLength } = drawDecor('{', lookupDecors2);
    expect(decorationLength).toBe(8);
    expect(svg).toContain('x1="92" y1="100" x2="100" y2="100"'); // base->middle
    expect(svg).toContain('x1="92" y1="100" x2="100" y2="92"'); // base->left
    expect(svg).toContain('x1="92" y1="100" x2="100" y2="108"'); // base->right
  });

  test('CIRCLE_CROWFOOT (o{) — crowfoot + trailing circle, decorationLength=18', () => {
    const { svg, decorationLength } = drawDecor('o{', lookupDecors2);
    expect(decorationLength).toBe(18);
    expect(svg).toContain('cx="86" cy="100" rx="4" ry="4"');
  });

  test('LINE_CROWFOOT (|{) — crowfoot + trailing bar, decorationLength=8', () => {
    const { svg, decorationLength } = drawDecor('|{', lookupDecors2);
    expect(decorationLength).toBe(8);
    expect(svg).toContain('x1="90" y1="96" x2="90" y2="104"');
  });

  test('DOUBLE_LINE (||) — two parallel bars, decorationLength=8', () => {
    const { svg, decorationLength } = drawDecor('||', lookupDecors2);
    expect(decorationLength).toBe(8);
    expect(svg).toContain('x1="96" y1="96" x2="96" y2="104"');
    expect(svg).toContain('x1="93" y1="96" x2="93" y2="104"');
  });

  test('NOT_NAVIGABLE (x) — crossing X, decorationLength=8', () => {
    const { svg, decorationLength } = drawDecor('x', lookupDecors2);
    expect(decorationLength).toBe(8);
    expect(svg).toContain('d="M95,96 L87,104 M95,104 L87,96"');
  });

  test('SQUARE (#) — rect centered at the contact point, decorationLength=5', () => {
    const { svg, decorationLength } = drawDecor('#', lookupDecors2);
    expect(decorationLength).toBe(5);
    expect(svg).toContain('x="95" y="95" width="10" height="10"');
  });

  test('PLUS (+) — filled circle + cross, decorationLength=16', () => {
    const { svg, decorationLength } = drawDecor('+', lookupDecors2);
    expect(decorationLength).toBe(16);
    expect(svg).toContain('cx="92" cy="100" rx="8" ry="8"'); // px+r=84+8, py+r=92+8
  });

  test('HALF_ARROW_UP (\\\\) — single wing, no getDecorationLength override (base default 8)', () => {
    const { svg, decorationLength } = drawDecor('\\\\', lookupDecors2);
    expect(decorationLength).toBe(8);
    expect(svg).toContain('x1="100" y1="100" x2="91" y2="96"');
  });

  test('HALF_ARROW_DOWN (//) — opposite wing direction', () => {
    const { svg } = drawDecor('//', lookupDecors2);
    expect(svg).toContain('x1="100" y1="100" x2="91" y2="104"');
  });

  test('REDEFINES (<||, tail side) — hollow triangle + perpendicular bar, decorationLength=18', () => {
    const { svg, decorationLength } = drawDecor('<||', lookupDecors1);
    expect(decorationLength).toBe(18);
    // The custom ExtremityExtendsLike rotate (see ExtremityExtendsLike.ts's
    // doc comment) negates y even at angle=0 — bug-for-bug preserved.
    expect(svg).toContain('points="100,100,81,107,81,93,100,100"');
    expect(svg).toContain('x1="77.2" y1="107" x2="77.2" y2="93"');
  });

  test('DEFINEDBY (<|:, tail side) — hollow triangle + two dots, decorationLength=18', () => {
    const { svg, decorationLength } = drawDecor('<|:', lookupDecors1);
    expect(decorationLength).toBe(18);
    expect(svg).toContain('cx="75.3" cy="105" rx="2" ry="2"'); // pos1 + size = 73.3+2, 103+2
    expect(svg).toContain('cx="75.3" cy="95" rx="2" ry="2"'); // pos2 + size = 73.3+2, 93+2
  });

  test('CIRCLE (0) — hollow circle sized off the diagram background, decorationLength=12', () => {
    const { svg, decorationLength } = drawDecor('0', lookupDecors2);
    expect(decorationLength).toBe(12);
    // angle = angleIn - PI/2 = -PI/2; dest = (p0.x - r*cos(angle+PI/2),
    // p0.y - r*sin(angle+PI/2)) = (100 - 6*cos(0), 100 - 6*sin(0)) = (94, 100).
    const m = /<ellipse cx="([\d.]+)" cy="([\d.]+)"/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(94, 3); // cx = (dest.x-r)+r = dest.x
    expect(Number(m![2])).toBeCloseTo(100, 3); // cy = (dest.y-r)+r = dest.y
  });

  test('CIRCLE_FILL (@) — same geometry as CIRCLE, filled with the line color', () => {
    const { svg } = drawDecor('@', lookupDecors2);
    expect(svg).toContain('fill="#181818"');
  });

  test('CIRCLE_LINE (|o) — thickness-scaled circle + bar, decorationLength=15', () => {
    const { svg, decorationLength } = drawDecor('o|', lookupDecors2);
    expect(decorationLength).toBe(15);
    expect(svg).toContain('x1="96" y1="96" x2="96" y2="104"');
  });

  test('CIRCLE_CONNECT (0), tail side (0)) — circle + 90deg arc, decorationLength=10', () => {
    const { svg, decorationLength } = drawDecor('0)', lookupDecors1);
    expect(decorationLength).toBe(10);
    expect(svg).toContain('cx="100" cy="100" rx="6" ry="6"');
    const m = /<path d="M([\d.]+),([\d.]+) A/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(92.9289, 3);
    expect(Number(m![2])).toBeCloseTo(92.9289, 3);
  });

  test('PARENTHESIS ()), head side) — arc only, decorationLength=10', () => {
    const { svg, decorationLength } = drawDecor('(', lookupDecors2);
    expect(decorationLength).toBe(10);
    const m = /<path d="M([\d.]+),([\d.]+) A/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(96.9218, 3);
    expect(Number(m![2])).toBeCloseTo(91.5428, 3);
  });
});
