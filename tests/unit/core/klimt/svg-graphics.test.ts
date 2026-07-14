import { describe, expect, it } from 'vitest';
import {
  SvgGraphics,
  basicSvgOption,
  LengthAdjust,
  TransparentFillBehavior,
  getMetadataHex,
} from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import { seedOf } from '../../../../src/core/klimt/drawing/svg/svg-graphics-core.js';
import { UGroupType } from '../../../../src/core/klimt/shape/UGroup.js';
import { UPath, USegmentType } from '../../../../src/core/klimt/shape/UPath.js';

const noText = {
  fontFamily: null,
  fontSize: 12,
  fontWeight: null,
  fontStyle: null,
  textDecoration: null,
  textLength: 5,
  attributes: new Map<string, string>(),
  textBackColor: null,
} as const;

describe('SvgGraphics — document preamble (D4′, AC1)', () => {
  it('matches the jar preamble attr-for-attr for an empty document (w=79, h=301, DESCRIPTION)', () => {
    const svg = new SvgGraphics(
      0,
      basicSvgOption({
        minDim: { width: 78.5, height: 300.5 },
        backcolor: '#FFFFFF',
        rootAttributes: new Map([['data-diagram-type', 'DESCRIPTION']]),
      }),
      '$version$',
    );
    const xml = svg.createXml();
    expect(xml).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
        ' version="1.1" data-diagram-type="DESCRIPTION"' +
        ' style="width:79px;height:301px;background:#FFFFFF;" width="79px" height="301px"' +
        ' viewBox="0 0 79 301" zoomAndPan="magnify" preserveAspectRatio="none"' +
        ' contentStyleType="text/css"><?plantuml $version$?><defs/><g/></svg>',
    );
  });

  it('emits a <style> hover rule into <defs> when option.hover is set', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ hover: '#FF0000' }), 'v');
    expect(svg.createXml()).toContain(
      '<style type="text/css"><![CDATA[path:hover { stroke: #FF0000 !important;}]]></style>',
    );
  });

  it('interactive mode setup is a structurally-faithful no-op (no resource bundle)', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ interactiveBaseFilename: 'diagram' }), 'v');
    expect(svg.createXml()).toContain('<defs/>');
  });

  it('adds <title> and <desc> children when option.title/desc are set', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ title: 'My Diagram', desc: 'A description' }), 'v');
    const xml = svg.createXml();
    expect(xml).toContain('<title>My Diagram</title>');
    expect(xml).toContain('<desc>A description</desc>');
  });

  it('omits style/width/height root attributes when svgDimensionStyle is false', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ svgDimensionStyle: false }), 'v');
    const xml = svg.createXml();
    expect(xml).not.toContain(' style="width');
    expect(xml).toContain('viewBox="0 0 10 10"');
  });

  it('registers a gradient def and paints the backing rect when backcolor is a Gradient', () => {
    const svg = new SvgGraphics(
      0,
      basicSvgOption({ backcolor: { color1: '#FF0000', color2: '#00FF00', policy: '/' } }),
      'v',
    );
    const xml = svg.createXml();
    expect(xml).toContain('<linearGradient x1="0%" y1="0%" x2="100%" y2="100%" id="g00">');
    expect(xml).toContain('<rect x="0" y="0" width="10" height="10" fill="url(#g00)" style="stroke:none;stroke-width:1;"/>');
    expect(xml).not.toContain('background:');
  });

  it('paints the backing rect for a non-excluded plain backcolor', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ backcolor: '#123456' }), 'v');
    const xml = svg.createXml();
    expect(xml).toContain('background:#123456;');
    expect(xml).toContain('fill="#123456"');
  });

  it('does not paint a backing rect for #00000000/#000000/#FFFFFF (upstream exclusion list)', () => {
    for (const color of ['#00000000', '#000000', '#FFFFFF']) {
      const svg = new SvgGraphics(0, basicSvgOption({ backcolor: color }), 'v');
      expect(svg.createXml()).not.toContain('<rect');
    }
  });
});

