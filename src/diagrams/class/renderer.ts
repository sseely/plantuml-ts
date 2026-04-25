/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import type { ClassifierKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import {
  rect,
  text,
  line,
  path,
  diamond,
  svgRoot,
  arrowHeadRef,
} from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Badge helpers — colored circle with letter in the header
// ---------------------------------------------------------------------------

function badgeFill(kind: ClassifierKind): string {
  switch (kind) {
    case 'interface':  return '#7B5EA7'; // purple
    case 'abstract':   return '#3A8FA8'; // teal
    case 'enum':       return '#4DA34D'; // green
    case 'annotation': return '#888888'; // gray
    case 'object':     return '#E07020'; // orange
    default:           return '#4472B8'; // blue (class)
  }
}

function badgeLetter(kind: ClassifierKind): string {
  switch (kind) {
    case 'interface':  return 'I';
    case 'abstract':   return 'A';
    case 'enum':       return 'E';
    case 'annotation': return '@';
    case 'object':     return 'O';
    default:           return 'C';
  }
}

// ---------------------------------------------------------------------------
// Classifier kind → fill color
// ---------------------------------------------------------------------------

function classifierFill(geo: ClassifierGeo, theme: Theme): string {
  if (geo.kind === 'enum') return theme.colors.graph.enumBackground;
  return theme.colors.graph.classBackground;
}

// ---------------------------------------------------------------------------
// Classifier box
// ---------------------------------------------------------------------------

function renderClassifier(geo: ClassifierGeo, theme: Theme): string {
  const fill = classifierFill(geo, theme);
  const parts: string[] = [];

  // Background rect
  parts.push(
    rect(geo.x, geo.y, geo.width, geo.height, {
      fill,
      stroke: theme.colors.border,
      strokeWidth: 1,
    }),
  );

  // Divider lines
  for (const divY of geo.dividerYs) {
    parts.push(
      line(
        geo.x,
        geo.y + divY,
        geo.x + geo.width,
        geo.y + divY,
        { stroke: theme.colors.border },
      ),
    );
  }

  // Text rows — header (centered, italic for abstract/interface) + member rows
  for (const row of geo.rows) {
    const hasIndent = row.indent > 0;

    // Visibility icon for member rows
    if (row.visibilityIcon !== undefined) {
      const iconX = geo.x + 11; // 4px margin + 7px to center of 14px icon area
      const iconY = geo.y + row.y;
      const r = 5;
      switch (row.visibilityIcon) {
        case '+': // public — green circle
          parts.push(`<circle cx="${iconX}" cy="${iconY}" r="${r}" fill="#81B03A"/>`);
          break;
        case '-': // private — red square
          parts.push(`<rect x="${iconX - r}" y="${iconY - r}" width="${r * 2}" height="${r * 2}" fill="#D04540"/>`);
          break;
        case '#': // protected — orange diamond
          parts.push(diamond(iconX, iconY, r, { fill: '#E7A020' }));
          break;
        case '~': // package — teal circle
          parts.push(`<circle cx="${iconX}" cy="${iconY}" r="${r}" fill="#619AC4"/>`);
          break;
      }
    }

    parts.push(
      text(
        hasIndent ? geo.x + row.indent : geo.x + geo.width / 2,
        geo.y + row.y,
        row.text,
        {
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize,
          fill: theme.colors.text,
          textAnchor: hasIndent ? 'start' : 'middle',
          dominantBaseline: 'middle',
          ...(row.italic === true ? { fontStyle: 'italic' as const } : {}),
        },
      ),
    );
  }

  // Badge — colored circle with kind letter, positioned left of center in header.
  // Suppressed when hideCircle is set (from a "hide circle" directive).
  if (geo.hideCircle !== true) {
    const headerH = geo.dividerYs[0] ?? 28;
    const badgeR = 10;
    const badgeX = Math.round(geo.x + badgeR + 6);
    const badgeY = Math.round(geo.y + headerH / 2);
    parts.push(`<circle cx="${badgeX}" cy="${badgeY}" r="${badgeR}" fill="${badgeFill(geo.kind)}"/>`);
    parts.push(
      text(badgeX, badgeY, badgeLetter(geo.kind), {
        fontFamily: theme.fontFamily,
        fontSize: 10,
        fill: '#FFFFFF',
        fontWeight: 'bold',
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      }),
    );
  }

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Namespace box
// ---------------------------------------------------------------------------

function renderNamespace(geo: NamespaceGeo, theme: Theme): string {
  const box = rect(geo.x, geo.y, geo.width, geo.height, {
    fill: theme.colors.graph.packageBackground,
    stroke: theme.colors.graph.packageBorder,
    strokeWidth: 1,
    strokeDasharray: '4 2',
  });
  const label = text(
    geo.x + 6,
    geo.y + theme.fontSize + 4,
    geo.label,
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
    },
  );
  return box + label;
}

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

function buildPathData(points: EdgeGeo['points']): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (first === undefined) return '';
  const start = `M ${first.x},${first.y}`;
  const segments = rest.map((p) => `L ${p.x},${p.y}`);
  return [start, ...segments].join(' ');
}

function targetMarker(decor: EdgeGeo['targetDecor']): string | undefined {
  switch (decor) {
    case 'triangle':
      return `url(#${arrowHeadRef('extension')})`;
    case 'open':
      return `url(#${arrowHeadRef('dependency')})`;
    case 'none':
    case 'diamond':
    case 'filledDiamond':
      return undefined;
  }
}

function sourceMarker(decor: EdgeGeo['sourceDecor']): string | undefined {
  switch (decor) {
    case 'filledDiamond':
      return `url(#${arrowHeadRef('composition')})`;
    case 'diamond':
      return `url(#${arrowHeadRef('aggregation')})`;
    case 'none':
      return undefined;
  }
}

function renderEdge(geo: EdgeGeo, theme: Theme): string {
  const parts: string[] = [];
  const d = buildPathData(geo.points);

  if (d !== '') {
    const markerEnd = targetMarker(geo.targetDecor);
    const markerStart = sourceMarker(geo.sourceDecor);

    parts.push(
      path(d, {
        stroke: theme.colors.arrow,
        strokeWidth: 1.5,
        ...(geo.dashed ? { strokeDasharray: '5 5' } : {}),
        ...(markerEnd !== undefined ? { markerEnd } : {}),
        ...(markerStart !== undefined ? { markerStart } : {}),
      }),
    );
  }

  if (geo.label !== undefined) {
    parts.push(
      text(
        geo.label.x,
        geo.label.y,
        geo.label.text,
        {
          fill: theme.colors.graph.edgeLabel,
          fontSize: theme.fontSize - 2,
          textAnchor: 'start',
          dominantBaseline: 'middle',
        },
      ),
    );
  }

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a class diagram geometry into an SVG string.
 *
 * @param geo   - Pre-computed geometry from layoutClass().
 * @param theme - Visual theme.
 * @returns     SVG string.
 */
export function renderClass(geo: ClassGeometry, theme: Theme): string {
  const children: string[] = [];

  // 1. Background
  children.push(
    rect(0, 0, geo.totalWidth, geo.totalHeight, {
      fill: theme.colors.background,
    }),
  );

  // 2. Namespace boxes (behind classifiers)
  for (const ns of geo.namespaces) {
    children.push(renderNamespace(ns, theme));
  }

  // 3. Classifier boxes
  for (const classifier of geo.classifiers) {
    children.push(renderClassifier(classifier, theme));
  }

  // 4. Edges
  for (const edge of geo.edges) {
    children.push(renderEdge(edge, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}
