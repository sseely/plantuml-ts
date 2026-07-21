/**
 * State-diagram note materialization + rendering (mission G4 S10 — "notes
 * never render", the largest remaining zero-diff family named in S9's own
 * queue).
 *
 * Notes materialize as `StateNodeGeo` entries (`kind: 'note'`) sharing the
 * SAME creation-index sort/uid/ink-shift machinery every other state node
 * already uses (`state-geo-types.ts#StateNodeGeo`'s own `noteLines`/
 * `noteOpale` doc comments) rather than a parallel array + a separate
 * document-order mechanism the class engine's own `NoteGeo[]` needs — this
 * mission's `creationIndex` threading (S7) is exact enough that folding
 * notes into the SAME array + the SAME `sortSpecsByCreationIndex` walk
 * reproduces jar's real interleaved document order for free, and the
 * generic `shiftStateNode`/`buildStateUidPlan` walks (layout.ts,
 * renderer-uid.ts) need ZERO note-specific changes as a result.
 *
 * Two shapes only (jar-verified `labono-83-nega255`/`xodazu-26-cube992`/
 * `gedude-95-subi666`, byte-exact `<path d="...">` derivation against each
 * fixture's own raw SVG):
 *  - A FREESTANDING note (no host) draws jar's `EntityImageNote#drawNormal`
 *    shape — a plain folded-corner `<path>` box, ASYMMETRIC stroke-width
 *    (0.5 on the main outline, 1 — `UStroke`'s bare default — on the fold
 *    triangle): `drawNormal` strokes only the main polygon draw call
 *    (`stroked.draw(polygon)`), the corner draw (`ug.draw(getCorner(...))`)
 *    reuses the UN-stroked `ug`.
 *  - An ATTACHED note (`of X` / implicit-position) ALWAYS resolves to jar's
 *    Opale zigzag-notch MERGED shape (`EntityImageNote#drawU`'s
 *    `opaleLine`/`isOpale()` branch) — state's note-to-host connector edge
 *    always routes through this merge in every sampled fixture (no
 *    plain-box-plus-separate-dashed-line case reachable from this corpus,
 *    unlike class's own richer note taxonomy with namespace/member-tip
 *    targets). Both outline+corner draw with the SAME stroke-width (0.5) in
 *    this branch (`Opale.drawU` strokes both with one shared `ug`, unlike
 *    `drawNormal`'s asymmetric split above).
 *
 * Reuses `../class/note-opale.ts`'s pure geometry functions
 * (`opalePolygonLeft/Right/Up/Down`/`opaleCorner`/`resolveOpaleConnector`) —
 * diagram-agnostic byte-exact ports of `Opale.java`, the SAME upstream
 * mechanism regardless of diagram type (see that module's own doc comment;
 * `state-render-colors.ts` already establishes the precedent of importing
 * from `../class/` for shared, diagram-agnostic geometry/color helpers).
 *
 * NOT built this iteration (queued in full, `plans/g4-state-svg/ledger.md`
 * S10): `note ... on link` (embedded in the transition's OWN `<g
 * class="link">`, no host `<g class="entity">` at all — a THIRD,
 * structurally different shape, jar-verified `vateco-92-pece508`); creole
 * markup / table content inside a note body (`fatupo-62-bemu777`); `#color`
 * overrides on notes (the grammar's own `NOTE_COLOR` capture group is
 * non-capturing today, `state-notes.ts`'s own doc comment); the composite
 * pipeline's own note materialization (`state-composite-pass.ts` never
 * calls into this module yet — every target fixture this iteration is
 * FLAT, `layout.ts#hasAnyComposite` false for all three).
 */
import type { StateDiagramAST, StateNote } from './ast.js';
import type { StateNodeGeo } from './state-geo-types.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import type { DotLayoutResult } from '../../core/graph-layout.types.js';
import { path, text as svgText } from '../../core/svg.js';
import { javaRound4 } from '../../core/number-format.js';
import { measureNote } from './state-note-layout.js';
import { resolveStateFill, textAscent } from './state-render-colors.js';
import {
  opalePolygonLeft,
  opalePolygonRight,
  opalePolygonUp,
  opalePolygonDown,
  opaleCorner,
  resolveOpaleConnector,
} from '../class/note-opale.js';

// ---------------------------------------------------------------------------
// Constants — Opale.java's real jar values (see module doc comment for the
// jar-verified derivation against labono-83-nega255/gedude-95-subi666).
// ---------------------------------------------------------------------------

