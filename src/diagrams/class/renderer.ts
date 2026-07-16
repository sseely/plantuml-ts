/**
 * Class diagram SVG renderer.
 *
 * Pure function: ClassGeometry + Theme → SVG string.
 * No DOM, no async.
 */

import type { ClassGeometry, ClassifierGeo, EdgeGeo, NamespaceGeo } from './layout.js';
import type { NoteGeo } from './note-layout.js';
import type { Visibility } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { RenderFragment } from '../../core/dispatcher.js';
import {
  rect,
  text,
  line,
  path,
  polygon,
  diamond,
  ellipse,
} from '../../core/svg.js';
import { renderUSymbolIcon } from '../../core/usymbol-shapes.js';
import { MAP_CELL_MARGIN_X } from './class-object-map-sizing.js';
import { buildEdgeArrowheads, decorName } from './renderer-arrowhead.js';
import { buildClassUidPlan } from './renderer-uid.js';
import { wrapCluster, wrapEntity, wrapLink, leafPortion } from './renderer-group.js';
import {
  hasBadge,
  badgeFill,
  badgeGlyphPath,
  BADGE_RADIUS,
  BADGE_CENTER_X_OFFSET,
} from './class-badge.js';

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
  '*': '#000000', // IE_MANDATORY (ColorParam.iconIEMandatory) — black
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

/**
 * The kind badge in the header: a filled `<ellipse>` (radius {@link
 * BADGE_RADIUS}, upstream `SkinParam#getCircledCharacterRadius()` default)
 * plus the kind letter drawn as a real vector glyph outline (`<path>`),
 * matching `klimt/shape/CircledCharacter.java` -- never `<circle>`+`<text>`.
 * Position formula (`class-badge.ts`'s own doc comment, jar-verified):
 * `cx = geo.x + BADGE_CENTER_X_OFFSET`, `cy = geo.y + headerHeight / 2`.
 */
function renderBadge(geo: ClassifierGeo, theme: Theme): string {
  const headerH = geo.dividerYs[0] ?? 28;
  const badgeX = geo.x + BADGE_CENTER_X_OFFSET;
  const badgeY = geo.y + headerH / 2;
  return (
    ellipse(badgeX, badgeY, BADGE_RADIUS, BADGE_RADIUS, {
      fill: badgeFill(geo.kind), stroke: theme.colors.border, strokeWidth: 1,
    }) +
    // `style.value(PName.FontColor)` on the spot style signature -- black in
    // every non-monochrome theme sampled (`plans/g2-class-svg/ledger.md`
    // N3); monochrome-reverse flips this to white, a separate, smaller,
    // unfixed divergence (that theme already diverges more broadly).
    `<path d="${badgeGlyphPath(geo.kind, badgeX, badgeY)}" fill="#000000"/>`
  );
}

/**
 * Map-only: the column-B vertical divider per non-linked data row
 * (TextBlockMap#drawU's per-row `ULine.vline`). Row/column geometry is
 * reconstructed from rows[]/dividerYs alone (no ClassifierGeo schema change
 * — see class-object-map-sizing.ts#buildMapRowGeo for why): every data row
 * contributes exactly two rows[] entries (key, value) after the header
 * entries (those with y below dividerYs[0]); a linked row's value entry has
 * empty text and is skipped (upstream never draws that cell either).
 *
 * NOT used for `json` — a json entries area can nest arbitrarily deep, so it
 * does not fit the "exactly two rows[] entries per data row" invariant this
 * relies on; see class-json-sizing.ts's file doc for the documented
 * rendering simplification (row/column TEXT is exact at every depth, only
 * the vertical divider lines are omitted).
 */
function renderMapColumnDividers(geo: ClassifierGeo, theme: Theme): string {
  if (geo.kind !== 'map' || geo.dividerYs.length === 0) return '';
  const dataRows = geo.rows.filter((r) => r.y >= geo.dividerYs[0]!);
  const parts: string[] = [];
  for (let i = 0; i < geo.dividerYs.length; i++) {
    const value = dataRows[2 * i + 1];
    if (value === undefined || value.text === '') continue; // linked/point row
    const top = geo.dividerYs[i]!;
    const bottom = geo.dividerYs[i + 1] ?? geo.height;
    const dividerX = geo.x + value.indent - MAP_CELL_MARGIN_X;
    parts.push(line(dividerX, geo.y + top, dividerX, geo.y + bottom, { stroke: theme.colors.border }));
  }
  return parts.join('');
}