describe('SvgGraphics — number formatting (D4′, AC2)', () => {
  it('formats fractional ellipse coordinates matching the jar (cited: test-results/dot-cache/component/babafi-51-dixi026/in.svg — <ellipse cx="32.4688" cy="14" rx="8" ry="8" .../>)', () => {
    const svg = new SvgGraphics(1, basicSvgOption(), 'v');
    svg.svgEllipse(32.4688, 14, 8, 8, 0);
    expect(svg.createXml()).toContain(
      '<ellipse cx="32.4688" cy="14" rx="8" ry="8" fill="black" style="stroke:black;stroke-width:1;"/>',
    );
  });

  it('drops a trailing .0000 to a bare integer, and trims trailing zeros otherwise', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgEllipse(10, 10.5, 3.14159, 3, 0);
    expect(svg.createXml()).toContain('cx="10" cy="10.5" rx="3.1416" ry="3"');
  });

  it("rounds HALF_UP off the shortest round-trip decimal, not the double's raw binary value (Java %.4f semantics -- jar: java.util.Formatter's FloatingDecimal-based conversion; component/luniju-97-tuja870 pins textLength=\"8.6938\" for a value whose true binary double is 8.6937499999999996, which naive toFixed(4) rounds DOWN to \"8.6937\")", () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    // 10.7 * 0.8125 === 8.69375 as a JS literal, but its exact IEEE754
    // double value is 8.6937499999999996447... -- toFixed(4) rounds off
    // that exact binary value (giving "8.6937"), while Java's %.4f rounds
    // off the value's shortest round-trip decimal string "8.69375"
    // (giving "8.6938"). This test pins the jar-matching behavior.
    svg.svgEllipse(8.69375, 10, 3, 3, 0);
    expect(svg.createXml()).toContain('cx="8.6938"');
  });
});

describe('SvgGraphics — gradients (D2′, AC3)', () => {
  it('dedups identical gradient registrations to one def with a stable seed/counter id', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    const id1 = svg.createSvgGradient('#FF0000', '#00FF00', '/');
    const id2 = svg.createSvgGradient('#FF0000', '#00FF00', '/');
    expect(id1).toBe(id2);
    expect(id1).toBe('g00');

    const id3 = svg.createSvgGradient('#0000FF', '#FFFFFF', '|');
    expect(id3).toBe('g01');

    const xml = svg.createXml();
    expect((xml.match(/<linearGradient/g) ?? []).length).toBe(2);
  });

  it.each([
    ['|', '0%', '50%', '100%', '50%'],
    ['\\', '0%', '100%', '100%', '0%'],
    ['-', '50%', '0%', '50%', '100%'],
    ['/', '0%', '0%', '100%', '100%'],
  ])('policy %s resolves to the upstream gradient vector', (policy, x1, y1, x2, y2) => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.createSvgGradient('#FFFFFF', '#000000', policy);
    expect(svg.createXml()).toContain(`x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`);
  });

  it('an unrecognized policy falls through to the "/" vector (upstream default branch)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.createSvgGradient('#FFFFFF', '#000000', '?');
    expect(svg.createXml()).toContain('x1="0%" y1="0%" x2="100%" y2="100%"');
  });

  it('emits two <stop> children (0%/100% offsets) per gradient', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.createSvgGradient('#AAAAAA', '#BBBBBB', '/');
    const xml = svg.createXml();
    expect(xml).toContain('<stop stop-color="#AAAAAA" offset="0%"/>');
    expect(xml).toContain('<stop stop-color="#BBBBBB" offset="100%"/>');
  });
});

