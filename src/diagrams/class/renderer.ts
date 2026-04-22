/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import {
  rect,
  text,
  line,
  path,
  svgRoot,
  arrowHeadRef,
} from '../../core/svg.js';

// ---------------------------------------------------------------------------
// Classifier kind → fill color
// ---------------------------------------------------------------------------

function classifierFill(geo: ClassifierGeo, theme: Theme): string {
  // The kind is not stored on ClassifierGeo; we derive it from the header row.
  // ClassifierGeo rows[0].text holds the display string with prefix:
  //   «interface» …  → interface
  //   «enum» …       → enum
  //   {abstract} …   → abstract / annotation (both use classBackground)
  //   @…             → annotation
  //   (anything else)→ class
  const header = geo.rows[0]?.text ?? '';
  if (header.startsWith('«interface»')) {
    return theme.colors.graph.interfaceBackground;
  }
  if (header.startsWith('«enum»')) {
    return theme.colors.graph.enumBackground;
  }
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

  // Text rows
  for (const row of geo.rows) {
    const hasIndent = row.indent > 0;
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
        },
      ),
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
          textAnchor: 'middle',
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
