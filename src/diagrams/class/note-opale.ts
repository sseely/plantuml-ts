/**
 * Opale zigzag-notch note geometry + the fuzzy member-line matcher --
 * G2/N13 (note-of-member connector family).
 *
 * Upstream draws a `note <left|right> of Class::member` tip as a SINGLE
 * folded-corner box whose outline has a zigzag notch cut directly into it,
 * pointing at the target member row -- no separate connector line, no
 * `<g class="entity">` wrapper (`svek/image/EntityImageTips.java#drawU` +
 * `svek/image/Opale.java#getPolygonLeft/Right`). This module ports the pure
 * geometry (`opalePolygonLeft`/`opalePolygonRight`/`opaleCorner`, byte-exact
 * against the jar with `roundCorner` fixed at 0 -- no fixture in this
 * mission's target set combines a member-tip note with `skinparam
 * roundcorner`, see the module's own scope note below) and the fuzzy
 * substring matcher (`cucadiagram/BodierAbstract.java#getBestMatch`/
 * `matchScore`) used to resolve `::member` against a classifier's own
 * rendered row text.
 *
 * `getPolygonUp`/`getPolygonDown` (used only by the GENERAL "opalisable
 * single-link note" mechanism, `svek/image/EntityImageNote.java` --
 * ledgered, not built this iteration) and nonzero `roundCorner` support are
 * deliberately NOT ported here -- `EntityImageTips.getPosition()` only ever
 * emits `Position.LEFT`/`RIGHT` (grammar-enforced,
 * `command/note/CommandFactoryTipOnEntity.java`'s regex accepts only
 * `(right|left)`), so a member-tip note never needs the other two
 * directions.
 */

// ---------------------------------------------------------------------------
// Opale outline/corner geometry
// ---------------------------------------------------------------------------

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
