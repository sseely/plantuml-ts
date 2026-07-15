/**
 * CommandCreoleL2.test.ts — E2r/L2: the inline directive commands
 * (`<size:>`, `<color:>`, `<font size=/color=>`, `<font:family>`,
 * `<latex>`, `[[url]]`) exercised through `buildStripeAtoms`'s full
 * registration/dispatch path (`CommandCreoleBuilder.ts`'s command map),
 * matching this project's existing `StripeSimple.test.ts` convention of
 * testing through the public API rather than each `Command` object
 * directly.
 */
import { describe, expect, test } from 'vitest';
import { FontStyle, type FontConfiguration } from '../../../../../../src/core/klimt/shape/UText.js';
import { buildStripeAtoms } from '../../../../../../src/core/klimt/creole/legacy/StripeSimple.js';
import type { CreoleAtom } from '../../../../../../src/core/klimt/creole/atom/Atom.js';

const PLAIN: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };

function textOf(atom: CreoleAtom): { text: string; size: number; color: string | null; family: string; styles: FontStyle[] } {
  if (atom.kind !== 'text') throw new Error('expected a text atom');
  return { text: atom.text, size: atom.font.size, color: atom.font.color, family: atom.font.family, styles: [...atom.font.styles] };
}

describe('CommandCreoleSizeChange', () => {
  test('bracketed form changes size for the captured inner text only', () => {
    const atoms = buildStripeAtoms('<size:20>big</size>rest', PLAIN);
    expect(atoms.map(textOf)).toEqual([
      { text: 'big', size: 20, color: '#000000', family: 'sans-serif', styles: [] },
      { text: 'rest', size: 14, color: '#000000', family: 'sans-serif', styles: [] },
    ]);
  });

  test('EOL form (no closing tag) changes size to end of line', () => {
    const atoms = buildStripeAtoms('a<size:9>rest of line', PLAIN);
    expect(atoms.map(textOf)).toEqual([
      { text: 'a', size: 14, color: '#000000', family: 'sans-serif', styles: [] },
      { text: 'rest of line', size: 9, color: '#000000', family: 'sans-serif', styles: [] },
    ]);
  });

  test('nests correctly inside an active italic run (size command preserves outer styles)', () => {
    const atoms = buildStripeAtoms('//<size:12>sized italic</size>//', PLAIN);
    expect(atoms.map(textOf)).toEqual([
      { text: 'sized italic', size: 12, color: '#000000', family: 'sans-serif', styles: [FontStyle.ITALIC] },
    ]);
  });

  test('colon-space form ("<size: 8>") is recognized', () => {
    const atoms = buildStripeAtoms('<size: 8>tiny</size>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'tiny', size: 8, color: '#000000', family: 'sans-serif', styles: [] }]);
  });
});

describe('CommandCreoleColorChange', () => {
  test('bracketed form resolves a named color', () => {
    const atoms = buildStripeAtoms('<color:red>hot</color>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'hot', size: 14, color: '#FF0000', family: 'sans-serif', styles: [] }]);
  });

  test('bracketed form resolves a hex color', () => {
    const atoms = buildStripeAtoms('<color:#00FF00>green</color>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'green', size: 14, color: '#00FF00', family: 'sans-serif', styles: [] }]);
  });

  test('EOL form (no closing tag) resolves to end of line', () => {
    const atoms = buildStripeAtoms('<color:blue>rest of line', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'rest of line', size: 14, color: '#0000FF', family: 'sans-serif', styles: [] }]);
  });

  test('an unresolvable color token leaves the font unchanged (upstream: NoSuchColorException swallowed)', () => {
    const atoms = buildStripeAtoms('<color:notarealcolor>text</color>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'text', size: 14, color: '#000000', family: 'sans-serif', styles: [] }]);
  });

  test('wraps a sprite atom (unified atom+command scan, E2r/L2 architecture fix)', () => {
    const atoms = buildStripeAtoms('<color:red><$Batch></color>', PLAIN);
    expect(atoms).toEqual([{ kind: 'inline', atom: { kind: 'sprite', name: 'Batch', scale: 1 } }]);
  });
});

describe('CommandCreoleColorAndSizeChange (<font size=/color=>)', () => {
  test('both size and color attrs, bracketed form', () => {
    const atoms = buildStripeAtoms('<font size=12 color=blue>hi</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'hi', size: 12, color: '#0000FF', family: 'sans-serif', styles: [] }]);
  });

  test('color attr order does not matter (color before size)', () => {
    const atoms = buildStripeAtoms('<font color=red size=18>hi</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'hi', size: 18, color: '#FF0000', family: 'sans-serif', styles: [] }]);
  });

  test('size attr only', () => {
    const atoms = buildStripeAtoms('<font size=20>only size</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'only size', size: 20, color: '#000000', family: 'sans-serif', styles: [] }]);
  });

  test('color attr only', () => {
    const atoms = buildStripeAtoms('<font color=green>only color</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'only color', size: 14, color: '#008000', family: 'sans-serif', styles: [] }]);
  });

  test('EOL form (no closing tag)', () => {
    const atoms = buildStripeAtoms('<font size=16>rest of line', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'rest of line', size: 16, color: '#000000', family: 'sans-serif', styles: [] }]);
  });

  test('quoted hex color attr', () => {
    const atoms = buildStripeAtoms('<font color="#112233">hi</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'hi', size: 14, color: '#112233', family: 'sans-serif', styles: [] }]);
  });
});

describe('CommandCreoleFontFamilyChange (registered AFTER ColorAndSizeChange, same "<f" starter)', () => {
  test('colon form changes family, bracketed', () => {
    const atoms = buildStripeAtoms('<font:Arial>hi</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'hi', size: 14, color: '#000000', family: 'Arial', styles: [] }]);
  });

  test('space form changes family, bracketed', () => {
    const atoms = buildStripeAtoms('<font Courier New>hi</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'hi', size: 14, color: '#000000', family: 'Courier New', styles: [] }]);
  });

  test('EOL form (no closing tag)', () => {
    const atoms = buildStripeAtoms('<font:Times>rest of line', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'rest of line', size: 14, color: '#000000', family: 'Times', styles: [] }]);
  });

  test('a size=/color= attr form is claimed by ColorAndSizeChange, not this command', () => {
    const atoms = buildStripeAtoms('<font size=12>x</font>', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'x', size: 12, color: '#000000', family: 'sans-serif', styles: [] }]);
  });
});

describe('CommandCreoleLatex', () => {
  test('recognizes <latex>...</latex> as its own atom, under the active color', () => {
    const atoms = buildStripeAtoms('<latex>x^2</latex>', PLAIN);
    expect(atoms).toEqual([{ kind: 'latex', expr: 'x^2', color: '#000000' }]);
  });

  test('inside <color:> the latex atom carries that color', () => {
    const atoms = buildStripeAtoms('<color:blue><latex>\\mathcal{D}</latex></color>', PLAIN);
    expect(atoms).toEqual([{ kind: 'latex', expr: '\\mathcal{D}', color: '#0000FF' }]);
  });

  test('an unterminated <latex> tag (no closing tag) falls through as literal text', () => {
    const atoms = buildStripeAtoms('<latex>no closing tag', PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: '<latex>no closing tag', size: 14, color: '#000000', family: 'sans-serif', styles: [] }]);
  });

  test('surrounding text is preserved around a latex atom', () => {
    const atoms = buildStripeAtoms('before <latex>a+b</latex> after', PLAIN);
    expect(atoms).toEqual([
      { kind: 'text', text: 'before ', font: PLAIN },
      { kind: 'latex', expr: 'a+b', color: '#000000' },
      { kind: 'text', text: ' after', font: PLAIN },
    ]);
  });
});

describe('CommandCreoleUrl ([[url]] atom-splitting)', () => {
  test('a bare url resolves the label to the url itself', () => {
    const atoms = buildStripeAtoms('[[http://www.google.com]]', PLAIN);
    expect(atoms.map(textOf)).toEqual([
      { text: 'http://www.google.com', size: 14, color: '#0000FF', family: 'sans-serif', styles: [FontStyle.UNDERLINE] },
    ]);
  });

  test('an explicit label after the url is used as the visible text', () => {
    const atoms = buildStripeAtoms('[[http://www.google.com CLICK]]', PLAIN);
    expect(atoms.map(textOf)).toEqual([
      { text: 'CLICK', size: 14, color: '#0000FF', family: 'sans-serif', styles: [FontStyle.UNDERLINE] },
    ]);
  });

  test('an optional {tooltip} block is stripped before label resolution', () => {
    const atoms = buildStripeAtoms('[[http://www.yahoo.com{This is Dog}]]', PLAIN);
    expect(atoms.map(textOf)).toEqual([
      { text: 'http://www.yahoo.com', size: 14, color: '#0000FF', family: 'sans-serif', styles: [FontStyle.UNDERLINE] },
    ]);
  });

  test('surrounding text is preserved around a url atom', () => {
    const atoms = buildStripeAtoms('You can click\n[[http://www.google.com]] <$maxime>'.split('\n')[0]!, PLAIN);
    expect(atoms.map(textOf)).toEqual([{ text: 'You can click', size: 14, color: '#000000', family: 'sans-serif', styles: [] }]);
  });
});
