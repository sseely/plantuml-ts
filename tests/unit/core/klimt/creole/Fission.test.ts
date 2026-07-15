/**
 * Fission.test.ts — E2r/L3: word-wrap (`getSplitted`'s greedy word-boundary
 * line-packing over a `CreoleAtom[]`).
 *
 * The `100 wrapWidth` suite is jar-verified 2026-07-15 (direct probe,
 * `-DPLANTUML_DETERMINISTIC_TEXT=true`, oracle jar, `oracle/capture.sh`):
 * `rectangle "This is a genuinely long single line of text with no
 * explicit newlines that should trigger wrapping if a default width
 * exists somewhere" as R1` with `skinparam wrapWidth 100` split into
 * exactly 10 physical lines (grouped by shared SVG `<text>` y-coordinate,
 * font-size 14) with this exact word sequence per line — see the ledger
 * for the raw SVG dump this table was read off.
 */
import { describe, expect, test } from 'vitest';
import { XDimension2D } from '../../../../../src/core/klimt/geom/XDimension2D.js';
import type { FontConfiguration } from '../../../../../src/core/klimt/shape/UText.js';
import type { CreoleAtom } from '../../../../../src/core/klimt/creole/atom/Atom.js';
import { getSplitted } from '../../../../../src/core/klimt/creole/Fission.js';
import { buildStripeAtoms } from '../../../../../src/core/klimt/creole/legacy/StripeSimple.js';
import { DeterministicMeasurer } from '../../../../../src/core/measurer-deterministic.js';

const PLAIN: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };

/** A trivial 1-unit-per-character measurer (no font metrics involved) —
 *  used for the algorithm-shape tests below, where exact pixel widths
 *  don't matter, only the BREAK POSITIONS the word-boundary scan picks. */
function charWidthMeasure(atom: CreoleAtom): number {
  if (atom.kind !== 'text') return 0;
  return atom.text.length;
}

function texts(lines: readonly (readonly CreoleAtom[])[]): string[][] {
  return lines.map((line) =>
    line.map((a) => {
      if (a.kind !== 'text') throw new Error('expected a text atom');
      return a.text;
    }),
  );
}

describe('getSplitted — disabled (maxWidth 0)', () => {
  test('maxWidth 0 returns the atoms unchanged, as the single line', () => {
    const atoms = buildStripeAtoms('hello world', PLAIN);
    expect(getSplitted(atoms, 0, charWidthMeasure)).toEqual([atoms]);
  });
});

describe('getSplitted — word-boundary greedy packing (1-unit-per-char measurer)', () => {
  test('a short line under maxWidth is not split', () => {
    const atoms = buildStripeAtoms('hi there', PLAIN);
    expect(texts(getSplitted(atoms, 100, charWidthMeasure))).toEqual([['hi', ' ', 'there']]);
  });

  test('breaks at the LAST word boundary before exceeding maxWidth', () => {
    // "aaaa bbbb cccc" — maxWidth 9: "aaaa bbbb" is 9 (not > 9, kept);
    // adding " cccc" would push to 14 (> 9) — break before "cccc".
    const atoms = buildStripeAtoms('aaaa bbbb cccc', PLAIN);
    expect(texts(getSplitted(atoms, 9, charWidthMeasure))).toEqual([
      ['aaaa', ' ', 'bbbb'],
      ['cccc'],
    ]);
  });

  test('a single word longer than maxWidth is kept whole (no break point inside it)', () => {
    const atoms = buildStripeAtoms('supercalifragilisticexpialidocious', PLAIN);
    expect(texts(getSplitted(atoms, 5, charWidthMeasure))).toEqual([['supercalifragilisticexpialidocious']]);
  });

  test('leading/trailing whitespace on continuation lines is stripped', () => {
    const atoms = buildStripeAtoms('aa   bb   cc', PLAIN);
    // "aa   bb" is 7 (<=8, kept); next boundary would push past 8.
    const lines = texts(getSplitted(atoms, 8, charWidthMeasure));
    for (const line of lines) {
      expect(line[0]).not.toBe(' ');
      expect(line[line.length - 1]).not.toBe(' ');
    }
  });

  test('an empty line (single-space fallback atom) is not split', () => {
    const atoms = buildStripeAtoms('', PLAIN);
    expect(texts(getSplitted(atoms, 5, charWidthMeasure))).toEqual([[' ']]);
  });
});

describe('getSplitted — jar-verified against a real DeterministicMeasurer probe', () => {
  test('wrapWidth 100, font-size 14: splits into 10 lines matching the jar exactly', () => {
    const measurer = new DeterministicMeasurer();
    const stringBounder = {
      calculateDimension(font: { family: string; size: number }, text: string): XDimension2D {
        const { width, height } = measurer.measure(text, font);
        return new XDimension2D(width, height);
      },
    };
    const measureAtomWidth = (atom: CreoleAtom): number => {
      if (atom.kind !== 'text') return 0;
      return stringBounder.calculateDimension(atom.font, atom.text).getWidth();
    };

    const text =
      'This is a genuinely long single line of text with no explicit newlines that should trigger wrapping if a default width exists somewhere';
    const atoms = buildStripeAtoms(text, PLAIN);
    const lines = texts(getSplitted(atoms, 100, measureAtomWidth));

    expect(lines).toEqual([
      ['This', ' ', 'is', ' ', 'a'],
      ['genuinely', ' ', 'long'],
      ['single', ' ', 'line', ' ', 'of', ' ', 'text'],
      ['with', ' ', 'no', ' ', 'explicit'],
      ['newlines', ' ', 'that'],
      ['should', ' ', 'trigger'],
      ['wrapping', ' ', 'if', ' ', 'a'],
      ['default', ' ', 'width'],
      ['exists'],
      ['somewhere'],
    ]);
  });
});
