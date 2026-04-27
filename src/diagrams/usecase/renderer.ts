/**
 * Use case diagram SVG renderer.
 *
 * Pure function: UseCaseGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { UseCaseGeometry, UCNodeGeo, UCEdgeGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import {
  svgRoot,
  rect,
  text,
  line,
  path,
  ellipse,
} from '../../core/svg.js';
import { measureLatex, renderLatexMathML } from '../../core/latex.js';

// ---------------------------------------------------------------------------
// Container kind guard
// ---------------------------------------------------------------------------

const CONTAINER_KINDS: ReadonlySet<string> = new Set([
  'package',
  'rectangle',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
]);

function isContainerKind(kind: string): boolean {
  return CONTAINER_KINDS.has(kind);
}

// ---------------------------------------------------------------------------
// Business usecase diagonal helpers
// ---------------------------------------------------------------------------

/**
 * RotatedEllipse.getPoint(theta) — faithful port of upstream Java.
 * Returns a point on the ellipse with semi-axes (a, b) rotated by beta.
 * Result is relative to the ellipse center.
 */
function rotatedEllipsePoint(
  a: number,
  b: number,
  beta: number,
  theta: number,
): { x: number; y: number } {
  const x = a * Math.cos(theta);
  const y = b * Math.sin(theta);
  return {
    x: x * Math.cos(beta) - y * Math.sin(beta),
    y: x * Math.sin(beta) + y * Math.cos(beta),
  };
}

/**
 * RotatedEllipse.getOtherTheta(theta1) — faithful port of upstream Java.
 * Given one theta, returns the conjugate theta for the diagonal intersection.
 *
 * Java source:
 *   z = getPoint(theta1).getX()
 *   a = getA() * cos(beta), b = getB() * sin(beta)
 *   sum = 2 * getA() * z / (getA()^2 + getB()^2)
 *   other = sum - cos(theta1)
 *   return -acos(other)
 */
function getOtherTheta(
  a: number,
  b: number,
  beta: number,
  theta1: number,
): number {
  const z = rotatedEllipsePoint(a, b, beta, theta1).x;
  const sum = (2 * a * z) / (a * a + b * b);
  const other = sum - Math.cos(theta1);
  // Clamp to [-1, 1] to guard floating-point drift before acos
  return -Math.acos(Math.max(-1, Math.min(1, other)));
}

/**
 * UEllipse.getPointAtAngle(alpha) — faithful port of upstream Java.
 * Returns a point on the ellipse relative to its top-left corner.
 * w, h are the ellipse width and height.
 */
function ellipsePointAtAngle(
  w: number,
  h: number,
  alpha: number,
): { x: number; y: number } {
  return {
    x: w / 2 + (w / 2) * Math.cos(alpha),
    y: h / 2 + (h / 2) * Math.sin(alpha),
  };
}

// ---------------------------------------------------------------------------
// Label renderer — plain text or LaTeX foreignObject
// ---------------------------------------------------------------------------

/**
 * Render a node label as either a `<text>` element (plain) or a
 * `<foreignObject>` containing KaTeX MathML (when the display string
 * contains a `<latex>` tag).
 *
 * @param display - The node's display string (may contain `<latex>…</latex>`).
 * @param cx      - Horizontal center of the label anchor.
 * @param cy      - Vertical baseline / center of the label anchor.
 * @param theme   - Active theme.
 */
function renderLabel(
  display: string,
  cx: number,
  cy: number,
  theme: Theme,
): string {
  if (display.includes('<latex>')) {
    const { width: w, height: h } = measureLatex(display);
    return renderLatexMathML(display, cx - w / 2, cy - h / 2, w, h, theme.colors.text);
  }
  return text(cx, cy, display, {
    textAnchor: 'middle',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fill: theme.colors.text,
  });
}

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

/**
 * Render a stick-figure actor node.
 * node.width = 50, node.height = 70.
 */
function renderActor(node: UCNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y;
  const stroke = theme.colors.graph.actorStroke;
  const fill = theme.colors.graph.actorFill;

  // Head circle (r=8)
  const head =
    `<circle cx="${cx}" cy="${cy + 8}" r="8"` +
    ` stroke="${stroke}" fill="${fill}"/>`;

  // Body: bottom of head to waist
  const body = line(cx, cy + 16, cx, cy + 40, { stroke });

  // Arms: horizontal at waist level
  const arms = line(cx - 14, cy + 28, cx + 14, cy + 28, { stroke });

  // Left leg
  const leftLeg = line(cx, cy + 40, cx - 12, cy + 58, { stroke });

  // Right leg
  const rightLeg = line(cx, cy + 40, cx + 12, cy + 58, { stroke });

  // Label below figure
  const label = renderLabel(node.display, cx, cy + 70, theme);

  return head + body + arms + leftLeg + rightLeg + label;
}

