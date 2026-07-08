/**
 * Node-shape renderers for the unified description diagram renderer.
 *
 * Extracted from renderer.ts to stay within the 500-line complexity limit.
 * Contains all per-USymbol node renderers plus the top-level renderNode
 * dispatcher (which recurses through renderContainerNode for children).
 *
 * Ported from:
 *   src/diagrams/component/renderer.ts — component box, lollipop, cylinder
 *   src/diagrams/usecase/renderer.ts  — ellipse, stick-actors, container rect
 */

import type { DescriptionNodeGeo } from './layout-helpers.js';
import type { Theme } from '../../core/theme.js';
import type { USymbol } from '../../core/descriptive-keywords.js';
import { rect, text, ellipse, line, noteBox } from '../../core/svg.js';
import { renderNodeLabel } from '../../core/latex.js';
import {
  renderComponentIcon,
  renderDatabaseIcon,
  renderActorIcon,
  renderUseCaseIcon,
} from '../../core/usymbol-shapes.js';
import { CONTAINER_SYMBOLS } from './parse-helpers.js';

// ---------------------------------------------------------------------------
// Constants — mirror source renderers; no magic literals
// ---------------------------------------------------------------------------

/**
 * Symbols whose PlantUML convention is a dashed container border.
 * Preserved verbatim from usecase/renderer.ts:268 DASHED_CONTAINER_KINDS.
 */
export const DASHED_CONTAINER_SYMBOLS: ReadonlySet<USymbol> = new Set<USymbol>([
  'package',
  'folder',
]);

/** Actor head radius (usecase/renderer.ts). */
const ACTOR_HEAD_R = 8;

/** EntityImageNote body line spacing — matches layout-helpers'
 *  NOTE_LINE_HEIGHT_FACTOR so measured height and rendered text agree. */
const NOTE_LINE_HEIGHT_FACTOR = 1.4;

/** Business-actor diagonal angle constants — ActorStickMan.java specialBusiness(). */
const BUSINESS_ALPHA_NUM = 21;
const BUSINESS_ALPHA_DEN = 64;

/** Business use-case rotation (π/4) and theta-1 (20°) constants. */
const BUSINESS_UC_BETA = Math.PI / 4;
const BUSINESS_UC_THETA1_DEG = 20.0;

// ---------------------------------------------------------------------------
// Container classification
// ---------------------------------------------------------------------------

/**
 * A node renders as a container only when its symbol is a container kind AND
 * it has at least one child. Uses CONTAINER_SYMBOLS from parse-helpers
 * (never redefined here per .claude/CLAUDE.md architecture note).
 */
export function isRenderedAsContainer(node: DescriptionNodeGeo): boolean {
  return CONTAINER_SYMBOLS.has(node.symbol) && node.children.length > 0;
}

// ---------------------------------------------------------------------------
// Business use-case diagonal helpers (ported from usecase/renderer.ts)
// ---------------------------------------------------------------------------

/** RotatedEllipse.getPoint(theta) — faithful port of upstream Java. */
function rotatedEllipsePoint(
  a: number, b: number, beta: number, theta: number,
): { x: number; y: number } {
  const x = a * Math.cos(theta);
  const y = b * Math.sin(theta);
  return { x: x * Math.cos(beta) - y * Math.sin(beta), y: x * Math.sin(beta) + y * Math.cos(beta) };
}

/** RotatedEllipse.getOtherTheta(theta1) — faithful port of upstream Java. */
function getOtherTheta(a: number, b: number, beta: number, theta1: number): number {
  const z = rotatedEllipsePoint(a, b, beta, theta1).x;
  const other = (2 * a * z) / (a * a + b * b) - Math.cos(theta1);
  return -Math.acos(Math.max(-1, Math.min(1, other)));
}

/** UEllipse.getPointAtAngle(alpha) — faithful port of upstream Java. */
function ellipsePointAtAngle(w: number, h: number, alpha: number): { x: number; y: number } {
  return { x: w / 2 + (w / 2) * Math.cos(alpha), y: h / 2 + (h / 2) * Math.sin(alpha) };
}

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

/**
 * USymbol: note (EntityImageNote) → sticky-note (folded top-right corner),
 * multi-line body text centered vertically. `noteBox` provides the shape;
 * its default fill (`#FEFECE`) is the pale-yellow PlantUML note color.
 */
