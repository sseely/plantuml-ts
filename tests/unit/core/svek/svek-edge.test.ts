/**
 * svek-edge.test.ts — T13: conformance + unit tests for the DRAWING
 * half of `SvekEdge.java` (svek/SvekEdge.ts, svek/svek-edge-*.ts,
 * svek/extremity/*).
 *
 * Conformance fixtures follow the same "wrap fragments in identical
 * minimal documents, compare via `compareSvg`" pattern as
 * `tests/unit/core/decoration/symbols-component.test.ts` (see that
 * file's module doc comment; `extractTopGroup`/`wrapFragment` are
 * local helpers per the one-helper-per-suite convention).
 *
 * GOLDEN provenance: every fragment below was generated 2026-07-09 by
 *   `java -jar ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar
 *    -tsvg -pipe`
 * on the template (one diagram per decor token `T`):
 *   @startuml
 *   skinparam componentStyle rectangle
 *   [a]
 *   [b]
 *   a T b
 *   @enduml
 * and is the verbatim `<!--link ...--><g class="link" ...>...</g>`
 * subtree of the jar's output (the entity subtrees around it belong to
 * other tasks' scopes). `PLAIN_WITH_LABEL` additionally carries a
 * label (`a --> b : use`) and comes from the cached corpus fixture
 * `test-results/dot-cache/component/babafi-51-dixi026/in.svg`; DASHED
 * is `a ..> b` from the same jar run.
 *
 * Raw-spline reconstruction: the jar path is post-trim (upstream trims
 * `decorationLength` off the decorated end after placing the extremity
 * at the RAW endpoint — `SvekEdge#getExtremitySimplier`). The goldens
 * are all single-cubic vertical splines, so the raw endpoint is
 * recovered as `trimmedEnd ± (0, decorationLength)`. `decorationLength`
 * is read from the port's own factory: this cannot mask a wrong port
 * value, because the extremity is then drawn at the reconstructed raw
 * endpoint and every absolute coordinate in its golden subtree would
 * shift by the same error and fail the compare — only the trimmed path
 * `d` is insensitive to it (it always round-trips), which the golden's
 * extremity coordinates therefore cover.
 */
import { describe, expect, test } from 'vitest';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import type { Point2D } from '../../../../src/core/klimt/UTranslate.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';
import { SvekEdge } from '../../../../src/core/svek/SvekEdge.js';
import type { SvekEdgeInput } from '../../../../src/core/svek/SvekEdge.js';
import {
  buildExtremityFactory,
  getLinkTypeName,
  isFillDecor,
  looksLikeNoDecorAtAllSvg,
  looksLikeRevertedForSvg,
  lookupDecors1,
  lookupDecors2,
} from '../../../../src/core/svek/extremity/link-decor.js';
import type { LinkDecorName } from '../../../../src/core/svek/extremity/link-decor.js';
import {
  buildDotPathFromSplinePoints,
  edgeMidpoint,
} from '../../../../src/core/svek/svek-edge-geometry.js';
import { strokeForStyle } from '../../../../src/core/svek/svek-edge-stroke.js';

// ---------------------------------------------------------------------------
// Shared harness (mirrors symbols-component.test.ts's own local helpers)
// ---------------------------------------------------------------------------

const LABEL_FONT: FontConfiguration = {
  family: 'sans-serif',
  size: 13,
  color: '#000000',
  styles: new Set(),
};

/** Real-jar text width for the one labelled fixture (babafi-51's `use`
 *  at 13pt — `textLength="20.9625"` in the cached SVG). */
const driverStringBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    if (text === 'use' && font.size === 13) return { width: 20.9625 };
    return { width: 0 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', driverStringBounder);
}

function extractTopGroup(svg: string): string {
  const match = /<g>([\s\S]*)<\/g><\/svg>$/.exec(svg);
  if (match === null) throw new Error('extractTopGroup: no top-level <g>...</g></svg> found');
  const inner = match[1];
  if (inner === undefined) throw new Error('extractTopGroup: capture group did not match');
  return inner;
}

