/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import type { NoteGeo } from './note-layout.js';
import type { ClassifierKind, Visibility } from './ast.js';
import type { Theme } from '../../core/theme.js';
import {
  rect,
  text,
  line,
  path,
  polygon,
  diamond,
  svgRoot,
  arrowHeadRef,
} from '../../core/svg.js';
import { renderUSymbolIcon } from '../../core/usymbol-shapes.js';

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

const VISIBILITY_FILL: Record<Visibility, string> = {
  '+': '#81B03A', // public — green
  '-': '#D04540', // private — red
  '#': '#E7A020', // protected — orange
  '~': '#619AC4', // package — teal
};

/** The colored visibility marker to the left of a member row. */
function renderVisibilityIcon(icon: Visibility, x: number, y: number): string {
  const r = 5;
  if (icon === '-')
    return `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="${VISIBILITY_FILL['-']}"/>`;
  if (icon === '#') return diamond(x, y, r, { fill: VISIBILITY_FILL['#'] });
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${VISIBILITY_FILL[icon]}"/>`;
}

/** One text row (header or member), preceded by its visibility icon if any. */
function renderRow(geo: ClassifierGeo, row: ClassifierGeo['rows'][number], theme: Theme): string {
  const hasIndent = row.indent > 0;
  const icon =
    row.visibilityIcon !== undefined
      ? renderVisibilityIcon(row.visibilityIcon, geo.x + 11, geo.y + row.y)
      : '';
  return (
    icon +
    text(hasIndent ? geo.x + row.indent : geo.x + geo.width / 2, geo.y + row.y, row.text, {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fill: theme.colors.text,
      textAnchor: hasIndent ? 'start' : 'middle',
      dominantBaseline: 'middle',
      ...(row.italic === true ? { fontStyle: 'italic' as const } : {}),
    })
  );
}

/** The kind badge (colored circle + letter) in the header. */
function renderBadge(geo: ClassifierGeo, theme: Theme): string {
  const headerH = geo.dividerYs[0] ?? 28;
  const badgeR = 10;
  const badgeX = Math.round(geo.x + badgeR + 6);
  const badgeY = Math.round(geo.y + headerH / 2);
  return (
    `<circle cx="${badgeX}" cy="${badgeY}" r="${badgeR}" fill="${badgeFill(geo.kind)}"/>` +
    text(badgeX, badgeY, badgeLetter(geo.kind), {
      fontFamily: theme.fontFamily, fontSize: 10, fill: '#FFFFFF',
      fontWeight: 'bold', textAnchor: 'middle', dominantBaseline: 'middle',
    })
  );
}

function renderClassifier(geo: ClassifierGeo, theme: Theme): string {
  // Descriptive elements (database/component/actor/usecase) draw their USymbol
  // icon instead of the class box; usecase carries no usymbol (its kind is enough).
  const usymbol = geo.kind === 'usecase' ? 'usecase' : geo.usymbol;
  if (usymbol !== undefined) {
    const display = geo.rows[0]?.text ?? geo.id;
    const icon = renderUSymbolIcon(usymbol, { ...geo, display }, theme);
    if (icon !== undefined) return icon;
  }

  const parts: string[] = [
    rect(geo.x, geo.y, geo.width, geo.height, {
      fill: classifierFill(geo, theme), stroke: theme.colors.border, strokeWidth: 1,
    }),
  ];
  for (const divY of geo.dividerYs)
    parts.push(line(geo.x, geo.y + divY, geo.x + geo.width, geo.y + divY, { stroke: theme.colors.border }));
  for (const row of geo.rows) parts.push(renderRow(geo, row, theme));
  if (geo.hideCircle !== true) parts.push(renderBadge(geo, theme));
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
        stroke: theme.colors.arrow, strokeWidth: 1.5,
        ...(geo.dashed ? { strokeDasharray: '5 5' } : {}),
        ...(markerEnd !== undefined ? { markerEnd } : {}),
        ...(markerStart !== undefined ? { markerStart } : {}),
      }),
    );
  }
  if (geo.label !== undefined) {
    parts.push(
      text(geo.label.x, geo.label.y, geo.label.text, {
        fill: theme.colors.graph.edgeLabel, fontSize: theme.fontSize - 2,
        textAnchor: 'start', dominantBaseline: 'middle',
      }),
    );
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Note (folded-corner box + dashed connector)
// ---------------------------------------------------------------------------

const NOTE_FILL = '#FEFFDD';
const NOTE_FOLD = 10; // matches note-layout NOTE_FOLD allowance
const NOTE_PAD_X = 8;
const NOTE_PAD_Y = 6;

function renderNote(note: NoteGeo, theme: Theme): string {
  const parts: string[] = [];

  // Dashed connector to the host (no arrowheads).
  const connector = buildPathData(note.connector);
  if (connector !== '') {
    parts.push(
      path(connector, { stroke: theme.colors.arrow, strokeWidth: 1, strokeDasharray: '4 4' }),
    );
  }

  // Folded-corner outline ("opale") with the top-right corner turned down.
  const { x, y, width: w, height: h } = note;
  const f = NOTE_FOLD;
  parts.push(
    polygon(
      [
        { x, y },
        { x: x + w - f, y },
        { x: x + w, y: y + f },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      { fill: NOTE_FILL, stroke: theme.colors.border, strokeWidth: 1 },
    ),
  );
  const fold = `M ${x + w - f},${y} L ${x + w - f},${y + f} L ${x + w},${y + f}`;
  parts.push(path(fold, { stroke: theme.colors.border, strokeWidth: 1 }));

  // Body text, one line per row.
  const lineHeight = theme.fontSize * 1.4;
  note.lines.forEach((ln, i) => {
    parts.push(
      text(x + NOTE_PAD_X, y + NOTE_PAD_Y + (i + 0.8) * lineHeight, ln, {
        fill: theme.colors.text,
        fontSize: theme.fontSize,
        textAnchor: 'start',
        dominantBaseline: 'middle',
      }),
    );
  });

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

  // 5. Notes (folded boxes + dashed connectors), drawn on top.
  for (const note of geo.notes) {
    children.push(renderNote(note, theme));
  }

  return svgRoot(geo.totalWidth, geo.totalHeight, children, theme.colors.background);
}
