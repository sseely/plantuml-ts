import { describe, it, expect } from 'vitest';
import {
  opalePolygonLeft,
  opalePolygonRight,
  opalePolygonUp,
  opalePolygonDown,
  opaleCorner,
  getOpaleStrategy,
  matchScore,
  getBestMatchRow,
} from '../../../src/diagrams/class/note-opale.js';

describe('opalePolygonRight — jar-verified byte-exact (cajicu-52-cego765, B note)', () => {
  it('emits the exact zigzag path jar draws for a RIGHT-notch member-tip note', () => {
    // B's note: box origin (98,7) in the jar SVG's own note-local frame is
    // (34.81,21.5) absolute -- reproduced here with offset baked in, matching
    // renderer-note.ts's own usage. width=28.2313, height=23 (single-line
    // "b", fontSize 13). pp1=(0, height/2)=(0,11.5) (fixed, per
    // EntityImageTips), pp2=(69.19, 28.5) (derived from the host row anchor
    // math, see plans/g2-class-svg/ledger.md N13).
    const d = opalePolygonRight(
      { origin: { x: 34.81, y: 21.5 }, width: 28.2313, height: 23 },
      { pp1: { x: 0, y: 11.5 }, pp2: { x: 69.19, y: 28.5 } },
    );
    // Byte-exact against the jar SVG for cajicu-52-cego765's B::m_b note
    // (2026-07-16 oracle re-capture): degenerate zero-radius arcs are
    // emitted verbatim (`A0,0 0 0 0 x,y`), not simplified to `L`.
    expect(d).toBe(
      'M34.81,21.5 L34.81,44.5 A0,0 0 0 0 34.81,44.5 L63.04130000000001,44.5 A0,0 0 0 0 63.04130000000001,44.5 ' +
        'L63.04130000000001,39.5 L104,50 L63.04130000000001,31.5 L63.04130000000001,31.5 L53.04130000000001,21.5 ' +
        'L34.81,21.5 A0,0 0 0 0 34.81,21.5',
    );
  });
});

describe('opalePolygonLeft — jar-verified byte-exact (cajicu-52-cego765, D note)', () => {
  it('emits the exact zigzag path jar draws for a LEFT-notch member-tip note', () => {
    const d = opalePolygonLeft(
      { origin: { x: 115.81, y: 251.5 }, width: 28.2313, height: 23 },
      { pp1: { x: 0, y: 11.5 }, pp2: { x: -40.96, y: 28.5 } },
    );
    expect(d).toBe(
      'M115.81,251.5 L115.81,259 L74.85,280 L115.81,267 L115.81,274.5 A0,0 0 0 0 115.81,274.5 ' +
        'L144.0413,274.5 A0,0 0 0 0 144.0413,274.5 L144.0413,261.5 L134.0413,251.5 L115.81,251.5 A0,0 0 0 0 115.81,251.5',
    );
  });
});

describe('opaleCorner — the folded-corner triangle, shared by every note kind', () => {
  it('emits the exact fold-corner path jar draws', () => {
    const d = opaleCorner({ x: 34.81, y: 21.5 }, 28.2313);
    expect(d).toBe('M53.04130000000001,21.5 L53.04130000000001,31.5 L63.04130000000001,31.5 L53.04130000000001,21.5');
  });
});

describe('matchScore — BodierAbstract#matchScore port', () => {
  it('scores an exact whole-string match as 0', () => {
    expect(matchScore('m_b', 'm_b')).toBe(0);
  });

  it('penalizes trailing text after the match', () => {
    // "m_b: int" -- candidate "m_b" matches at index 0, then ": int" (5
    // chars) trails: first char ':' is not alphanumeric -> separator seen,
    // every one of the 5 trailing chars (: , space, i, n, t) then costs
    // WEIGHT_AFTER_SEPARATOR (1000) once separatorSeen is true.
    expect(matchScore('m_b: int', 'm_b')).toBe(5_000);
  });

  it('penalizes ALPHANUMERIC trailing text before the first separator MUCH more', () => {
    // "member1" vs candidate "member" -- matches at index 0, one trailing
    // char '1' (alphanumeric, no separator yet) costs WEIGHT_TRAILING_LETTERS.
    expect(matchScore('member1', 'member')).toBe(1_000_000);
  });

  it('returns Infinity when the candidate is not a substring anywhere', () => {
    expect(matchScore('method()', 'typo')).toBe(Infinity);
  });

  it('penalizes a match starting further into the line, letters costing far more than punctuation', () => {
    // "+String a1" vs candidate "a1": no match at index 0 ('+' not-a-letter,
    // +1), then 'S','t','r','i','n','g' (6 letters, +1e9 each), then ' '
    // (not-a-letter, +1) before the match starts at index 8.
    const score = matchScore('+String a1', 'a1');
    expect(score).toBe(6_000_000_002);
  });
});