describe('SvgGraphics — bigint seed (D8): 19-digit/unsafe-integer seeds', () => {
  // Provenance: `java -jar ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar
  // -tsvg -pipe` fed the exact 3-line source below (LF-joined, no trailing
  // newline) produced:
  //   <linearGradient x1="0%" y1="0%" x2="100%" y2="100%" id="ga1lkcxsvvc1d0">
  // i.e. gradientId "g" + base36(abs(seed)) "a1lkcxsvvc1d" + counter "0".
  // base36("a1lkcxsvvc1d") === 1322063392101289393n (19 digits, unsafe —
  // exceeds Number.MAX_SAFE_INTEGER, 9007199254740991). The real
  // `UmlSource.seed()` value for that source is the signed 64-bit fold,
  // -1322063392101289393n (its abs is the id's base36 payload).
  const JAR_SOURCE = ['@startuml', 'component Foo #FF0000/00FF00', '@enduml'].join('\n');
  const JAR_SEED = -1322063392101289393n;

  it('seedOf reproduces the jar-verified UmlSource.seed() value exactly', () => {
    expect(seedOf(JAR_SOURCE)).toBe(JAR_SEED);
  });

  it('a 19-digit bigint seed drives gradient ids matching the jar byte-for-byte across two registrations', () => {
    const svg = new SvgGraphics(JAR_SEED, basicSvgOption(), 'v');
    const id1 = svg.createSvgGradient('#FF0000', '#00FF00', '/');
    expect(id1).toBe('ga1lkcxsvvc1d0');

    const id2 = svg.createSvgGradient('#0000FF', '#FFFFFF', '|');
    expect(id2).toBe('ga1lkcxsvvc1d1');

    const xml = svg.createXml();
    expect(xml).toContain('<linearGradient x1="0%" y1="0%" x2="100%" y2="100%" id="ga1lkcxsvvc1d0">');
  });

  it('threading seedOf(source) straight into SvgGraphics matches the jar id end to end', () => {
    const svg = new SvgGraphics(seedOf(JAR_SOURCE), basicSvgOption(), 'v');
    const id = svg.createSvgGradient('#FF0000', '#00FF00', '/');
    expect(id).toBe('ga1lkcxsvvc1d0');
  });

  it('a plain number seed (existing call sites) keeps producing the same ids as before (no behavior change)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(svg.createSvgGradient('#FF0000', '#00FF00', '/')).toBe('g00');
  });

  it("Long.MIN_VALUE seed overflow: Math.abs stays negative, base36 keeps the leading '-' (Java parity)", () => {
    const svg = new SvgGraphics(-(2n ** 63n), basicSvgOption(), 'v');
    expect(svg.createSvgGradient('#000000', '#FFFFFF', '/')).toBe('g-1y2p0ij32e8e80');
  });
});

describe('SvgGraphics — groups & comments (AC4)', () => {
  it('startGroup + addComment match upstream <g> attrs and <!--comment--> emission', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.addComment('entity X');
    svg.startGroup(
      new Map<UGroupType, string>([
        [UGroupType.CLASS, 'entity'],
        [UGroupType.DATA_QUALIFIED_NAME, 'Pack1.Comp1'],
        [UGroupType.DATA_UID, 'ent0002'],
        [UGroupType.DATA_SOURCE_LINE, '4'],
      ]),
    );
    svg.svgRectangle({ x: 0, y: 0, width: 10, height: 10, rx: 0, ry: 0 }, 0);
    svg.closeGroup();

    const xml = svg.createXml();
    expect(xml).toContain('<!--entity X-->');
    expect(xml).toContain(
      '<g class="entity" data-qualified-name="Pack1.Comp1" id="ent0002" data-source-line="4">' +
        '<rect x="0" y="0" width="10" height="10" fill="black" style="stroke:black;stroke-width:1;"/></g>',
    );
  });

  it('drops an empty group entirely (no children appended)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.startGroup(new Map([[UGroupType.CLASS, 'entity']]));
    svg.closeGroup();
    expect(svg.createXml()).not.toContain('class="entity"');
  });

  it('startGroup throws for an empty typeIdents map', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.startGroup(new Map())).toThrow();
  });

  it('closeGroup throws when there is no pending element', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.closeGroup()).toThrow();
  });
});

