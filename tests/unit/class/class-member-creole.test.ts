/**
 * class-member-creole.test.ts — G2 N22: unit tests for the class member-row
 * creole-atom seam (`src/diagrams/class/class-member-creole.ts`).
 *
 * Coverage: measurement-identity for plain (no-markup) text (this mission's
 * own HARD BOUNDARY), inline style commands (bold/italic/underline/strike/
 * color), member-level `{abstract}`/`{static}` font seeding, and inline
 * img/sprite atom resolution (SI5b sprite reuse).
 */
import { describe, expect, test } from 'vitest';
import {
  memberBaseFont,
  buildMemberAtoms,
  resolveMemberAtoms,
  buildMemberRow,
} from '../../../src/diagrams/class/class-member-creole.js';
import { FontStyle } from '../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../src/core/klimt/shape/UText.js';
import { FormulaMeasurer, WidthTableMeasurer } from '../../../src/core/measurer.js';
import { createSpriteRegistry, addSprite } from '../../../src/core/sprite-commands.js';
import { SpriteMonochrome } from '../../../src/core/klimt/sprite/SpriteMonochrome.js';
import { encodePng, toBase64DataUri } from '../../../src/core/klimt/sprite/png-encoder.js';

const measurer = new FormulaMeasurer();
const FONT_SPEC = { family: 'sans-serif', size: 14 };
const BASE_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: null, styles: new Set() };

function buildSpriteRegistryWithFoo(): ReturnType<typeof createSpriteRegistry> {
  const registry = createSpriteRegistry();
  const sprite = new SpriteMonochrome(4, 4, 16);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) sprite.setGray(x, y, (x + y) % 16);
  }
  addSprite(registry, 'foo', sprite);
  return registry;
}

const TINY_PNG_URI = toBase64DataUri(encodePng(new Uint8Array(2 * 2 * 4).fill(0xff), 2, 2));

describe('memberBaseFont', () => {
  test('plain member: no styles, color null', () => {
    const font = memberBaseFont(FONT_SPEC, {});
    expect(font.styles.size).toBe(0);
    expect(font.color).toBeNull();
    expect(font.family).toBe('sans-serif');
    expect(font.size).toBe(14);
  });

  test('{abstract} member -> ITALIC', () => {
    const font = memberBaseFont(FONT_SPEC, { isAbstract: true });
    expect(font.styles.has(FontStyle.ITALIC)).toBe(true);
    expect(font.styles.has(FontStyle.UNDERLINE)).toBe(false);
  });

  test('{static} member -> UNDERLINE', () => {
    const font = memberBaseFont(FONT_SPEC, { isStatic: true });
    expect(font.styles.has(FontStyle.UNDERLINE)).toBe(true);
    expect(font.styles.has(FontStyle.ITALIC)).toBe(false);
  });

  test('{static abstract} member -> both', () => {
    const font = memberBaseFont(FONT_SPEC, { isAbstract: true, isStatic: true });
    expect(font.styles.has(FontStyle.ITALIC)).toBe(true);
    expect(font.styles.has(FontStyle.UNDERLINE)).toBe(true);
  });
});

describe('buildMemberAtoms — measurement identity (mission HARD BOUNDARY)', () => {
  test('plain text with no creole markup: exactly one atom, untouched text', () => {
    const atoms = buildMemberAtoms('+getName(): String', BASE_FONT);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]).toEqual({ kind: 'text', text: '+getName(): String', font: BASE_FONT });
  });

  test('generic type angle brackets (List<String>) never trip a creole command', () => {
    const atoms = buildMemberAtoms('+items: List<String>', BASE_FONT);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]).toMatchObject({ kind: 'text', text: '+items: List<String>' });
  });

  test('plain text measures identically through resolveMemberAtoms as a direct measurer call', () => {
    const text = '+getName(): String';
    const atoms = buildMemberAtoms(text, BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    const direct = measurer.measure(text, FONT_SPEC).width;
    expect(build.width).toBe(direct);
  });

  test('HORIZONTAL_LINE-shaped member text (pathological) falls back to one plain atom', () => {
    const atoms = buildMemberAtoms('----', BASE_FONT);
    expect(atoms).toEqual([{ kind: 'text', text: '----', font: BASE_FONT }]);
  });
});

