import { describe, expect, it } from 'vitest';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import {
  DriverImagePng,
  DriverPixelSvg,
  DriverImageSvgSvg,
  DriverTextAsPathSvg,
  DriverCenteredCharacterSvg,
} from '../../../../src/core/klimt/drawing/svg/driver-svg-stubs.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UEllipse } from '../../../../src/core/klimt/shape/UEllipse.js';
import { ULine } from '../../../../src/core/klimt/shape/ULine.js';
import { UPolygon } from '../../../../src/core/klimt/shape/UPolygon.js';
import { UPath } from '../../../../src/core/klimt/shape/UPath.js';
import { DotPath } from '../../../../src/core/klimt/shape/DotPath.js';
import { UText } from '../../../../src/core/klimt/shape/UText.js';
import type { FontStyle } from '../../../../src/core/klimt/shape/UText.js';
import { UComment } from '../../../../src/core/klimt/shape/UComment.js';
import { UGroup, UGroupType } from '../../../../src/core/klimt/shape/UGroup.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { Fore } from '../../../../src/core/klimt/Fore.js';
import { Back } from '../../../../src/core/klimt/Back.js';
import type { UShape } from '../../../../src/core/klimt/UShape.js';
import type { UParam } from '../../../../src/core/klimt/UParam.js';

// Known text-measurement widths for the jar-fixture spot checks below,
// keyed "family/size/text" — matches the exact `textLength` the real
// jar's AWT font metrics produced (cited per-test). Anything not in this
// table falls back to a cheap deterministic heuristic — fine for tests
// that only check driver dispatch/attribute-emission logic, not exact
// jar-measured widths.
const KNOWN_WIDTHS = new Map<string, number>([['sans-serif/14/Pack1', 38.9375]]);

const stubStringBounder: StringBounder = {
  calculateDimension(font, text) {
    const key = `${font.family}/${font.size}/${text}`;
    const known = KNOWN_WIDTHS.get(key);
    if (known !== undefined) return { width: known };
    return { width: text.length * font.size * 0.5 };
  },
};

function newGraphic(seed = 0): UGraphicSvg {
  return UGraphicSvg.build(seed, basicSvgOption(), '$version$', stubStringBounder);
}

describe('DriverRectangleSvg (AC1)', () => {
  it('emits x/y/width/height/fill/style/rx/ry for a rounded rect under translate+stroke+fill', () => {
    const root = newGraphic();
    root
      .apply(new UStroke(0, 0, 1.5))
      .apply(new Fore('#000000'))
      .apply(new Back('#FF0000'))
      .apply(new UTranslate(20, 5))
      .draw(URectangle.build(15, 10).rounded(5));

    expect(root.getSvgString()).toContain(
      '<rect x="20" y="5" width="15" height="10" fill="#FF0000"' +
        ' style="stroke:#000000;stroke-width:1.5;" rx="2.5" ry="2.5"/>',
    );
  });

  it('matches the jar fragment attr-for-attr (AC2 — component/sacuso-94-gugi476/in.svg, Comp1 rect)', () => {
    const root = newGraphic();
    root
      .apply(new UStroke(0, 0, 0.5))
      .apply(new Fore('#181818'))
      .apply(new Back('#F1F1F1'))
      .apply(new UTranslate(22.42, 115.46))
      .draw(URectangle.build(85.15, 44).rounded(5));

    expect(root.getSvgString()).toContain(
      '<rect x="22.42" y="115.46" width="85.15" height="44" fill="#F1F1F1"' +
        ' style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>',
    );
  });

  it('a non-rounded rect has no rx/ry attrs', () => {
    const root = newGraphic();
    root.apply(new Fore('none')).apply(new Back('none')).draw(URectangle.build(4, 4));
    const xml = root.getSvgString();
    const rectFragment = /<rect[^/]*\/>/.exec(xml)![0];
    expect(rectFragment).not.toContain('rx=');
    expect(rectFragment).not.toContain('ry=');
  });
});

