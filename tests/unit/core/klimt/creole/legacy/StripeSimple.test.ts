/**
 * StripeSimple.test.ts — E2r/L1: `buildStripeAtoms`'s nested inline
 * style-run splitting (bold/italic/underline/wave/strikeout, creole-pure
 * and HTML-tag-style, with and without a closing tag) plus
 * `fontConfigurationForHeading`'s per-order font cascade.
 */
import { describe, expect, test } from 'vitest';
import { FontStyle, type FontConfiguration } from '../../../../../../src/core/klimt/shape/UText.js';
import {
  buildStripeAtoms,
  buildLiteralAtoms,
  fontConfigurationForHeading,
} from '../../../../../../src/core/klimt/creole/legacy/StripeSimple.js';

const PLAIN: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };

function textAtoms(atoms: ReturnType<typeof buildStripeAtoms>): { text: string; styles: FontStyle[] }[] {
  return atoms.map((a) => {
    if (a.kind !== 'text') throw new Error('expected a text atom');
    return { text: a.text, styles: [...a.font.styles] };
  });
}

describe('buildStripeAtoms — atom-free plain text', () => {
  test('plain text with no markup produces exactly one atom, unchanged', () => {
    const atoms = buildStripeAtoms('hello world', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: 'hello world', styles: [] }]);
  });

  test('an empty line produces one single-space atom (upstream getAtoms() fallback)', () => {
    const atoms = buildStripeAtoms('', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: ' ', styles: [] }]);
  });
});

describe('buildStripeAtoms — creole-pure double-punctuation forms', () => {
  test('"**bold**" splits into one BOLD atom', () => {
    const atoms = buildStripeAtoms('**bold**', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: 'bold', styles: [FontStyle.BOLD] }]);
  });

  test('"a **bold** b" splits into three runs: plain, BOLD, plain', () => {
    const atoms = buildStripeAtoms('a **bold** b', PLAIN);
    expect(textAtoms(atoms)).toEqual([
      { text: 'a ', styles: [] },
      { text: 'bold', styles: [FontStyle.BOLD] },
      { text: ' b', styles: [] },
    ]);
  });

  test('"//italic//" splits into one ITALIC atom', () => {
    expect(textAtoms(buildStripeAtoms('//italic//', PLAIN))).toEqual([{ text: 'italic', styles: [FontStyle.ITALIC] }]);
  });

  test('"__underline__" splits into one UNDERLINE atom', () => {
    expect(textAtoms(buildStripeAtoms('__underline__', PLAIN))).toEqual([
      { text: 'underline', styles: [FontStyle.UNDERLINE] },
    ]);
  });

  test('"~~wave~~" splits into one WAVE atom', () => {
    expect(textAtoms(buildStripeAtoms('~~wave~~', PLAIN))).toEqual([{ text: 'wave', styles: [FontStyle.WAVE] }]);
  });

  test('non-greedy: "**a**b**" stops at the FIRST closing "**", leaving "b**" for further processing', () => {
    // "b**" has no matching closer of its own -> "**" falls through as
    // literal pending text (searchCommand requires >=1 content char, and
    // there's nothing after this trailing "**" to close against).
    const atoms = buildStripeAtoms('**a**b**', PLAIN);
    expect(textAtoms(atoms)).toEqual([
      { text: 'a', styles: [FontStyle.BOLD] },
      { text: 'b**', styles: [] },
    ]);
  });
});