/** Descriptive elements (database/component/actor/usecase) draw their USymbol
 *  icon instead of the class box; usecase carries no usymbol (its kind is
 *  enough). Returns undefined when this classifier has no icon to draw (the
 *  normal box path below applies) or the icon renderer declines. Split out of
 *  renderClassifier purely to keep that function's own NLOC/CCN under cap. */
function tryRenderUSymbol(geo: ClassifierGeo, theme: Theme): string | undefined {
  const usymbol = geo.kind === 'usecase' ? 'usecase' : geo.usymbol;
  if (usymbol === undefined) return undefined;
  const display = geo.rows[0]?.text ?? geo.id;
  return renderUSymbolIcon(usymbol, { ...geo, display }, theme);
}

/** The plain name+members/rows box (every classifier kind not handled by
 *  {@link tryRenderUSymbol}). Split out of renderClassifier for the same
 *  NLOC/CCN reason. */
function renderClassifierBox(geo: ClassifierGeo, theme: Theme): string {
  const parts: string[] = [
    // `URectangle.build(...).rounded(roundCorner)` -- `PName.RoundCorner`
    // default 2.5 (`EntityImageClass.java`'s own `roundCorner` field);
    // border stroke-width 0.5, not 1 (`getStyle().getStroke(...)`,
    // jar-verified across 3+ fixtures — `plans/g2-class-svg/ledger.md` N3).
    rect(geo.x, geo.y, geo.width, geo.height, {
      fill: classifierFill(geo, theme), stroke: theme.colors.border, strokeWidth: 0.5,
      rx: 2.5, ry: 2.5,
    }),
  ];
  // Draw order matters (positional comparator): jar draws rect, THEN the
  // badge (if any), THEN the header name, THEN the compartment dividers,
  // THEN member rows (`EntityImageClass#drawInternal` draws the rect+badge
  // via `header.drawU` before `body.drawU` draws the member area) —
  // verified byte-for-byte on 3+ fixtures, `plans/g2-class-svg/ledger.md` N3.
  if (geo.hideCircle !== true && hasBadge(geo.kind)) parts.push(renderBadge(geo, theme));
  const [headerRow, ...memberRows] = geo.rows;
  if (headerRow !== undefined && headerRow.text !== '') parts.push(renderRow(geo, headerRow, theme));
  // Divider lines are inset 1px from the rect's left/right edges (jar:
  // `x1="8"`..`x2="98.0469"` against a `x="7"`..`width="92.0469"` rect —
  // verified on 3+ fixtures, `plans/g2-class-svg/ledger.md` N3).
  for (const divY of geo.dividerYs)
    parts.push(
      line(geo.x + 1, geo.y + divY, geo.x + geo.width - 1, geo.y + divY, { stroke: theme.colors.border }),
    );
  parts.push(renderMapColumnDividers(geo, theme));
  // A map's linked-row value entry carries empty text (see
  // renderMapColumnDividers doc) — upstream never draws that cell.
  for (const row of memberRows) if (row.text !== '') parts.push(renderRow(geo, row, theme));
  return parts.join('');
}

