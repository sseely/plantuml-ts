/**
 * DisplayPositioned + DiagramAnnotations — the shared chrome model ported
 * from upstream `TitledDiagram`'s title/caption/legend/header/footer/
 * mainFrame fields. Mission G0b / T1 (`plans/g0b-annotations/decisions.md`
 * D1: no `DisplaySection`; the model is `DisplayPositioned` only.
 *
 * Scope reduction (T1 write-set is `src/core/annotations/` only — it must
 * NOT touch `src/core/klimt/geom/`, even though the task spec's Read-set
 * suggested extending `HorizontalAlignment`/`VerticalAlignment` there with
 * `fromString`. `HorizontalAlignment.ts`/`VerticalAlignment.ts` currently
 * export only the 3 enum values with no `fromString`; rather than touch
 * files outside this task's declared write-set (risking a write collision
 * with the two concurrent batch-1 agents), `fromString`/`fromString`-with-
 * default are ported here instead, scoped to annotation-command parsing.
 * If a later task needs the same parser for skinparam/style-block
 * alignment values, promoting these into klimt/geom is the natural next
 * step — flagged, not silently duplicated forever.
 *
 * `Display` here is `readonly string[] | null` (raw, unparsed creole
 * lines) per the T1 spec: creole parsing happens later, at draw time.
 * `null` is the `Display.NULL` sentinel (`DisplayPositioned.isNull()`).
 *
 * `DiagramAnnotations` is a mutable record (fields reassigned by the
 * setters below), mirroring `TitledDiagram`'s private mutable fields —
 * see project CLAUDE.md's Java-to-TS translation table: Java mutates in
 * place; use mutable objects and document the mutation contract. The
 * mutation contract: `matchAnnotationCommand` (commands.ts) mutates the
 * `DiagramAnnotations` object passed to it in place; callers do not need
 * (and do not get) a returned copy.
 *
 * @see ~/git/plantuml/.../abel/DisplayPositioned.java
 * @see ~/git/plantuml/.../TitledDiagram.java:81-232
 */

import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../klimt/geom/VerticalAlignment.js';

// ---------------------------------------------------------------------------
// DisplayPositioned
// ---------------------------------------------------------------------------

/** @see ~/git/plantuml/.../abel/DisplayPositioned.java:48-116 */
export interface DisplayPositioned {
  readonly display: readonly string[] | null;
  readonly horizontalAlignment: HorizontalAlignment | null;
  readonly verticalAlignment: VerticalAlignment | null;
  /** Line index the command that produced this annotation was matched at.
   *  Java's `LineLocation` carries file/line/included-from context this
   *  port does not yet model; a raw line index is the reduced equivalent
   *  (sufficient for T9 mainframe rendering diagnostics). `null` for the
   *  `none()` defaults, matching upstream's `location == null` there. */
  readonly location: number | null;
}

/** @see DisplayPositioned.java#none */
export function noneDisplayPositioned(
  horizontalAlignment: HorizontalAlignment | null,
  verticalAlignment: VerticalAlignment | null,
): DisplayPositioned {
  return { display: null, horizontalAlignment, verticalAlignment, location: null };
}

/** @see DisplayPositioned.java#single(LineLocation, Display, ...) */
export function singleDisplayPositioned(
  display: readonly string[],
  horizontalAlignment: HorizontalAlignment | null,
  verticalAlignment: VerticalAlignment | null,
  location: number | null = null,
): DisplayPositioned {
  return { display, horizontalAlignment, verticalAlignment, location };
}

/** @see DisplayPositioned.java#isNull (delegates to `Display.isNull`) */
export function isDisplayPositionedNull(dp: DisplayPositioned): boolean {
  return dp.display === null;
}

/** @see DisplayPositioned.java#withDisplay */
export function withDisplay(dp: DisplayPositioned, display: readonly string[]): DisplayPositioned {
  return { ...dp, display };
}

/** @see DisplayPositioned.java#withHorizontalAlignment */
export function withHorizontalAlignment(
  dp: DisplayPositioned,
  horizontalAlignment: HorizontalAlignment | null,
): DisplayPositioned {
  return { ...dp, horizontalAlignment };
}

/** @see DisplayPositioned.java#withLocation */
export function withLocation(dp: DisplayPositioned, location: number | null): DisplayPositioned {
  return { ...dp, location };
}

/** `Display.isWhite()`: null, empty, or a single blank/whitespace-only
 *  line. Used only by {@link setTitle}'s reject-null-or-white guard.
 * @see ~/git/plantuml/.../klimt/creole/Display.java:169-172 */
function isWhiteDisplay(display: readonly string[] | null): boolean {
  /* v8 ignore start -- unreachable via this module's only caller: setTitle
   * invokes isWhiteDisplay(title.display) only after isDisplayPositionedNull
   * (title) has already returned false, so display is never null here; no
   * caller ever produces a genuinely empty display[] either (splitDisplayLine
   * always returns >= 1 element, and multiline callers guard body.length > 0
   * before constructing a DisplayPositioned at all). Preserved for standalone
   * correctness -- this mirrors Display.isWhite() exactly, not narrowed to
   * the one live call shape. */
  if (display === null || display.length === 0) return true;
  /* v8 ignore stop */
  // display.length === 1 here, so display[0] is always defined.
  return display.length === 1 && /^[\s ]*$/.test(display[0]!);
}

// ---------------------------------------------------------------------------
// HorizontalAlignment.fromString / VerticalAlignment.fromString
// ---------------------------------------------------------------------------

