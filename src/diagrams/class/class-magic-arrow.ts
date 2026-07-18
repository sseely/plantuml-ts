/**
 * class-magic-arrow.ts — G2 item 44: the "magic arrow" edge-label glyph
 * (`StringWithArrow.java`, `TextBlockArrow2`, `SvekEdge
 * #getArrowDirectionInRadian`). A relationship label ending in `" >"`/
 * `" <"` (or the bare `>`/`<`/`"< "`/`"> "` forms) strips the arrow
 * character and draws a small inline triangle glyph before the remaining
 * text — `svek/SvekEdge.java:59,284,297,304` (the SAME class `descdiagram`
 * uses; confirmed applicable to class diagrams via `CommandLinkClass`'s own
 * shared `Labels` construction, `classdiagram/command/CommandLinkClass
 * .java:342-366`).
 *
 * Scope: single-line labels only (`splitEdgeLabelLines(label).lines.length
 * === 1`) — jar itself only strips a top-level arrow when
 * `Display.hasSeveralGuideLines(completeLabel)` is false
 * (`StringWithArrow.java:63-65`); a multi-line label defers arrow-parsing
 * to a PER-LINE re-check inside `addSeveralMagicArrows`
 * (`StringWithArrow.java:115-127`), a genuinely separate sub-mechanism with
 * zero corpus reach in this mission's item-43/44 fixtures (no fixture
 * combines a `\n`/`\l`/`\r` line break with a magic-arrow token) —
 * unimplemented, named here rather than guessed at.
 *
 * Also scoped OUT: the self-loop (`isAutolink()`) angle formula
 * (`dotPath.getStartAngle()`, a bezier tangent, NOT the straight
 * start-to-end vector below) — `dorelu-66-lixu637`'s own reach, a separate
 * geometry primitive this port has not built (`ledger.md` item 44). The
 * general (non-autolink) formula below is jar-verified byte-exact SHAPE
 * against `lojepe-37-liri985`'s golden triangle `<polygon>`.
 */

/** `TextBlockArrow2`'s own fixed glyph box side length — `(int) (size *
 *  .80)` with `size = CARDINALITY_FONT_SIZE` (13), Java's truncating `int`
 *  cast (`Math.trunc`, equivalent to `Math.floor` for this positive
 *  input). */
export const ARROW_GLYPH_SIZE = Math.trunc(13 * 0.8);

export type MagicArrowDirection = 'forward' | 'backward';

export interface MagicArrowLabel {
  /** Remaining label text after stripping the arrow token; `undefined` for
   *  a BARE `<`/`>` label (jar's `label = null` branch — no text at all,
   *  glyph only). */
  text: string | undefined;
  direction: MagicArrowDirection;
}

/**
 * Detect and strip a magic-arrow token from a SINGLE-line label, mirroring
 * `StringWithArrow`'s constructor (`descdiagram/command/StringWithArrow
 * .java:56-91`) exactly, in the SAME check order (jar tests bare-equality
 * before the `startsWith`/`endsWith` forms). Returns `undefined` when the
 * label carries no magic-arrow token at all (jar's trailing `else` branch,
 * `linkArrow = NONE_OR_SEVERAL`).
 */
export function parseMagicArrowLabel(label: string): MagicArrowLabel | undefined {
  if (label === '<') return { text: undefined, direction: 'backward' };
  if (label === '>') return { text: undefined, direction: 'forward' };
  if (label.startsWith('< ')) return { text: label.slice(2).trim(), direction: 'backward' };
  if (label.startsWith('> ')) return { text: label.slice(2).trim(), direction: 'forward' };
  if (label.endsWith(' >')) return { text: label.slice(0, -2).trim(), direction: 'forward' };
  if (label.endsWith(' <')) return { text: label.slice(0, -2).trim(), direction: 'backward' };
  return undefined;
}

/**
 * `SvekEdge#getArrowDirectionInRadianInternal` (non-autolink branch,
 * SvekEdge.java:208-217): `Math.atan2(end.x-start.x, end.y-start.y)` over
 * the edge's OWN start/end points (a "compass" angle — 0 = straight down
 * in SVG's y-down space, NOT the usual `atan2(dy,dx)` math convention).
 * `start`/`end` are the ALREADY from-to-normalized spline endpoints
 * (`class-geo-builders.ts#normalizeEdgePoints`'s own doc comment — mirrors
 * jar's post-`solveLine` `dotPath`). BACKWARD adds `Math.PI`
 * (`getArrowDirectionInRadian`, SvekEdge.java:201-206).
 */
export function magicArrowAngle(
  points: ReadonlyArray<{ x: number; y: number }>,
  direction: MagicArrowDirection,
): number {
  const start = points[0]!;
  const end = points[points.length - 1]!;
  const internal = Math.atan2(end.x - start.x, end.y - start.y);
  return direction === 'backward' ? Math.PI + internal : internal;
}

/** `getPoint(len, alpha)` (`TextBlockArrow2.java:79-82`). */
function arrowPoint(len: number, alpha: number): { x: number; y: number } {
  return { x: len * Math.sin(alpha), y: len * Math.cos(alpha) };
}

/**
 * The 3 triangle vertices of the magic-arrow glyph, in ABSOLUTE
 * coordinates — `TextBlockArrow2#drawU` (klimt/shape/TextBlockArrow2.java:
 * 63-77), jar-verified byte-exact SHAPE against `lojepe-37-liri985`'s
 * golden `<polygon>` (tip + two back corners; relative deltas match to the
 * hundredth). `originX`/`originY` is the glyph's own `ARROW_GLYPH_SIZE`-
 * square box's top-left corner — see `class-geo-builders.ts
 * #attachEdgeLabel`'s doc comment for the block layout this glyph sits
 * within.
 */
export function magicArrowGlyphPoints(
  originX: number,
  originY: number,
  angleRadians: number,
): Array<{ x: number; y: number }> {
  const half = ARROW_GLYPH_SIZE / 2;
  const beta = (Math.PI * 4) / 5;
  const cx = originX + half;
  const cy = originY + 13 / 2;
  const tip = arrowPoint(half, angleRadians);
  const a = arrowPoint(half, angleRadians + beta);
  const b = arrowPoint(half, angleRadians - beta);
  return [
    { x: cx + tip.x, y: cy + tip.y },
    { x: cx + a.x, y: cy + a.y },
    { x: cx + b.x, y: cy + b.y },
  ];
}
