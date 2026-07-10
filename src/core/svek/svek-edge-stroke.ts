import { UStroke } from '../klimt/UStroke.js';
import type { SvekLinkStyle } from './SvekEdge.js';

/**
 * svek-edge-stroke.ts — `LinkStyle#getStroke3()`
 * (decoration/LinkStyle.java), the dash/thickness formula per link
 * style. Split out of `SvekEdge.ts` to keep that file under this
 * project's 500-line cap (reported split).
 *
 * Ported exactly: `DASHED` -> dash(7,7) thickness 1, `DOTTED` -> dash
 * (1,3) thickness 1, `BOLD` -> thickness 2 (no dash), else (`NORMAL`)
 * -> thickness 1 (no dash). Upstream's `thickness` override
 * (`goThickness`/`isThicknessOverrided`, fed by a `thickness=N` bracket
 * token) is NOT ported — `SvekEdgeInput.style` carries no thickness
 * override field (see `SvekEdge.ts`'s cut-line report); every stroke
 * below uses the un-overridden default thickness upstream's own
 * `nonZeroThickness()` falls back to.
 */
const STROKE_BY_STYLE: Record<SvekLinkStyle, UStroke> = {
  dashed: new UStroke(7, 7, 1),
  dotted: new UStroke(1, 3, 1),
  bold: UStroke.withThickness(2),
  solid: UStroke.withThickness(1),
};

export function strokeForStyle(style: SvekLinkStyle): UStroke {
  return STROKE_BY_STYLE[style];
}