describe('SvgGraphics — fill/stroke state', () => {
  it('splits an 8-hex fill into fill + fill-opacity (fillMe alpha branch)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setFillColor('#11223380');
    svg.svgRectangle({ x: 0, y: 0, width: 5, height: 5, rx: 0, ry: 0 }, 0);
    expect(svg.createXml()).toContain('fill="#112233" fill-opacity="0.50196"');
  });

  it('WITH_FILL_NONE converts "#00000000" to fill="none"', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setFillColor('#00000000');
    svg.svgRectangle({ x: 0, y: 0, width: 5, height: 5, rx: 0, ry: 0 }, 0);
    expect(svg.createXml()).toContain('fill="none"');
  });

  it('WITH_FILL_OPACITY preserves "#00000000" for fillMe to split into fill+fill-opacity', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setFillColor('#00000000', TransparentFillBehavior.WITH_FILL_OPACITY);
    svg.svgRectangle({ x: 0, y: 0, width: 5, height: 5, rx: 0, ry: 0 }, 0);
    expect(svg.createXml()).toContain('fill="#000000" fill-opacity="0.00000"');
  });

  it('WITH_FILL_OPACITY falls back to fixColor(null) when fill is null', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setFillColor(null, TransparentFillBehavior.WITH_FILL_OPACITY);
    svg.svgRectangle({ x: 0, y: 0, width: 5, height: 5, rx: 0, ry: 0 }, 0);
    expect(svg.createXml()).toContain('fill="none"');
  });

  it('setStrokeColor(null) maps to stroke:none', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setStrokeColor(null);
    svg.svgLine(0, 0, 5, 5, 0);
    expect(svg.createXml()).toContain('style="stroke:none;stroke-width:1;"');
  });

  it('setStrokeWidth(0, ...) makes styleMe a no-op (no style attribute at all)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setStrokeWidth(0, null);
    svg.svgLine(0, 0, 5, 5, 0);
    expect(svg.createXml()).toContain('<line x1="0" y1="0" x2="5" y2="5"/>');
  });

  it('setStrokeWidth with a dasharray sets stroke-dasharray', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setStrokeWidth(2, [4, 2]);
    svg.svgLine(0, 0, 5, 5, 0);
    expect(svg.createXml()).toContain('style="stroke:black;stroke-width:2;stroke-dasharray:4,2;"');
  });
});

describe('SvgGraphics — shapes', () => {
  it('svgRectangle is a no-op for zero or negative width/height', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgRectangle({ x: 0, y: 0, width: 0, height: 10, rx: 0, ry: 0 }, 0);
    svg.svgRectangle({ x: 0, y: 0, width: 10, height: -1, rx: 0, ry: 0 }, 0);
    expect(svg.createXml()).not.toContain('<rect');
  });

  it('svgRectangle emits rx/ry only when both are > 0', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgRectangle({ x: 0, y: 0, width: 10, height: 10, rx: 2.5, ry: 2.5 }, 0);
    svg.svgRectangle({ x: 0, y: 0, width: 10, height: 10, rx: 0, ry: 0 }, 0);
    const xml = svg.createXml();
    expect(xml).toContain('rx="2.5" ry="2.5"');
    expect((xml.match(/<rect/g) ?? []).length).toBe(2);
  });

  it('svgArcEllipse accepts positional numbers and Point2D pairs equivalently', () => {
    const a = new SvgGraphics(0, basicSvgOption(), 'v');
    a.svgArcEllipse(25, 25, 5, 395, 40, 400);
    const b = new SvgGraphics(0, basicSvgOption(), 'v');
    b.svgArcEllipse(25, 25, { x: 5, y: 395 }, { x: 40, y: 400 });
    expect(a.createXml()).toBe(b.createXml());
    expect(a.createXml()).toContain('d="M5,395 A25,25 0 0 0 40 400"');
  });

  it('svgArcEllipse skips element creation but still tracks bounds when hidden', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setHidden(true);
    svg.svgArcEllipse(25, 25, 0, 0, 50, 50);
    const xml = svg.createXml();
    expect(xml).not.toContain('<path');
    expect(xml).toContain('viewBox="0 0 51 51"');
  });

  it('svgPolygon renders comma-joined formatted points with the miter style', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgPolygon(0, 0, 0, 10, 0, 5, 10);
    expect(svg.createXml()).toContain(
      '<polygon points="0,0,10,0,5,10" fill="black"' +
        ' style="stroke:black;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>',
    );
  });

  it('manageShadow registers exactly one shadow filter def, reused across shapes', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgRectangle({ x: 0, y: 0, width: 5, height: 5, rx: 0, ry: 0 }, 2);
    svg.svgEllipse(20, 20, 5, 5, 2);
    const xml = svg.createXml();
    expect((xml.match(/<filter id="f0"/g) ?? []).length).toBe(1);
    expect((xml.match(/filter="url\(#f0\)"/g) ?? []).length).toBe(2);
  });
});

