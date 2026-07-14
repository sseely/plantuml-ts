/**
 * Unit tests for the mission G1 I-scale shared `scale ...` directive
 * matcher + factor resolver (`src/core/scale-command.ts`).
 *
 * `matchScaleCommand` mirrors 6 upstream `CommandScale*.java` regexes;
 * `resolveScaleFactor` mirrors each corresponding `Scale*.java`'s
 * `getScaleInternal` plus `ScaleProtected`'s shared `<=0 -> 1` / `>4 -> 4`
 * clamp. Values pinned against jar-verified fixtures where cited (see
 * `scale-command.ts`'s module doc for the full Java citation list).
 */
import { describe, it, expect } from 'vitest';
import { matchScaleCommand, resolveScaleFactor } from '../../src/core/scale-command.js';

// ---------------------------------------------------------------------------
// matchScaleCommand
// ---------------------------------------------------------------------------

describe('matchScaleCommand — CommandScale (ScaleSimple)', () => {
  it('parses `scale 2` (component/saveje-35-vumu271)', () => {
    expect(matchScaleCommand('scale 2')).toEqual({ kind: 'simple', factor: 2 });
  });

  it('parses `scale 10` (component/berome-43-xini276)', () => {
    expect(matchScaleCommand('scale 10')).toEqual({ kind: 'simple', factor: 10 });
  });

  it('parses a fractional factor `scale 1.5`', () => {
    expect(matchScaleCommand('scale 1.5')).toEqual({ kind: 'simple', factor: 1.5 });
  });

  it('parses the DIV form `scale 2/3`', () => {
    const spec = matchScaleCommand('scale 2/3');
    expect(spec?.kind).toBe('simple');
    expect((spec as { factor: number }).factor).toBeCloseTo(2 / 3, 10);
  });

  it('tolerates whitespace around the DIV separator `scale 2 / 3`', () => {
    const spec = matchScaleCommand('scale 2 / 3');
    expect((spec as { factor: number }).factor).toBeCloseTo(2 / 3, 10);
  });

  it('is case-insensitive: `SCALE 2`', () => {
    expect(matchScaleCommand('SCALE 2')).toEqual({ kind: 'simple', factor: 2 });
  });

  it('rejects `scale 0` (CommandScale.executeArg: zero numerator errors)', () => {
    expect(matchScaleCommand('scale 0')).toBeUndefined();
  });

  it('rejects `scale 2/0` (zero denominator errors)', () => {
    expect(matchScaleCommand('scale 2/0')).toBeUndefined();
  });
});

describe('matchScaleCommand — CommandScaleWidthAndHeight (ScaleWidthAndHeight)', () => {
  it('parses `scale 300*200`', () => {
    expect(matchScaleCommand('scale 300*200')).toEqual({
      kind: 'widthAndHeight',
      width: 300,
      height: 200,
    });
  });

  it('parses the `x` separator `scale 300x200`', () => {
    expect(matchScaleCommand('scale 300x200')).toEqual({
      kind: 'widthAndHeight',
      width: 300,
      height: 200,
    });
  });

  it('tolerates whitespace around the separator `scale 300 * 200`', () => {
    expect(matchScaleCommand('scale 300 * 200')).toEqual({
      kind: 'widthAndHeight',
      width: 300,
      height: 200,
    });
  });
});

describe('matchScaleCommand — CommandScaleWidthOrHeight (ScaleWidth/ScaleHeight)', () => {
  it('parses `scale 200 height` (component/givape-84-xano421)', () => {
    expect(matchScaleCommand('scale 200 height')).toEqual({ kind: 'height', target: 200 });
  });

  it('parses `scale 1000 width` (component/vimulo-11-buni641)', () => {
    expect(matchScaleCommand('scale 1000 width')).toEqual({ kind: 'width', target: 1000 });
  });

  it('is case-insensitive on the width|height keyword `scale 200 HEIGHT`', () => {
    expect(matchScaleCommand('scale 200 HEIGHT')).toEqual({ kind: 'height', target: 200 });
  });
});

describe('matchScaleCommand — CommandScaleMaxWidth / CommandScaleMaxHeight', () => {
  it('parses `scale max 1000 width`', () => {
    expect(matchScaleCommand('scale max 1000 width')).toEqual({ kind: 'maxWidth', target: 1000 });
  });

  it('parses `scale max 300 height`', () => {
    expect(matchScaleCommand('scale max 300 height')).toEqual({
      kind: 'maxHeight',
      target: 300,
    });
  });
});

