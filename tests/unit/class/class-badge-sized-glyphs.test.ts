import { describe, it, expect } from 'vitest';
import { lookupSizedGlyph } from '../../../src/diagrams/class/class-badge-sized-glyphs.js';

describe('lookupSizedGlyph', () => {
  it('returns a captured entry for a known (C, size) pair', () => {
    const entry = lookupSizedGlyph('C', 18);
    expect(entry).toBeDefined();
    expect(entry?.refCx).toBe(23);
    expect(entry?.refCy).toBe(24);
    expect(entry?.d).toContain('M25.501,30.1221');
  });

  it('returns undefined for a non-C letter regardless of size', () => {
    expect(lookupSizedGlyph('I', 18)).toBeUndefined();
    expect(lookupSizedGlyph('A', 13)).toBeUndefined();
  });

  it('returns undefined for a C at an uncaptured size', () => {
    expect(lookupSizedGlyph('C', 17)).toBeUndefined();
    expect(lookupSizedGlyph('C', 25)).toBeUndefined();
  });

  it('covers every captured size (13-22, excluding 17)', () => {
    for (const size of [13, 14, 15, 16, 18, 19, 20, 21, 22]) {
      expect(lookupSizedGlyph('C', size)).toBeDefined();
    }
  });
});
