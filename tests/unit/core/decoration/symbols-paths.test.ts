/**
 * symbols-paths.test.ts — T8 (re-run): conformance tests for the
 * path-heavy family (`USymbolCloud`, `USymbolFolder`).
 *
 * Same harness/conventions as `symbols-component.test.ts` (T6): each
 * symbol's `asSmall(...)` is rendered standalone through `UGraphicSvg`
 * (no `EntityImageDescription`/dot-layout in between) and compared
 * against a real jar SVG fragment via `compareSvg` (the harness at
 * `tests/oracle/svg-conformance/compare.ts`).
 *
 * jarFragment provenance: every reference fragment below is extracted,
 * VERBATIM (modulo the coordinate rebase described below), from real
 * jar output — `java -jar
 * ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar -tsvg -pipe` on
 * a minimal single-element `.puml` (`cloud Foo`, a multi-line `cloud`
 * label, `folder Foo`, `package Foo`) — captured 2026-07-09. As in T6,
 * every coordinate is REBASED by exactly `(-7, -7)` (dot/SVEK's
 * per-entity diagram-margin convention, unrelated to any `USymbol*`
 * class's own drawing math, which always starts at local `(0, 0)`).
 * `USymbolCloud`/`USymbolFolder`'s own math was independently derived
 * from each Java source and cross-checked by hand against the rebased
 * jar numbers below (see each `describe` block's inline comment)
 * before being written down — including bit-for-bit validating
 * `USymbolCloud`'s `java.util.Random`-seeded bump layout against the
 * real jar's cubic-Bezier control points at two different sizes (a
 * throwaway Node/BigInt reimplementation of the port's own algorithm
 * was run against both fixtures below during development; every
 * control point matched within 2e-4, well inside `compareSvg`'s 0.01
 * tolerance — see `.agent-notes/T8-symbols-paths.md`).
 *
 * Text measurement seam (see `symbols-component.test.ts`'s module doc
 * comment for the full rationale): `fooLabelTextBlock`/
 * `multiLineLabelTextBlock`/`packageTitleTextBlock` below hardcode real
 * jar-measured widths/heights rather than reproducing a font-metrics
 * engine — this task's conformance obligation is the CHROME each class
 * draws around whatever dimension/draw behavior its label/title/
 * stereotype parameters report.
 */
import { describe, expect, test } from 'vitest';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import { textBlockMagneticBorder } from '../../../../src/core/klimt/shape/TextBlock.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { UText, FontStyle } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { SymbolContext } from '../../../../src/core/decoration/symbol/SymbolContext.js';
import { USymbolCloud } from '../../../../src/core/decoration/symbol/USymbolCloud.js';
import { USymbolFolder } from '../../../../src/core/decoration/symbol/USymbolFolder.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';

// ---------------------------------------------------------------------------
// Shared fixtures — see the module doc comment above for full provenance.
// ---------------------------------------------------------------------------

const PLAIN_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };
const BOLD_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set([FontStyle.BOLD]) };

const FOO_LABEL_WIDTH = 24.7051;
const FOO_LABEL_HEIGHT = 16.4883;
const FOO_BASELINE_DY = 13.5352;

/** A `TextBlock` test double standing in for a real BodyFactory-built
 * "Foo" label — see the module doc comment above ("Text measurement
 * seam"). */
function fooLabelTextBlock(): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(FOO_LABEL_WIDTH, FOO_LABEL_HEIGHT),
    drawU: (ug) => {
      ug.apply(new UTranslate(0, FOO_BASELINE_DY)).draw(UText.build('Foo', PLAIN_FONT));
    },
  };
}

const emptyTextBlock: TextBlock = {
  calculateDimension: () => new XDimension2D(0, 0),
  drawU: () => {
    // no-op: this stub carries no drawable content.
  },
};

/** A `TextBlock` test double with a fixed, caller-chosen dimension that
 * draws a plain `URectangle` of that same size — used by this suite's
 * `asBig` behavioral tests (below). */
function fixedTextBlock(width: number, height: number): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(width, height),
    drawU: (ug) => {
      ug.draw(URectangle.build(width, height));
    },
  };
}