/**
 * Render a business actor node — stickman with a diagonal line across the
 * head circle (exactly as ActorStickMan.java specialBusiness()).
 *
 * Coordinates from ActorStickMan.java:
 *   alpha = 21 * PI / 64
 *   angle1 = PI/4 + alpha, angle2 = PI/4 - alpha
 *   r = headDiam/2 = 8
 *   p1 = (r*cos(angle1), r*sin(angle1))
 *   p2 = (r*cos(angle2), r*sin(angle2))
 *   line from (headCenterX + p1.x, headCenterY + p1.y)
 *          to (headCenterX + p2.x, headCenterY + p2.y)
 */
function renderBusinessActor(node: UCNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y;
  const stroke = theme.colors.graph.actorStroke;
  const fill = theme.colors.graph.businessActorFill;

  // Head circle (r=8)
  const head =
    `<circle cx="${cx}" cy="${cy + 8}" r="8"` +
    ` stroke="${stroke}" fill="${fill}"/>`;

  // Body: bottom of head to waist
  const body = line(cx, cy + 16, cx, cy + 40, { stroke });

  // Arms: horizontal at waist level
  const arms = line(cx - 14, cy + 28, cx + 14, cy + 28, { stroke });

  // Left leg
  const leftLeg = line(cx, cy + 40, cx - 12, cy + 58, { stroke });

  // Right leg
  const rightLeg = line(cx, cy + 40, cx + 12, cy + 58, { stroke });

  // Business diagonal across head — from ActorStickMan.java specialBusiness()
  const r = 8;
  const businessAlpha = (21 * Math.PI) / 64;
  const angle1 = Math.PI / 4 + businessAlpha;
  const angle2 = Math.PI / 4 - businessAlpha;
  const p1x = r * Math.cos(angle1);
  const p1y = r * Math.sin(angle1);
  const p2x = r * Math.cos(angle2);
  const p2y = r * Math.sin(angle2);
  // Head center is at (cx, cy + 8)
  const headCy = cy + 8;
  const diagonal = line(cx + p1x, headCy + p1y, cx + p2x, headCy + p2y, {
    stroke,
  });

  // Label below figure
  const label = renderLabel(node.display, cx, cy + 70, theme);

  return head + body + arms + leftLeg + rightLeg + diagonal + label;
}

/**
 * Render a use case node as a horizontal ellipse with centered label.
 */
function renderUseCaseNode(node: UCNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  const oval = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: theme.colors.graph.usecaseFill,
    stroke: theme.colors.border,
  });

  const label = renderLabel(node.display, cx, cy + theme.fontSize / 3, theme);

  return oval + label;
}

/**
 * Render a business use case node — ellipse with centered label and a
 * diagonal line across the interior.
 *
 * Diagonal ported from USymbolUsecase.java specialBusiness():
 *   rotatedEllipse = RotatedEllipse(frontier, PI/4)
 *   theta1 = 20.0 * PI / 180
 *   theta2 = rotatedEllipse.getOtherTheta(theta1)
 *   frontier2 = frontier.scale(0.99)
 *   p1 = frontier2.getPointAtAngle(-theta1)  (relative to top-left)
 *   p2 = frontier2.getPointAtAngle(-theta2)
 */
function renderBusinessUseCaseNode(node: UCNodeGeo, theme: Theme): string {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;

  const oval = ellipse(cx, cy, node.width / 2, node.height / 2, {
    fill: theme.colors.graph.businessUsecaseFill,
    stroke: theme.colors.border,
  });

  const label = renderLabel(node.display, cx, cy + theme.fontSize / 3, theme);

  // Business diagonal — ported from USymbolUsecase.java specialBusiness()
  const a = node.width / 2;
  const b = node.height / 2;
  const beta = Math.PI / 4;
  const theta1 = (20.0 * Math.PI) / 180;
  const theta2 = getOtherTheta(a, b, beta, theta1);

  // UEllipse.scale(0.99) produces same top-left, scaled dimensions
  const w2 = node.width * 0.99;
  const h2 = node.height * 0.99;
  const lp1 = ellipsePointAtAngle(w2, h2, -theta1);
  const lp2 = ellipsePointAtAngle(w2, h2, -theta2);

  const diagonal = line(
    node.x + lp1.x,
    node.y + lp1.y,
    node.x + lp2.x,
    node.y + lp2.y,
    { stroke: theme.colors.border },
  );

  return oval + label + diagonal;
}

// Kinds whose PlantUML convention is a dashed border; all others use solid.
const DASHED_CONTAINER_KINDS: ReadonlySet<string> = new Set(['package', 'folder']);

/**
 * Render a container node (package, rectangle, etc.) with a label in the
 * top-left and children inside.  Packages and folders use a dashed border
 * (PlantUML convention); all other container kinds (rectangle, node, frame,
 * cloud, database) use a solid border.  The label is rendered bold.
 */
