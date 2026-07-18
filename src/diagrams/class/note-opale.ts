/**
 * Opale zigzag-notch note geometry + the fuzzy member-line matcher --
 * G2/N13 (note-of-member connector family) + G2/N14 (general "opalisable"
 * single-link note, `EntityImageNote.java`).
 *
 * Upstream draws a `note <left|right> of Class::member` tip AND a general
 * single-link `note <pos> of X` / freestanding note as the SAME shape: a
 * SINGLE folded-corner box whose outline has a zigzag notch cut directly
 * into it, pointing at the target -- no separate connector line
 * (`svek/image/EntityImageTips.java#drawU` and
 * `svek/image/EntityImageNote.java#drawU`'s `opaleLine` branch both draw via
 * `svek/image/Opale.java#getPolygonLeft/Right/Up/Down`). This module ports
 * the pure geometry (`opalePolygonLeft`/`Right`/`Up`/`Down`/`opaleCorner`/
 * `getOpaleStrategy`, byte-exact against the jar with `roundCorner` fixed at
 * 0 -- no fixture in this mission's target set combines an opalisable note
 * with `skinparam roundcorner`) and the fuzzy substring matcher
 * (`cucadiagram/BodierAbstract.java#getBestMatch`/`matchScore`) used to
 * resolve a member-tip's `::member` against a classifier's own rendered row
 * text.
 *
 * `getPolygonUp`/`getPolygonDown` are needed ONLY by the general mechanism
 * (`note-layout.ts`'s non-tip `opale` resolution) -- a member-tip note's own
 * grammar (`EntityImageTips.getPosition()`) only ever emits `Position.LEFT`/
 * `RIGHT` (`command/note/CommandFactoryTipOnEntity.java`'s regex accepts
 * only `(right|left)`), so `renderTipNote` never calls the UP/DOWN variants.
 */

// ---------------------------------------------------------------------------
// Opale outline/corner geometry
// ---------------------------------------------------------------------------

import type { NoteGeo } from './note-layout.js';
import type { MemberRenderAtom } from './class-member-creole.js';

export interface OpalePoint {
  x: number;
  y: number;
}

/** The note's own absolute position + size -- this renderer draws absolute
 *  coordinates directly (no `<g transform>` wrapper, matches every other
 *  class-diagram shape), so every emitted path coordinate is `origin` plus
 *  a LOCAL (0,0-at-top-left) offset. */
export interface OpaleBox {
  origin: OpalePoint;
  width: number;
  height: number;
}

/** The notch's two anchor points, LOCAL to the note's own (0,0)-at-top-left
 *  frame -- `pp1` sits on the note's own edge (only its component along the
 *  notch-bearing edge matters); `pp2` is the notch tip, pointing at the
 *  target. */
export interface OpaleConnector {
  pp1: OpalePoint;
  pp2: OpalePoint;
}

/** `Opale.java`'s `cornersize` constant -- the folded-corner triangle size. */
const OPALE_CORNER_SIZE = 10;
/** `Opale.java`'s `delta` constant -- the zigzag notch's half-depth along
 *  the box edge the notch is cut into. */
const OPALE_DELTA = 4;

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Zigzag-notch outline, notch cut into the LEFT edge (`direction ===
 * 'left'`, upstream `Direction.LEFT`) -- byte-exact port of
 * `Opale.java#getPolygonLeft` with `roundCorner` fixed at 0. `roundCorner
 * === 0` still emits degenerate `A0,0 0 0 0 x,y` arc commands (NOT
 * simplified to `L`) at every `arcTo` call site -- jar-verified byte-for-
 * byte against `cajicu-52-cego765`/`tenobo-24-liga464`: a zero-radius arc
 * renders identically to a straight line per the SVG spec, but the emitted
 * PATH TEXT differs (`A0,0...` vs `L...`), and this mission's conformance
 * bar is byte/structural, not merely visual.
 * @see ~/git/plantuml/.../svek/image/Opale.java#getPolygonLeft
 */