/** A multi-line label test double for the "big cloud" fixture (real
 * jar-measured per-line widths/heights — see the module doc comment's
 * "Text measurement seam" note). Real jar source: `cloud "<line 1>
 * \nLine two\nLine three\nLine four\nLine five\nLine six"` — six lines
 * stacked with the SAME per-line height as `fooLabelTextBlock`'s
 * `FOO_LABEL_HEIGHT` (16.4883, a font-metrics constant independent of
 * text content — confirmed by the jar's own six baseline positions all
 * differing by exactly that amount), each left-aligned (all six
 * `<text>` elements share the same real jar `x`), starting at baseline
 * `FOO_BASELINE_DY` (also the SAME universal constant `Foo` uses).
 */
const CLOUD_BIG_LINES: ReadonlyArray<{ text: string; width: number }> = [
  { text: 'This is quite a long cloud label to force width over one hundred pixels', width: 477.5859 },
  { text: 'Line two', width: 57.0527 },
  { text: 'Line three', width: 67.6826 },
  { text: 'Line four', width: 60.5938 },
  { text: 'Line five', width: 56.6699 },
  { text: 'Line six', width: 52.1992 },
];
const CLOUD_BIG_LABEL_WIDTH = 477.5859;
const CLOUD_BIG_LABEL_HEIGHT = CLOUD_BIG_LINES.length * FOO_LABEL_HEIGHT; // 98.9298

function multiLineLabelTextBlock(): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(CLOUD_BIG_LABEL_WIDTH, CLOUD_BIG_LABEL_HEIGHT),
    drawU: (ug) => {
      CLOUD_BIG_LINES.forEach((line, i) => {
        const y = FOO_BASELINE_DY + i * FOO_LABEL_HEIGHT;
        ug.apply(new UTranslate(0, y)).draw(UText.build(line.text, PLAIN_FONT));
      });
    },
  };
}

/** The `package Foo` title block — real jar-measured facts: a bold
 * "Foo"@14pt reports `textLength="25.9219"` (wider than the plain
 * `FOO_LABEL_WIDTH` — bold glyphs are wider), and (independently
 * derived from the real jar's tab-notch geometry minus
 * `USymbolFolder`'s own `marginTitleX1/X2` constants) an overall title
 * BLOCK dimension of `(37.9219, 16.4883)` with its own `<text>` drawn
 * at internal `(6, 13.5352)` — i.e. the title block carries its own
 * 6px left AND right padding around the bold glyph run (real
 * BodyFactory title-block convention, independent of `USymbolFolder`).
 */
const PACKAGE_TITLE_WIDTH = 37.9219;
const PACKAGE_TITLE_HEIGHT = FOO_LABEL_HEIGHT;
const PACKAGE_TITLE_TEXT_WIDTH = 25.9219;
const PACKAGE_TITLE_TEXT_X_OFFSET = 6;

function packageTitleTextBlock(): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(PACKAGE_TITLE_WIDTH, PACKAGE_TITLE_HEIGHT),
    drawU: (ug) => {
      ug.apply(new UTranslate(PACKAGE_TITLE_TEXT_X_OFFSET, FOO_BASELINE_DY)).draw(UText.build('Foo', BOLD_FONT));
    },
  };
}

/** Real jar style/geometry facts common to every fixture below:
 * `backColor=#F1F1F1`, `foreColor=#181818`, `stroke-width=0.5`,
 * `roundCorner=5` (rendered as `rx=ry=2.5`/`rx=ry=3.75` — see
 * `USymbolFolder.ts`'s `folderPath` — `USymbolCloud` never reads
 * `roundCorner` at all, so the same context fixture is reused for both
 * symbols), no shadow, no diagonal corner. */
function fooSymbolContext(): SymbolContext {
  return new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 0, 5, 0);
}

function newGraphic(stringBounder: DriverStringBounder = stubDriverStringBounder): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stringBounder);
}

