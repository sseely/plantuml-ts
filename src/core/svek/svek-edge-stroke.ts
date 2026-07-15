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
 * -> thickness 1 (no dash). G1 I-linkstyle: the `thicknessOverride`
 * param (bracket `thickness=N`, `WithLinkType.goThickness`,
 * `decoration/WithLinkType.java:159-160`) is now wired -- when present,
 * DASHED/DOTTED/NORMAL use it as their thickness (`LinkStyle
 * .nonZeroThickness()`, java:118-123), but BOLD ignores it entirely and
 * always draws at a hardcoded thickness 2 (`LinkStyle.getStroke3()`,
 * java:105-107) -- a genuine upstream quirk (`-[bold,thickness=8]->`
 * still renders at width 2), preserved faithfully rather than "fixed".
 * `LinkType.getStroke3(UStroke defaultThickness)`'s own
 * suggested-stroke/Style-system fallback path (java:245-256) is not
 * ported: this port has no `getDefaultStyleDefinition`/Style-based arrow
 * stroke, so the no-override case always reduces to exactly the
 * per-category defaults below (Java's own `defaultThickness == null`
 * branch).
 */
const STROKE_BY_STYLE: Record<SvekLinkStyle, UStroke> = {
  dashed: new UStroke(7, 7, 1),
  dotted: new UStroke(1, 3, 1),
  bold: UStroke.withThickness(2),
  solid: UStroke.withThickness(1),
};

export function strokeForStyle(style: SvekLinkStyle, thicknessOverride?: number): UStroke {
  if (thicknessOverride === undefined) return STROKE_BY_STYLE[style];
  switch (style) {
    case 'dashed':
      return new UStroke(7, 7, thicknessOverride);
    case 'dotted':
      return new UStroke(1, 3, thicknessOverride);
    case 'bold':
      // LinkStyle.getStroke3() (java:105-107): BOLD hardcodes thickness 2
      // regardless of any thickness override.
      return UStroke.withThickness(2);
    case 'solid':
      return UStroke.withThickness(thicknessOverride);
  }
}