const NOTE_FONT_SIZE = 13;
const NOTE_MARGIN_X1 = 6;
const NOTE_MARGIN_Y = 5;
/** `Opale.java`'s `cornersize` — the folded-corner triangle size, SAME
 *  constant `../class/note-opale.ts#OPALE_CORNER_SIZE` already uses. */
const NOTE_FOLD = 10;
/** `ColorParam.noteBackground`'s plantuml.skin default — the fallback when
 *  a note has no `#color` override (mission G4 S12: resolved via
 *  `resolveStateFill`, the SAME fill-only override precedent
 *  `state-render-colors.ts` already establishes for state boxes/
 *  pseudostates — `<style>`-bucket override support remains out of scope,
 *  module doc comment). */
const NOTE_FILL = '#FEFFDD';
const NOTE_STROKE_WIDTH = 0.5;
/** `UStroke`'s bare default width — `drawNormal`'s UN-stroked corner draw
 *  call (module doc comment's freestanding-shape derivation). */
const NOTE_CORNER_DEFAULT_STROKE_WIDTH = 1;

// ---------------------------------------------------------------------------
// Geo materialization (post-DOT-layout)
// ---------------------------------------------------------------------------

type DotNode = DotLayoutResult['nodes'][number];
type DotEdge = DotLayoutResult['edges'][number];

/** Resolve an attached note's Opale notch direction/anchors from its own
 *  routed connector-edge spline (`state-note-layout.ts#buildNoteGraphPartsByScope`
 *  already contributes a `__noteedge_<id>` DOT edge for every singleton
 *  attached-note group — `mergeKey`'s own doc comment; this mission's target
 *  fixtures never exercise a MULTI-member group, so `group.id === note.id`
 *  always holds here). `undefined` when the connector edge never resolved
 *  (freestanding note, or an edge id genuinely absent from this pass's own
 *  result set) — the caller falls back to the plain folded-corner box. */
function resolveNoteOpale(
  note: StateNote,
  pos: Pick<DotNode, 'x' | 'y' | 'width' | 'height'>,
  edgePosMap: ReadonlyMap<string, DotEdge>,
): StateNodeGeo['noteOpale'] {
  if (note.target === undefined) return undefined;
  const edge = edgePosMap.get(`__noteedge_${note.id}`);
  if (edge === undefined) return undefined;
  return resolveOpaleConnector({ width: pos.width, height: pos.height }, { x: pos.x, y: pos.y }, edge.points);
}

/** Parameter bundle for {@link buildFlatNoteGeos} — collapsed from 5
 *  positional args into one object to stay inside this project's
 *  per-function param-count budget (mirrors `renderer-group.ts
 *  #WrapLinkInfo`'s own precedent). */
export interface FlatNoteGeoCtx {
  readonly posMap: ReadonlyMap<string, DotNode>;
  readonly edgePosMap: ReadonlyMap<string, DotEdge>;
  readonly theme: Theme;
  readonly measurer: StringMeasurer;
}

/** One note -> a renderable `StateNodeGeo`, or `undefined` when it has no
 *  own DOT-layout position (composite-scoped notes this iteration, or a
 *  genuinely orphaned note — see {@link buildFlatNoteGeos}'s own doc
 *  comment). Split out purely to keep {@link buildFlatNoteGeos} under this
 *  project's per-function NLOC cap. */
function buildOneNoteGeo(note: StateNote, ctx: FlatNoteGeoCtx): StateNodeGeo | undefined {
  const pos = ctx.posMap.get(note.id);
  if (pos === undefined) return undefined;
  const m = measureNote(note.text, ctx.theme, ctx.measurer);
  const opale = resolveNoteOpale(note, pos, ctx.edgePosMap);
  return {
    id: note.id,
    kind: 'note',
    display: '',
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    children: [],
    transitions: [],
    noteLines: m.lines,
    ...(opale !== undefined ? { noteOpale: opale } : {}),
    ...(note.creationIndex !== undefined ? { creationIndex: note.creationIndex } : {}),
    ...(note.color !== undefined ? { color: note.color } : {}),
  };
}