describe('buildMemberAtoms — inline creole style commands', () => {
  test('<b>bold</b> tail splits into a bold run + a plain run', () => {
    const atoms = buildMemberAtoms('<b>bold</b> tail', BASE_FONT);
    expect(atoms).toHaveLength(2);
    expect(atoms[0]).toMatchObject({ kind: 'text', text: 'bold' });
    expect((atoms[0] as { font: FontConfiguration }).font.styles.has(FontStyle.BOLD)).toBe(true);
    expect(atoms[1]).toMatchObject({ kind: 'text', text: ' tail' });
    expect((atoms[1] as { font: FontConfiguration }).font.styles.has(FontStyle.BOLD)).toBe(false);
  });

  test('<color:red>text</color> resolves to a hex color on the atom font', () => {
    const atoms = buildMemberAtoms('<color:red>warn</color>', BASE_FONT);
    expect(atoms).toHaveLength(1);
    expect((atoms[0] as { font: FontConfiguration }).font.color).toBe('#FF0000');
  });

  test('--strike--able text (deprecated method marker, sojave-47-pura962) strikes through', () => {
    // A member line shaped EXACTLY `--word--` with nothing else (no
    // suffix/prefix) is a whole-line-anchored SECTION_HEADER match in
    // `classifyStripeLine` -- the SAME "embedded-label separator" case
    // `CreoleStripeSimpleParser.ts`'s own doc comment reports as an
    // unported LITERAL fallback, not STRIKE (matches real upstream, which
    // treats `--word--` as a section header at ANY CreoleMode). The real
    // corpus fixture's shape has a trailing `(): void` suffix, so the
    // anchored pattern does NOT match -- the string falls through to
    // NORMAL, where the (unanchored) `--...--` STRIKE creole command DOES
    // fire as a substring match.
    const atoms = buildMemberAtoms('--deprecatedMethod--(): void', BASE_FONT);
    expect(atoms).toHaveLength(2);
    expect(atoms[0]).toMatchObject({ kind: 'text', text: 'deprecatedMethod' });
    expect((atoms[0] as { font: FontConfiguration }).font.styles.has(FontStyle.STRIKE)).toBe(true);
    expect(atoms[1]).toMatchObject({ kind: 'text', text: '(): void' });
    expect((atoms[1] as { font: FontConfiguration }).font.styles.has(FontStyle.STRIKE)).toBe(false);
  });

  test('a whole-line `--word--` member (anchored, no suffix) is the SAME LITERAL fallback classifyStripeLine documents for description separators -- NOT struck (matches real upstream SECTION_HEADER precedence)', () => {
    const atoms = buildMemberAtoms('--deprecatedMethod--', BASE_FONT);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]).toEqual({ kind: 'text', text: '--deprecatedMethod--', font: BASE_FONT });
  });

  test('summed atom width equals the sum of each run measured independently', () => {
    const atoms = buildMemberAtoms('<b>bold</b> tail', BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    const boldWidth = measurer.measure('bold', { ...FONT_SPEC, weight: 'bold' }).width;
    const tailWidth = measurer.measure(' tail', FONT_SPEC).width;
    expect(build.width).toBeCloseTo(boldWidth + tailWidth, 6);
  });
});