describe('matchScaleCommand — CommandScaleMaxWidthAndHeight (ScaleMaxWidthAndHeight)', () => {
  it('parses `scale max 300*200`', () => {
    expect(matchScaleCommand('scale max 300*200')).toEqual({
      kind: 'maxWidthAndHeight',
      width: 300,
      height: 200,
    });
  });

  it('parses `scale max 300x200`', () => {
    expect(matchScaleCommand('scale max 300x200')).toEqual({
      kind: 'maxWidthAndHeight',
      width: 300,
      height: 200,
    });
  });
});

describe('matchScaleCommand — non-scale lines', () => {
  it('returns undefined for an ordinary component declaration', () => {
    expect(matchScaleCommand('[foo]')).toBeUndefined();
  });

  it('returns undefined for `scaleFoo` (no word-boundary match on a prefix)', () => {
    expect(matchScaleCommand('scaleFoo 2')).toBeUndefined();
  });

  it('returns undefined for a malformed scale directive `scale abc`', () => {
    expect(matchScaleCommand('scale abc')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveScaleFactor
// ---------------------------------------------------------------------------

describe('resolveScaleFactor — undefined spec', () => {
  it('returns 1 (no scale directive present)', () => {
    expect(resolveScaleFactor(undefined, 100, 100)).toBe(1);
  });
});

describe('resolveScaleFactor — simple (ScaleSimple)', () => {
  it('returns the raw factor unchanged, ignoring dims', () => {
    expect(resolveScaleFactor({ kind: 'simple', factor: 2 }, 92, 169)).toBe(2);
  });

  it('clamps a factor > 4 down to 4 (ScaleProtected — component/berome-43-xini276, `scale 10`)', () => {
    expect(resolveScaleFactor({ kind: 'simple', factor: 10 }, 100, 100)).toBe(4);
  });

  it('clamps a factor <= 0 up to 1', () => {
    expect(resolveScaleFactor({ kind: 'simple', factor: -1 }, 100, 100)).toBe(1);
  });
});

describe('resolveScaleFactor — width / height (ScaleWidth / ScaleHeight)', () => {
  it('width: target / unscaled width', () => {
    expect(resolveScaleFactor({ kind: 'width', target: 200 }, 100, 50)).toBe(2);
  });

  it('height: target / unscaled height', () => {
    expect(resolveScaleFactor({ kind: 'height', target: 200 }, 50, 100)).toBe(2);
  });

  it('width form may enlarge past 1x (unlike the max forms)', () => {
    expect(resolveScaleFactor({ kind: 'width', target: 400 }, 100, 50)).toBe(4);
  });
});

describe('resolveScaleFactor — widthAndHeight (ScaleWidthAndHeight)', () => {
  it('takes the smaller of the two ratios (fit within box)', () => {
    // width ratio 300/100=3, height ratio 200/100=2 -> min = 2
    expect(resolveScaleFactor({ kind: 'widthAndHeight', width: 300, height: 200 }, 100, 100)).toBe(2);
  });
});

describe('resolveScaleFactor — maxWidth / maxHeight (ScaleMaxWidth / ScaleMaxHeight)', () => {
  it('never enlarges: target/width > 1 clamps to 1', () => {
    expect(resolveScaleFactor({ kind: 'maxWidth', target: 400 }, 100, 100)).toBe(1);
  });

  it('shrinks when target/width < 1', () => {
    expect(resolveScaleFactor({ kind: 'maxWidth', target: 50 }, 100, 100)).toBe(0.5);
  });

  it('maxHeight shrinks when target/height < 1', () => {
    expect(resolveScaleFactor({ kind: 'maxHeight', target: 25 }, 100, 100)).toBe(0.25);
  });
});

describe('resolveScaleFactor — maxWidthAndHeight (ScaleMaxWidthAndHeight)', () => {
  it('never enlarges even when both ratios exceed 1', () => {
    expect(
      resolveScaleFactor({ kind: 'maxWidthAndHeight', width: 300, height: 400 }, 100, 100),
    ).toBe(1);
  });

  it('shrinks to the smaller of the two ratios when both are < 1', () => {
    // width ratio 40/100=0.4, height ratio 60/100=0.6 -> min = 0.4
    expect(
      resolveScaleFactor({ kind: 'maxWidthAndHeight', width: 40, height: 60 }, 100, 100),
    ).toBe(0.4);
  });
});