const stubDriverStringBounder: DriverStringBounder = {
  calculateDimension(_font, text) {
    // Only real jar-measured widths appear here (matching
    // `symbols-component.test.ts`'s own `jarStringBounder` convention).
    if (text === 'Foo') return { width: FOO_LABEL_WIDTH };
    const line = CLOUD_BIG_LINES.find((l) => l.text === text);
    if (line !== undefined) return { width: line.width };
    return { width: 0 };
  },
};

/** A second stringBounder used ONLY by the `package Foo` fixtures below.
 * `DriverTextSvg`'s real `calculateDimension` call only forwards
 * `{family, size}` to the `StringBounder` (see `driver-text-svg.ts`) —
 * NOT the bold/italic style flags — so a single shared bounder cannot
 * report two different widths for the same ("Foo", sans-serif, 14)
 * key depending on which `FontConfiguration` drew it. Real bold glyphs
 * genuinely measure wider than regular ones (a real font-metrics
 * engine fact, not a `USymbolFolder` concern), so this task's package
 * fixtures use their own bounder reporting the REAL bold-"Foo"
 * jar-measured width instead. */
const packageStringBounder: DriverStringBounder = {
  calculateDimension(_font, text) {
    if (text === 'Foo') return { width: PACKAGE_TITLE_TEXT_WIDTH };
    return { width: 0 };
  },
};

/** Extracts the content of this port's single top-level `<g>...</g>`
 * (see `symbols-component.test.ts`'s identical helper). */
function extractTopGroup(svg: string): string {
  const match = /<g>([\s\S]*)<\/g><\/svg>$/.exec(svg);
  if (match === null) throw new Error('extractTopGroup: no top-level <g>...</g><\/svg> found');
  const inner = match[1];
  if (inner === undefined) throw new Error('extractTopGroup: capture group did not match');
  return inner;
}

/** Wraps a fragment (ours or the jar's) in the SAME minimal document on
 * both sides — root attrs are therefore never compared, only the
 * fragment's own shapes. */