export function opalePolygonLeft(box: OpaleBox, connector: OpaleConnector): string {
  const { origin, width, height } = box;
  const { pp1, pp2 } = connector;
  const y1 = clamp(pp1.y - OPALE_DELTA, 0, height - 2 * OPALE_DELTA);
  const c = OPALE_CORNER_SIZE;
  const ox = origin.x;
  const oy = origin.y;
  return [
    `M${ox},${oy}`,
    `L${ox},${oy + y1}`,
    `L${ox + pp2.x},${oy + pp2.y}`,
    `L${ox},${oy + y1 + 2 * OPALE_DELTA}`,
    `L${ox},${oy + height}`,
    `A0,0 0 0 0 ${ox},${oy + height}`,
    `L${ox + width},${oy + height}`,
    `A0,0 0 0 0 ${ox + width},${oy + height}`,
    `L${ox + width},${oy + c}`,
    `L${ox + width - c},${oy}`,
    `L${ox},${oy}`,
    `A0,0 0 0 0 ${ox},${oy}`,
  ].join(' ');
}

/**
 * Zigzag-notch outline, notch cut into the RIGHT edge (`direction ===
 * 'right'`, upstream `Direction.RIGHT`) -- byte-exact port of
 * `Opale.java#getPolygonRight`, same `roundCorner === 0` semantics as
 * {@link opalePolygonLeft}.
 * @see ~/git/plantuml/.../svek/image/Opale.java#getPolygonRight
 */
export function opalePolygonRight(box: OpaleBox, connector: OpaleConnector): string {
  const { origin, width, height } = box;
  const { pp1, pp2 } = connector;
  const y1 = clamp(pp1.y - OPALE_DELTA, OPALE_CORNER_SIZE, height - 2 * OPALE_DELTA);
  const c = OPALE_CORNER_SIZE;
  const ox = origin.x;
  const oy = origin.y;
  return [
    `M${ox},${oy}`,
    `L${ox},${oy + height}`,
    `A0,0 0 0 0 ${ox},${oy + height}`,
    `L${ox + width},${oy + height}`,
    `A0,0 0 0 0 ${ox + width},${oy + height}`,
    `L${ox + width},${oy + y1 + 2 * OPALE_DELTA}`,
    `L${ox + pp2.x},${oy + pp2.y}`,
    `L${ox + width},${oy + y1}`,
    `L${ox + width},${oy + c}`,
    `L${ox + width - c},${oy}`,
    `L${ox},${oy}`,
    `A0,0 0 0 0 ${ox},${oy}`,
  ].join(' ');
}

/**
 * The folded-corner triangle drawn OVER the outline, always, regardless of
 * notch direction -- `Opale.java#getCorner`, `roundCorner` fixed at 0.
 * @see ~/git/plantuml/.../svek/image/Opale.java#getCorner
 */
export function opaleCorner(origin: OpalePoint, width: number): string {
  const c = OPALE_CORNER_SIZE;
  const ox = origin.x;
  const oy = origin.y;
  return [
    `M${ox + width - c},${oy}`,
    `L${ox + width - c},${oy + c}`,
    `L${ox + width},${oy + c}`,
    `L${ox + width - c},${oy}`,
  ].join(' ');
}

/**
 * Zigzag-notch outline, notch cut into the TOP edge (`direction === 'up'`,
 * upstream `Direction.UP`) -- byte-exact port of `Opale.java#getPolygonUp`
 * with `roundCorner` fixed at 0. Used ONLY by the general opalisable-note
 * mechanism (G2/N14) -- a member-tip note's grammar never reaches this
 * direction, see this module's own doc comment.
 * @see ~/git/plantuml/.../svek/image/Opale.java#getPolygonUp
 */
