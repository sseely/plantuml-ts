import { describe, it, expect } from 'vitest';
import {
  applyMonochromeHex,
  applyMonochromeToFragment,
} from '../../../src/diagrams/class/class-monochrome.js';

// G2 N61: `skinparam monochrome true|reverse` -- jar's `ColorMapper.MONOCHROME`/
// `MONOCHROME_REVERSE` (`ColorUtils.java#getGrayScaleColor`/
// `getGrayScaleColorReverse`, `klimt/color/ColorUtils.java`), YIQ-weighted
// grayscale: `floor((R*299 + G*587 + B*114) / 1000)`, reverse = `255 - gray`.
// Jar-verified against `pofabe-33-kizo628`'s own golden badge ellipse:
// `#ADD1B2` (173,209,178) -> `#C2C2C2` (194,194,194):
// floor((173*299 + 209*587 + 178*114) / 1000)
//   = floor((51727 + 122683 + 20292) / 1000) = floor(194702 / 1000) = 194 = 0xC2.

describe('applyMonochromeHex', () => {
  it('converts a 6-digit hex to jar-verified YIQ grayscale (monochrome true)', () => {
    expect(applyMonochromeHex('#ADD1B2', 'true')).toBe('#C2C2C2');
  });

  it('converts a 6-digit hex to reverse grayscale (255 - gray)', () => {
    // gray=194 -> reverse = 255-194 = 61 = 0x3D
    expect(applyMonochromeHex('#ADD1B2', 'reverse')).toBe('#3D3D3D');
  });

  it('is a no-op for an already-gray color (R=G=B)', () => {
    expect(applyMonochromeHex('#181818', 'true')).toBe('#181818');
  });

  it('preserves the alpha suffix on an 8-digit hex, unchanged', () => {
    expect(applyMonochromeHex('#ADD1B280', 'true')).toBe('#C2C2C280');
  });

  it('leaves fully-transparent #00000000 unchanged in both modes (no-paint bypass)', () => {
    expect(applyMonochromeHex('#00000000', 'true')).toBe('#00000000');
    expect(applyMonochromeHex('#00000000', 'reverse')).toBe('#00000000');
  });

  it('passes through a non-hex-shaped string unchanged', () => {
    expect(applyMonochromeHex('none', 'true')).toBe('none');
  });
});

describe('applyMonochromeToFragment', () => {
  it('returns the fragment unchanged when mode is undefined', () => {
    const svg = '<ellipse fill="#ADD1B2" style="stroke:#181818;stroke-width:1;"/>';
    expect(applyMonochromeToFragment(svg, undefined)).toBe(svg);
  });

  it('rewrites a bare fill="#RRGGBB" attribute', () => {
    const svg = '<ellipse fill="#ADD1B2"/>';
    expect(applyMonochromeToFragment(svg, 'true')).toBe('<ellipse fill="#C2C2C2"/>');
  });

  it('rewrites fill/stroke inside a style="..." attribute', () => {
    const svg = '<ellipse fill="#ADD1B2" style="stroke:#181818;stroke-width:1;"/>';
    expect(applyMonochromeToFragment(svg, 'true')).toBe(
      '<ellipse fill="#C2C2C2" style="stroke:#181818;stroke-width:1;"/>',
    );
  });

  it('rewrites a stop-color: declaration with a following space', () => {
    const svg = '<stop stop-color: #ADD1B2 />';
    expect(applyMonochromeToFragment(svg, 'true')).toBe('<stop stop-color: #C2C2C2 />');
  });

  it('rewrites a CSS-style "stroke: #RRGGBB" with a space after the colon', () => {
    const svg = 'path:hover { stroke: #ADD1B2 !important;}';
    expect(applyMonochromeToFragment(svg, 'true')).toBe(
      'path:hover { stroke: #C2C2C2 !important;}',
    );
  });

  it('does not touch a "fill: none" or unrelated hex-free markup', () => {
    const svg = '<rect fill="none" id="ent0001"/>';
    expect(applyMonochromeToFragment(svg, 'true')).toBe(svg);
  });
});