function wrapFragment(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><g>${inner}</g></svg>`;
}

function render(asSmall: TextBlock, stringBounder?: DriverStringBounder): string {
  const ug = newGraphic(stringBounder);
  asSmall.drawU(ug);
  return wrapFragment(extractTopGroup(ug.getSvgString()));
}

function expectConformant(ours: string, jarFragment: string): void {
  const { pass, diffs } = compareSvg(ours, wrapFragment(jarFragment), 'deterministic');
  expect(pass, `first diff: ${JSON.stringify(diffs[0])}`).toBe(true);
}

// ---------------------------------------------------------------------------
// Reference fragments (jar-derived, rebased by (-7,-7) — see provenance note)
// ---------------------------------------------------------------------------

// `cloud Foo` — USymbolCloud.java#asSmall: width=54.7051, height=46.4883
// (margin 15*4 + Foo's own 24.7051x16.4883), `width>100 && height>100` is
// false so the bump loop takes the SIMPLE (4-segment) branch — 8 cubic
// segments total.
const JAR_CLOUD_SMALL_FOO =
  '<path d="M8.5008,8.0049 C13.7631,-1.6193 20.9788,-1.6251 28.0492,5.9498 C35.8647,-1.4782 43.0316,-1.8206 48.5216,8.6149 ' +
  'C55.9845,12.3548 58.7586,16.5376 52.0101,23.5884 C59.1891,30.1228 55.3842,37.3486 47.493,39.6429 ' +
  'C44.9849,50.384 36.7968,55.2771 27.6578,46.3198 C19.4505,52.464 11.0003,47.972 9.4659,38.5308 ' +
  'C0.7217,36.8636 0.6224,31.7091 4.7332,25.4063 C-1.1939,18.8278 -0.3381,11.3864 8.5008,8.0049" ' +
  'style="stroke:#181818;stroke-width:0.5;" fill="#F1F1F1"/>' +
  '<text x="15" y="28.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// `cloud "<6 lines>"` — width=507.5859, height=128.9298 (margin 15*4 +
// the widest line 477.5859 x six stacked lines' 98.9298), both >100 so
// the bump loop takes the COMPLEX (8-segment, corner-anchored) branch —
// 36 cubic segments total (vs. the small fixture's 8).
const JAR_CLOUD_BIG_FOO =
  '<path d="M21.2423,8.5428 C33.1508,-4.0482 46.9384,-6.6854 54.6474,12.9025 C61.4579,-4.4493 73.56,-7.0817 85.3665,8.1994 ' +
  'C94.7388,-6.0164 111.7706,-9.8683 120.9976,8.3591 C131.4126,-4.9464 143.9431,-4.2413 151.5799,11.3041 ' +
  'C161.9082,-9.1308 178.4684,-9.2008 189.6909,10.4541 C196.694,-5.2677 210.7018,-9.319 221.7445,6.3261 ' +
  'C234.3231,-8.497 249.6083,-9.5956 259.502,9.33 C268.9686,-5.3903 282.3279,-8.211 294.1658,6.541 ' +
  'C302.8305,-8.9165 314.5675,-5.709 323.5306,6.2209 C335.0702,-10.1227 349.2566,-3.8493 356.5962,10.7142 ' +
  'C364.27,-8.9563 381.7815,-5.021 391.4375,8.6424 C400.4844,-9.2758 418.9375,-12.1033 428.7029,7.937 ' +
  'C438.3285,-8.8875 454.0031,-7.968 462.7496,8.8272 C478.3113,-7.1873 490.0932,-5.2026 499.5859,15 ' +
  'C502.3155,16.3327 502.2577,17.8227 500.0808,19.6748 C523.8336,28.8498 526.1833,48.7082 507.2738,64.6989 ' +
  'C531.0488,89.994 523.6354,109.9551 492.5859,120.9297 C496.1694,119.3089 498.2052,122.0104 497.6829,125.2423 ' +
  'C489.2598,145.27 471.2723,144.0768 460.0069,128.227 C448.0483,146.2321 437.7604,144.0297 426.4942,127.554 ' +
  'C417.6722,144.1213 402.5072,148.5288 390.5972,130.7847 C381.6997,145.8278 370.4017,143.4984 362.4356,129.8698 ' +
  'C351.1659,144.3222 337.9576,145.1619 327.5474,128.8937 C319.652,144.6363 302.9732,144.898 293.7118,130.4232 ' +
  'C280.6844,148.2348 268.4483,147.1963 254.7233,131.2283 C244.0853,145.5087 231.2088,145.6059 222.2323,129.4544 ' +
  'C213.5292,146.3899 201.2727,146.156 190.6986,131.3109 C177.2649,149.2473 163.7613,147.3527 151.6416,129.8622 ' +
  'C143.206,143.9764 132.1302,145.2347 122.6628,130.9138 C109.5722,149.4947 93.0348,145.2457 84.4725,126.3049 ' +
  'C75.1542,143.6556 63.6581,141.5861 53.0951,127.5491 C32.0943,141.8376 16.3841,141.4163 8,113.9297 ' +
  'C9.6262,113.2125 10.4115,113.9018 10.3288,115.5866 C-12.7047,102.4938 -11.7752,82.5916 7.1363,66.7565 ' +
  'C-19.1035,43.1252 -17.7869,23.7314 15,8 C16.9943,5.4219 19.7395,5.4682 21.2423,8.5428" ' +
  'style="stroke:#181818;stroke-width:0.5;" fill="#F1F1F1"/>' +
  '<text x="15" y="28.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="477.5859" font-family="sans-serif">' +
  'This is quite a long cloud label to force width over one hundred pixels</text>' +
  '<text x="15" y="45.0234" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="57.0527" font-family="sans-serif">Line two</text>' +
  '<text x="15" y="61.5117" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="67.6826" font-family="sans-serif">Line three</text>' +
  '<text x="15" y="78" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="60.5938" font-family="sans-serif">Line four</text>' +
  '<text x="15" y="94.4883" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="56.6699" font-family="sans-serif">Line five</text>' +
  '<text x="15" y="110.9766" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="52.1992" font-family="sans-serif">Line six</text>';

// `folder Foo` — USymbolFolder.java (showTitle=false): wtitle=46 (the
// showTitle=false fallback (40,15) + marginTitleX1/X2), htitle=21,
// width=70, height=54.4883, roundCorner=5 (half=2.5).
const JAR_FOLDER_FOO =
  '<path d="M2.5,0 L43.5,0 A3.75,3.75 0 0 1 46,2.5 L53,21 L67.5,21 A2.5,2.5 0 0 1 70,23.5 L70,51.9883 ' +
  'A2.5,2.5 0 0 1 67.5,54.4883 L2.5,54.4883 A2.5,2.5 0 0 1 0,51.9883 L0,2.5 A2.5,2.5 0 0 1 2.5,0" ' +
  'style="stroke:#181818;stroke-width:0.5;" fill="#F1F1F1"/>' +
  '<line x1="0" y1="21" x2="53" y2="21" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="10" y="41.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// `package Foo` — USymbolFolder.java (showTitle=true): wtitle=43.9219
// (the REAL bold-"Foo" title dimension + marginTitleX1/X2),
// htitle=22.4883, width=67.9219, height=39.4883, roundCorner=5.
const JAR_PACKAGE_FOO =
  '<path d="M2.5,0 L41.4219,0 A3.75,3.75 0 0 1 43.9219,2.5 L50.9219,22.4883 L65.4219,22.4883 A2.5,2.5 0 0 1 67.9219,24.9883 ' +
  'L67.9219,36.9883 A2.5,2.5 0 0 1 65.4219,39.4883 L2.5,39.4883 A2.5,2.5 0 0 1 0,36.9883 L0,2.5 A2.5,2.5 0 0 1 2.5,0" ' +
  'style="stroke:#181818;stroke-width:0.5;" fill="#F1F1F1"/>' +
  '<line x1="0" y1="22.4883" x2="50.9219" y2="22.4883" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="10" y="16.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="25.9219" font-weight="700" font-family="sans-serif">Foo</text>';

// ---------------------------------------------------------------------------
// Conformance tests (AC1/AC2)
// ---------------------------------------------------------------------------

describe('USymbolCloud (T8, AC1/AC2) — bump-generated cloud frontier', () => {
  test('asSmall renders conformant vs. the jar fragment (cloud Foo, SIMPLE branch)', () => {
    const symbol = new USymbolCloud();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_CLOUD_SMALL_FOO);
  });

  test('asSmall renders conformant vs. the jar fragment (6-line cloud label, COMPLEX branch)', () => {
    const symbol = new USymbolCloud();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, multiLineLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_CLOUD_BIG_FOO);
  });

  test('AC2: the two fixtures produce a different bump-segment COUNT (8 vs. 36 cubic curves)', () => {
    const ctx1 = fooSymbolContext();
    const small = new USymbolCloud().asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx1, HorizontalAlignment.CENTER);
    const ctx2 = fooSymbolContext();
    const big = new USymbolCloud().asSmall(emptyTextBlock, multiLineLabelTextBlock(), emptyTextBlock, ctx2, HorizontalAlignment.CENTER);

    const smallSvg = render(small);
    const bigSvg = render(big);
    const countCubics = (svg: string): number => (svg.match(/<path d="([^"]*)"/)?.[1]?.match(/C/g) ?? []).length;

    expect(countCubics(smallSvg)).toBe(8);
    expect(countCubics(bigSvg)).toBe(36);
  });

  test('getSNames reports "cloud"', () => {
    expect(new USymbolCloud().getSNames()).toEqual(['cloud']);
  });

  test('coverage: a tiny cloud (empty label) exercises bubbleLine\'s nb===0 fallback', () => {
    // width=height=30 (margin 15*2 + an empty 0x0 label) puts every one
    // of the four sides' half-segments (post `specialLine` split) well
    // under `bubbleSize` (11), forcing `USymbolCloud.java#bubbleLine`'s
    // `if (nb == 0) { bubbleSize = length / 2; ... }` re-derivation
    // branch — otherwise unreached by every jar-conformance fixture
    // above (all comfortably larger).
    const symbol = new USymbolCloud();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const svg = render(asSmall);
    expect(svg).toContain('<path d="M');
  });
});