describe('getBestMatchRow — picks the lowest-score row, or undefined for none', () => {
  const rows = [
    { text: 'member1' },
    { text: 'memberB()' },
    { text: 'member2' },
  ];

  it('picks the exact match over a longer/prefixed one', () => {
    expect(getBestMatchRow(rows, 'member2')?.text).toBe('member2');
  });

  it('picks the best-scoring prefix match when no exact match exists', () => {
    expect(getBestMatchRow(rows, 'memberB')?.text).toBe('memberB()');
  });

  it('returns undefined when no row contains the candidate at all', () => {
    expect(getBestMatchRow(rows, 'typo')).toBeUndefined();
  });
});
// ---------------------------------------------------------------------------
// General opalisable-note mechanism (G2/N14): UP/DOWN geometry + direction
// strategy -- EntityImageNote.java's opaleLine branch, used by every
// single-link `note <pos> of X` (not just member-tips).
// ---------------------------------------------------------------------------

describe('opalePolygonDown — jar-verified byte-exact (bumuma-72-zoka383)', () => {
  it('emits the exact zigzag path jar draws for a DOWN-notch note ("note top of foo")', () => {
    // note is ABOVE its host ("foo") -- jar's connector routes DOWN, so the
    // notch is cut into the note's own BOTTOM edge. Box origin/dims and
    // pp1/pp2 taken directly from the oracle SVG (test-results/dot-cache/
    // class/bumuma-72-zoka383/in.svg): box (6.33,6)..(59.0987,55); the
    // routed connector is a straight vertical line, so pp1.x === pp2.x.
    const d = opalePolygonDown(
      { origin: { x: 6.33, y: 6 }, width: 59.0987 - 6.33, height: 55 - 6 },
      { pp1: { x: 26.38, y: 49 }, pp2: { x: 32.71 - 6.33, y: 114.55 - 6 } },
    );
    expect(d).toBe(
      'M6.33,6 L6.33,55 A0,0 0 0 0 6.33,55 L28.71,55 L32.71,114.55 L36.71,55 L59.0987,55 ' +
        'A0,0 0 0 0 59.0987,55 L59.0987,16 L49.0987,6 L6.33,6 A0,0 0 0 0 6.33,6',
    );
  });
});

describe('opalePolygonUp — jar-verified byte-exact (sisolu-74-minu975)', () => {
  it('emits the exact zigzag path jar draws for an UP-notch note ("note bottom of a")', () => {
    // note is BELOW its host ("a") -- jar's connector routes UP, notch cut
    // into the note's own TOP edge. Box (6,115)..(102.2375,164).
    const d = opalePolygonUp(
      { origin: { x: 6, y: 115 }, width: 102.2375 - 6, height: 164 - 115 },
      { pp1: { x: 48.12, y: 0 }, pp2: { x: 54.12 - 6, y: 55.37 - 115 } },
    );
    expect(d).toBe(
      'M6,115 L6,164 A0,0 0 0 0 6,164 L102.2375,164 A0,0 0 0 0 102.2375,164 L102.2375,125 ' +
        'L92.2375,115 L58.12,115 L54.12,55.37 L50.12,115 L6,115 A0,0 0 0 0 6,115',
    );
  });
});

describe('getOpaleStrategy — jar-verified direction pick on all 4 edges', () => {
  it('picks LEFT when pt sits nearest the left edge (fezugi-39-fujo327, "note right of a")', () => {
    expect(getOpaleStrategy(67.9625, 23, { x: 0, y: 11.5 })).toBe('left');
  });

  it('picks RIGHT when pt sits nearest the right edge (cajicu-52-cego765, B note)', () => {
    expect(getOpaleStrategy(28.2313, 23, { x: 28.2313, y: 11.5 })).toBe('right');
  });

  it('picks DOWN when pt sits nearest the bottom edge (bumuma-72-zoka383)', () => {
    expect(getOpaleStrategy(52.7687, 49, { x: 26.38, y: 49 })).toBe('down');
  });

  it('picks UP when pt sits nearest the top edge (sisolu-74-minu975)', () => {
    expect(getOpaleStrategy(96.2375, 49, { x: 48.12, y: 0 })).toBe('up');
  });

  it('LEFT wins a tie over RIGHT/UP/DOWN (upstream if/else-if order)', () => {
    // A square box, pt at dead center is EQUIDISTANT to all 4 edges.
    expect(getOpaleStrategy(20, 20, { x: 10, y: 10 })).toBe('left');
  });
});
