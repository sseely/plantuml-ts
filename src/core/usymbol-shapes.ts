/**
 * Shared per-USymbol leaf-shape renderers — the SVG for a descriptive element's
 * icon (component notch, database cylinder, actor stick-figure, usecase ellipse).
 * Pure geometry: a shape is a function of its box ({@link IconGeo}) + theme, so
 * every cuca engine (description, class, …) draws the same icon.
 *
 * The four shapes below are faithful ports of upstream's exact geometry
 * (decisions.md#D5 "USymbol geometry"): USymbolDatabase.java, USymbolComponent2
 * .java, ActorStickMan.java, USymbolUsecase/TextBlockInEllipse.java. Each
 * resolves its own color via {@link resolveElementPaint} for its SName (D4) —
 * no shape reads a hard-coded class-bucket field — and draws through the
 * Paint-aware svg primitives so gradient fills (e.g. a database gradient) work.
 */
import type { Theme } from './theme.js';
import { resolveElementPaint } from './theme.js';
import type { Paint } from './paint.js';
import { paintToSvg } from './paint.js';
import { rect, text, ellipse, line, path } from './svg.js';
import { renderNodeLabel } from './latex.js';

/** The minimal node geometry a USymbol shape needs. */
export interface IconGeo {
  x: number;
  y: number;
  width: number;
  height: number;
  display: string;
}

/**
 * A `<path>` filled with a {@link Paint} (svg.ts `path` is stroke-only,
 * `fill="none"`). Resolves the fill/stroke paints, prepending any gradient
 * `<linearGradient>` defs (deduped later by svgRoot).
 */
function filledPath(d: string, fill: Paint, stroke: Paint): string {
  const f = paintToSvg(fill);
  const s = paintToSvg(stroke);
  return (
    `${f.def ?? ''}${s.def ?? ''}` +
    `<path d="${d}" fill="${f.fill}" stroke="${s.fill}" stroke-width="1"/>`
  );
}

/** Database cylinder body outline (cubic caps, fixed 10px depth). */
function databaseBodyPath(x: number, y: number, w: number, h: number): string {
  return (
    `M ${x},${y + 10} ` +
    `C ${x},${y} ${x + w / 2},${y} ${x + w / 2},${y} ` +
    `C ${x + w / 2},${y} ${x + w},${y} ${x + w},${y + 10} ` +
    `L ${x + w},${y + h - 10} ` +
    `C ${x + w},${y + h} ${x + w / 2},${y + h} ${x + w / 2},${y + h} ` +
    `C ${x + w / 2},${y + h} ${x},${y + h} ${x},${y + h - 10} ` +
    `L ${x},${y + 10} Z`
  );
}

/** Database front-mouth arc (lip at y=20). */
function databaseMouthPath(x: number, y: number, w: number): string {
  return (
    `M ${x},${y + 10} ` +
    `C ${x},${y + 20} ${x + w / 2},${y + 20} ${x + w / 2},${y + 20} ` +
    `C ${x + w / 2},${y + 20} ${x + w},${y + 20} ${x + w},${y + 10}`
  );
}

/**
 * USymbol: database → cylinder. Faithful port of USymbolDatabase.java:61-87 —
 * one path with cubic caps of fixed 10px depth (independent of height), plus a
 * front-mouth arc whose lip sits at y=20.
 */
export function renderDatabaseIcon(node: IconGeo, theme: Theme): string {
  const { x, y, width: w, height: h, display } = node;
  const bg = resolveElementPaint(theme, 'database', 'background');
  const stroke = resolveElementPaint(theme, 'database', 'border');
  const body = filledPath(databaseBodyPath(x, y, w, h), bg, stroke);
  // Front lip: stroked only (upstream fills the closing path with none).
  const mouth = path(databaseMouthPath(x, y, w), { stroke, strokeWidth: 1 });
  const labelEl = text(x + w / 2, y + (h + 20) / 2 + theme.fontSize / 3, display, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: resolveElementPaint(theme, 'database', 'font'),
    textAnchor: 'middle',
  });
  return body + mouth + labelEl;
}

/**
 * USymbol: component → UML2 box with a two-tab notch. Faithful port of
 * USymbolComponent2.java:59-75 — body rect plus an outer tab (15×10 at
 * (w-20,5)) and two inner ticks (4×2 at (w-22,7) and (w-22,11)).
 */
export function renderComponentIcon(node: IconGeo, theme: Theme): string {
  const { x, y, width: w, height: h, display } = node;
  const bg = resolveElementPaint(theme, 'component', 'background');
  const stroke = resolveElementPaint(theme, 'component', 'border');
  const box = { fill: bg, stroke, strokeWidth: 1 };
  const body = rect(x, y, w, h, box);
  const outerTab = rect(x + w - 20, y + 5, 15, 10, box);
  const tick1 = rect(x + w - 22, y + 7, 4, 2, box);
  const tick2 = rect(x + w - 22, y + 11, 4, 2, box);
  const labelEl = text(
    x + w / 2,
    y + h / 2 + theme.fontSize / 2,
    display,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: resolveElementPaint(theme, 'component', 'font'),
      textAnchor: 'middle',
    },
  );
  return body + outerTab + tick1 + tick2 + labelEl;
}

/**
 * USymbol: actor → stick figure. Faithful port of ActorStickMan.java:51-96 —
 * head Ø16 (centre y=8); body translated to (cx, 16): spine (0,0)→(0,27),
 * arms (-13,8)→(13,8), legs (0,27)→(∓13,42).
 */
export function renderActorIcon(node: IconGeo, theme: Theme): string {
  const { x, y, width: w, display } = node;
  const cx = x + w / 2;
  const stroke = resolveElementPaint(theme, 'actor', 'border');
  const headFill = resolveElementPaint(theme, 'actor', 'background');
  const head = ellipse(cx, y + 8, 8, 8, {
    fill: headFill,
    stroke,
    'stroke-width': 1,
  });
  // Body translated to (cx, y+16): spine, arms, legs at the cited offsets.
  const bodyTop = y + 16;
  const spine = line(cx, bodyTop, cx, bodyTop + 27, { stroke });
  const arms = line(cx - 13, bodyTop + 8, cx + 13, bodyTop + 8, { stroke });
  const leftLeg = line(cx, bodyTop + 27, cx - 13, bodyTop + 42, { stroke });
  const rightLeg = line(cx, bodyTop + 27, cx + 13, bodyTop + 42, { stroke });
  return (
    head +
    spine +
    arms +
    leftLeg +
    rightLeg +
    renderNodeLabel(display, cx, bodyTop + 42 + theme.fontSize, theme)
  );
}

/**
 * USymbol: usecase → horizontal ellipse (sized to the node box, which layout
 * sized to the text footprint `.bigger(6)`) with a centred label
 * (TextBlockInEllipse dy-2).
 */
export function renderUseCaseIcon(node: IconGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const oval = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: resolveElementPaint(theme, 'usecase', 'background'),
    stroke: resolveElementPaint(theme, 'usecase', 'border'),
  });
  return oval + renderNodeLabel(node.display, cx, cy - 2 + theme.fontSize / 3, theme);
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