function renderNoteNode(node: DescriptionNodeGeo, theme: Theme): string {
  const box = noteBox(node.x, node.y, node.width, node.height, { stroke: theme.colors.border });
  const lines = node.display.split('\n');
  const lineHeight = theme.fontSize * NOTE_LINE_HEIGHT_FACTOR;
  const startY = node.y + theme.fontSize + (node.height - lines.length * lineHeight) / 2;
  const labels = lines
    .map((ln, i) => text(node.x + node.width / 2, startY + i * lineHeight, ln, {
      fontFamily: theme.fontFamily, fontSize: theme.fontSize, fill: theme.colors.text, textAnchor: 'middle',
    }))
    .join('');
  return box + labels;
}

/**
 * USymbol: port (EntityPosition PORTIN/PORTOUT) → small filled square on
 * the container border (EntityPosition.drawSymbol's INPUT_PIN/OUTPUT_PIN
 * branch: `URectangle.build(RADIUS*2, RADIUS*2)`). Render fidelity is not
 * the DOT-parity bar — a plain small square is sufficient; label is
 * skipped when it's just the auto-generated id-as-display text is short
 * enough to fit, matching the bare `portin br0` case seen in fixtures.
 */
function renderPortNode(node: DescriptionNodeGeo, theme: Theme): string {
  const box = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.border, stroke: theme.colors.border, strokeWidth: 1,
  });
  const labelEl = text(
    node.x + node.width / 2, node.y + node.height + theme.fontSize,
    node.display,
    { fontFamily: theme.fontFamily, fontSize: theme.fontSize, fill: theme.colors.text, textAnchor: 'middle' },
  );
  return box + labelEl;
}

/** USymbol: interface → lollipop ellipse with label below. */
function renderInterfaceNode(node: DescriptionNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const circle = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: 'none', stroke: theme.colors.border, 'stroke-width': 1,
  });
  const labelEl = text(cx, node.y + node.height + theme.fontSize, node.display, {
    fontFamily: theme.fontFamily, fontSize: theme.fontSize, fill: theme.colors.text, textAnchor: 'middle',
  });
  return circle + labelEl;
}

// ---------------------------------------------------------------------------
// Database cylinder helpers
// ---------------------------------------------------------------------------

/**
 * USymbol: actor-business → stick-figure + diagonal across head.
 * Diagonal from ActorStickMan.java specialBusiness(): alpha = 21 * PI / 64.
 */
function renderBusinessActor(node: DescriptionNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y;
  const stroke = theme.colors.graph.actorStroke;
  const head =
    `<circle cx="${cx}" cy="${cy + ACTOR_HEAD_R}" r="${ACTOR_HEAD_R}"` +
    ` stroke="${stroke}" fill="${theme.colors.graph.businessActorFill}"/>`;
  const body = line(cx, cy + 16, cx, cy + 40, { stroke });
  const arms = line(cx - 14, cy + 28, cx + 14, cy + 28, { stroke });
  const leftLeg = line(cx, cy + 40, cx - 12, cy + 58, { stroke });
  const rightLeg = line(cx, cy + 40, cx + 12, cy + 58, { stroke });
  const r = ACTOR_HEAD_R;
  const alpha = (BUSINESS_ALPHA_NUM * Math.PI) / BUSINESS_ALPHA_DEN;
  const headCy = cy + ACTOR_HEAD_R;
  const diagonal = line(
    cx + r * Math.cos(Math.PI / 4 + alpha), headCy + r * Math.sin(Math.PI / 4 + alpha),
    cx + r * Math.cos(Math.PI / 4 - alpha), headCy + r * Math.sin(Math.PI / 4 - alpha),
    { stroke },
  );
  return head + body + arms + leftLeg + rightLeg + diagonal + renderNodeLabel(node.display, cx, cy + 70, theme);
}