describe('DriverEllipseSvg (AC2 — component/babafi-51-dixi026/in.svg)', () => {
  it('full ellipse (start=extend=0) matches the jar fragment attr-for-attr', () => {
    const root = newGraphic();
    root
      .apply(new UStroke(0, 0, 0.5))
      .apply(new Fore('#181818'))
      .apply(new Back('#F1F1F1'))
      .apply(new UTranslate(24.4688, 6))
      .draw(UEllipse.build(16, 16));

    expect(root.getSvgString()).toContain(
      '<ellipse cx="32.4688" cy="14" rx="8" ry="8" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>',
    );
  });

  it('partial ellipse (extend != 0) draws an SVG elliptical-arc <path>, not an <ellipse>', () => {
    const root = newGraphic();
    // start=0, extend=90 -> DriverEllipseSvg.java's `start = start + 90`
    // then the `extend > 0` branch: angleA=90, angleB=180.
    root.apply(new Fore('#181818')).apply(new Back('#F1F1F1')).draw(new UEllipse(20, 20, 0, 90));

    // start=0 -> angleA=90, angleB=180 puts sin(90)=1/cos(90)~=0 and
    // sin(180)~=0/cos(180)=-1 exactly on axis, so the expected numbers
    // are trivial without needing to replicate SvgGraphicsCore#format's
    // trailing-zero trimming.
    expect(root.getSvgString()).toContain('<path d="M20,10 A10,10 0 0 0 10 0"');
    expect(root.getSvgString()).not.toMatch(/<ellipse[^/]*cx="10"/);
  });

  it('partial ellipse (extend < 0) swaps the arc endpoint order', () => {
    const root = newGraphic();
    // start=0, extend=-90 -> start+90=90; extend<0 branch: angleA=start+extend=0,
    // angleB=start=90 (the mirror of the extend>0 case above).
    root.apply(new Fore('#181818')).apply(new Back('#F1F1F1')).draw(new UEllipse(20, 20, 0, -90));

    expect(root.getSvgString()).toContain('<path d="M10,20 A10,10 0 0 0 20 10"');
  });
});

describe('DriverLineSvg (AC2 — component/babafi-51-dixi026/in.svg)', () => {
  it('matches the jar fragment attr-for-attr', () => {
    const root = newGraphic();
    root
      .apply(new UStroke(0, 0, 1))
      .apply(new Fore('#181818'))
      .apply(new UTranslate(116.92, 54.5))
      .draw(new ULine(246.0075 - 116.92, 0));

    expect(root.getSvgString()).toContain(
      '<line x1="116.92" y1="54.5" x2="246.0075" y2="54.5" style="stroke:#181818;stroke-width:1;"/>',
    );
  });

  it('a Gradient stroke Paint flattens to color1, registering NO <linearGradient> def', () => {
    const root = newGraphic();
    root
      .apply(new UStroke(0, 0, 1))
      .apply(new Fore({ color1: '#112233', color2: '#445566', policy: '-' }))
      .draw(new ULine(10, 0));

    const xml = root.getSvgString();
    expect(xml).toContain('style="stroke:#112233;stroke-width:1;"');
    expect(xml).not.toContain('<linearGradient');
  });
});

describe('DriverPolygonSvg (AC2 — component/babafi-51-dixi026/in.svg, arrowhead polygon)', () => {
  it('matches the jar fragment attr-for-attr', () => {
    const root = newGraphic();
    const polygon = new UPolygon([
      { x: 115.71, y: 53.5 },
      { x: 106.71, y: 49.5 },
      { x: 110.71, y: 53.5 },
      { x: 106.71, y: 57.5 },
      { x: 115.71, y: 53.5 },
    ]);
    root.apply(new UStroke(0, 0, 1)).apply(new Fore('#181818')).apply(new Back('#181818')).draw(polygon);

    expect(root.getSvgString()).toContain(
      '<polygon points="115.71,53.5,106.71,49.5,110.71,53.5,106.71,57.5,115.71,53.5" fill="#181818"' +
        ' style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>',
    );
  });
});

describe('DriverPathSvg', () => {
  it('general branch: fill/stroke resolved independently when color != backcolor', () => {
    const root = newGraphic();
    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.lineTo(10, 10);

    root.apply(new UStroke(0, 0, 1)).apply(new Fore('#181818')).apply(new Back('#F1F1F1')).draw(path);

    const xml = root.getSvgString();
    expect(xml).toContain('<path d="M0,0 L10,0 L10,10" style="stroke:#181818;stroke-width:1;" fill="#F1F1F1"/>');
  });

  it('fast path: color === backcolor (both plain, non-gradient) -> flat fill, empty stroke, no style attr', () => {
    const root = newGraphic();
    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(10, 0);
    path.lineTo(10, 10);

    root.apply(new UStroke(0, 0, 1)).apply(new Fore('#112233')).apply(new Back('#112233')).draw(path);

    const xml = root.getSvgString();
    // strokeWidth becomes "0" -> styleMe short-circuits, no style attr at all.
    expect(xml).toContain('<path d="M0,0 L10,0 L10,10" fill="#112233"/>');
  });

  it('a Gradient color equal in value to a Gradient backcolor still takes the general branch (never the fast path)', () => {
    const root = newGraphic();
    const path = UPath.none();
    path.moveTo(0, 0);
    path.lineTo(5, 0);

    const gradient = { color1: '#FF0000', color2: '#FFFF00', policy: '/' as const };
    root.apply(new UStroke(0, 0, 1)).apply(new Fore(gradient)).apply(new Back(gradient)).draw(path);

    // General branch always registers gradient defs via SvgGraphics —
    // the fast path (flat fill/no-stroke) never fires for gradients,
    // matching upstream's `!(color instanceof HColorGradient)` guard.
    expect(root.getSvgString()).toContain('<linearGradient');
  });
});