function wrapFragment(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><g>${inner}</g></svg>`;
}

function expectConformant(ours: string, jarFragment: string): void {
  const { pass, diffs } = compareSvg(wrapFragment(ours), wrapFragment(jarFragment), 'deterministic');
  expect(pass, `first diff: ${JSON.stringify(diffs[0])}`).toBe(true);
}

/** Parses the four control points of a golden's (single-cubic,
 *  post-trim) `<path d="M... C..."/>`. */
function parsePathPoints(frag: string): Point2D[] {
  const d = /<path d="M([\d.-]+),([\d.-]+) C([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)"/.exec(frag);
  if (d === null) throw new Error('parsePathPoints: no single-cubic path in fragment');
  const n = d.slice(1).map(Number);
  return [
    { x: n[0]!, y: n[1]! },
    { x: n[2]!, y: n[3]! },
    { x: n[4]!, y: n[5]! },
    { x: n[6]!, y: n[7]! },
  ];
}

/** The port's own decoration length for a decor (see the module doc
 *  comment on why reading it from the port cannot mask a wrong value). */
function decorationLengthOf(name: LinkDecorName): number {
  return buildExtremityFactory(name, '#FFFFFF')
    .createUDrawable({ x: 0, y: 0 }, Math.PI / 2, null)
    .getDecorationLength();
}

/** Unit vector pointing from `b` toward `a`. */
function unitToward(a: Point2D, b: Point2D): Point2D {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const norm = Math.hypot(dx, dy);
  return { x: dx / norm, y: dy / norm };
}

/** Reconstructs the RAW (pre-trim) graphviz spline from a golden's
 *  trimmed path. `DotPath#moveEndPoint`/`moveStartPoint` (upstream
 *  DotPath.java:206-234) shift BOTH the moved endpoint and its
 *  adjacent control point by the same delta, so undoing the trim
 *  shifts that same pair back out along the end tangent (whose
 *  direction the trim preserves — both points move equally). */
function rawPoints(frag: string, decor: LinkDecorName, side: 'head' | 'tail'): Point2D[] {
  const [p0, p1, p2, p3] = parsePathPoints(frag) as [Point2D, Point2D, Point2D, Point2D];
  const len = decorationLengthOf(decor);
  if (side === 'head') {
    const u = unitToward(p3, p2);
    return [
      p0,
      p1,
      { x: p2.x + len * u.x, y: p2.y + len * u.y },
      { x: p3.x + len * u.x, y: p3.y + len * u.y },
    ];
  }
  const u = unitToward(p0, p1);
  return [
    { x: p0.x + len * u.x, y: p0.y + len * u.y },
    { x: p1.x + len * u.x, y: p1.y + len * u.y },
    p2,
    p3,
  ];
}

const BASE_INPUT = {
  uid: 'lnk3',
  from: 'a',
  to: 'b',
  fromUid: 'ent0001',
  toUid: 'ent0002',
  sourceLine: 4,
  style: 'solid',
  color: '#181818',
  backgroundColor: '#FFFFFF',
} as const;

function drawEdge(input: SvekEdgeInput): { svg: string; frag: string } {
  const ug = newGraphic();
  new SvekEdge(input).drawU(ug);
  const svg = ug.getSvgString();
  return { svg, frag: extractTopGroup(svg) };
}

// ---------------------------------------------------------------------------
// Per-decor jar goldens (provenance in the module doc comment)
// ---------------------------------------------------------------------------

interface DecorGolden {
  readonly decor: LinkDecorName;
  readonly side: 'head' | 'tail';
  readonly token: string;
  readonly puml: string;
  readonly frag: string;
}

