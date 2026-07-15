/**
 * entity-image-description-separator.test.ts — G1 I9b: bare Creole
 * horizontal-line separator markers (`----`/`====`/`....`, EMPTY content
 * between the delimiters) inside a multi-line entity display.
 *
 * Upstream: `klimt/creole/legacy/CreoleStripeSimpleParser.java`'s
 * SECTION_HEADER_PATTERN/SECTION_TITLE_PATTERN/SECTION_SEPARATOR_PATTERN/
 * DOUBLE_DOT_DELIMITED_LINE feed `StripeSimple#analyzeAndAdd`'s
 * `StripeStyleType.HORIZONTAL_LINE` branch, which draws a
 * `CreoleHorizontalLine` atom (-> `UHorizontalLine`, an SVG `<line>`)
 * instead of literal text. This port's `buildTextBlock`
 * (`EntityImageDescriptionSupport.ts`) previously had no such
 * classification at all — every display line, including a bare `----`,
 * rendered as a literal `<text>----</text>`.
 *
 * jarFragment provenance: rebased (-134.14,-111) from the REAL,
 * deterministic-mode-captured jar SVG,
 * `test-results/dot-cache/component/butebe-90-dozo380/in.svg`'s `queue3`
 * entity (`queue "queue1\n----\ntoto" as queue3`) — the fixture this
 * mechanism was drilled against (G1 ledger.md I9b). Uses
 * `DeterministicMeasurer` (not `jarMeasurer`) because that corpus was
 * captured under `-DPLANTUML_DETERMINISTIC_TEXT=true` — see
 * `entity-image-description.test.ts`'s own module doc comment for why
 * mixing measurer systems silently fails conformance for reasons
 * unrelated to the code under test.
 *
 * E2r/L1 update (2026-07-15): `classifySeparatorLine` was SUBSUMED by
 * `klimt/creole/legacy/CreoleStripeSimpleParser.ts#classifyStripeLine`,
 * which also now runs NORMAL lines through the ported style-command
 * engine — see the "run of 5 dashes" test below for a jar-verified
 * correction this uncovered, and `CreoleStripeSimpleParser.ts`'s own doc
 * comment for the "--Header--" embedded-label finding (still deferred,
 * this suite's own pin unchanged).
 */
import { describe, expect, test } from 'vitest';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { FontStyle } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { DeterministicMeasurer } from '../../../../src/core/measurer-deterministic.js';
import { ActorStyle } from '../../../../src/core/skin/ActorStyle.js';
import { ComponentStyle } from '../../../../src/core/decoration/symbol/USymbols.js';
import { EntityImageDescription, type EntityImageDescriptionParams } from '../../../../src/core/svek/image/EntityImageDescription.js';

const TITLE_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };
const STEREO_FONT: FontConfiguration = {
  family: 'sans-serif',
  size: 14,
  color: '#000000',
  styles: new Set([FontStyle.ITALIC]),
};

const measurer = new DeterministicMeasurer();

const deterministicDriverBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    return { width: measurer.measure(text, { family: font.family, size: font.size }).width };
  },
};

function deterministicStringBounder(): {
  calculateDimension: (font: { family: string; size: number }, text: string) => XDimension2D;
  getDescent: (font: { family: string; size: number }, text: string) => number;
} {
  return {
    calculateDimension(font, text) {
      const { width, height } = measurer.measure(text, { family: font.family, size: font.size });
      return new XDimension2D(width, height);
    },
    getDescent(font, text) {
      return measurer.getDescent({ family: font.family, size: font.size }, text);
    },
  };
}

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', deterministicDriverBounder, measurer);
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

function render(entity: EntityImageDescription): string {
  const ug = newGraphic();
  entity.drawU(ug);
  return wrapFragment(extractTopGroup(ug.getSvgString()));
}

function baseParams(overrides: Partial<EntityImageDescriptionParams>): EntityImageDescriptionParams {
  return {
    entity: { name: 'queue3', uid: 'ent0004', qualifiedName: 'queue3', location: { position: 1 }, url: null },
    symbol: { keyword: 'queue', actorStyle: ActorStyle.STICKMAN, componentStyle: ComponentStyle.UML2 },
    labels: { codeName: 'queue3', displayText: 'queue1\n----\ntoto', stereotypeLabels: [] },
    paint: {
      forecolor: '#181818',
      backcolor: '#F1F1F1',
      roundCorner: 0,
      diagonalCorner: 0,
      deltaShadow: 0,
      stroke: UStroke.withThickness(0.5),
      fontTitle: TITLE_FONT,
      fontStereo: STEREO_FONT,
      titleAlignment: HorizontalAlignment.CENTER,
      stereotypeAlignment: HorizontalAlignment.CENTER,
    },
    links: [],
    fixCircleLabelOverlapping: false,
    ...overrides,
  };
}

/**
 * Real-jar geometry facts, `test-results/dot-cache/component/
 * butebe-90-dozo380/in.svg`'s `queue3` fragment (`queue "queue1\n----\n
 * toto" as queue3`, rebased -134.14,-111 to the entity's own box origin).
 * The bare `----` line draws as a single solid `<line>` at y="19" -- the
 * `SEPARATOR_DRAW_ADVANCE`/`SEPARATOR_SIZE_HEIGHT` constants
 * (`EntityImageDescriptionSupport.ts`) this test pins -- not a literal
 * `<text>----</text>`. `queue1`'s own position is unaffected by the
 * SEPARATE, already-ledgered post-separator-line alignment gap (G1 I9b
 * ledger entry): it is the WIDEST line, so a CENTER-vs-LEFT alignment
 * bug produces the same x=5 offset either way -- this test asserts only
 * facts this mechanism's fix actually calibrated, not the full-fragment
 * round trip (which would also require the alignment fix to pass).
 */