function renderContainer(node: UCNodeGeo, theme: Theme): string {
  const dashed = DASHED_CONTAINER_KINDS.has(node.kind);
  const box = rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.graph.packageBackground,
    stroke: theme.colors.graph.packageBorder,
    strokeWidth: 1,
    ...(dashed ? { strokeDasharray: '4 2' } : {}),
  });

  const label = text(node.x + 6, node.y + theme.fontSize + 4, node.display, {
    textAnchor: 'start',
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    fontWeight: 'bold',
    fill: theme.colors.text,
  });

  const children = node.children
    .map((child) => renderNode(child, theme))
    .join('');

  return box + label + children;
}

/**
 * Dispatch to the correct renderer for a single node.
 */
function renderNode(node: UCNodeGeo, theme: Theme): string {
  if (node.kind === 'actor') {
    return renderActor(node, theme);
  }
  if (node.kind === 'business-actor') {
    return renderBusinessActor(node, theme);
  }
  if (node.kind === 'usecase') {
    return renderUseCaseNode(node, theme);
  }
  if (node.kind === 'business-usecase') {
    return renderBusinessUseCaseNode(node, theme);
  }
  if (isContainerKind(node.kind)) {
    return renderContainer(node, theme);
  }
  // Unknown kind — fallback rect so nothing is lost
  return rect(node.x, node.y, node.width, node.height, {
    fill: theme.colors.background,
    stroke: theme.colors.border,
  });
}

// ---------------------------------------------------------------------------
// Edge renderer
// ---------------------------------------------------------------------------

/**
 * Build a smooth SVG path `d` string through an ordered list of points.
 *
 * Two-point paths use a cubic bezier whose control points sit at the
 * horizontal midpoint of the segment — this produces the arc look that
 * PlantUML renders for actor→use-case connections.
 *
 * Multi-point paths use the "smooth polyline" technique: each interior
 * waypoint becomes a quadratic bezier control point and the curve passes
 * through the midpoints between consecutive waypoints, eliminating sharp
 * angular bends.
 */
function buildEdgePath(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (first === undefined) return '';
  if (points.length === 1) return `M ${first.x},${first.y}`;

  const last = points[points.length - 1]!;

  if (points.length === 2) {
    const midX = (first.x + last.x) / 2;
    return (
      `M ${first.x},${first.y} ` +
      `C ${midX},${first.y} ${midX},${last.y} ${last.x},${last.y}`
    );
  }

  // Smooth polyline: pass through midpoints between consecutive waypoints,
  // using each original waypoint as a quadratic bezier control point.
  const parts: string[] = [`M ${first.x},${first.y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]!;
    const next = points[i + 1]!;
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    parts.push(`Q ${curr.x},${curr.y} ${midX},${midY}`);
  }
  parts.push(`L ${last.x},${last.y}`);
  return parts.join(' ');
}

/**
 * Compute the midpoint of an edge's point list for label placement.
 */
function edgeMidpoint(
  points: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) {
    const p = points[0]!;
    return { x: p.x, y: p.y };
  }
  const midIdx = Math.floor(points.length / 2);
  const a = points[midIdx - 1]!;
  const b = points[midIdx]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function renderEdge(edge: UCEdgeGeo, theme: Theme): string {
  const d = buildEdgePath(edge.points);
  if (d === '') return '';

  const strokeDasharray = edge.dashed ? '5 5' : undefined;

  const edgePath = path(d, {
    stroke: theme.colors.arrow,
    strokeWidth: 1.5,
    ...(strokeDasharray !== undefined ? { strokeDasharray } : {}),
    markerEnd: 'url(#arrow-dependency)',
  });

  let extras = '';

  if (edge.stereotype !== undefined) {
    const mid = edgeMidpoint(edge.points);
    extras += text(mid.x, mid.y - 6, `«${edge.stereotype}»`, {
      textAnchor: 'middle',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize - 2,
      fill: theme.colors.graph.edgeLabel,
    });
  }

  if (edge.label !== undefined) {
    const lbl = edge.label;
    extras += text(lbl.x, lbl.y, lbl.text, {
      textAnchor: 'middle',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize - 2,
      fill: theme.colors.graph.edgeLabel,
    });
  }

  return edgePath + extras;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a use case diagram geometry into an SVG string.
 *
 * Pure function — no DOM, no side effects.
 */
export function renderUseCase(geo: UseCaseGeometry, theme: Theme): string {
  const children: string[] = [];

  // Background
  children.push(
    rect(0, 0, geo.totalWidth, geo.totalHeight, {
      fill: theme.colors.background,
    }),
  );

  // Nodes (containers recurse into their children)
  for (const node of geo.nodes) {
    children.push(renderNode(node, theme));
  }

  // Edges
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}