describe('SvgGraphics — text()', () => {
  it('applies orientation 90/270 rotate transforms, and no transform otherwise', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('a', 1, 2, { ...noText, orientation: 90 });
    svg.text('b', 1, 2, { ...noText, orientation: 270 });
    svg.text('c', 1, 2, noText);
    const xml = svg.createXml();
    expect(xml).toContain('transform="rotate(-90 1 2)"');
    expect(xml).toContain('transform="rotate(90 1 2)"');
    expect((xml.match(/<text/g) ?? []).length).toBe(3);
  });

  it('sets font-weight/font-style/text-decoration when provided', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('a', 0, 0, { ...noText, fontWeight: '700', fontStyle: 'italic', textDecoration: 'underline' });
    const xml = svg.createXml();
    expect(xml).toContain('font-weight="700"');
    expect(xml).toContain('font-style="italic"');
    expect(xml).toContain('text-decoration="underline"');
  });

  it('lowercases "roboto" and injects the Google Fonts @import exactly once', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('a', 0, 0, { ...noText, fontFamily: 'Roboto' });
    svg.text('b', 10, 10, { ...noText, fontFamily: 'Roboto' });
    const xml = svg.createXml();
    expect((xml.match(/fonts\.googleapis\.com/g) ?? []).length).toBe(1);
    expect(xml).toContain('font-family="Roboto"');
  });

  it('maps "monospaced" to font-family="monospace" and substitutes NBSP for spaces', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('a b', 0, 0, { ...noText, fontFamily: 'Monospaced' });
    const xml = svg.createXml();
    expect(xml).toContain('font-family="monospace"');
    expect(xml).toContain('>a b<');
  });

  it('substitutes NBSP for "courier" too, without renaming the family', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('a b', 0, 0, { ...noText, fontFamily: 'courier' });
    const xml = svg.createXml();
    expect(xml).toContain('font-family="courier"');
    expect(xml).toContain('>a b<');
  });

  it('registers a feFlood/feComposite filter for textBackColor', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('hi', 0, 0, { ...noText, textBackColor: '#FFFF00' });
    const xml = svg.createXml();
    expect(xml).toContain('<filter id="b00" x="0" y="0" width="1" height="1">');
    expect(xml).toContain('filter="url(#b00)"');
  });

  it('applies extra attributes in insertion order', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.text('a', 0, 0, { ...noText, attributes: new Map([['data-foo', 'bar']]) });
    expect(svg.createXml()).toContain('data-foo="bar"');
  });

  it('is hidden-suppressed but still tracks bounds via textLength', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setHidden(true);
    svg.text('a', 40, 40, { ...noText, textLength: 20 });
    const xml = svg.createXml();
    expect(xml).not.toContain('<text');
    expect(xml).toContain('viewBox="0 0 61 41"');
  });

  it('lengthAdjust NONE emits no lengthAdjust/textLength attributes', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ lengthAdjust: LengthAdjust.NONE }), 'v');
    svg.text('a', 0, 0, noText);
    expect(svg.createXml()).not.toContain('lengthAdjust');
  });

  it('lengthAdjust SPACING_AND_GLYPHS sets lengthAdjust="spacingAndGlyphs"', () => {
    const svg = new SvgGraphics(0, basicSvgOption({ lengthAdjust: LengthAdjust.SPACING_AND_GLYPHS }), 'v');
    svg.text('a', 0, 0, noText);
    expect(svg.createXml()).toContain('lengthAdjust="spacingAndGlyphs"');
  });
});

