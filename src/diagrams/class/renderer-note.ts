/**
 * Note rendering — folded-corner box + dashed connector, or the Opale
 * zigzag-notch member-tip shape (G2/N13). Split out of `renderer.ts` to
 * keep that file under the project's 500-line file cap (mirrors
 * `renderer-arrowhead.ts`/`renderer-group.ts`/`renderer-uid.ts`'s own
 * "split purely for size, no behavior change" precedent).
 */
import type { NoteGeo } from './note-layout.js';
import type { EdgeGeo } from './layout.js';
import type { Theme } from '../../core/theme.js';
import { text, path, polygon } from '../../core/svg.js';
import { javaRound4 } from '../../core/number-format.js';
import {
  opalePolygonLeft,
  opalePolygonRight,
  opalePolygonUp,
  opalePolygonDown,
  opaleCorner,
  type OpaleBox,
  type OpaleConnector,
  type OpaleDirection,
} from './note-opale.js';

/**
 * Bezier-spline or polyline path data for a routed connector — the SAME
 * shape `renderer.ts#renderEdge` builds for a normal relationship edge
 * (`(points.length - 1) % 3 === 0` and `>= 4` points ⇒ well-formed cubic
 * bezier chain, else a plain polyline fallback for the degenerate 2-point
 * case). Duplicated rather than imported: `renderer.ts` itself imports this
 * module, so importing back would cycle; both copies are pure functions
 * with no shared state, kept in lockstep by doc-comment cross-reference.
 * @see renderer.ts#buildPathData
 */
function buildConnectorPathData(points: EdgeGeo['points']): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (first === undefined) return '';
  const start = `M${first.x},${first.y}`;

  const isBezierSpline = points.length >= 4 && (points.length - 1) % 3 === 0;
  if (isBezierSpline) {
    const segments: string[] = [];
    for (let i = 1; i < points.length; i += 3) {
      const c1 = points[i]!;
      const c2 = points[i + 1]!;
      const end = points[i + 2]!;
      segments.push(`C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`);
    }
    return [start, ...segments].join(' ');
  }

  const segments = rest.map((p) => `L${p.x},${p.y}`);
  return [start, ...segments].join(' ');
}

const NOTE_FILL = '#FEFFDD';
/** `Opale.java`'s `cornersize` -- the folded-corner triangle size, shared by
 *  BOTH the plain fold (this file) and the zigzag-notch tip outline
 *  (`note-opale.ts#opaleCorner`, the SAME upstream constant). */
const NOTE_FOLD = 10;
/** `Opale.java`'s `marginX1`/`marginY` -- text inset from the note box's
 *  own top-left corner (matches `note-layout.ts#measureNote`'s sizing). */
const NOTE_MARGIN_X1 = 6;
const NOTE_MARGIN_X2 = 15;
const NOTE_MARGIN_Y = 5;
/** `plantuml.skin`'s `note { FontSize 13 }` -- one point smaller than the
 *  diagram's normal text (matches `note-layout.ts#NOTE_FONT_SIZE`). */
const NOTE_FONT_SIZE = 13;
/** Ascent-from-line-top baseline offset at the note's fixed font size 13
 *  (`fontSize - descent`, `DeterministicMeasurer#getDescent` == `size/4.5`)
 *  -- precomputed since this renderer takes no measurer (pure function of
 *  `ClassGeometry + Theme`, `class-layout-helpers.ts`'s identical formula
 *  already resolved this at LAYOUT time for every other text row). */
const NOTE_BASELINE_OFFSET = NOTE_FONT_SIZE - NOTE_FONT_SIZE / 4.5;
/** `note { LineThickness 0.5 }` (`plantuml.skin`) -- both the outline/
 *  corner paths and the plain connector line. */
const NOTE_STROKE_WIDTH = 0.5;

/** Note body text, one line per row, LEFT-anchored, no creole markup
 *  (G2/N13 scope note: `textLength` uses the note's OWN max-line width for
 *  every line, not a genuine per-line measurement -- exact for the common
 *  single-line case, an accepted residual on multi-line notes, which none
 *  of this iteration's target fixtures reach zero-diff on for other,
 *  already-named reasons -- creole markup inside note text, e.g.
 *  `<color:#red>`/`**bold**`, is a separate, unbuilt gap). */
function renderNoteText(note: NoteGeo, theme: Theme): string {
  const parts: string[] = [];
  // G2/N14: javaRound4 -- `note.width - marginX1 - marginX2` round-trips
  // back to the ORIGINAL measured width mathematically, but floating-point
  // subtraction of the SAME two margin constants added earlier
  // (`measureNote`) doesn't always land on the exact bit pattern (jar-
  // verified: `fezugi-39-fujo327` emitted `46.962500000000006` vs jar's
  // `46.9625`) -- the SAME `%.4f`-then-trim rounding every other measured
  // `textLength` in this engine already applies at its emission point
  // (`class-layout-helpers.ts`'s `javaRound4(measurer.measure(...).width)`
  // precedent), just missing here.
  const textLength = javaRound4(note.width - NOTE_MARGIN_X1 - NOTE_MARGIN_X2);
  note.lines.forEach((ln, i) => {
    parts.push(
      text(
        note.x + NOTE_MARGIN_X1,
        note.y + NOTE_MARGIN_Y + i * NOTE_FONT_SIZE + NOTE_BASELINE_OFFSET,
        ln,
        {
          fontFamily: theme.fontFamily,
          fontSize: NOTE_FONT_SIZE,
          fill: '#000000',
          lengthAdjust: 'spacing',
          textLength,
        },
      ),
    );
  });
  return parts.join('');
}

