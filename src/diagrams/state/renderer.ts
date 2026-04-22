/**
 * State diagram SVG renderer.
 *
 * Pure function: StateGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { StateGeometry, StateNodeGeo, TransitionGeo } from './layout.js';
import type { StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import {
  svgRoot,
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
      return renderForkJoin(node, theme);
    case 'choice':
    case 'junction':
      return renderChoiceJunction(node, theme);
    case 'history':
    case 'deepHistory':
      return renderHistory(node, node.kind, theme);
    case 'normal':
      return renderNormal(node, theme);
  }
}

// ---------------------------------------------------------------------------
// Transition renderer
// ---------------------------------------------------------------------------

function buildPathD(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  // noUncheckedIndexedAccess: first can be undefined if points is empty,
  // but we guard above.
  if (first === undefined) return '';
  const segments = rest.map((p) => `L ${p.x},${p.y}`).join(' ');
  return `M ${first.x},${first.y}${rest.length > 0 ? ' ' + segments : ''}`;
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
export function renderState(geo: StateGeometry, theme: Theme): string {
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

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}