describe('SvgGraphics — svgPath (UPath serialization)', () => {
  it('renders every segment type (M/L/Q/C/A) and trims trailing whitespace', () => {
    const path = new UPath('my-id', 'code-42');
    path.add([0, 0], USegmentType.SEG_MOVETO);
    path.add([10, 0], USegmentType.SEG_LINETO);
    path.add([15, 0, 20, 5], USegmentType.SEG_QUADTO);
    path.add([25, 0, 30, 5, 35, 10], USegmentType.SEG_CUBICTO);
    path.add([5, 5, 0, 0, 0, 40, 10], USegmentType.SEG_ARCTO);
    path.add([], USegmentType.SEG_CLOSE);

    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgPath(0, 0, path, 0);
    const xml = svg.createXml();
    expect(xml).toContain('id="my-id"');
    expect(xml).toContain('codeLine="code-42"');
    expect(xml).toContain('d="M0,0 L10,0 Q15,0 20,5 C25,0 30,5 35,10 A5,5 0 0 0 40,10"');
  });

  it('omits id/codeLine attrs when both are null', () => {
    const path = new UPath(null, null);
    path.add([0, 0], USegmentType.SEG_MOVETO);
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.svgPath(0, 0, path, 0);
    const xml = svg.createXml();
    expect(xml).not.toContain('id="');
    expect(xml).not.toContain('codeLine="');
  });

  it('skips element creation when hidden, but still tracks bounds via segments', () => {
    const path = new UPath(null, null);
    path.add([0, 0], USegmentType.SEG_MOVETO);
    path.add([100, 50], USegmentType.SEG_LINETO);
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setHidden(true);
    svg.svgPath(0, 0, path, 0);
    const xml = svg.createXml();
    expect(xml).not.toContain('<path');
    expect(xml).toContain('viewBox="0 0 101 51"');
  });
});

describe('SvgGraphics — legacy path-builder API', () => {
  it('newpath/moveto/lineto/curveto/quadto/closepath/fill build one <path>', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.newpath();
    svg.moveto(0, 0);
    svg.lineto(10, 0);
    svg.curveto(10, 0, 20, 10, 20, 20);
    svg.quadto(25, 25, 30, 30);
    svg.closepath();
    svg.fill(0);
    expect(svg.createXml()).toContain('d="M0,0 L10,0 C10,0 20,10 20,20 Q25,25 30,30 Z "');
  });

  it('curveto accepts Point2D triples equivalently to positional numbers', () => {
    const a = new SvgGraphics(0, basicSvgOption(), 'v');
    a.newpath();
    a.moveto(0, 0);
    a.curveto(1, 2, 3, 4, 5, 6);
    a.fill(0);

    const b = new SvgGraphics(0, basicSvgOption(), 'v');
    b.newpath();
    b.moveto(0, 0);
    b.curveto({ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 });
    b.fill(0);

    expect(a.createXml()).toBe(b.createXml());
  });

  it('throws if append is called before newpath() (mirrors upstream NPE-on-misuse)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.moveto(0, 0)).toThrow();
  });

  it('fill() with hidden=true skips element creation but still resets currentPath', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    svg.setHidden(true);
    svg.newpath();
    svg.moveto(0, 0);
    svg.fill(0);
    expect(svg.createXml()).not.toContain('<path');

    svg.setHidden(false);
    svg.newpath();
    svg.moveto(1, 1);
    svg.fill(0);
    expect(svg.createXml()).toContain('d="M1,1 "');
  });
});

describe('SvgGraphics — D3′ stubs', () => {
  it('openLink throws citing D3-prime', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.openLink('http://x', null, null)).toThrow(/D3-prime/);
  });

  it('closeLink throws citing D3-prime', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.closeLink()).toThrow(/D3-prime/);
  });

  it('svgImage throws citing D3-prime regardless of args (covers both upstream overloads)', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.svgImage({}, 0, 0)).toThrow(/D3-prime/);
    expect(() => svg.svgImage()).toThrow(/D3-prime/);
  });

  it('addCommentMetadata throws citing D3-prime (extended) via getMetadataHex', () => {
    const svg = new SvgGraphics(0, basicSvgOption(), 'v');
    expect(() => svg.addCommentMetadata('@startuml\n@enduml')).toThrow(/D3-prime \(extended\)/);
  });

  it('getMetadataHex throws citing D3-prime (extended)', () => {
    expect(() => getMetadataHex('x')).toThrow(/D3-prime \(extended\)/);
  });
});