function renderClassifier(geo: ClassifierGeo, theme: Theme): string {
  const icon = tryRenderUSymbol(geo, theme);
  if (icon !== undefined) return icon;
  return renderClassifierBox(geo, theme);
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

/**
 * G2 N1 (mechanism 2 part C): arrowheads are drawn as inline
 * polygons/paths (`renderer-arrowhead.ts#buildEdgeArrowheads`), matching
 * jar's class-diagram corpus (zero `<marker>`/`markerEnd` anywhere,
 * `plans/g2-class-svg/ledger.md` N0) -- the old `targetMarker`/
 * `sourceMarker` (`url(#...)` SVG-`<marker>`-reference) functions are
 * removed, not just unused, since `svgRoot`'s automatic `ALL_ARROW_TYPES`
 * marker-def injection no longer runs for class at all (`renderClass`
 * bypasses `svgRoot` entirely via `classShell` -- `assembleClassShell`
 * emits an empty `<defs/>`, matching jar).
 *
 * Returns `extraDefs` alongside `body` so `renderClass` can thread any
 * non-empty extremity `<defs>` payload (gradients -- see
 * `buildEdgeArrowheads`'s own doc comment) into the fragment's overall
 * `extraDefs`, the same role `svgRoot`'s `extraDefs` param used to serve.
 */
function renderEdge(geo: EdgeGeo, theme: Theme): { body: string; extraDefs: string } {
  const parts: string[] = [];
  const d = buildPathData(geo.points);
  if (d !== '') {
    parts.push(
      path(d, {
        stroke: theme.colors.arrow, strokeWidth: 1.5,
        ...(geo.dashed ? { strokeDasharray: '5 5' } : {}),
      }),
    );
  }
  const arrowheads = buildEdgeArrowheads(geo, theme.colors.arrow, theme.colors.background);
  parts.push(arrowheads.tail, arrowheads.head);
  if (geo.label !== undefined) {
    parts.push(
      text(geo.label.x, geo.label.y, geo.label.text, {
        fill: theme.colors.graph.edgeLabel, fontSize: theme.fontSize - 2,
        textAnchor: 'start', dominantBaseline: 'middle',
      }),
    );
  }
  return { body: parts.join(''), extraDefs: arrowheads.extraDefs };
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
 * G2 N1 (mechanism 2, "SVG root shell"): no longer draws its own
 * background `<rect>` -- jar's class SVGs fold the background into the
 * root `<svg style="...background:...;">` attribute (`renderer-
 * shell.ts#assembleClassShell`), never a body-level shape (grep-verified,
 * `plans/g2-class-svg/ledger.md` N0 -- the jar sample's content `<g>`
 * starts directly at the first cluster/classifier, no leading `<rect>`).
 * `background` still travels on the returned fragment so the shell
 * assembler's `style` attribute picks up the theme's real color.
 *
 * @param geo   - Pre-computed geometry from layoutClass().
 * @param theme - Visual theme.
 * @returns     RenderFragment carrying `classShell: true` (routes through
 *              `assembleClassShell`, never the generic `svgRoot`).
 */
export function renderClass(geo: ClassGeometry, theme: Theme): RenderFragment {
  const children: string[] = [];
  let extraDefs = '';
  // G2 N2 (mechanism 3): every drawn element gets an `ent%04d`/`lnk%d`
  // uid + `<g class="entity"/"cluster"/"link">` wrapper -- see
  // `renderer-uid.ts#buildClassUidPlan`/`renderer-group.ts`'s own doc
  // comments for the scheme and its exact/fallback gate.
  const uidPlan = buildClassUidPlan(geo);

  // 1. Namespace boxes (behind classifiers)
  for (const ns of geo.namespaces) {
    const uid = uidPlan.namespaceUid.get(ns.id) ?? '';
    children.push(wrapCluster(ns.label, uid, ns.id, renderNamespace(ns, theme)));
  }

  // 2. Classifier boxes
  for (const classifier of geo.classifiers) {
    const uid = uidPlan.classifierUid.get(classifier.id) ?? '';
    children.push(wrapEntity(leafPortion(classifier.id), uid, classifier.id, true, renderClassifier(classifier, theme)));
  }

  // 3. Edges
  geo.edges.forEach((edge, i) => {
    const rendered = renderEdge(edge, theme);
    extraDefs += rendered.extraDefs;
    children.push(
      wrapLink(
        {
          from: edge.from,
          to: edge.to,
          uid: uidPlan.edgeUid[i] ?? '',
          fromUid: uidPlan.resolveEntityUid(edge.from),
          toUid: uidPlan.resolveEntityUid(edge.to),
          decor1: decorName(edge.targetDecor),
          decor2: decorName(edge.sourceDecor),
        },
        rendered.body,
      ),
    );
  });

  // 4. Notes (folded boxes + dashed connectors), drawn on top. Upstream
  // never comments a note's group (`EntityImageNote.java` -- see
  // `renderer-group.ts#wrapEntity`'s own doc comment).
  for (const note of geo.notes) {
    const uid = uidPlan.noteUid.get(note.id) ?? '';
    children.push(wrapEntity(note.id, uid, note.id, false, renderNote(note, theme)));
  }

  return {
    body: children.join(''),
    width: geo.totalWidth,
    height: geo.totalHeight,
    background: theme.colors.background,
    ...(extraDefs.length > 0 ? { extraDefs } : {}),
    classShell: true,
  };
}
