/**
 * Sizing formulas for composite-state wrapping (mission A4/T4 — the
 * autonom/cluster split, mechanisms.md §1/§3). Split out of ./state-sizing.ts
 * to keep both files under the project's per-file size cap.
 *
 * @see ~/git/plantuml/.../svek/InnerStateAutonom.java (calculateDimensionSlow,
 *      drawU — MARGIN*2+2*MARGIN_LINE+marginForFields delta, title/attr/img
 *      vertical merge)
 * @see ~/git/plantuml/.../svek/ConcurrentStates.java (region image stacking)
 */

import type { State } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import { splitCreoleLines } from './state-sizing.js';

interface Dim {
  width: number;
  height: number;
}

/** IEntityImage.MARGIN / MARGIN_LINE (both 5) — same constants used by the
 *  flat EntityImageState formula (state-sizing.ts's STATE_MARGIN_DELTA). */
const MARGIN = 5;
const MARGIN_LINE = 5;

function measureLines(lines: readonly string[], font: FontSpec, measurer: StringMeasurer): Dim {
  if (lines.length === 0) return { width: 0, height: 0 };
  let width = 0;
  let height = 0;
  for (const line of lines) {
    const m = measurer.measure(line, font);
    if (m.width > width) width = m.width;
    height += m.height;
  }
  return { width, height };
}

/** The vertical offset at which an InnerStateAutonom's wrapped child image is
 *  drawn inside the outer box — needed to shift the child pass's own
 *  (locally-rooted) geometry into the parent's absolute coordinate space.
 *  Mirrors `InnerStateAutonom.getSpaceYforURL` (no URL case: `url==null`
 *  skips the URL gap, matching every state-diagram fixture in the corpus). */
export interface AutonomOffset {
  x: number;
  y: number;
}

export interface AutonomWrapper {
  width: number;
  height: number;
  /** Offset at which the wrapped child pass's own geometry is drawn,
   *  relative to the wrapper box's own top-left corner. */
  childOffset: AutonomOffset;
}

/**
 * InnerStateAutonom.calculateDimensionSlow + getSpaceYforURL: title (state's
 * own display name) stacked above an optional description/body, stacked
 * above the wrapped child pass's own total image dimensions — delta by
 * MARGIN*2+2*MARGIN_LINE(+MARGIN if a body is present), applied to both axes.
 */
export function measureAutonomWrapper(
  state: State,
  childImg: Dim,
  theme: Theme,
  measurer: StringMeasurer,
): AutonomWrapper {
  const font: FontSpec = { family: theme.fontFamily, size: theme.fontSize };
  const text = measureLines(splitCreoleLines(state.display), font, measurer);
  const bodyLines = (state.description ?? []).flatMap(splitCreoleLines);
  const attr = measureLines(bodyLines, font, measurer);
  const marginForFields = attr.height > 0 ? MARGIN : 0;

  const nameHeight = MARGIN + text.height + MARGIN_LINE;
  const descriptionHeight = attr.height + marginForFields;

  const mergedWidth = Math.max(text.width, attr.width, childImg.width);
  const mergedHeight = text.height + attr.height + childImg.height;
  const delta = MARGIN * 2 + 2 * MARGIN_LINE + marginForFields;

  return {
    width: mergedWidth + delta,
    height: mergedHeight + delta,
    childOffset: { x: MARGIN, y: nameHeight + descriptionHeight + MARGIN_LINE },
  };
  // #lizard forgives -- faithful port of InnerStateAutonom's dimension
  // formula; CCN 2, length driven by the doc comment + straight-line math.
}

/** ConcurrentStates: per-region images stacked vertically (TB rankdir) with a
 *  fixed separator gap between consecutive regions — width is the widest
 *  region, height is the sum of region heights plus (n-1) separators. No
 *  exact upstream pixel constant was traced for the separator gap in this
 *  corpus (ConcurrentSeparator draws a dashed rule, not a fixed-height box in
 *  the sources read) — RANK_SEP's own floor (60pt) stands in as a
 *  structurally-reasonable gap; width/height are report-only metrics for the
 *  DOT-parity comparator (not asserted in `structurallyEqual`), so this
 *  approximation does not affect EQUAL classification.
 * @see ~/git/plantuml/.../svek/ConcurrentStates.java
 */
const CONCURRENT_SEPARATOR_GAP = 60;

export function stackConcurrentRegions(regionDims: readonly Dim[]): Dim {
  if (regionDims.length === 0) return { width: 0, height: 0 };
  const width = Math.max(...regionDims.map((d) => d.width));
  const height =
    regionDims.reduce((sum, d) => sum + d.height, 0) +
    CONCURRENT_SEPARATOR_GAP * (regionDims.length - 1);
  return { width, height };
}
