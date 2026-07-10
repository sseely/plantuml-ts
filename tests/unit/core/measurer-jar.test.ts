import { describe, it, expect } from 'vitest';
import { JarMeasurer, jarMeasurer } from '../../../src/core/measurer-jar.js';
import type { FontSpec } from '../../../src/core/measurer.js';

/**
 * Validates the jar-faithful measurer (architecture decision D12) against
 * the AWT values recorded in scripts/extract-jar-font-metrics/README.md
 * ("Spot-check values" + "Style handling" tables), extracted via
 * FontMetrics.getStringBounds with FRACTIONALMETRICS + ANTIALIASING on,
 * matching StringBounderSvg's exact measurement path. The goal is
 * pixel-identical measurement to the jar, not "correct" measurement.
 */
describe('JarMeasurer — jar-faithful AWT string measurer (D12)', () => {
  const m = new JarMeasurer();
  const plain14: FontSpec = { family: 'SansSerif', size: 14 };
  const bold14: FontSpec = { family: 'SansSerif', size: 14, weight: 'bold' };
  const italic14: FontSpec = { family: 'SansSerif', size: 14, style: 'italic' };
  const boldItalic14: FontSpec = {
    family: 'SansSerif',
    size: 14,
    weight: 'bold',
    style: 'italic',
  };

  describe('exported singleton', () => {
    it('jarMeasurer is a JarMeasurer instance behaving identically to a fresh one', () => {
      expect(jarMeasurer.measure('W', plain14)).toEqual(m.measure('W', plain14));
    });
  });

  describe('plain-style advances (README spot-check values)', () => {
    it.each<[string, number]>([
      ['W', 11.9765625],
      [' ', 4.4296875],
      ['m', 13.0703125],
      ['i', 4.046875],
      ['A', 9.659179684],
      ['l', 4.046875],
    ])('%s measures %fpx at 14pt', (ch, px) => {
      expect(m.measure(ch, plain14).width).toBeCloseTo(px, 6);
    });

    it('12pt spot-check matches README: W = 10.265625px', () => {
      expect(m.measure('W', { family: 'SansSerif', size: 12 }).width).toBeCloseTo(
        10.265625,
        6,
      );
    });
  });

  describe('bold-style advances (README style-handling table)', () => {
    it.each<[string, number]>([
      ['W', 12.653320316],
      [' ', 4.614257816],
      ['m', 13.576171882],
      ['i', 4.552734382],
      ['A', 10.30859375],
      ['l', 4.552734382],
    ])('bold %s measures %fpx at 14pt (distinct from plain)', (ch, px) => {
      expect(m.measure(ch, bold14).width).toBeCloseTo(px, 6);
    });

    it('bold advance is NOT a fixed scale of the plain advance (non-uniform per glyph)', () => {
      const ratioW = m.measure('W', bold14).width / m.measure('W', plain14).width;
      const ratioI = m.measure('i', bold14).width / m.measure('i', plain14).width;
      expect(ratioW).not.toBeCloseTo(ratioI, 3);
    });
  });

  describe('italic reuses the plain table (empirically verified: no advance change)', () => {
    it('italic-only measures identically to plain', () => {
      expect(m.measure('Hello World', italic14)).toEqual(
        m.measure('Hello World', plain14),
      );
    });

    it('bold+italic measures identically to bold alone', () => {
      expect(m.measure('Hello World', boldItalic14)).toEqual(
        m.measure('Hello World', bold14),
      );
    });
  });

  describe('additivity (per-glyph table is additive by construction)', () => {
    it('sums codepoints: "Ai" = A + i', () => {
      const a = m.measure('A', plain14).width;
      const i = m.measure('i', plain14).width;
      expect(m.measure('Ai', plain14).width).toBeCloseTo(a + i, 6);
    });

    it('whole-string width equals summed per-glyph widths for README test strings', () => {
      for (const s of ['Hello World', 'AVA', 'Type']) {
        let summed = 0;
        for (const ch of s) summed += m.measure(ch, plain14).width;
        expect(m.measure(s, plain14).width).toBeCloseTo(summed, 6);
      }
    });
  });

  describe('linear scaling with font size', () => {
    it('plain scales linearly (factor = size)', () => {
      const at14 = m.measure('AWM', plain14).width;
      const at28 = m.measure('AWM', { family: 'SansSerif', size: 28 }).width;
      expect(at28).toBeCloseTo(at14 * 2, 6);
    });

    it('bold scales linearly (factor = size)', () => {
      const at14 = m.measure('AWM', bold14).width;
      const at28 = m.measure('AWM', {
        family: 'SansSerif',
        size: 28,
        weight: 'bold',
      }).width;
      expect(at28).toBeCloseTo(at14 * 2, 6);
    });
  });

  describe('height and descent', () => {
    it('height = (ascent + descent) * size, constant regardless of text', () => {
      const expected = (0.9667969 + 0.2109375) * 14;
      expect(m.measure('W', plain14).height).toBeCloseTo(expected, 5);
      expect(m.measure('Hello World', plain14).height).toBeCloseTo(expected, 5);
    });

    it('height is identical across plain/bold/italic (ascent+descent unchanged)', () => {
      const plainHeight = m.measure('x', plain14).height;
      expect(m.measure('x', bold14).height).toBeCloseTo(plainHeight, 10);
      expect(m.measure('x', italic14).height).toBeCloseTo(plainHeight, 10);
    });

    it('getDescent = descent * size, ignoring the text argument', () => {
      const expected = 0.2109375 * 14;
      expect(m.getDescent(plain14, 'anything')).toBeCloseTo(expected, 6);
      expect(m.getDescent(plain14, '')).toBeCloseTo(expected, 6);
    });

    it('getDescent uses the bold table selection but the same descent value', () => {
      expect(m.getDescent(bold14, 'x')).toBeCloseTo(m.getDescent(plain14, 'x'), 10);
    });
  });

  describe('fallback advance for codepoints outside [32, 591]', () => {
    it('a codepoint below MIN_CODEPOINT falls back to the plain mean advance', () => {
      // Tab (U+0009) is below MIN_CODEPOINT (32) — not in the extracted table.
      const tab = String.fromCharCode(9);
      const expected = 0.626722977 * 14;
      expect(m.measure(tab, plain14).width).toBeCloseTo(expected, 5);
    });

    it('a codepoint above MAX_CODEPOINT falls back to the bold mean advance under bold', () => {
      // U+10000 (astral plane) is above MAX_CODEPOINT (591).
      const expected = 0.664181996 * 14;
      expect(m.measure('\u{10000}', bold14).width).toBeCloseTo(expected, 5);
    });
  });

  describe('font-agnostic (family field ignored — one physical table per style)', () => {
    it('measures identically regardless of family name', () => {
      const a = m.measure('Hello', { family: 'Courier', size: 14 }).width;
      const b = m.measure('Hello', { family: 'SansSerif', size: 14 }).width;
      expect(a).toBe(b);
    });
  });

  describe('empty string', () => {
    it('measures zero width, but height/descent are still style-derived constants', () => {
      expect(m.measure('', plain14).width).toBe(0);
      expect(m.measure('', plain14).height).toBeCloseTo(
        (0.9667969 + 0.2109375) * 14,
        5,
      );
    });
  });
});