describe('USymbolFolder (T8, AC1/AC3) — folder (showTitle=false)', () => {
  test('asSmall renders conformant vs. the jar fragment (folder Foo)', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_FOLDER_FOO);
  });

  test('getSNames reports whatever SName the constructor was given', () => {
    expect(new USymbolFolder('folder', false).getSNames()).toEqual(['folder']);
  });

  test('toString appends the showTitle flag (bug-for-bug: USymbolFolder.java#toString)', () => {
    expect(new USymbolFolder('folder', false).toString()).toMatch(/false$/);
  });
});

describe('USymbolFolder (T8, AC1/AC3) — package (showTitle=true)', () => {
  test('asSmall renders conformant vs. the jar fragment (package Foo)', () => {
    const symbol = new USymbolFolder('package', true);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(packageTitleTextBlock(), emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall, packageStringBounder), JAR_PACKAGE_FOO);
  });

  test('getSNames reports "package"', () => {
    expect(new USymbolFolder('package', true).getSNames()).toEqual(['package']);
  });
});

describe('USymbolFolder/asSmall — roundCorner=0 branch (coverage)', () => {
  test('draws a plain UPolygon outline (not the arced UPath) when roundCorner is 0', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 0, 0, 0);
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    asSmall.drawU(ug);
    const svg = ug.getSvgString();
    // USymbolFolder.java#drawFolder, roundCorner===0 branch: a closed
    // polygon (0,0)-(wtitle,0)-(wtitle+7,htitle)-(width,htitle)-
    // (width,height)-(0,height)-(0,0); wtitle=46, htitle=21 (see the
    // dimension test above), width=70, height=54.4883.
    expect(svg).toContain('<polygon points="0,0,46,0,53,21,70,21,70,54.4883,0,54.4883,0,0"');
    expect(svg).not.toMatch(/<path d="[^"]*A/);
  });
});