describe('DriverDotPathSvg', () => {
  it('renders the flattened bezier path when the foreground color is not transparent', () => {
    const root = newGraphic();
    const dotPath = DotPath.fromBeziers([{ x1: 0, y1: 0, ctrlx1: 2, ctrly1: 0, ctrlx2: 4, ctrly2: 4, x2: 6, y2: 4 }]);

    root.apply(new UStroke(0, 0, 1)).apply(new Fore('#181818')).draw(dotPath);

    const xml = root.getSvgString();
    expect(xml).toContain('<path d="M0,0 C2,0 4,4 6,4" style="stroke:#181818;stroke-width:1;" fill="none"/>');
  });

  it('draws nothing when the foreground paint is the "none" sentinel', () => {
    const root = newGraphic();
    const before = root.getSvgString();
    const dotPath = DotPath.fromBeziers([{ x1: 0, y1: 0, ctrlx1: 1, ctrly1: 1, ctrlx2: 2, ctrly2: 2, x2: 3, y2: 3 }]);

    root.apply(new Fore('none')).draw(dotPath);

    expect(root.getSvgString()).toBe(before);
  });
});

describe('DriverTextSvg', () => {
  it('matches the jar fragment attr-for-attr for a BOLD label (AC2 — component/sacuso-94-gugi476/in.svg, "Pack1")', () => {
    const root = newGraphic();
    const font = {
      family: 'sans-serif',
      size: 14,
      color: '#000000',
      styles: new Set(['BOLD'] as const),
    };
    root.apply(new UTranslate(10, 95.3489)).draw(UText.build('Pack1', font));

    expect(root.getSvgString()).toContain(
      '<text x="10" y="95.3489" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="38.9375"' +
        ' font-weight="700" font-family="sans-serif">Pack1</text>',
    );
  });

  it('is a no-op when the font color is transparent (null)', () => {
    const root = newGraphic();
    const before = root.getSvgString();
    root.draw(UText.build('hidden', { family: 'sans-serif', size: 14, color: null, styles: new Set<FontStyle>() }));
    expect(root.getSvgString()).toBe(before);
  });

  it('UNDERLINE + STRIKE + WAVE combine into one text-decoration value', () => {
    const root = newGraphic();
    const font = {
      family: 'sans-serif',
      size: 12,
      color: '#0000FF',
      styles: new Set(['UNDERLINE', 'STRIKE', 'WAVE'] as const),
    };
    root.draw(UText.build('deco', font));
    expect(root.getSvgString()).toContain('text-decoration="underline line-through wavy underline"');
  });

  it('a leading space shifts x by the measured space width and is stripped from the text', () => {
    const root = newGraphic();
    const font = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set<FontStyle>() };
    root.apply(new UTranslate(10, 0)).draw(UText.build(' hi', font));
    // stub bounder: space width = 1 * 14 * 0.5 = 7 -> x = 10 + 7 = 17.
    expect(root.getSvgString()).toContain('<text x="17"');
    expect(root.getSvgString()).toContain('>hi</text>');
  });

  it('trailing whitespace and a leading tab are trimmed via the ported `trin()`', () => {
    const root = newGraphic();
    const font = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set<FontStyle>() };
    // A leading TAB is not a regular space, so upstream's `startsWith(" ")`
    // x-shift loop never fires for it; `trin()` (char code <= 0x20) is the
    // only thing that strips it, exercising both of `trin`'s while loops.
    root.apply(new UTranslate(0, 0)).draw(UText.build('\thi ', font));
    expect(root.getSvgString()).toContain('>hi</text>');
  });

  it('ITALIC style flag maps to font-style="italic"', () => {
    const root = newGraphic();
    const font = {
      family: 'sans-serif',
      size: 12,
      color: '#000000',
      styles: new Set(['ITALIC'] as const),
    };
    root.draw(UText.build('slanted', font));
    expect(root.getSvgString()).toContain('font-style="italic"');
  });

  it('a whitespace-only string substitutes NBSP for every space (Upstream: char 160)', () => {
    const root = newGraphic();
    const font = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set<FontStyle>() };
    root.draw(UText.build('   ', font));
    // The port's local `trin()` (StringUtils.trin, ported faithfully —
    // see driver-text-svg.ts) only strips chars <= U+0020, so the NBSP
    // (U+00A0) glyphs the substitution above just inserted survive into
    // the emitted text content, unlike JS's own `.trim()` which would
    // have swallowed them.
    expect(root.getSvgString()).toContain('>   </text>');
  });
});

