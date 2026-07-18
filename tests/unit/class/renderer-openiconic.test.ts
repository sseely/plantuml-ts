/**
 * Direct unit tests for `renderer-openiconic.ts` (G2 N41) -- tested in
 * isolation per `~/.claude/rules/testability.md` (pure function, preferred
 * over exercising it only indirectly through `renderClass`'s own full
 * pipeline). Expected `<path d>` byte-verified against jar-cached fixtures
 * in `openiconic-glyphs.test.ts` -- this file only checks the render
 * function's own wrapping/dispatch (position formula application, `fill`
 * attr, unknown-glyph fallback), not re-deriving glyph geometry.
 */
import { describe, it, expect } from 'vitest';
import { renderOpenIconicAtom } from '../../../src/diagrams/class/renderer-openiconic.js';
import { defaultTheme } from '../../../src/core/theme.js';
import type { MemberRenderAtom } from '../../../src/diagrams/class/class-member-creole.js';

describe('renderOpenIconicAtom', () => {
  it('renders a <path> with the resolved fill color at the icon origin', () => {
    const theme = { ...defaultTheme, fontSize: 14 };
    const atom: Extract<MemberRenderAtom, { kind: 'vector' }> = {
      kind: 'vector',
      name: 'key',
      factor: 1,
      fill: '#123456',
      width: 10,
      height: 8,
    };
    const out = renderOpenIconicAtom(atom, 13, 45.8889, theme);
    expect(out.startsWith('<path d="')).toBe(true);
    expect(out).toContain('fill="#123456"');
    // originX = x + 1 (flat left margin); the glyph's own M point (5.5,0 for
    // 'key') scales by factor=1 and translates by (originX, originY) --
    // matches `openiconic-glyphs.test.ts`'s own byte-exact 'key' expectation
    // shifted by this call's specific origin.
    expect(out).toContain('M19.5,38');
  });

  it('returns an empty string for an unrecognized glyph name (defensive -- should not occur in practice)', () => {
    const theme = { ...defaultTheme, fontSize: 14 };
    const atom: Extract<MemberRenderAtom, { kind: 'vector' }> = {
      kind: 'vector',
      name: 'pencil',
      factor: 1,
      fill: '#000000',
      width: 10,
      height: 8,
    };
    expect(renderOpenIconicAtom(atom, 13, 45.8889, theme)).toBe('');
  });
});