describe('buildStripeAtoms — nested inline style runs (usecase/lurupu-11-fubo915 line 3 shape)', () => {
  test('"<b>this is also long</b>" (legacy HTML-tag form, closed) produces one BOLD atom', () => {
    const atoms = buildStripeAtoms('<b>this is also long</b>', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: 'this is also long', styles: [FontStyle.BOLD] }]);
  });

  test('"<b>bold to end" (legacyEol form, no closing tag) styles the rest of the line', () => {
    const atoms = buildStripeAtoms('<b>bold to end', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: 'bold to end', styles: [FontStyle.BOLD] }]);
  });

  test('nested: "**bold //and italic// text**" -- italic run inside bold, both flags on the nested run', () => {
    const atoms = buildStripeAtoms('**bold //and italic// text**', PLAIN);
    expect(textAtoms(atoms)).toEqual([
      { text: 'bold ', styles: [FontStyle.BOLD] },
      { text: 'and italic', styles: [FontStyle.BOLD, FontStyle.ITALIC] },
      { text: ' text', styles: [FontStyle.BOLD] },
    ]);
  });

  test('legacy nested with HTML tags: "<b>bold <i>and italic</i> text</b>"', () => {
    const atoms = buildStripeAtoms('<b>bold <i>and italic</i> text</b>', PLAIN);
    expect(textAtoms(atoms)).toEqual([
      { text: 'bold ', styles: [FontStyle.BOLD] },
      { text: 'and italic', styles: [FontStyle.BOLD, FontStyle.ITALIC] },
      { text: ' text', styles: [FontStyle.BOLD] },
    ]);
  });

  test('font restores to the OUTER style after a nested run closes, for trailing plain text', () => {
    const atoms = buildStripeAtoms('**bold //italic// bold again** plain', PLAIN);
    expect(textAtoms(atoms)).toEqual([
      { text: 'bold ', styles: [FontStyle.BOLD] },
      { text: 'italic', styles: [FontStyle.BOLD, FontStyle.ITALIC] },
      { text: ' bold again', styles: [FontStyle.BOLD] },
      { text: ' plain', styles: [] },
    ]);
  });
});

describe('buildStripeAtoms — starter-prefix disambiguation (searchCommand tie-break)', () => {
  test('"<b></b>" (empty legacy form) -- upstream quirk, faithfully reproduced: an EMPTY captured inner ("V".length===0) makes `matchingSize` return 0, which `searchCommand` treats identically to "no match" (same rule for a real, non-empty capture) -- so the CLOSED legacy form never wins here, and the LEGACYEOL form (same "<b" starter) wins instead, swallowing the literal "</b>" text as part of the bold run to end of line', () => {
    const atoms = buildStripeAtoms('x<b></b>y', PLAIN);
    expect(textAtoms(atoms)).toEqual([
      { text: 'x', styles: [] },
      { text: '</b>y', styles: [FontStyle.BOLD] },
    ]);
  });

  test('a run of 5 dashes reaches STRIKE via non-greedy "--...--" matching, sandwiching a single "-"', () => {
    const atoms = buildStripeAtoms('-----', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: '-', styles: [FontStyle.STRIKE] }]);
  });
});

describe('fontConfigurationForHeading — I4c mechanism 2/5 per-order cascade', () => {
  test('order 0: bigger(4) + bold', () => {
    const f = fontConfigurationForHeading(PLAIN, 0);
    expect(f.size).toBe(18);
    expect([...f.styles]).toEqual([FontStyle.BOLD]);
  });

  test('order 1: bigger(2) + bold', () => {
    const f = fontConfigurationForHeading(PLAIN, 1);
    expect(f.size).toBe(16);
    expect([...f.styles]).toEqual([FontStyle.BOLD]);
  });

  test('order 2: bigger(1) + bold', () => {
    const f = fontConfigurationForHeading(PLAIN, 2);
    expect(f.size).toBe(15);
    expect([...f.styles]).toEqual([FontStyle.BOLD]);
  });

  test('order 3+ (default branch): italic, no size change', () => {
    const f = fontConfigurationForHeading(PLAIN, 3);
    expect(f.size).toBe(14);
    expect([...f.styles]).toEqual([FontStyle.ITALIC]);
  });

  test('does not mutate the input FontConfiguration', () => {
    fontConfigurationForHeading(PLAIN, 0);
    expect(PLAIN.styles.size).toBe(0);
    expect(PLAIN.size).toBe(14);
  });
});

describe('buildLiteralAtoms — LITERAL classification bypass (no style-command processing)', () => {
  test('"--Header--" stays a single, unstyled, unmodified text atom', () => {
    const atoms = buildLiteralAtoms('--Header--', PLAIN);
    expect(textAtoms(atoms)).toEqual([{ text: '--Header--', styles: [] }]);
  });

  test('an empty literal line falls back to a single space atom', () => {
    expect(textAtoms(buildLiteralAtoms('', PLAIN))).toEqual([{ text: ' ', styles: [] }]);
  });
});
