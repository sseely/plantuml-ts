/**
 * Unit tests for `shiftFragmentBody` (src/core/annotations/coord-shift.ts)
 * — mission G1d. Pins the coordinate-attribute vocabulary this module
 * shifts (x/y/cx/cy/x1/y1/x2/y2/points/d/transform) and the ones it
 * deliberately leaves untouched (width/height/rx/ry/r/dx/dy).
 */
import { describe, it, expect } from 'vitest';
import { shiftFragmentBody } from '../../src/core/annotations/coord-shift.js';

describe('shiftFragmentBody — fast path', () => {
  it('returns the body unchanged (byte-identical) when dx=0 and dy=0', () => {
    const body = '<rect x="1" y="2" width="10" height="5"/>';
    expect(shiftFragmentBody(body, 0, 0)).toBe(body);
  });
});

describe('shiftFragmentBody — simple position attributes', () => {
  it('shifts x/y on a rect, leaves width/height untouched', () => {
    const body = '<rect x="1" y="2" width="10" height="5"/>';
    expect(shiftFragmentBody(body, 100, 10)).toBe('<rect x="101" y="12" width="10" height="5"/>');
  });

  it('shifts cx/cy on an ellipse, leaves rx/ry untouched', () => {
    const body = '<ellipse cx="5" cy="5" rx="8" ry="8"/>';
    expect(shiftFragmentBody(body, 3, -2)).toBe('<ellipse cx="8" cy="3" rx="8" ry="8"/>');
  });

  it('shifts x1/y1/x2/y2 on a line', () => {
    const body = '<line x1="0" y1="0" x2="10" y2="20"/>';
    expect(shiftFragmentBody(body, 5, 5)).toBe('<line x1="5" y1="5" x2="15" y2="25"/>');
  });

  it('does NOT shift dx/dy (relative nudges) or r (radius, a dimension)', () => {
    const body = '<text x="1" y="2" dx="1" dy="1"><circleref r="4"/></text>';
    expect(shiftFragmentBody(body, 10, 10)).toBe(
      '<text x="11" y="12" dx="1" dy="1"><circleref r="4"/></text>',
    );
  });

  it('does not confuse x1/cx/rx with the bare x/y attribute (word-boundary safety)', () => {
    const body = '<rect x="1" rx="2"/><line x1="3" y1="4" x2="5" y2="6"/>';
    expect(shiftFragmentBody(body, 100, 0)).toBe(
      '<rect x="101" rx="2"/><line x1="103" y1="4" x2="105" y2="6"/>',
    );
  });
});

describe('shiftFragmentBody — points (polygon/polyline)', () => {
  it('shifts a space-separated pairs points list (core/svg.ts#polygon convention)', () => {
    const body = '<polygon points="1,2 3,4 5,6"/>';
    expect(shiftFragmentBody(body, 10, 100)).toBe('<polygon points="11,102 13,104 15,106"/>');
  });

  it('shifts an all-comma points list (klimt arrowhead convention, matches jar)', () => {
    const body = '<polygon points="1,2,3,4,5,6"/>';
    expect(shiftFragmentBody(body, 10, 100)).toBe('<polygon points="11,102,13,104,15,106"/>');
  });
});

describe('shiftFragmentBody — path d attribute', () => {
  it('shifts M/L (one x,y pair each)', () => {
    const body = '<path d="M1,2 L3,4"/>';
    expect(shiftFragmentBody(body, 10, 100)).toBe('<path d="M11,102 L13,104"/>');
  });

  it('shifts C (three x,y pairs — two control points + endpoint)', () => {
    const body = '<path d="M0,0 C1,2 3,4 5,6"/>';
    expect(shiftFragmentBody(body, 10, 100)).toBe('<path d="M10,100 C11,102 13,104 15,106"/>');
  });

  it('shifts Q (control point + endpoint)', () => {
    const body = '<path d="M0,0 Q1,2 3,4"/>';
    expect(shiftFragmentBody(body, 10, 100)).toBe('<path d="M10,100 Q11,102 13,104"/>');
  });

  it('shifts only the endpoint pair of A, leaving rx/ry/rotation/flags untouched', () => {
    const body = '<path d="M0,0 A25,25 0 0,1 30,40"/>';
    expect(shiftFragmentBody(body, 10, 100)).toBe('<path d="M10,100 A25,25 0 0,1 40,140"/>');
  });

  it('leaves a Z (close, no args) segment untouched', () => {
    const body = '<path d="M0,0 L1,1 Z"/>';
    expect(shiftFragmentBody(body, 10, 10)).toBe('<path d="M10,10 L11,11 Z"/>');
  });
});

describe('shiftFragmentBody — transform composition', () => {
  it('composes into an existing translate(a,b)', () => {
    const body = '<g transform="translate(5,10)">X</g>';
    expect(shiftFragmentBody(body, 1, 2)).toBe('<g transform="translate(6,12)">X</g>');
  });

  it('shifts the pivot of rotate(deg,cx,cy), leaving the angle untouched', () => {
    const body = '<text transform="rotate(-90,5,5)" x="5" y="5">X</text>';
    expect(shiftFragmentBody(body, 10, 20)).toBe(
      '<text transform="rotate(-90,15,25)" x="15" y="25">X</text>',
    );
  });
});

describe('shiftFragmentBody — negative and fractional shift amounts', () => {
  it('applies a negative dx/dy', () => {
    const body = '<rect x="10" y="10" width="1" height="1"/>';
    expect(shiftFragmentBody(body, -5, -3)).toBe('<rect x="5" y="7" width="1" height="1"/>');
  });

  it('applies a fractional shift, matching jarMeasurer-scale precision', () => {
    const body = '<rect x="10" y="10" width="1" height="1"/>';
    expect(shiftFragmentBody(body, 37.48826666666667, 0)).toBe(
      '<rect x="47.48826666666667" y="10" width="1" height="1"/>',
    );
  });
});
