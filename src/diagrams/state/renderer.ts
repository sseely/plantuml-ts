/**
 * State diagram SVG renderer.
 *
 * Pure function: StateGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { StateGeometry, StateNodeGeo, TransitionGeo } from './layout.js';
import type { StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import {
  rect,
  text,
  path,
  ellipse,
  diamond,
} from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Node shape renderers
// ---------------------------------------------------------------------------

function renderInitial(node: StateNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = node.width / 2;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${theme.colors.border}"/>`;
}

function renderFinal(node: StateNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const outerR = node.width / 2;
  const innerR = outerR * 0.5;
  return (
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="${theme.colors.border}" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${theme.colors.border}"/>`
  );
}

function renderForkJoin(node: StateNodeGeo, theme: Theme): string {
  return rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.border,
  });
}

function renderChoiceJunction(node: StateNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const size = node.width / 2;
  return diamond(cx, cy, size, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
}

function renderHistory(node: StateNodeGeo, kind: StateKind, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = node.width / 2;
  const label = kind === 'deepHistory' ? 'H*' : 'H';
  return (
    ellipse(cx, cy, r, r, { fill: 'none', stroke: theme.colors.border }) +
    text(cx, cy + theme.fontSize / 3, label, {
      textAnchor: 'middle',
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    })
  );
}

function renderNormal(node: StateNodeGeo, theme: Theme): string {
  const box = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    strokeWidth: 1,
    rx: 8,
  });
  const label = text(
    node.x + node.width / 2,
    node.y + node.height / 2 + theme.fontSize / 2,
    node.display,
    {
      textAnchor: 'middle',
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
  );
  return box + label;
}

/**
 * `kind:'json'` leaf (mission A4 Phase L iter 20) — a plain labeled box,
 * the closest visual analog available today. Faithful `shape=plaintext`
 * TABLE content (member rows, matching class engine's own json rendering)
 * is deferred to future visual-fidelity work — this renderer has no row-
 * drawing infrastructure at all yet, not even for a plain state's own
 * description/body lines (renderNormal only ever draws the name). Mirrors
 * the syncBar case's own documented no-dedicated-renderer-yet gap below.
 */
function renderJson(node: StateNodeGeo, theme: Theme): string {
  return renderNormal(node, theme);
}

function renderComposite(node: StateNodeGeo, theme: Theme): string {
  // Dashed outer rect for composite state container
  const outerBox = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
    strokeWidth: 1,
    strokeDasharray: '6,3',
    rx: 8,
  });
  // Label at top of the composite box
  const label = text(
    node.x + node.width / 2,
    node.y + theme.fontSize + 4,
    node.display,
    {
      textAnchor: 'middle',
      fill: theme.colors.text,
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
    },
  );
  // Render children inside the composite
  const childrenSvg = node.children.map((child) => renderNode(child, theme)).join('');
  return outerBox + label + childrenSvg;
}

function renderNode(node: StateNodeGeo, theme: Theme): string {
  // Composite states take priority: they contain children and get a dashed wrapper
  if (node.children.length > 0) {
    return renderComposite(node, theme);
  }

  switch (node.kind) {
    case 'initial':
      return renderInitial(node, theme);
    case 'final':
      return renderFinal(node, theme);
    case 'fork':
    case 'join':
    // syncBar (T2 addition, `=name=` transition endpoints — see
    // ast.ts's StateKind) has no dedicated renderer yet: T3/T4 owns
    // renderer.ts's real rewrite. Reusing the fork/join bar shape is the
    // closest visual analog — upstream itself renders synchronization
    // bars and fork/join with the same bar shape (LeafType.SYNCHRO_BAR /
    // STATE_FORK_JOIN both go through GeneralImageBuilder's bar case).
    case 'syncBar':
      return renderForkJoin(node, theme);
    case 'choice':
      return renderChoiceJunction(node, theme);
    case 'history':
    case 'deepHistory':
      return renderHistory(node, node.kind, theme);
    case 'normal':
      return renderNormal(node, theme);
    case 'json':
      return renderJson(node, theme);
    // #lizard forgives -- faithful one-branch-per-StateKind dispatch; each
    // case is a single delegating return, not real decision complexity.
  }
}

// ---------------------------------------------------------------------------
// Transition renderer
// ---------------------------------------------------------------------------

function buildPathD(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const p0 = points[0];
  if (p0 === undefined) return '';
  if (points.length === 1) return `M ${p0.x},${p0.y}`;

  if (points.length === 2) {
    const p1 = points[1]!;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const cp1x = p0.x + dx * 0.1;
    const cp1y = p0.y + dy * 0.45;
    const cp2x = p1.x - dx * 0.3;
    const cp2y = p1.y - dy * 0.4;
    return `M ${p0.x},${p0.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }

  // Catmull-Rom → cubic Bézier for 3+ waypoints
  const parts: string[] = [`M ${p0.x},${p0.y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i > 0 ? i - 1 : 0]!;
    const curr = points[i]!;
    const next1 = points[i + 1]!;
    const next2 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const cp1x = curr.x + (next1.x - prev.x) / 6;
    const cp1y = curr.y + (next1.y - prev.y) / 6;
    const cp2x = next1.x - (next2.x - curr.x) / 6;
    const cp2y = next1.y - (next2.y - curr.y) / 6;
    parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next1.x},${next1.y}`);
  }
  return parts.join(' ');
}

function renderTransition(transition: TransitionGeo, theme: Theme): string {
  const d = buildPathD(transition.points);
  if (d === '') return '';

  const pathEl = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1.5,
    markerEnd: 'url(#arrow-dependency)',
  });

  if (transition.label === undefined) {
    return pathEl;
  }

  const { text: labelText, x, y } = transition.label;
  const labelEl = text(x, y, labelText, {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
  });

  return pathEl + labelEl;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a state diagram geometry into an SVG string.
 */
export function renderState(geo: StateGeometry, theme: Theme): RenderFragment {
  const children: string[] = [];

  // Background
  children.push(
    rect(0, 0, geo.totalWidth, geo.totalHeight, {
      fill: theme.colors.background,
    }),
  );

  // States
  for (const node of geo.states) {
    children.push(renderNode(node, theme));
  }

  // Transitions
  for (const transition of geo.transitions) {
    children.push(renderTransition(transition, theme));
  }

  return {
    body: children.join(''),
    width: geo.totalWidth,
    height: geo.totalHeight,
    background: theme.colors.background,
  };
}