describe('UComment / UGroup dispatch (u-graphic-svg.ts)', () => {
  it('UComment draws through the ordinary driver map into an XML comment', () => {
    const root = newGraphic();
    root.draw(new UComment('hello world'));
    expect(root.getSvgString()).toContain('<!--hello world-->');
  });

  it('startGroup/closeGroup wrap subsequent draws in a <g> with the group attributes', () => {
    const root = newGraphic();
    const group = new UGroup();
    group.put(UGroupType.DATA_UID, 'ent0001'); // UGroupType.ID is intentionally ignored (see xml-writer.ts).
    root.startGroup(group);
    root.draw(URectangle.build(4, 4));
    root.closeGroup();

    const xml = root.getSvgString();
    expect(xml).toContain('<g id="ent0001">');
  });

  it('getSvgGraphics() exposes the same shared SvgGraphics instance draws land in', () => {
    const root = newGraphic();
    root.draw(new UComment('via getSvgGraphics'));
    expect(root.getSvgGraphics().createXml()).toContain('<!--via getSvgGraphics-->');
  });
});

describe('Gradient Paint fill (AC3)', () => {
  it('registers exactly one <linearGradient> def and references it via url(#id)', () => {
    const root = newGraphic();
    const gradient = { color1: '#FF0000', color2: '#FFFF00', policy: '/' as const };
    root.apply(new Fore('none')).apply(new Back(gradient)).draw(URectangle.build(10, 10));

    const xml = root.getSvgString();
    const defs = [...xml.matchAll(/<linearGradient[^>]*id="([^"]+)"[^>]*>/g)];
    expect(defs).toHaveLength(1);
    const id = defs[0]![1];
    expect(xml).toContain(`fill="url(#${id})"`);
    expect(xml).toContain('<stop stop-color="#FF0000" offset="0%"/>');
    expect(xml).toContain('<stop stop-color="#FFFF00" offset="100%"/>');
  });

  it('registering the same (color1, color2, policy) twice de-dups to one def', () => {
    const root = newGraphic();
    const gradient = { color1: '#AAAAAA', color2: '#BBBBBB', policy: '|' as const };
    root.apply(new Back(gradient)).draw(URectangle.build(4, 4));
    root.apply(new Back(gradient)).draw(URectangle.build(4, 4));

    const xml = root.getSvgString();
    expect([...xml.matchAll(/<linearGradient/g)]).toHaveLength(1);
  });
});

describe('copyUGraphic (u-graphic-svg.ts)', () => {
  it('shares the same underlying document across apply() chains', () => {
    const root = newGraphic();
    const styled = root.apply(new Fore('#010101'));
    styled.draw(URectangle.build(2, 2));
    root.draw(URectangle.build(3, 3));

    // Both draws land in the SAME document — reachable from `root`.
    const xml = root.getSvgString();
    expect(xml).toContain('width="2" height="2"');
    expect(xml).toContain('width="3" height="3"');
  });

  it('does not leak state changes back to the original instance', () => {
    const root = newGraphic();
    root.apply(new UTranslate(50, 50));
    expect(root.getTranslate().getDx()).toBe(0);
    expect(root.getTranslate().getDy()).toBe(0);
  });
});

describe('Deferred D3-prime driver stubs (AC4)', () => {
  const dummyShape = {} as UShape;
  const dummyParam = {} as UParam;

  it.each([
    ['DriverImagePng', new DriverImagePng()],
    ['DriverPixelSvg', new DriverPixelSvg()],
    ['DriverImageSvgSvg', new DriverImageSvgSvg()],
    ['DriverTextAsPathSvg', new DriverTextAsPathSvg()],
    ['DriverCenteredCharacterSvg', new DriverCenteredCharacterSvg()],
  ] as const)('%s.draw() throws, naming D3-prime', (_name, driver) => {
    expect(() => driver.draw(dummyShape, dummyParam)).toThrow(/D3-prime/);
  });
});