/** @see ~/git/plantuml/.../klimt/geom/HorizontalAlignment.java:49-60 */
export function horizontalAlignmentFromString(s: string | null | undefined): HorizontalAlignment | null {
  if (s === null || s === undefined) return null;
  const upper = s.toUpperCase();
  if (upper === HorizontalAlignment.LEFT) return HorizontalAlignment.LEFT;
  if (upper === HorizontalAlignment.CENTER) return HorizontalAlignment.CENTER;
  if (upper === HorizontalAlignment.RIGHT) return HorizontalAlignment.RIGHT;
  return null;
}

/** @see ~/git/plantuml/.../klimt/geom/HorizontalAlignment.java:62-73
 *  Not called from commands.ts (decisions.md D8: header/footer default
 *  alignment is resolved from style at DRAW time, not parse time) — ported
 *  for interface-contract completeness and for T9 (style-default
 *  resolution) to consume directly rather than re-derive. */
export function horizontalAlignmentFromStringOrDefault(
  s: string | null | undefined,
  defaultValue: HorizontalAlignment,
): HorizontalAlignment {
  if (s === null || s === undefined) return defaultValue;
  return horizontalAlignmentFromString(s) ?? defaultValue;
}

/** `top` -> TOP; everything else, including `null`/`undefined`, -> BOTTOM.
 *  Upstream's CENTER branch is commented out (no side-placed legend) —
 *  preserved verbatim, including the quirk (project CLAUDE.md: preserve
 *  upstream names, including the ugly ones).
 * @see ~/git/plantuml/.../klimt/geom/VerticalAlignment.java:41-52 */
export function verticalAlignmentFromString(s: string | null | undefined): VerticalAlignment {
  if (s !== null && s !== undefined && s.toUpperCase() === VerticalAlignment.TOP) return VerticalAlignment.TOP;
  return VerticalAlignment.BOTTOM;
}

// ---------------------------------------------------------------------------
// DiagramAnnotations
// ---------------------------------------------------------------------------

/** @see TitledDiagram.java:89-95 (field defaults) */
export interface DiagramAnnotations {
  title: DisplayPositioned;
  caption: DisplayPositioned;
  legend: DisplayPositioned;
  header: DisplayPositioned;
  footer: DisplayPositioned;
  mainFrame: DisplayPositioned;
}

/** @see TitledDiagram.java:89-95 */
export function createAnnotations(): DiagramAnnotations {
  return {
    title: noneDisplayPositioned(HorizontalAlignment.CENTER, VerticalAlignment.TOP),
    caption: noneDisplayPositioned(HorizontalAlignment.CENTER, VerticalAlignment.BOTTOM),
    legend: noneDisplayPositioned(HorizontalAlignment.CENTER, VerticalAlignment.BOTTOM),
    header: noneDisplayPositioned(HorizontalAlignment.CENTER, null),
    footer: noneDisplayPositioned(HorizontalAlignment.CENTER, null),
    mainFrame: noneDisplayPositioned(null, null),
  };
}

/** All six annotations are null -> the diagram carries no chrome at all,
 *  so the chrome pipeline (T5+) can be skipped entirely for byte-stability
 *  (decisions.md D5). */
export function isEmpty(a: DiagramAnnotations): boolean {
  return (
    isDisplayPositionedNull(a.title) &&
    isDisplayPositionedNull(a.caption) &&
    isDisplayPositionedNull(a.legend) &&
    isDisplayPositionedNull(a.header) &&
    isDisplayPositionedNull(a.footer) &&
    isDisplayPositionedNull(a.mainFrame)
  );
}

/** The ONLY one of the six setters upstream guards — a null/white title is
 *  silently dropped rather than overwriting the existing (possibly still
 *  default) title. `setCaption`/`setLegend`/`setMainFrame` below have no
 *  such guard in TitledDiagram.java; preserved as an intentional asymmetry.
 * @see TitledDiagram.java:168-172 */
export function setTitle(a: DiagramAnnotations, title: DisplayPositioned): void {
  if (isDisplayPositionedNull(title) || isWhiteDisplay(title.display)) return;
  a.title = title;
}

/** @see TitledDiagram.java:191-193 (unconditional, unlike setTitle) */
export function setCaption(a: DiagramAnnotations, caption: DisplayPositioned): void {
  a.caption = caption;
}

/** @see TitledDiagram.java:225-227 (unconditional, unlike setTitle) */
export function setLegend(a: DiagramAnnotations, legend: DisplayPositioned): void {
  a.legend = legend;
}

/** @see TitledDiagram.java:187-189 (unconditional, unlike setTitle) */
export function setMainFrame(a: DiagramAnnotations, mainFrame: DisplayPositioned): void {
  a.mainFrame = mainFrame;
}

/** Incremental update: display + horizontal alignment + location are
 *  swapped in on the EXISTING `header` DisplayPositioned (preserving
 *  whatever `verticalAlignment` was already there — always `null` for
 *  header/footer since nothing ever sets it).
 * @see TitledDiagram.java:215-218 */
export function updateHeader(
  a: DiagramAnnotations,
  location: number,
  display: readonly string[],
  horizontalAlignment: HorizontalAlignment | null,
): void {
  a.header = withLocation(withHorizontalAlignment(withDisplay(a.header, display), horizontalAlignment), location);
}

/** @see TitledDiagram.java:210-213 */
export function updateFooter(
  a: DiagramAnnotations,
  location: number,
  display: readonly string[],
  horizontalAlignment: HorizontalAlignment | null,
): void {
  a.footer = withLocation(withHorizontalAlignment(withDisplay(a.footer, display), horizontalAlignment), location);
}