export function opalePolygonUp(box: OpaleBox, connector: OpaleConnector): string {
  const { origin, width, height } = box;
  const { pp1, pp2 } = connector;
  const x1 = clamp(pp1.x - OPALE_DELTA, 0, width - OPALE_CORNER_SIZE);
  const c = OPALE_CORNER_SIZE;
  const ox = origin.x;
  const oy = origin.y;
  return [
    `M${ox},${oy}`,
    `L${ox},${oy + height}`,
    `A0,0 0 0 0 ${ox},${oy + height}`,
    `L${ox + width},${oy + height}`,
    `A0,0 0 0 0 ${ox + width},${oy + height}`,
    `L${ox + width},${oy + c}`,
    `L${ox + width - c},${oy}`,
    `L${ox + x1 + 2 * OPALE_DELTA},${oy}`,
    `L${ox + pp2.x},${oy + pp2.y}`,
    `L${ox + x1},${oy}`,
    `L${ox},${oy}`,
    `A0,0 0 0 0 ${ox},${oy}`,
  ].join(' ');
}

/**
 * Zigzag-notch outline, notch cut into the BOTTOM edge (`direction ===
 * 'down'`, upstream `Direction.DOWN`) -- byte-exact port of
 * `Opale.java#getPolygonDown`, same `roundCorner === 0` semantics as
 * {@link opalePolygonUp}.
 * @see ~/git/plantuml/.../svek/image/Opale.java#getPolygonDown
 */
export function opalePolygonDown(box: OpaleBox, connector: OpaleConnector): string {
  const { origin, width, height } = box;
  const { pp1, pp2 } = connector;
  const x1 = clamp(pp1.x - OPALE_DELTA, 0, width);
  const c = OPALE_CORNER_SIZE;
  const ox = origin.x;
  const oy = origin.y;
  return [
    `M${ox},${oy}`,
    `L${ox},${oy + height}`,
    `A0,0 0 0 0 ${ox},${oy + height}`,
    `L${ox + x1},${oy + height}`,
    `L${ox + pp2.x},${oy + pp2.y}`,
    `L${ox + x1 + 2 * OPALE_DELTA},${oy + height}`,
    `L${ox + width},${oy + height}`,
    `A0,0 0 0 0 ${ox + width},${oy + height}`,
    `L${ox + width},${oy + c}`,
    `L${ox + width - c},${oy}`,
    `L${ox},${oy}`,
    `A0,0 0 0 0 ${ox},${oy}`,
  ].join(' ');
}

/** The four notch directions the general opalisable-note mechanism can pick
 *  (member-tips are LEFT/RIGHT only, see this module's own doc comment). */
export type OpaleDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Orthogonal (single-axis) distance from `pt` to a box edge given as two
 * endpoints -- `EntityImageNote.java#getOrthoDistance`: a horizontal edge
 * (`p1.y === p2.y`) measures only the y-gap, a vertical edge only the x-gap.
 * @see ~/git/plantuml/.../svek/image/EntityImageNote.java#getOrthoDistance
 */
function orthoDistance(p1: OpalePoint, p2: OpalePoint, pt: OpalePoint): number {
  if (p1.y === p2.y) return Math.abs(p1.y - pt.y);
  return Math.abs(p1.x - pt.x);
}

/**
 * Pick which of the note box's four edges `pt` (the connector's near-side
 * anchor, LOCAL to the note's own frame) is closest to -- byte-exact port of
 * `EntityImageNote.java#getOpaleStrategy`. Tie-break order matters: LEFT
 * wins over RIGHT/UP/DOWN, then RIGHT over UP/DOWN, then UP over DOWN
 * (upstream's own if/else-if chain, reproduced verbatim rather than a
 * generic min-of-4 to preserve its exact tie-breaking).
 * @see ~/git/plantuml/.../svek/image/EntityImageNote.java#getOpaleStrategy
 */
export function getOpaleStrategy(width: number, height: number, pt: OpalePoint): OpaleDirection {
  const d1 = orthoDistance({ x: width, y: 0 }, { x: width, y: height }, pt); // right edge
  const d2 = orthoDistance({ x: 0, y: height }, { x: width, y: height }, pt); // bottom edge
  const d3 = orthoDistance({ x: 0, y: 0 }, { x: 0, y: height }, pt); // left edge
  const d4 = orthoDistance({ x: 0, y: 0 }, { x: width, y: 0 }, pt); // top edge
  if (d3 <= d1 && d3 <= d2 && d3 <= d4) return 'left';
  if (d1 <= d2 && d1 <= d3 && d1 <= d4) return 'right';
  if (d4 <= d1 && d4 <= d2 && d4 <= d3) return 'up';
  return 'down';
}