/** Plain note: folded-corner box + a separate dashed connector line to its
 *  host (or no connector at all for a freestanding note) -- every note
 *  kind EXCEPT a resolved member-tip (`renderTipNote` below). */
export function renderNote(note: NoteGeo, theme: Theme): string {
  const parts: string[] = [];

  const connector = buildConnectorPathData(note.connector);
  if (connector !== '') {
    parts.push(
      path(connector, { stroke: theme.colors.arrow, strokeWidth: NOTE_STROKE_WIDTH, strokeDasharray: '4 4' }),
    );
  }

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
      { fill: NOTE_FILL, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH },
    ),
  );
  const fold = `M ${x + w - f},${y} L ${x + w - f},${y + f} L ${x + w},${y + f}`;
  parts.push(path(fold, { stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }));
  parts.push(renderNoteText(note, theme));

  return parts.join('');
}

/**
 * A resolved member-tip note (`note <left|right> of Class::member`): the
 * connector is a zigzag notch cut directly into the note's own outline
 * (`note-opale.ts`), not a separate line -- and the whole thing draws
 * UNWRAPPED (no `<g class="entity">`, no id, no comment), matching
 * `EntityImageTips`'s draw path -- upstream never routes a tip through the
 * normal per-entity `<g>`-wrapping machinery other leaf kinds get (mirrors
 * `renderAssocPoint`'s identical unwrapped precedent, G2 N8).
 * @see ~/git/plantuml/.../svek/image/EntityImageTips.java#drawU
 */
export function renderTipNote(note: NoteGeo, theme: Theme): string {
  const tip = note.tip!;
  const box: OpaleBox = { origin: { x: note.x, y: note.y }, width: note.width, height: note.height };
  const connector: OpaleConnector = { pp1: tip.pp1, pp2: tip.pp2 };
  const outline = tip.direction === 'left' ? opalePolygonLeft(box, connector) : opalePolygonRight(box, connector);
  const parts: string[] = [
    path(outline, { fill: NOTE_FILL, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
    path(opaleCorner({ x: note.x, y: note.y }, note.width), { fill: NOTE_FILL, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
  ];
  parts.push(renderNoteText(note, theme));
  return parts.join('');
}

/** Dispatch to the right `opalePolygon*` function by direction --
 *  `Opale.java#drawU`'s own `strategy` switch, shared by {@link renderTipNote}
 *  (LEFT/RIGHT only) and {@link renderOpaleNote} (all four). */
function opaleOutline(direction: OpaleDirection, box: OpaleBox, connector: OpaleConnector): string {
  switch (direction) {
    case 'left': return opalePolygonLeft(box, connector);
    case 'right': return opalePolygonRight(box, connector);
    case 'up': return opalePolygonUp(box, connector);
    case 'down': return opalePolygonDown(box, connector);
  }
}

/**
 * A RESOLVED general "opalisable" note (G2/N14, `note <pos> of X` with a
 * single non-invisible connection to a non-note entity) -- the SAME
 * zigzag-notch merged outline as a member-tip note, but WRAPPED in the
 * normal `<g class="entity">` (upstream never special-cases the wrapping
 * for this mechanism the way it does for member-tips -- `EntityImageNote`
 * draws through the ordinary per-entity `<g>` path, jar-verified:
 * `fezugi-39-fujo327`'s note is `<g class="entity" data-qualified-name=
 * "GMN2" id="ent0003" data-source-line="7">`). No separate `<g
 * class="link">` connector draws at all -- `SvekEdge#drawU`'s `if (opale)
 * return;` -- the caller must not emit one for this note's own connector
 * edge.
 * @see ~/git/plantuml/.../svek/image/EntityImageNote.java#drawU
 */
export function renderOpaleNote(note: NoteGeo, theme: Theme): string {
  const opale = note.opale!;
  const box: OpaleBox = { origin: { x: note.x, y: note.y }, width: note.width, height: note.height };
  const connector: OpaleConnector = { pp1: opale.pp1, pp2: opale.pp2 };
  const parts: string[] = [
    path(opaleOutline(opale.direction, box, connector), { fill: NOTE_FILL, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
    path(opaleCorner({ x: note.x, y: note.y }, note.width), { fill: NOTE_FILL, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }),
  ];
  parts.push(renderNoteText(note, theme));
  return parts.join('');
}
