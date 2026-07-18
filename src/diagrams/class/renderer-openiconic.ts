/**
 * Renders one OpenIconic `<&glyph>` `MemberRenderAtom` (G2 N41) -- split out
 * of `renderer-classifier-box.ts#renderRowAtoms` purely to keep that
 * function's own NLOC under this project's complexity cap and to avoid
 * growing `renderer-classifier-box.ts` (already at this repo's 500-line
 * file cap) any further than necessary; mirrors the existing `renderer-
 * note.ts`/`renderer-arrowhead.ts` split-out-of-renderer.ts precedent.
 */
import type { Theme } from '../../core/theme.js';
import { buildOpenIconicPathD, openIconicOriginY } from '../../core/openiconic-glyphs.js';
import type { MemberRenderAtom } from './class-member-creole.js';

/**
 * `x`/`y` are the atom's own render position, as already tracked by
 * `renderRowAtoms`'s x-advance loop (`x`) and the row's own text BASELINE
 * (`y`) -- `openIconicOriginY` derives the glyph's real top-left from those,
 * `x + 1` for the atom's own flat left margin (`openiconic-glyphs.ts
 * #openIconicDims`'s doc comment). Returns `''` for an atom whose glyph name
 * somehow isn't in the captured table (should not occur -- `class-member-
 * creole.ts#resolveOpenIconicAtom` already filters this before a `'vector'`
 * atom is ever built; defensive only, matches this file's sibling renderers'
 * own "never throw mid-render" convention).
 */
export function renderOpenIconicAtom(
  atom: Extract<MemberRenderAtom, { kind: 'vector' }>,
  x: number,
  y: number,
  theme: Theme,
): string {
  const originY = openIconicOriginY(y, theme.fontSize, atom.factor);
  const d = buildOpenIconicPathD(atom.name, atom.factor, x + 1, originY);
  return d === undefined ? '' : `<path d="${d}" fill="${atom.fill}"/>`;
}