describe('USymbolFolder vs USymbolCloud (AC2) — distinct jar shapes', () => {
  test('folder and package produce two different fragments for the same real jar geometry', () => {
    const ctx1 = fooSymbolContext();
    const folderSvg = render(new USymbolFolder('folder', false).asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx1, HorizontalAlignment.CENTER));
    const ctx2 = fooSymbolContext();
    const packageSvg = render(new USymbolFolder('package', true).asSmall(packageTitleTextBlock(), emptyTextBlock, emptyTextBlock, ctx2, HorizontalAlignment.CENTER), packageStringBounder);

    expect(folderSvg).not.toBe(packageSvg);
    expectConformant(folderSvg, JAR_FOLDER_FOO);
    expectConformant(packageSvg, JAR_PACKAGE_FOO);
    expect(compareSvg(folderSvg, wrapFragment(JAR_PACKAGE_FOO), 'deterministic').pass).toBe(false);
    expect(compareSvg(packageSvg, wrapFragment(JAR_FOLDER_FOO), 'deterministic').pass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC3: folder tab-dimension formula coverage (USymbolFolder.java's own
// getWTitle/getHTitle constants), verified against the REAL jar numbers
// above rather than re-derived independently.
// ---------------------------------------------------------------------------

describe('USymbolFolder tab-dimension formulas (AC3)', () => {
  test('showTitle=false: wtitle/htitle come from the (40,15) fallback + marginTitleX1/X2/Y1/Y2 (3,3,3,3)', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const dim = asSmall.calculateDimension({} as never);
    // wtitle = 40+3+3 = 46; htitle = 15+3+3 = 21; the hline's own
    // dx/dy (JAR_FOLDER_FOO) directly encode wtitle+7 / htitle.
    expect(dim.getWidth()).toBeCloseTo(70, 4);
    expect(dim.getHeight()).toBeCloseTo(54.4883, 4);
  });

  test('showTitle=true: wtitle/htitle come from the REAL title dimension + marginTitleX1/X2/Y1/Y2', () => {
    const symbol = new USymbolFolder('package', true);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(packageTitleTextBlock(), emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const dim = asSmall.calculateDimension({} as never);
    // wtitle = 37.9219+3+3 = 43.9219; htitle = 16.4883+3+3 = 22.4883.
    expect(dim.getWidth()).toBeCloseTo(67.9219, 4);
    expect(dim.getHeight()).toBeCloseTo(39.4883, 4);
  });
});

describe('USymbolFolder#getMagneticBorder (AC3, behavioral — not jar-rendered: no visual output)', () => {
  test('pulls a point inside the tab straight down by htitle', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const border = textBlockMagneticBorder(asSmall);
    // wtitle=46, htitle=21 (see the dimension test above). A point at
    // x=50 (>=wtitle), y=10 (inside [0,htitle]) sits ABOVE the tab's
    // slanted top edge -> USymbolFolder.java's first `if` branch.
    const force = border.getForceAt({ x: 50, y: 10 }, {} as never);
    expect(force.getDx()).toBe(0);
    expect(force.getDy()).toBe(21);
  });

  test('linearly ramps the force across the slanted tab edge (marginTitleX3=7 zone)', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const border = textBlockMagneticBorder(asSmall);
    // wtitle=46, marginTitleX3=7 -> ramp zone is x in [39, 46], y<=0.
    // Halfway (x=42.5, delta=3.5, how=3.5/14=0.25) -> dy = htitle*0.25.
    const force = border.getForceAt({ x: 42.5, y: 0 }, {} as never);
    expect(force.getDx()).toBe(0);
    expect(force.getDy()).toBeCloseTo(21 * 0.25, 6);
  });

  test('exerts no force far outside the tab', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const border = textBlockMagneticBorder(asSmall);
    const force = border.getForceAt({ x: 5, y: 30 }, {} as never);
    expect(force.getDx()).toBe(0);
    expect(force.getDy()).toBe(0);
  });

  test('throws if called without a stringBounder (this implementation genuinely needs one to re-measure)', () => {
    const symbol = new USymbolFolder('folder', false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const border = textBlockMagneticBorder(asSmall);
    expect(() => border.getForceAt({ x: 0, y: 0 })).toThrow(/stringBounder/);
  });
});

// ---------------------------------------------------------------------------
// asBig behavioral coverage (T8 quality bar — 90/90/90; not jar-conformance,
// see the module doc comment's "Text measurement seam" note).
// ---------------------------------------------------------------------------

const WIDTH = 100;
const HEIGHT = 50;

describe('USymbolCloud/asBig', () => {
  test('draws the bump chrome plus centered stereotype/title at the computed positions', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolCloud();
    const ctx = fooSymbolContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    expect(big.calculateDimension({} as never)).toEqual(new XDimension2D(WIDTH, HEIGHT));

    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).toContain('x="42" y="13" width="16" height="8"'); // stereotype: (100-16)/2=42
    expect(svg).toContain('x="40" y="21" width="20" height="10"'); // title: (100-20)/2=40, y=13+8
  });
});

describe('USymbolFolder/asBig', () => {
  test('draws the tab, title, and stereotype at the computed positions', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolFolder('package', true);
    const ctx = fooSymbolContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    expect(big.calculateDimension({} as never)).toEqual(new XDimension2D(WIDTH, HEIGHT));

    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    // htitle = dimTitle.getHeight()+3+3 = 16; title drawn at (4,2).
    expect(svg).toContain('x="4" y="2" width="20" height="10"');
    // stereotype: posStereo=(100-16)/2=42 -> (4+42, 2+16) = (46, 18).
    expect(svg).toContain('x="46" y="18" width="16" height="8"');
  });

  test('getMagneticBorder reads the REAL title dimension (not the showTitle fallback)', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolFolder('package', true);
    const ctx = fooSymbolContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    const border = textBlockMagneticBorder(big);
    // wtitle = 20+3+3 = 26; a point inside [0,htitle=16] at x=30 (>=26)
    // is pulled down by htitle.
    const force = border.getForceAt({ x: 30, y: 5 }, {} as never);
    expect(force.getDy()).toBe(16);
  });
});