describe('resolveMemberAtoms — inline img/sprite atoms', () => {
  test('unresolved sprite name (no registry) contributes nothing', () => {
    const atoms = buildMemberAtoms('<$foo> label', BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    // Only the ' label' text atom survives -- the sprite atom is dropped.
    expect(build.atoms).toHaveLength(1);
    expect(build.atoms[0]).toMatchObject({ kind: 'text', text: ' label' });
  });

  test('unresolved sprite name (registry present, name absent) contributes nothing', () => {
    const registry = createSpriteRegistry();
    const atoms = buildMemberAtoms('<$bar> label', BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer, registry);
    expect(build.atoms).toHaveLength(1);
    expect(build.atoms[0]).toMatchObject({ kind: 'text', text: ' label' });
  });

  test('resolved sprite name resolves to an image atom with positive dims', () => {
    const registry = buildSpriteRegistryWithFoo();
    const atoms = buildMemberAtoms('<$foo> label', BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer, registry);
    expect(build.atoms).toHaveLength(2);
    expect(build.atoms[0]).toMatchObject({ kind: 'image' });
    const img = build.atoms[0] as { kind: 'image'; href: string; width: number; height: number };
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
    expect(img.href.startsWith('data:image/png;base64,')).toBe(true);
    expect(build.width).toBeGreaterThan(0);
  });

  test('<img:data-uri> resolves to an image atom without any registry', () => {
    const atoms = buildMemberAtoms(`<img:${TINY_PNG_URI}> icon`, BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    expect(build.atoms[0]).toMatchObject({ kind: 'image', width: 2, height: 2 });
  });
});

describe('buildMemberRow — one-stop build', () => {
  test('plain field: single text atom, width matches direct measurement', () => {
    const build = buildMemberRow('+name: String', {}, FONT_SPEC, measurer);
    expect(build.atoms).toHaveLength(1);
    expect(build.width).toBe(measurer.measure('+name: String', FONT_SPEC).width);
  });

  test('{abstract} method: the single atom carries ITALIC', () => {
    const build = buildMemberRow('+draw()', { isAbstract: true }, FONT_SPEC, measurer);
    expect(build.atoms).toHaveLength(1);
    const atom = build.atoms[0] as { kind: 'text'; font: FontConfiguration };
    expect(atom.font.styles.has(FontStyle.ITALIC)).toBe(true);
  });
});

describe('resolveMemberAtoms — inline OpenIconic <&glyph> atoms (G2 N41)', () => {
  test('a bare <&x> atom resolves to a vector atom with positive dims and the row base font color', () => {
    const font: FontConfiguration = { family: 'sans-serif', size: 14, color: '#123456', styles: new Set() };
    const atoms = buildMemberAtoms('<&x> field', font);
    const build = resolveMemberAtoms(atoms, font, measurer);
    expect(build.atoms).toHaveLength(2);
    expect(build.atoms[0]).toMatchObject({ kind: 'vector', name: 'x' });
    const vec = build.atoms[0] as { kind: 'vector'; factor: number; fill: string; width: number; height: number };
    expect(vec.factor).toBeCloseTo(14 / 12, 10);
    expect(vec.fill).toBe('#123456');
    expect(vec.width).toBeGreaterThan(0);
    expect(vec.height).toBeGreaterThan(0);
    expect(build.atoms[1]).toMatchObject({ kind: 'text', text: ' field' });
  });

  test('<color:red><&x></color> resolves fill from the AMBIENT color at the markup position, not the row base font', () => {
    const atoms = buildMemberAtoms('<color:red><&x></color> field', BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    const vec = build.atoms[0] as { kind: 'vector'; fill: string };
    expect(vec.fill).toBe('#FF0000');
  });

  test('<&x{scale=2.25,color=#FF0000}> a forced color wins over the ambient font color', () => {
    const font: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };
    const atoms = buildMemberAtoms('<&x{scale=2.25,color=#00FF00}>', font);
    const build = resolveMemberAtoms(atoms, font, measurer);
    const vec = build.atoms[0] as { kind: 'vector'; fill: string; factor: number };
    expect(vec.fill).toBe('#00FF00');
    expect(vec.factor).toBeCloseTo((2.25 * 14) / 12, 10);
  });

  test('an unrecognized glyph name contributes nothing (matches the unresolved-sprite-name precedent)', () => {
    const atoms = buildMemberAtoms('<&pencil> field', BASE_FONT);
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    expect(build.atoms).toHaveLength(1);
    expect(build.atoms[0]).toMatchObject({ kind: 'text', text: ' field' });
  });
});

describe('resolveMemberAtoms — latex atoms are dropped (zero corpus reach)', () => {
  test('a latex CreoleAtom contributes nothing (measure 0, no render atom)', () => {
    // No member text in the corpus produces a `latex` atom (buildMemberAtoms
    // never emits one -- `<latex>` is unreachable from a real class member
    // line, see this module's own doc comment); constructed directly here
    // to exercise the drop branch `resolveOneAtom` still needs to handle
    // defensively (mirrors `MemberRenderAtom`'s own doc comment).
    const atoms = [
      { kind: 'text' as const, text: 'before ', font: BASE_FONT },
      { kind: 'latex' as const, expr: 'x^2', color: '#000000' },
      { kind: 'text' as const, text: 'after', font: BASE_FONT },
    ];
    const build = resolveMemberAtoms(atoms, BASE_FONT, measurer);
    expect(build.atoms).toHaveLength(2);
    expect(build.atoms[0]).toMatchObject({ kind: 'text', text: 'before ' });
    expect(build.atoms[1]).toMatchObject({ kind: 'text', text: 'after' });
    const expectedWidth =
      measurer.measure('before ', FONT_SPEC).width + measurer.measure('after', FONT_SPEC).width;
    expect(build.width).toBeCloseTo(expectedWidth, 6);
  });
});

// G2 N57, item 38: a creole run whose text is ENTIRELY whitespace draws as
// NBSP (U+00A0), matching `DriverTextSvg.java`'s `text.matches("^\\s*$")`
// branch -- jar-verified against `vicuro-37-tese143`'s real golden SVG
// (`textLength="3.575"` for a bare 13pt space run split off by a
// `<size:18>`/`<u>` boundary). The width-TABLE entry for the space
// character itself (`SANS_SERIF_BLOCKS[0][32] === 0`) is confirmed correct
// -- a byte-exact match of upstream's own `UnicodeFontWidthSansSerif.java`
// (full 255-block comparison, not just this one entry) -- so `width` (the
// LAYOUT/x-advance value) must stay 0; only the RENDER-time text/textLength
// differ, via the new `renderText`/`renderWidth` fields.
describe('resolveMemberAtoms — whitespace-only run renders as NBSP (G2 N57, item 38)', () => {
  test('a lone-space atom: layout width stays 0, renderText is NBSP, renderWidth is the NBSP width', () => {
    const wtMeasurer = new WidthTableMeasurer();
    const font: FontConfiguration = { family: 'sans-serif', size: 13, color: null, styles: new Set() };
    const atoms = [{ kind: 'text' as const, text: ' ', font }];
    const build = resolveMemberAtoms(atoms, font, wtMeasurer);
    expect(build.atoms).toHaveLength(1);
    const atom = build.atoms[0]!;
    expect(atom).toMatchObject({ kind: 'text', text: ' ', width: 0 });
    expect((atom as { renderText?: string }).renderText).toBe('\u00A0');
    expect((atom as { renderWidth?: number }).renderWidth).toBeCloseTo(3.575, 6);
    // Layout total (line-width sum) stays 0 for a lone space -- unchanged by
    // this fix, matches jar's own `AtomText#drawU`/`calculateDimensionSlow`
    // x-advance path (RAW width, no substitution).
    expect(build.width).toBe(0);
  });

  test('a multi-space run ("   ") also substitutes every space to NBSP', () => {
    const wtMeasurer = new WidthTableMeasurer();
    const font: FontConfiguration = { family: 'sans-serif', size: 13, color: null, styles: new Set() };
    const atoms = [{ kind: 'text' as const, text: '   ', font }];
    const build = resolveMemberAtoms(atoms, font, wtMeasurer);
    const atom = build.atoms[0]! as { renderText?: string; renderWidth?: number };
    expect(atom.renderText).toBe('\u00A0\u00A0\u00A0');
    expect(atom.renderWidth).toBeCloseTo(3 * 3.575, 6);
  });

  test('a non-whitespace atom carries no renderText/renderWidth override', () => {
    const build = resolveMemberAtoms([{ kind: 'text' as const, text: 'class', font: BASE_FONT }], BASE_FONT, measurer);
    const atom = build.atoms[0]! as { renderText?: string; renderWidth?: number };
    expect(atom.renderText).toBeUndefined();
    expect(atom.renderWidth).toBeUndefined();
  });

  test('a mixed run starting with a space ("  class") is NOT substituted (upstream gates on ENTIRELY whitespace only)', () => {
    const build = resolveMemberAtoms(
      [{ kind: 'text' as const, text: '  class', font: BASE_FONT }],
      BASE_FONT,
      measurer,
    );
    const atom = build.atoms[0]! as { renderText?: string; renderWidth?: number };
    expect(atom.renderText).toBeUndefined();
    expect(atom.renderWidth).toBeUndefined();
  });
});
