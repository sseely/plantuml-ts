/**
 * renderer-body-enhanced.ts — draws a classifier's `EnhancedBodyGeo`
 * (`class-body-enhanced-layout.ts`) primitives in EXACT jar draw order —
 * NOT the classic path's Y-sort merge (`renderer-classifier-box.ts
 * #buildBodyPrimitives`'s own doc comment): a titled divider draws its
 * CONTENT first, then the divider+label (`TextBlockLineBefore#drawU`'s
 * title!=null branch), the OPPOSITE order a plain Y-sort would produce
 * (divider.y sorts before its own content's higher y) — see `class-body-
 * enhanced-layout.ts`'s own module doc comment for the full derivation.
 *
 * G2 N42 (mission priority 1). Tree-connector geometry (bullet/hline/vline)
 * mirrors `Skeleton2#draw`'s exact draw order (hline THEN vline, per cell,
 * in cell order) — every stroke is the hardcoded `#000000` this file's
 * sibling `renderRowText` already uses as its own text-color default (the
 * SAME `FontConfiguration.getColor()` -- upstream's `AtomTree` ctor takes
 * the row's own font color as `lineColor`; every target fixture uses the
 * theme default, so the wider per-row-font-color threading is a named,
 * unverified remainder, not attempted this iteration). Bullet fill is the
 * classifier's OWN ambient background (`classifierFill`, mirroring `class-
 * visibility-icon.ts#renderVisibilityUrlBackground`'s identical "ambient
 * fill, explicit stroke" precedent, G2 N40).
 *
 * @see ~/git/plantuml/.../klimt/creole/atom/AtomTree.java#drawU
 * @see ~/git/plantuml/.../salt/element/Skeleton2.java#draw
 */
import type { ClassifierGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import { rect, line } from '../../core/svg.js';
import { text as svgText } from '../../core/svg.js';
import { renderRowText } from './renderer-classifier-box.js';
import { javaRound4 } from '../../core/number-format.js';
import type { EnhancedBodyGeo, EnhancedBodyPart } from './class-body-enhanced-layout.js';

/** The classifier box's OWN divider stroke color (`class-border`'s own
 *  ancestor cascade) — a plain `<line>`, matching `dividerYs`' identical
 *  existing convention (`renderer-classifier-box.ts#buildBodyPrimitives`). */
function renderDividerPart(
  geo: ClassifierGeo,
  part: Extract<EnhancedBodyPart, { kind: 'divider' }>,
  theme: Theme,
  borderColor: string,
): string {
  const y = geo.y + part.y;
  if (part.title === undefined) {
    return line(geo.x + 1, y, geo.x + geo.width - 1, y, { stroke: borderColor, strokeWidth: part.strokeWidth });
  }
  const fullStart = geo.x + 1;
  const fullEnd = geo.x + geo.width - 1;
  const gap = (fullEnd - fullStart - part.title.width) / 2;
  const labelStart = fullStart + gap;
  const labelEnd = fullEnd - gap;
  return (
    line(fullStart, y, labelStart, y, { stroke: borderColor, strokeWidth: part.strokeWidth }) +
    svgText(labelStart, geo.y + part.title.y, part.title.text, {
      fontFamily: theme.fontFamily, fontSize: theme.fontSize, fill: '#000000',
      lengthAdjust: 'spacing', textLength: javaRound4(part.title.width),
    }) +
    line(labelEnd, y, fullEnd, y, { stroke: borderColor, strokeWidth: part.strokeWidth })
  );
}

function renderRowsPart(geo: ClassifierGeo, part: Extract<EnhancedBodyPart, { kind: 'rows' }>, theme: Theme): string {
  let out = '';
  for (const row of part.rows) out += renderRowText(geo, row, theme);
  return out;
}

/** `Skeleton2#draw`'s per-entry draw: `drawHline` (a 2x2 bullet `<rect>` +
 *  an 8px `<line>`) THEN `drawVline` (a `<line>` up to the mother/sister
 *  entry). */
function renderTreeConnector(
  geo: ClassifierGeo,
  c: Extract<EnhancedBodyPart, { kind: 'tree' }>['connectors'][number],
  fill: string,
): string {
  return (
    rect(geo.x + c.bulletX, geo.y + c.bulletY, 2, 2, { fill, stroke: '#000000', strokeWidth: 1 }) +
    line(geo.x + c.hx1, geo.y + c.hy, geo.x + c.hx2, geo.y + c.hy, { stroke: '#000000', strokeWidth: 1 }) +
    line(geo.x + c.vx, geo.y + c.vy1, geo.x + c.vx, geo.y + c.vy2, { stroke: '#000000', strokeWidth: 1 })
  );
}

function renderTreePart(
  geo: ClassifierGeo,
  part: Extract<EnhancedBodyPart, { kind: 'tree' }>,
  theme: Theme,
  fill: string,
): string {
  let out = '';
  for (const row of part.rows) out += renderRowText(geo, row, theme);
  for (const c of part.connectors) out += renderTreeConnector(geo, c, fill);
  return out;
}

/**
 * Draws every part of an enhanced body IN ORDER (never Y-sorted — see this
 * file's own module doc comment). `classifierFill`/`classBorder` are
 * threaded in by the caller (`renderer-classifier-box.ts`, which already
 * resolves both for the box rect) rather than re-resolved here, avoiding a
 * second style-cascade lookup for the same classifier.
 */
export function renderEnhancedBody(
  geo: ClassifierGeo,
  body: EnhancedBodyGeo,
  theme: Theme,
  fill: string,
  borderColor: string,
): string {
  let out = '';
  for (const part of body.parts) {
    if (part.kind === 'divider') out += renderDividerPart(geo, part, theme, borderColor);
    else if (part.kind === 'rows') out += renderRowsPart(geo, part, theme);
    else out += renderTreePart(geo, part, theme, fill);
  }
  return out;
}