const GOLDENS: Record<string, DecorGolden> = {
  EXTENDS: { decor: 'EXTENDS', side: 'head', token: '|>', puml: '--|>', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="extension"><path d="M22,43.58 C22,60.52 22,68.18 22,85.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="22,103.2,28,85.2,16,85.2,22,103.2" fill="none" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  EXTENDS_caret: { decor: 'EXTENDS', side: 'head', token: '^', puml: '--^', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="extension"><path d="M22,43.58 C22,60.52 22,68.18 22,85.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="22,103.2,28,85.2,16,85.2,22,103.2" fill="none" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  COMPOSITION: { decor: 'COMPOSITION', side: 'head', token: '*', puml: '--*', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="composition"><path d="M21.41,43.58 C21.41,60.52 21.41,74.18 21.41,91.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="21.41,103.2,25.41,97.2,21.41,91.2,17.41,97.2,21.41,103.2" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  AGGREGATION: { decor: 'AGGREGATION', side: 'head', token: 'o', puml: '--o', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="aggregation"><path d="M21.41,43.58 C21.41,60.52 21.41,74.18 21.41,91.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="21.41,103.2,25.41,97.2,21.41,91.2,17.41,97.2,21.41,103.2" fill="none" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  NOT_NAVIGABLE: { decor: 'NOT_NAVIGABLE', side: 'head', token: 'x', puml: '--x', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="not_navigable"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><path d="M25.41,98.2 L17.41,90.2 M17.41,98.2 L25.41,90.2" style="stroke:#181818;stroke-width:1;" fill="none"/></g>' },
  REDEFINES: { decor: 'REDEFINES', side: 'head', token: '||>', puml: '--||>', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="redefines"><path d="M23,43.58 C23,60.52 23,68.18 23,85.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="23,103.2,16,84.2,30,84.2,23,103.2" fill="#FFFFFF" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/><line x1="16" y1="80.4" x2="30" y2="80.4" style="stroke:#181818;stroke-width:2;"/></g>' },
  DEFINEDBY: { decor: 'DEFINEDBY', side: 'head', token: ':|>', puml: '--:|>', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="definedby"><path d="M23,43.58 C23,60.52 23,68.18 23,85.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="23,103.2,16,84.2,30,84.2,23,103.2" fill="#FFFFFF" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/><ellipse cx="18" cy="78.5" rx="2" ry="2" fill="#181818" style="stroke:#181818;stroke-width:1;"/><ellipse cx="28" cy="78.5" rx="2" ry="2" fill="#181818" style="stroke:#181818;stroke-width:1;"/></g>' },
  CROWFOOT: { decor: 'CROWFOOT', side: 'head', token: '{', puml: '--{', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="crowfoot"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="21.41" y1="95.2" x2="29.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="13.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="21.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  CIRCLE_CROWFOOT: { decor: 'CIRCLE_CROWFOOT', side: 'head', token: 'o{', puml: '--o{', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="crowfoot"><path d="M21.41,43.58 C21.41,60.52 21.41,68.18 21.41,85.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="21.41" y1="95.2" x2="27.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="15.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="21.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><ellipse cx="21.41" cy="89.2" rx="4" ry="4" fill="none" style="stroke:#181818;stroke-width:1;"/></g>' },
  CIRCLE_LINE: { decor: 'CIRCLE_LINE', side: 'head', token: 'o|', puml: '--o|', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="association"><path d="M21.41,43.58 C21.41,60.52 21.41,71.18 21.41,88.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="21.41" y1="92.2" x2="21.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><ellipse cx="21.41" cy="92.2" rx="4" ry="4" fill="none" style="stroke:#181818;stroke-width:1;"/><line x1="25.41" y1="99.2" x2="17.41" y2="99.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  DOUBLE_LINE: { decor: 'DOUBLE_LINE', side: 'head', token: '||', puml: '--||', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="association"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="25.41" y1="99.2" x2="17.41" y2="99.2" style="stroke:#181818;stroke-width:1;"/><line x1="25.41" y1="96.2" x2="17.41" y2="96.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="21.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  LINE_CROWFOOT: { decor: 'LINE_CROWFOOT', side: 'head', token: '|{', puml: '--|{', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="crowfoot"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="21.41" y1="95.2" x2="27.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="15.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="95.2" x2="21.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="25.41" y1="93.2" x2="17.41" y2="93.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  ARROW: { decor: 'ARROW', side: 'head', token: '>', puml: '-->', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="dependency"><path d="M21.41,43.58 C21.41,60.52 21.41,81.18 21.41,98.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="21.41,103.2,25.41,94.2,21.41,98.2,17.41,94.2,21.41,103.2" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  ARROW_TRIANGLE: { decor: 'ARROW_TRIANGLE', side: 'head', token: '>>', puml: '-->>', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="dependency"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><polygon points="21.41,103.2,24.41,95.2,18.41,95.2,21.41,103.2" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  CIRCLE: { decor: 'CIRCLE', side: 'head', token: '0', puml: '--0', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,74.18 21.41,91.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><ellipse cx="21.41" cy="97.2" rx="6" ry="6" fill="#FFFFFF" style="stroke:#181818;stroke-width:1.5;"/></g>' },
  CIRCLE_FILL: { decor: 'CIRCLE_FILL', side: 'head', token: '@', puml: '--@', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,74.18 21.41,91.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><ellipse cx="21.41" cy="97.2" rx="6" ry="6" fill="#181818" style="stroke:#181818;stroke-width:1.5;"/></g>' },
  CIRCLE_CONNECT: { decor: 'CIRCLE_CONNECT', side: 'head', token: '(0', puml: '--(0', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,76.18 21.41,93.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><ellipse cx="21.41" cy="103.2" rx="6" ry="6" fill="#FFFFFF" style="stroke:#181818;stroke-width:1.5;"/><path d="M28.4811,96.1289 A10,10 0 0 0 14.3389 96.1289" fill="#FFFFFF" style="stroke:#181818;stroke-width:1.5;"/></g>' },
  PARENTHESIS: { decor: 'PARENTHESIS', side: 'head', token: '(', puml: '--(', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,76.18 21.41,93.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><path d="M29.8672,100.1218 A9,9 0 0 0 12.9528 100.1218" fill="none" style="stroke:#181818;stroke-width:1.5;"/></g>' },
  SQUARE: { decor: 'SQUARE', side: 'head', token: '#', puml: '--#', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,81.18 21.41,98.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><rect x="16.41" y="98.2" width="10" height="10" fill="#FFFFFF" style="stroke:#181818;stroke-width:1.5;"/></g>' },
  PLUS: { decor: 'PLUS', side: 'head', token: '+', puml: '--+', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="nested"><path d="M21.41,43.58 C21.41,60.52 21.41,70.18 21.41,87.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><ellipse cx="21.41" cy="95.2" rx="8" ry="8" fill="#FFFFFF" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="87.2" x2="21.41" y2="103.2" style="stroke:#181818;stroke-width:1;"/><line x1="29.41" y1="95.2" x2="13.41" y2="95.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  HALF_ARROW_UP: { decor: 'HALF_ARROW_UP', side: 'head', token: '\\\\', puml: '--\\\\', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="21.41" y1="103.2" x2="25.41" y2="94.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="103.2" x2="21.41" y2="95.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  HALF_ARROW_DOWN: { decor: 'HALF_ARROW_DOWN', side: 'head', token: '//', puml: '--//', frag:
    '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4"><path d="M21.41,43.58 C21.41,60.52 21.41,78.18 21.41,95.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/><line x1="21.41" y1="103.2" x2="17.41" y2="94.2" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="103.2" x2="21.41" y2="95.2" style="stroke:#181818;stroke-width:1;"/></g>' },
  tail_ARROW: { decor: 'ARROW', side: 'tail', token: '<', puml: '<--', frag:
    '<!--reverse link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="dependency"><path d="M21.41,48.58 C21.41,65.52 21.41,86.18 21.41,103.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-backto-b"/><polygon points="21.41,43.58,17.41,52.58,21.41,48.58,25.41,52.58,21.41,43.58" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  tail_COMPOSITION: { decor: 'COMPOSITION', side: 'tail', token: '*', puml: '*--', frag:
    '<!--reverse link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="composition"><path d="M21.41,55.58 C21.41,72.52 21.41,86.18 21.41,103.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-backto-b"/><polygon points="21.41,43.58,17.41,49.58,21.41,55.58,25.41,49.58,21.41,43.58" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
  tail_CROWFOOT: { decor: 'CROWFOOT', side: 'tail', token: '}', puml: '}--', frag:
    '<!--reverse link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="crowfoot"><path d="M21.41,51.58 C21.41,68.52 21.41,86.18 21.41,103.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-backto-b"/><line x1="21.41" y1="51.58" x2="13.41" y2="43.58" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="51.58" x2="29.41" y2="43.58" style="stroke:#181818;stroke-width:1;"/><line x1="21.41" y1="51.58" x2="21.41" y2="43.58" style="stroke:#181818;stroke-width:1;"/></g>' },
  tail_EXTENDS: { decor: 'EXTENDS', side: 'tail', token: '<|', puml: '<|--', frag:
    '<!--reverse link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="extension"><path d="M22,61.58 C22,78.52 22,86.18 22,103.2" style="stroke:#181818;stroke-width:1;" fill="none" id="a-backto-b"/><polygon points="22,43.58,16,61.58,28,61.58,22,43.58" fill="none" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>' },
};

// ---------------------------------------------------------------------------
// AC1/AC3 — every reachable LinkDecor, drawn with the jar's own
// geometry, conformant vs the jar's edge subtree
// ---------------------------------------------------------------------------

describe('SvekEdge per-decor conformance vs jar goldens', () => {
  for (const [name, golden] of Object.entries(GOLDENS)) {
    test(`${name} (${golden.puml})`, () => {
      const points = rawPoints(golden.frag, golden.decor, golden.side);
      const input: SvekEdgeInput = {
        ...BASE_INPUT,
        points,
        ...(golden.side === 'head' ? { headDecor: golden.token } : { tailDecor: golden.token }),
      };
      const { svg, frag } = drawEdge(input);

      // Structural conformance (comments and data-* are normalized away
      // by compareSvg; class/id/path-id/geometry/styles are compared).
      expectConformant(frag, golden.frag);

      // The stripped-by-compare decoration must still be emitted
      // verbatim (T11's "the document must still carry them" mandate):
      // the golden's own comment and full <g ...> opening tag.
      const comment = /^<!--[^>]*-->/.exec(golden.frag)![0];
      const gOpen = /<g class="link"[^>]*>/.exec(golden.frag)![0];
      expect(svg).toContain(comment);
      expect(svg).toContain(gOpen);
    });
  }
});

// ---------------------------------------------------------------------------
// AC1 — plain --> edge with a label, vs the cached corpus fixture
// ---------------------------------------------------------------------------

/** `test-results/dot-cache/component/babafi-51-dixi026/in.svg` — the
 *  `a --> b : use` link subtree (raw end = polygon tip (115.71,53.5),
 *  horizontal spline; ARROW decorationLength 5 trims to 110.71). */
const PLAIN_WITH_LABEL =
  '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="6" data-link-type="dependency">' +
  '<path d="M59.11,53.5 C74.93,53.5 90.74,53.5 110.71,53.5" style="stroke:#181818;stroke-width:1;" fill="none" id="a-to-b"/>' +
  '<polygon points="115.71,53.5,106.71,49.5,110.71,53.5,106.71,57.5,115.71,53.5" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
  '<text x="77.43" y="46.6111" fill="#000000" font-size="13" lengthAdjust="spacing" textLength="20.9625" font-family="sans-serif">use</text></g>';

test('plain --> edge with label conformant vs cached jar fixture (AC1)', () => {
  const { svg, frag } = drawEdge({
    ...BASE_INPUT,
    sourceLine: 6,
    // Raw spline: the fixture's path is post-trim (ARROW length 5 off
    // BOTH the endpoint and cp2 — see rawPoints's doc comment), so
    // cp2/end here are the cached 90.74/110.71 plus 5.
    points: [
      { x: 59.11, y: 53.5 },
      { x: 74.93, y: 53.5 },
      { x: 95.74, y: 53.5 },
      { x: 115.71, y: 53.5 },
    ],
    headDecor: '>',
    label: { text: 'use', x: 77.43, y: 46.6111 },
    labelFont: LABEL_FONT,
  });
  expectConformant(frag, PLAIN_WITH_LABEL);
  expect(svg).toContain('<!--link a to b-->');
  expect(svg).toContain(/<g class="link"[^>]*>/.exec(PLAIN_WITH_LABEL)![0]);
});

// ---------------------------------------------------------------------------
// AC2 — dashed ..> edge
// ---------------------------------------------------------------------------

/** Same jar, `a ..> b` (dashed body, ARROW head; dash 7,7). */
const DASHED =
  '<!--link a to b--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-source-line="4" data-link-type="dependency">' +
  '<path d="M21.41,43.58 C21.41,60.52 21.41,81.18 21.41,98.2" style="stroke:#181818;stroke-width:1;stroke-dasharray:7,7;" fill="none" id="a-to-b"/>' +
  '<polygon points="21.41,103.2,25.41,94.2,21.41,98.2,17.41,94.2,21.41,103.2" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/></g>';

test('dashed ..> edge conformant vs jar golden (AC2)', () => {
  const { frag } = drawEdge({
    ...BASE_INPUT,
    style: 'dashed',
    points: rawPoints(DASHED, 'ARROW', 'head'),
    headDecor: '>',
  });
  expectConformant(frag, DASHED);
});

// ---------------------------------------------------------------------------
// Unit tests — decor resolution and LinkType predicates
// ---------------------------------------------------------------------------

describe('lookupDecors1/lookupDecors2', () => {
  test('trims tokens and resolves both sides (LinkDecor.lookupDecors*)', () => {
    expect(lookupDecors1(' <| ')).toBe('EXTENDS');
    expect(lookupDecors1('<')).toBe('ARROW');
    expect(lookupDecors1('<_')).toBe('ARROW');
    expect(lookupDecors2('|>')).toBe('EXTENDS');
    expect(lookupDecors2('_>')).toBe('ARROW');
    expect(lookupDecors2('\\\\')).toBe('HALF_ARROW_UP');
    expect(lookupDecors2('//')).toBe('HALF_ARROW_DOWN');
  });

  test('unknown or absent tokens resolve to NONE (undefined)', () => {
    expect(lookupDecors1(undefined)).toBeUndefined();
    expect(lookupDecors1('~')).toBeUndefined();
    expect(lookupDecors2(undefined)).toBeUndefined();
    expect(lookupDecors2('|')).toBeUndefined();
  });

  test('decors2-only entries have no decors1 mapping (upstream nulls)', () => {
    expect(lookupDecors1('\\\\')).toBeUndefined();
    expect(lookupDecors1('//')).toBeUndefined();
  });
});

describe('getLinkTypeName (LinkType#getLinkTypeName)', () => {
  test('both NONE is an association (bothNone branch)', () => {
    expect(getLinkTypeName(undefined, undefined)).toBe('association');
  });

  test('priority order: COMPOSITION outranks ARROW on the other end', () => {
    expect(getLinkTypeName('ARROW', 'COMPOSITION')).toBe('composition');
  });

  test('either side matches (has() checks both decors)', () => {
    expect(getLinkTypeName(undefined, 'AGGREGATION')).toBe('aggregation');
    expect(getLinkTypeName('AGGREGATION', undefined)).toBe('aggregation');
  });

  test('unnamed decors yield undefined (attribute omitted)', () => {
    expect(getLinkTypeName('PARENTHESIS', undefined)).toBeUndefined();
    expect(getLinkTypeName('SQUARE', undefined)).toBeUndefined();
    expect(getLinkTypeName('HALF_ARROW_UP', undefined)).toBeUndefined();
    expect(getLinkTypeName('CIRCLE', 'CIRCLE_FILL')).toBeUndefined();
  });
});

describe('looksLike* predicates (LinkType)', () => {
  test('reverted iff decor only on the tail side', () => {
    expect(looksLikeRevertedForSvg(undefined, 'ARROW')).toBe(true);
    expect(looksLikeRevertedForSvg('ARROW', undefined)).toBe(false);
    expect(looksLikeRevertedForSvg('ARROW', 'ARROW')).toBe(false);
    expect(looksLikeRevertedForSvg(undefined, undefined)).toBe(false);
  });

  test('noDecorAtAll iff none or both', () => {
    expect(looksLikeNoDecorAtAllSvg(undefined, undefined)).toBe(true);
    expect(looksLikeNoDecorAtAllSvg('ARROW', 'ARROW')).toBe(true);
    expect(looksLikeNoDecorAtAllSvg('ARROW', undefined)).toBe(false);
    expect(looksLikeNoDecorAtAllSvg(undefined, 'ARROW')).toBe(false);
  });
});

describe('isFillDecor (LinkDecor#isFill)', () => {
  test('matches upstream isFill flags', () => {
    expect(isFillDecor('ARROW')).toBe(true);
    expect(isFillDecor('ARROW_TRIANGLE')).toBe(true);
    expect(isFillDecor('COMPOSITION')).toBe(true);
    expect(isFillDecor('CROWFOOT')).toBe(true);
    expect(isFillDecor('EXTENDS')).toBe(false);
    expect(isFillDecor('AGGREGATION')).toBe(false);
    expect(isFillDecor('CIRCLE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — SvekEdge document decoration
// ---------------------------------------------------------------------------

describe('SvekEdge comment / path id / group attrs', () => {
  const straight: readonly Point2D[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];

  test('no decor at all: plain comment, X-Y path id, association type', () => {
    const { svg } = drawEdge({ ...BASE_INPUT, points: straight });
    expect(svg).toContain('<!--link a to b-->');
    expect(svg).toContain('id="a-b"');
    expect(svg).toContain('data-link-type="association"');
  });

  test('both decors: plain comment, X-Y path id (noDecorAtAll branch)', () => {
    const { svg } = drawEdge({ ...BASE_INPUT, points: straight, tailDecor: '<', headDecor: '>' });
    expect(svg).toContain('<!--link a to b-->');
    expect(svg).toContain('id="a-b"');
  });

  test('tail-only decor: reverse comment and X-backto-Y path id', () => {
    const { svg } = drawEdge({ ...BASE_INPUT, points: straight, tailDecor: '<' });
    expect(svg).toContain('<!--reverse link a to b-->');
    expect(svg).toContain('id="a-backto-b"');
  });

  test('sourceLine omitted: no data-source-line attribute', () => {
    const { sourceLine: _sourceLine, ...rest } = BASE_INPUT;
    const { svg } = drawEdge({ ...rest, points: straight });
    expect(svg).not.toContain('data-source-line');
  });

  test('codeLine input becomes the path codeLine attribute', () => {
    const { svg } = drawEdge({ ...BASE_INPUT, points: straight, codeLine: '12' });
    expect(svg).toContain('codeLine="12"');
  });

  test('setSharedIds dedups path ids across edges (uniq)', () => {
    const ids = new Set<string>();
    const ug = newGraphic();
    const one = new SvekEdge({ ...BASE_INPUT, points: straight, headDecor: '>' });
    const two = new SvekEdge({ ...BASE_INPUT, points: straight, headDecor: '>' });
    one.setSharedIds(ids);
    two.setSharedIds(ids);
    one.drawU(ug);
    two.drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).toContain('id="a-to-b"');
    expect(svg).toContain('id="a-to-b-1"');
  });

  test('stereotype draws guillemet text near the midpoint', () => {
    const { svg } = drawEdge({
      ...BASE_INPUT,
      points: straight,
      stereotype: 'use',
      labelFont: LABEL_FONT,
    });
    expect(svg).toContain('\u00ABuse\u00BB');
  });
});

// ---------------------------------------------------------------------------
// Unit tests — geometry/stroke helpers
// ---------------------------------------------------------------------------

describe('buildDotPathFromSplinePoints', () => {
  test('rejects point counts that are not 1 + 3n', () => {
    expect(() => buildDotPathFromSplinePoints([{ x: 0, y: 0 }])).toThrow(/expected 1 \+ 3\*n/);
    expect(() =>
      buildDotPathFromSplinePoints([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
      ]),
    ).toThrow(/expected 1 \+ 3\*n/);
  });

  test('multi-cubic splines chain segments', () => {
    const path = buildDotPathFromSplinePoints([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ]);
    expect(path.getStartPoint()).toEqual({ x: 0, y: 0 });
    expect(path.getEndPoint()).toEqual({ x: 6, y: 0 });
  });
});

describe('edgeMidpoint / strokeForStyle', () => {
  test('midpoint of the control polyline', () => {
    const mid = edgeMidpoint([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ]);
    expect(mid.x).toBeCloseTo(15);
    expect(mid.y).toBeCloseTo(0);
  });

  test('LinkStyle#getStroke3 dash/thickness table', () => {
    expect(strokeForStyle('dashed').getDasharraySvg()).toEqual([7, 7]);
    expect(strokeForStyle('dotted').getDasharraySvg()).toEqual([1, 3]);
    expect(strokeForStyle('bold').getThickness()).toBe(2);
    expect(strokeForStyle('solid').getThickness()).toBe(1);
  });
});
