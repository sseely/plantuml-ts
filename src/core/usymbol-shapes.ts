/**
 * Shared per-USymbol leaf-shape renderers — the SVG for a descriptive element's
 * icon (component notch, database cylinder, actor stick-figure, usecase ellipse).
 * Pure geometry: a shape is a function of its box ({@link IconGeo}) + theme, so
 * every cuca engine (description, class, …) draws the same icon.
 *
 * Ported from the description engine's renderer-helpers (in turn from
 * component/renderer.ts + usecase/renderer.ts). Extracted here so the class
 * engine's descriptive elements render the same shapes.
 */
import type { Theme } from './theme.js';
import { rect, text, ellipse, line } from './svg.js';
import { renderNodeLabel } from './latex.js';

/** The minimal node geometry a USymbol shape needs. */
export interface IconGeo {
  x: number;
  y: number;
  width: number;
  height: number;
  display: string;
}

/** Component-box icon tab dimensions (component/renderer.ts). */
const COMP_ICON_W = 8;
const COMP_ICON_H = 5;
const COMP_ICON_MARGIN_R = 8;
const COMP_ICON_TOP_OFFSET_Y = 6;
const COMP_ICON_GAP = 2;

/** Database cylinder: floor for the ellipse cap ry and height-scale ratio. */
const DB_RY_MIN = 8;
const DB_RY_RATIO = 0.18;

/** Actor head radius (usecase/renderer.ts). */
const ACTOR_HEAD_R = 8;

/** USymbol: component → box with a two-tab notch icon on the right edge. */
export function renderComponentIcon(node: IconGeo, theme: Theme): string {
  const bg = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.graph.classBackground, stroke: theme.colors.border, strokeWidth: 1,
  });
  const iconX = node.x + node.width - COMP_ICON_W - COMP_ICON_MARGIN_R;
  const iconTopY = node.y + COMP_ICON_TOP_OFFSET_Y;
  const iconStyle = { fill: theme.colors.background, stroke: theme.colors.border, strokeWidth: 1 };
  const iconTop = rect(iconX, iconTopY, COMP_ICON_W, COMP_ICON_H, iconStyle);
  const iconBot = rect(iconX, iconTopY + COMP_ICON_H + COMP_ICON_GAP, COMP_ICON_W, COMP_ICON_H, iconStyle);
  const labelEl = text(node.x + node.width / 2, node.y + node.height / 2 + theme.fontSize / 2, node.display, {
    fontFamily: theme.fontFamily, fontSize: theme.fontSize, fill: theme.colors.text, textAnchor: 'middle',
  });
  return bg + iconTop + iconBot + labelEl;
}

/** Geometry bundle for the database cylinder body (avoids an 8-param function). */
interface DbCylGeo {
  x: number;
  width: number;
  topY: number;
  botY: number;
  rx: number;
  ry: number;
}

/** Cylinder side-lines + bottom arc SVG. */
function dbCylinderBody(geo: DbCylGeo, fill: string, stroke: string): string {
  const { x, width, topY, botY, rx, ry } = geo;
  const left = `<line x1="${x}" y1="${topY}" x2="${x}" y2="${botY}" stroke="${stroke}" stroke-width="1"/>`;
  const right = `<line x1="${x + width}" y1="${topY}" x2="${x + width}" y2="${botY}" stroke="${stroke}" stroke-width="1"/>`;
  const arc = `<path d="M ${x},${botY} A ${rx},${ry} 0 0,1 ${x + width},${botY}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  return left + right + arc;
}

/** USymbol: database → cylinder (body rect + side lines + bottom arc + top ellipse). */
export function renderDatabaseIcon(node: IconGeo, theme: Theme): string {
  const rx = node.width / 2;
  const ry = Math.max(DB_RY_MIN, Math.round(node.height * DB_RY_RATIO));
  const cx = node.x + rx;
  const topY = node.y + ry;
  const bodyH = node.height - ry * 2;
  const bg = theme.colors.graph.classBackground;
  const stroke = theme.colors.border;
  const cylGeo: DbCylGeo = { x: node.x, width: node.width, topY, botY: topY + bodyH, rx, ry };
  const body = rect(node.x, topY, node.width, bodyH, { fill: bg, stroke: 'none' });
  const cyl = dbCylinderBody(cylGeo, bg, stroke);
  const topEl = ellipse(cx, topY, rx, ry, { fill: bg, stroke, 'stroke-width': 1 });
  const labelEl = text(cx, topY + bodyH / 2 + theme.fontSize / 3, node.display, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
    textAnchor: 'middle',
  });
  return body + cyl + topEl + labelEl;
}

/** USymbol: actor → stick-figure with a label below. */
export function renderActorIcon(node: IconGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y;
  const stroke = theme.colors.graph.actorStroke;
  const head =
    `<circle cx="${cx}" cy="${cy + ACTOR_HEAD_R}" r="${ACTOR_HEAD_R}"` +
    ` stroke="${stroke}" fill="${theme.colors.graph.actorFill}"/>`;
  const body = line(cx, cy + 16, cx, cy + 40, { stroke });
  const arms = line(cx - 14, cy + 28, cx + 14, cy + 28, { stroke });
  const leftLeg = line(cx, cy + 40, cx - 12, cy + 58, { stroke });
  const rightLeg = line(cx, cy + 40, cx + 12, cy + 58, { stroke });
  return (
    head + body + arms + leftLeg + rightLeg +
    renderNodeLabel(node.display, cx, cy + 70, theme)
  );
}

/** USymbol: usecase → horizontal ellipse with a centered label. */
export function renderUseCaseIcon(node: IconGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const oval = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: theme.colors.graph.usecaseFill,
    stroke: theme.colors.border,
  });
  return oval + renderNodeLabel(node.display, cx, cy + theme.fontSize / 3, theme);
}

type IconRenderer = (node: IconGeo, theme: Theme) => string;

/** USymbol keyword → leaf-icon renderer (only the shapes with a distinct icon). */
const USYMBOL_ICONS = new Map<string, IconRenderer>([
  ['database', renderDatabaseIcon],
  ['component', renderComponentIcon],
  ['actor', renderActorIcon],
  ['usecase', renderUseCaseIcon],
]);

/**
 * Render a descriptive element's icon for the given USymbol keyword, or
 * `undefined` when there is no distinct icon (the caller draws a plain rect).
 */
export function renderUSymbolIcon(
  usymbol: string,
  node: IconGeo,
  theme: Theme,
): string | undefined {
  return USYMBOL_ICONS.get(usymbol.toLowerCase())?.(node, theme);
}