const JAR_QUEUE3_OUTER_D =
  'M5,0 L61.725,0 C66.725,0 66.725,23 66.725,23 C66.725,23 66.725,46 61.725,46 ' +
  'L5,46 C0,46 0,23 0,23 C0,23 0,0 5,0';

describe('EntityImageDescription — bare Creole horizontal-line separator (G1 I9b)', () => {
  test('a bare "----" display line draws as ONE <line> at the calibrated cursor position, not literal text', () => {
    const entity = new EntityImageDescription(baseParams({}));
    const svg = render(entity);
    expect(svg).not.toContain('----');
    const lines = [...svg.matchAll(/<line ([^/]*)\/>/g)];
    expect(lines).toHaveLength(1);
    const attrs = lines[0]?.[1] ?? '';
    expect(/y1="19"/.test(attrs)).toBe(true);
    expect(/y2="19"/.test(attrs)).toBe(true);
    expect(/stroke-width:1;/.test(attrs)).toBe(true);
    // "queue1" (the widest line, drawn BEFORE the separator) keeps its
    // exact jar-measured position regardless of the separate, deferred
    // post-separator alignment gap.
    expect(svg).toContain('<text x="5" y="15.8889"');
    // The outer cylinder shape (drawQueue -- untouched by this fix) is
    // unaffected: width/height still derive correctly from the 3-line
    // block's total measured height (14 + SEPARATOR_SIZE_HEIGHT[8] + 14 = 36
    // content, +10 margin = 46 total, matching the jar's own box height).
    const outerPath = /<path d="([^"]+)"[^/]*fill="#F1F1F1"/.exec(svg);
    expect(outerPath?.[1]).toBe(JAR_QUEUE3_OUTER_D);
  });

  test('calculateDimensionSlow reproduces the jar box height exactly (14 + 8 + 14 + margin 10 = 46)', () => {
    const entity = new EntityImageDescription(baseParams({}));
    const dim = entity.calculateDimensionSlow(deterministicStringBounder());
    expect(dim.getHeight()).toBeCloseTo(46, 3);
  });

  test('a non-empty "--Header--" line is UNCHANGED (still literal text) -- deferred embedded-label horizontal-line mechanism (jar-verified: real jar draws it as TWO short <line> elements flanking a plain "Header" <text>, not literal text OR struck-through -- CreoleHorizontalLine\'s label branch is a separate, still-unported mechanism this port intentionally leaves as its pre-existing literal-text fallback rather than half-building)', () => {
    const withHeader = baseParams({
      labels: { codeName: 'queue3', displayText: 'queue1\n--Header--\ntoto', stereotypeLabels: [] },
    });
    const svg = render(new EntityImageDescription(withHeader));
    expect(svg).toContain('--Header--');
    expect(svg).not.toContain('<line');
  });

  test('a run of 5 dashes ("-----") is NOT a separator (upstream capture excludes the delimiter char) -- reaches the creole style engine as NORMAL text, where the STRIKE syntax ("--...--") partially matches', () => {
    // E2r/L1 correction (diagnosis.md precedent -- "fix the mechanism, update
    // tests that pinned the old wrong behavior"): this assertion originally
    // pinned "-----" as untouched literal text, written before any creole
    // engine existed in this port (G1 I9b had no style-command chain to
    // reach at all). Jar-verified 2026-07-15 (-DPLANTUML_DETERMINISTIC_TEXT=
    // true, `queue "queue1\n-----\ntoto" as queue3`): the REAL jar renders a
    // single struck-through "-" `<text text-decoration="line-through">`
    // element, textLength 4.6375 -- "-----" is NOT a separator (confirmed,
    // the original assertion's premise), but it DOES reach StripeSimple's
    // ordinary NORMAL-line style-command scan, where the creole STRIKE
    // syntax (`--...--`, non-greedy) matches "--" + "-" + "--" and strikes
    // the single sandwiched dash. This port's new stripe/atom pipeline
    // reproduces that exact jar structure.
    const withFiveDashes = baseParams({
      labels: { codeName: 'queue3', displayText: 'queue1\n-----\ntoto', stereotypeLabels: [] },
    });
    const svg = render(new EntityImageDescription(withFiveDashes));
    expect(svg).not.toContain('-----');
    expect(svg).not.toContain('<line');
    const struckText = /<text[^>]*text-decoration="line-through"[^>]*>(-)<\/text>/.exec(svg);
    expect(struckText?.[1]).toBe('-');
  });

  test('a bare "====" line draws TWO parallel <line> elements (double-line style)', () => {
    const withEquals = baseParams({
      labels: { codeName: 'queue3', displayText: 'queue1\n====\ntoto', stereotypeLabels: [] },
    });
    const svg = render(new EntityImageDescription(withEquals));
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(2);
    expect(svg).not.toContain('====');
  });

  test('a bare "...." line draws as a single dotted <line>', () => {
    const withDots = baseParams({
      labels: { codeName: 'queue3', displayText: 'queue1\n....\ntoto', stereotypeLabels: [] },
    });
    const svg = render(new EntityImageDescription(withDots));
    expect(svg).toContain('<line ');
    expect(svg).not.toContain('....');
  });
});