/**
 * G2/N14: resolve the general "opalisable" note connector -- byte-exact port
 * of `EntityImageNote.java#drawU`'s `opaleLine` branch (the non-Smetana/dot
 * path this project's oracle uses). `rawPoints` is the routed DOT connector
 * spline in the SAME absolute coordinate space as `origin` (both come from
 * the same `DotLayoutResult`) -- localized here (`p - origin`) the same way
 * `DotPath#moveDelta(-node.getMinX(), -node.getMinY())` localizes it in
 * Java. Whichever endpoint is CLOSER to the note's own center becomes `pp1`
 * (the box-boundary anchor); the farther one becomes `pp2` (the notch tip,
 * near the host) -- `path.getStartPoint().distance(center) >
 * path.getEndPoint().distance(center)` triggers `path.reverse()` in Java,
 * which is equivalent to just picking the closer point directly. `undefined`
 * when there's no real spline to resolve (freestanding note, or a
 * degenerate single-point connector) -- caller falls back to a plain
 * folded-corner box.
 * @see ~/git/plantuml/.../svek/image/EntityImageNote.java#drawU
 */
export function resolveOpaleConnector(
  dim: { width: number; height: number },
  origin: { x: number; y: number },
  rawPoints: ReadonlyArray<{ x: number; y: number }>,
): { direction: OpaleDirection; pp1: OpalePoint; pp2: OpalePoint } | undefined {
  if (rawPoints.length < 2) return undefined;
  const first = rawPoints[0]!;
  const last = rawPoints[rawPoints.length - 1]!;
  const local = (p: { x: number; y: number }): OpalePoint => ({ x: p.x - origin.x, y: p.y - origin.y });
  const a = local(first);
  const b = local(last);
  const center: OpalePoint = { x: dim.width / 2, y: dim.height / 2 };
  const distTo = (p: OpalePoint): number => Math.hypot(p.x - center.x, p.y - center.y);
  const [pp1, pp2] = distTo(a) <= distTo(b) ? [a, b] : [b, a];
  return { direction: getOpaleStrategy(dim.width, dim.height, pp1), pp1, pp2 };
}

/**
 * A resolved general-opalisable note's geo (G2/N14), or `undefined` when
 * the connector didn't resolve (caller falls back to a plain folded-corner
 * box). Scope note: intended ONLY for a SINGLE-member group with a real
 * 2+-point connector -- whether upstream ever merges multiple non-tip
 * `note <pos> of X` statements onto one opalisable svek node (the way it
 * merges member-tips, `note-layout.ts#NoteGroup`'s own doc comment) is
 * unverified against any fixture in this mission's corpus; the caller
 * narrows to singleton groups to avoid inventing untested multi-member
 * Opale-stacking behavior. `note`/`m`/`points` are kept as plain structural
 * types (not `ClassNote`/`NoteMeasurement` by name) and the return type is
 * `import type`-only `NoteGeo` -- both erased at compile time
 * (`verbatimModuleSyntax`), so this module can build a `note-layout.ts`
 * shape without a runtime import cycle (that module already imports FROM
 * this one).
 */