/**
 * Map the diagram's OWN top-level notes (`StateNote.scopeId === ''`) into
 * renderable `StateNodeGeo` entries — the flat pipeline's own note
 * materialization (`layout.ts#buildFlatStateGeos`'s missing piece named by
 * S9's own diagnosis). A composite-scoped note (`scopeId !== ''`) is
 * skipped entirely — the composite pipeline's own materialization is a
 * separate, unbuilt piece this iteration (module doc comment).
 */
export function buildFlatNoteGeos(ast: StateDiagramAST, ctx: FlatNoteGeoCtx): StateNodeGeo[] {
  const geos: StateNodeGeo[] = [];
  for (const note of ast.notes ?? []) {
    if (note.scopeId !== '') continue;
    const geo = buildOneNoteGeo(note, ctx);
    if (geo !== undefined) geos.push(geo);
  }
  return geos;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Note body text, one `<text>` per line, LEFT-anchored — mirrors
 *  `../class/renderer-note.ts#renderNoteText`'s plain (no creole atoms)
 *  fallback shape; no target fixture this iteration carries inline markup
 *  in a note body (module doc comment). */
function renderNoteTextLines(node: StateNodeGeo, theme: Theme): string {
  const lines = node.noteLines ?? [];
  const parts: string[] = [];
  let lineTop = node.y + NOTE_MARGIN_Y;
  for (const ln of lines) {
    const y = lineTop + textAscent(NOTE_FONT_SIZE);
    parts.push(
      svgText(node.x + NOTE_MARGIN_X1, y, ln.text, {
        fontFamily: theme.fontFamily,
        fontSize: NOTE_FONT_SIZE,
        fill: '#000000',
        lengthAdjust: 'spacing',
        textLength: javaRound4(ln.width),
      }),
    );
    lineTop += NOTE_FONT_SIZE;
  }
  return parts.join('');
}

/** Freestanding note: `Opale.getPolygonNormal`/`getCorner` at `roundCorner
 *  === 0` (module doc comment's `drawNormal` derivation) — a plain
 *  rectangle-with-cut-corner `<path>` PLUS a separate filled corner
 *  triangle `<path>`, asymmetric stroke-width. */
export function renderStateNoteFreestanding(node: StateNodeGeo, theme: Theme): string {
  const { x, y, width: w, height: h } = node;
  const c = NOTE_FOLD;
  const fill = resolveStateFill(node, NOTE_FILL);
  const outline = `M${x},${y} L${x},${y + h} L${x + w},${y + h} L${x + w},${y + c} L${x + w - c},${y} L${x},${y}`;
  const corner = `M${x + w - c},${y} L${x + w - c},${y + c} L${x + w},${y + c} L${x + w - c},${y}`;
  return (
    path(outline, { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }) +
    path(corner, { fill, stroke: theme.colors.border, strokeWidth: NOTE_CORNER_DEFAULT_STROKE_WIDTH }) +
    renderNoteTextLines(node, theme)
  );
}

const OPALE_OUTLINE_FN = {
  left: opalePolygonLeft,
  right: opalePolygonRight,
  up: opalePolygonUp,
  down: opalePolygonDown,
} as const;

/** Attached note, resolved to a real host connector: `Opale.drawU`'s
 *  merged zigzag-notch shape (module doc comment) — SAME stroke-width on
 *  both the outline and corner `<path>`s, unlike the freestanding shape
 *  above. */
export function renderStateNoteOpale(node: StateNodeGeo, theme: Theme): string {
  const opale = node.noteOpale!;
  const box = { origin: { x: node.x, y: node.y }, width: node.width, height: node.height };
  const connector = { pp1: opale.pp1, pp2: opale.pp2 };
  const outline = OPALE_OUTLINE_FN[opale.direction](box, connector);
  const corner = opaleCorner({ x: node.x, y: node.y }, node.width);
  const fill = resolveStateFill(node, NOTE_FILL);
  return (
    path(outline, { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }) +
    path(corner, { fill, stroke: theme.colors.border, strokeWidth: NOTE_STROKE_WIDTH }) +
    renderNoteTextLines(node, theme)
  );
}

/** Dispatch by shape — {@link StateNodeGeo.noteOpale} present ⇒ the merged
 *  notch (attached, resolved host); absent ⇒ the plain folded-corner box
 *  (freestanding, or an attached note whose connector never resolved). */
export function renderStateNote(node: StateNodeGeo, theme: Theme): string {
  return node.noteOpale !== undefined ? renderStateNoteOpale(node, theme) : renderStateNoteFreestanding(node, theme);
}