/** USymbol: usecase-business → ellipse + interior diagonal (USymbolUsecase.java specialBusiness()). */
function renderBusinessUseCaseNode(node: DescriptionNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const oval = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: theme.colors.graph.businessUsecaseFill, stroke: theme.colors.border,
  });
  const label = renderNodeLabel(node.display, cx, cy + theme.fontSize / 3, theme);
  const a = node.width / 2;
  const b = node.height / 2;
  const theta1 = (BUSINESS_UC_THETA1_DEG * Math.PI) / 180;
  const theta2 = getOtherTheta(a, b, BUSINESS_UC_BETA, theta1);
  // UEllipse.scale(0.99): same top-left, scaled dimensions
  const lp1 = ellipsePointAtAngle(node.width * 0.99, node.height * 0.99, -theta1);
  const lp2 = ellipsePointAtAngle(node.width * 0.99, node.height * 0.99, -theta2);
  const diagonal = line(
    node.x + lp1.x, node.y + lp1.y, node.x + lp2.x, node.y + lp2.y,
    { stroke: theme.colors.border },
  );
  return oval + label + diagonal;
}

/**
 * USymbol: rectangle (always), or any CONTAINER_SYMBOLS with children.
 * Dashed border for DASHED_CONTAINER_SYMBOLS (package, folder); solid for others.
 */
function renderContainerNode(node: DescriptionNodeGeo, theme: Theme): string {
  const dashed = DASHED_CONTAINER_SYMBOLS.has(node.symbol);
  const box = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.graph.packageBackground,
    stroke: theme.colors.graph.packageBorder,
    strokeWidth: 1,
    ...(dashed ? { strokeDasharray: '4 2' } : {}),
  });
  const label = text(node.x + 6, node.y + theme.fontSize + 4, node.display, {
    textAnchor: 'start', fontFamily: theme.fontFamily,
    fontSize: theme.fontSize, fontWeight: 'bold', fill: theme.colors.text,
  });
  const children = node.children.map((child) => renderNode(child, theme)).join('');
  return box + label + children;
}

/**
 * D2 rect fallback for not-yet-drawn symbols. Must NOT throw; must NOT drop.
 *
 * TODO: upstream USymbol — implement specific shapes for:
 *   person, hexagon, label, circle, collections, action, process,
 *   agent, boundary, control, entity, artifact, card, file, queue, stack,
 *   and CONTAINER_SYMBOL leaves (node/cloud/frame/folder/package/storage/database)
 *   with no children.
 */
function renderFallbackNode(node: DescriptionNodeGeo, theme: Theme): string {
  const box = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background, stroke: theme.colors.border, strokeWidth: 1,
  });
  const labelEl = text(
    node.x + node.width / 2, node.y + node.height / 2 + theme.fontSize / 3,
    node.display,
    { fontFamily: theme.fontFamily, fontSize: theme.fontSize, fill: theme.colors.text, textAnchor: 'middle' },
  );
  return box + labelEl;
}

// ---------------------------------------------------------------------------
// Node dispatch — Map table keeps CCN ≤ 5 in renderNode
// ---------------------------------------------------------------------------

type NodeRenderer = (node: DescriptionNodeGeo, theme: Theme) => string;

/** Direct symbol → renderer mapping for explicit leaf shapes. */
const LEAF_RENDERERS = new Map<USymbol, NodeRenderer>([
  ['actor',            renderActorIcon],
  ['actor-business',   renderBusinessActor],
  ['usecase',          renderUseCaseIcon],
  ['usecase-business', renderBusinessUseCaseNode],
  ['interface',        renderInterfaceNode],
  ['component',        renderComponentIcon],
  ['note',             renderNoteNode],
  ['port',             renderPortNode],
]);

/**
 * Top-level node dispatch.
 *
 * Precedence:
 *  1. LEAF_RENDERERS map — actor, usecase, interface, component variants.
 *  2. database (leaf, no children) → cylinder.
 *  3. rectangle / CONTAINER_SYMBOLS with children → labeled container rect.
 *  4. All remaining → D2 rect fallback.
 */
export function renderNode(node: DescriptionNodeGeo, theme: Theme): string {
  const leafFn = LEAF_RENDERERS.get(node.symbol);
  if (leafFn !== undefined) return leafFn(node, theme);
  if (node.symbol === 'database' && node.children.length === 0) return renderDatabaseIcon(node, theme);
  if (node.symbol === 'rectangle' || isRenderedAsContainer(node)) return renderContainerNode(node, theme);
  return renderFallbackNode(node, theme);
}