export function buildOpaleNoteGeo(
  note: { id: string; creationIndex?: number; phantomSlot?: true; color?: string; stereotype?: string },
  // G2 N55: `lineAtoms` added, threading `NoteGeo.lineAtoms`'s own doc
  // comment through this note-shape builder too (the general-opalisable
  // branch of `mapGroupNoteGeos`'s singleton-group dispatch) -- kept as a
  // plain structural field (not `NoteMeasurement` by name) per this
  // function's own pre-existing "erased at compile time" import-cycle note
  // below.
  m: {
    width: number;
    height: number;
    lines: string[];
    lineWidths: number[];
    lineAtoms: readonly (readonly MemberRenderAtom[])[];
    lineHeights: readonly number[];
  },
  origin: { x: number; y: number },
  points: ReadonlyArray<{ x: number; y: number }>,
): NoteGeo | undefined {
  const resolved = resolveOpaleConnector({ width: m.width, height: m.height }, origin, points);
  if (resolved === undefined) return undefined;
  return {
    id: note.id, x: origin.x, y: origin.y, width: m.width, height: m.height, lines: m.lines,
    lineWidths: m.lineWidths,
    lineAtoms: m.lineAtoms,
    lineHeights: m.lineHeights,
    connector: [], opale: resolved,
    ...(note.creationIndex !== undefined ? { creationIndex: note.creationIndex } : {}),
    ...(note.phantomSlot !== undefined ? { phantomSlot: note.phantomSlot } : {}),
    ...(note.color !== undefined ? { color: note.color } : {}),
    ...(note.stereotype !== undefined ? { stereotype: note.stereotype } : {}),
  };
}

// ---------------------------------------------------------------------------
// Fuzzy member-line matcher (BodierAbstract#getBestMatch/matchScore)
// ---------------------------------------------------------------------------

const WEIGHT_BEFORE_MATCH_STEP = 1;
const WEIGHT_AFTER_SEPARATOR = 1_000;
const WEIGHT_TRAILING_LETTERS = 1_000_000;
const WEIGHT_BEFORE_MATCH_LETTER_STEP = 1_000_000_000;

function isAlphanum(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch);
}

function isOnlyLetter(ch: string): boolean {
  return /\p{L}/u.test(ch);
}

/**
 * Lower is better; `Infinity` means `candidate` does not appear as a literal
 * substring of `fullString` at all (jar: `Long.MAX_VALUE`, "never matches").
 * Byte-exact port of `BodierAbstract.java#matchScore` -- penalizes how far
 * into `fullString` the match starts (letters cost far more than
 * punctuation) and how much trailing text follows the match (alphanumeric
 * trailing text costs far more than text after the first separator).
 * @see ~/git/plantuml/.../cucadiagram/BodierAbstract.java#matchScore
 */
export function matchScore(fullString: string, candidate: string): number {
  const lenFull = fullString.length;
  const lenCand = candidate.length;
  let score = 0;
  for (let i = 0; i <= lenFull - lenCand; i++) {
    if (fullString.slice(i, i + lenCand) === candidate) {
      let separatorSeen = false;
      for (let j = i + lenCand; j < lenFull; j++) {
        const ch = fullString[j]!;
        if (!separatorSeen && isAlphanum(ch)) {
          score += WEIGHT_TRAILING_LETTERS;
        } else {
          separatorSeen = true;
          score += WEIGHT_AFTER_SEPARATOR;
        }
      }
      return score;
    }
    const ch = fullString[i]!;
    score += isOnlyLetter(ch) ? WEIGHT_BEFORE_MATCH_LETTER_STEP : WEIGHT_BEFORE_MATCH_STEP;
  }
  return Infinity;
}

/**
 * Best-scoring row whose text contains `candidate` as a literal substring,
 * or `undefined` when no row matches at all -- `getBestMatch` returning
 * `null`, which makes `EntityImageTips#drawU` abort (this iteration's
 * `mapNoteGeos` marks the note `dropped` instead of throwing, matching this
 * port's established "unresolvable note command is a silent no-op" posture,
 * `class-notes.ts#finalizePendingNote`'s own doc comment).
 * @see ~/git/plantuml/.../cucadiagram/BodierAbstract.java#getBestMatch
 */
export function getBestMatchRow<T extends { text: string }>(rows: readonly T[], candidate: string): T | undefined {
  let best: T | undefined;
  let bestScore = Infinity;
  for (const row of rows) {
    const score = matchScore(row.text, candidate);
    if (score < bestScore) {
      best = row;
      bestScore = score;
      if (bestScore === 0) break;
    }
  }
  return best;
}
