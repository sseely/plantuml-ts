/**
 * State-node sizing — svek-faithful dimension formulas for the state diagram
 * layout engine (./layout.ts). Split out of layout.ts/state-dot-graph.ts to
 * keep every function under the project's per-function complexity/size caps
 * and files under the 500-line cap (mirrors class engine's
 * class-layout-helpers.ts / class-object-map-sizing.ts precedent — D1,
 * duplicate consciously, do not extract a shared base).
 *
 * Faithful port of the dimension math, verified byte-for-byte (px, at the
 * WidthTableMeasurer's deterministic metrics) against cached oracle svek
 * dumps in test-results/dot-cache/state/<slug>/svek-N.dot:
 *   @see ~/git/plantuml/.../svek/GeneralImageBuilder.java (dispatch order)
 *   @see ~/git/plantuml/.../svek/image/EntityImageStateCommon.java (MARGIN=5, MARGIN_LINE=5)
 *   @see ~/git/plantuml/.../svek/image/EntityImageState.java (has-body/none simple state)
 *   @see ~/git/plantuml/.../svek/image/EntityImageStateEmptyDescription.java (hide empty description)
 *   @see ~/git/plantuml/.../svek/image/EntityImageState2.java + decoration/symbol/USymbolFrame.java (sdlreceive — approximate, see below)
 *   @see ~/git/plantuml/.../svek/image/CircleStart.java (20x20)
 *   @see ~/git/plantuml/.../svek/image/CircleEnd.java (22x22)
 *   @see ~/git/plantuml/.../svek/image/EntityImagePseudoState.java + EntityImageDeepHistory.java (22x22, history/history*)
 *   @see ~/git/plantuml/.../svek/image/EntityImageBranch.java (24x24 diamond, choice)
 *   @see ~/git/plantuml/.../svek/image/EntityImageSynchroBar.java (80x8 TB / 8x80 LR, fork/join/syncBar)
 *   @see ~/git/plantuml/.../svek/image/EntityImageJson.java (measured, kind:'json' — ./state-json-sizing.ts)
 *
 * Verified fixtures (mechanisms.md's evidence set):
 *   - bilare-19-fufe539 — 4 states, `hide empty description`, exact widths
 *     0.694444/0.694444/0.841319/1.035764in x 0.555556in (EmptyDescription,
 *     MIN 50x40) — px-exact.
 *   - gizati-67-kora187 / suzope-95-suvu383 — one state with a 3-line body
 *     (embedded `\n` vs 3 separate `s1 : text` lines render identically),
 *     0.694444 x 1.055556in (EntityImageState, MIN 50x50) — px-exact.
 *   - cekolo-21-gini183 — start/choice/fork/join/end/history/history* fixed
 *     sizes, all px-exact; `<<sdlreceive>>` is the one unverified formula
 *     (see SDL_MARGIN doc below).
 *   - maruju-55-soko478 — embedded `json foo1 { ... }` leaf (mission A4
 *     Phase L iter 20) — shape/structural dot-parity verified; per-node
 *     pixel size is reported but not gated (see state-json-sizing.ts's doc).
 */

import type { State, StateKind } from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { FontSpec, StringMeasurer } from '../../core/measurer.js';
import type { DotInputNodeShape } from '../../core/graph-layout.js';
import type { StateTextLine } from './state-geo-types.js';
import { measureJsonState } from './state-json-sizing.js';
import { resolveStateFontSize } from './state-render-colors.js';

// ---------------------------------------------------------------------------
// Creole line splitting
// ---------------------------------------------------------------------------

/**
 * Split a display/description string on PlantUML's literal `\n` line-break
 * token (two source characters: backslash, n — NOT a real newline; our
 * parser never converts it, mirroring upstream's Creole renderer which
 * treats the literal token as a line break at draw time). A raw newline
 * character (if one ever appears) is also treated as a break, since no
 * upstream state-diagram source produces one but defensive parity costs
 * nothing here.
 * @see ~/git/plantuml/.../klimt/creole/Display.java (line splitting on `\n`)
 */
export function splitCreoleLines(text: string): string[] {
  return text.split(/\\n|\n/);
}

// ---------------------------------------------------------------------------
// Fixed-size pseudostate table (§1 of mechanisms.md)
// ---------------------------------------------------------------------------

/** CircleStart.java:52 — `[*]` used as a transition SOURCE, or `<<start>>`. */
export const CIRCLE_START_SIZE = 20;
/** CircleEnd.java:55 — `[*]` used as a transition TARGET, or `<<end>>`. */
export const CIRCLE_END_SIZE = 22;
/** EntityImagePseudoState.java:61 / EntityImageDeepHistory.java — SAME size
 *  for shallow and deep history (the "H"/"H*" text differs, not the box). */
export const HISTORY_SIZE = 22;
/** EntityImageBranch.java:56 — `SIZE * 2` (choice diamond). */
export const BRANCH_SIZE = 24;
/** EntityImageSynchroBar.java:67-71 — 80x8 in TB rankdir, 8x80 in LR. */
export const SYNCHRO_BAR_LONG = 80;
export const SYNCHRO_BAR_SHORT = 8;

interface Dim {
  width: number;
  height: number;
}

/** Kinds whose box is a fixed size (independent of measured text) — every
 *  StateKind except 'normal'/'json' and the rankdir-dependent bar kinds
 *  (fork/join/syncBar, handled separately in fixedPseudostateDim). Table
 *  form (not a switch) keeps this file's per-function CCN under the cap. */
const FIXED_PSEUDOSTATE_DIM: Partial<Record<StateKind, Dim>> = {
  initial: { width: CIRCLE_START_SIZE, height: CIRCLE_START_SIZE },
  final: { width: CIRCLE_END_SIZE, height: CIRCLE_END_SIZE },
  history: { width: HISTORY_SIZE, height: HISTORY_SIZE },
  deepHistory: { width: HISTORY_SIZE, height: HISTORY_SIZE },
  choice: { width: BRANCH_SIZE, height: BRANCH_SIZE },
};

/** DOT shape per fixed-size pseudostate kind (bar kinds included — their
 *  shape doesn't depend on rankdir, only their dimensions do). */
const FIXED_PSEUDOSTATE_SHAPE: Partial<Record<StateKind, DotInputNodeShape>> = {
  initial: 'circle',
  final: 'circle',
  history: 'circle',
  deepHistory: 'circle',
  choice: 'diamond',
  // NOT rounded — EntityImageSynchroBar.getShapeType() is RECTANGLE.
  fork: 'rect',
  join: 'rect',
  syncBar: 'rect',
};

const BAR_KINDS: ReadonlySet<StateKind> = new Set(['fork', 'join', 'syncBar']);

/** Fixed-size pseudostate kinds — dimensions depend only on kind (+rankdir
 *  for the bar shapes), never on measured text. Undefined ⇒ 'normal' kind,
 *  which the caller measures from text instead. */
function fixedPseudostateDim(kind: StateKind, rankdir: 'TB' | 'LR'): Dim | undefined {
  if (BAR_KINDS.has(kind)) {
    return rankdir === 'LR'
      ? { width: SYNCHRO_BAR_SHORT, height: SYNCHRO_BAR_LONG }
      : { width: SYNCHRO_BAR_LONG, height: SYNCHRO_BAR_SHORT };
  }
  return FIXED_PSEUDOSTATE_DIM[kind];
}

// ---------------------------------------------------------------------------
// Normal-kind ('state Foo') sizing — EntityImageState / EntityImageStateEmptyDescription
// ---------------------------------------------------------------------------

/** IEntityImage.MARGIN / MARGIN_LINE (both 5) — EntityImageState's outer
 *  delta is 2*MARGIN + 2*MARGIN_LINE = 20, applied to BOTH width and height
 *  (XDimension2D#delta(single value) — see EntityImageState.java:111). */
const STATE_MARGIN_DELTA = 20;
const STATE_MIN_WIDTH = 50;
const STATE_MIN_HEIGHT = 50;

/** EntityImageStateEmptyDescription: delta = MARGIN*2 = 10 (both axes),
 *  MIN 50x40 — a shorter box than the full EntityImageState MIN (50x50). */
const EMPTY_DESC_MARGIN_DELTA = 10;
const EMPTY_DESC_MIN_WIDTH = 50;
const EMPTY_DESC_MIN_HEIGHT = 40;

/**
 * EntityImageState2 (`<<sdlreceive>>`) margin from USymbolFrame#getMargin:
 * `new Margin(10+5, 20+5, 15+5, 5+5)` = (x1=15, x2=25, y1=20, y2=10).
 * width += x1+x2 = 40; height += y1+y2 = 30. The measured text is the
 * state's OWN display (asSmall's "label" param is `entity.getDisplay()` via
 * BodyFactory.create2, not the description/body lines — the stereotype
 * itself renders as an EMPTY TextBlock, USymbolFrame.asSmall:72).
 *
 * mission G4 S14: the ~12pt width gap this doc comment used to report as
 * unverified is `BodyEnhancedAbstract#getMarginX()` = 6 (`BodyEnhanced1`'s
 * own override), applied via `TextBlockUtils.withMargin(block, marginX, 0)`
 * -- LEFT+RIGHT, so `2 * BODY_MARGIN_X` = 12 total, ON TOP OF
 * `USymbolFrame`'s own `SDL_MARGIN`. jar-verified byte-exact against
 * `cekolo-21-gini183`'s sdlreceive node (115.0875 x 44pt): `label.width`
 * (63.0875, "sdlreceive" at the deterministic theme font) + `SDL_MARGIN.x1
 * + SDL_MARGIN.x2` (40) + `2 * BODY_MARGIN_X` (12) = 115.0875 exactly;
 * height (44) needs no correction (single-line label, no extra vertical
 * padding from `getMarginX`, which is X-only).
 * @see ~/git/plantuml/.../cucadiagram/BodyEnhancedAbstract.java#getMarginX
 * @see ~/git/plantuml/.../cucadiagram/BodyEnhanced1.java#getMarginX
 * @see plans/g4-state-svg/ledger.md (S14)
 */
const SDL_MARGIN = { x1: 15, x2: 25, y1: 20, y2: 10 };
/** `BodyEnhanced1#getMarginX` — see {@link SDL_MARGIN}'s own doc comment. */
const BODY_MARGIN_X = 6;

function measureLines(lines: readonly string[], font: FontSpec, measurer: StringMeasurer): Dim {
  if (lines.length === 0) return { width: 0, height: 0 };
  let width = 0;
  let height = 0;
  for (const line of lines) {
    const m = measurer.measure(line, font);
    if (m.width > width) width = m.width;
    height += m.height;
  }
  return { width, height };
}

/** EntityImageState2 sizing (approximate — see SDL_MARGIN doc). */
function measureSdlReceive(state: State, font: FontSpec, measurer: StringMeasurer): Dim {
  const label = measureLines(splitCreoleLines(state.display), font, measurer);
  return {
    width: label.width + SDL_MARGIN.x1 + SDL_MARGIN.x2 + 2 * BODY_MARGIN_X,
    height: label.height + SDL_MARGIN.y1 + SDL_MARGIN.y2,
  };
}

/** EntityImageStateEmptyDescription: `hide empty description` + no body lines. */
function measureEmptyDescription(state: State, font: FontSpec, measurer: StringMeasurer): Dim {
  const name = measureLines(splitCreoleLines(state.display), font, measurer);
  const width = Math.max(name.width + EMPTY_DESC_MARGIN_DELTA, EMPTY_DESC_MIN_WIDTH);
  const height = Math.max(name.height + EMPTY_DESC_MARGIN_DELTA, EMPTY_DESC_MIN_HEIGHT);
  return { width, height };
}

/** EntityImageState: name + fields (body/description lines), MIN 50x50. */
function measureNormalState(state: State, font: FontSpec, measurer: StringMeasurer): Dim {
  const name = measureLines(splitCreoleLines(state.display), font, measurer);
  const bodyLines = (state.description ?? []).flatMap(splitCreoleLines);
  const fields = measureLines(bodyLines, font, measurer);
  const merged = { width: Math.max(name.width, fields.width), height: name.height + fields.height };
  const width = Math.max(merged.width + STATE_MARGIN_DELTA, STATE_MIN_WIDTH);
  const height = Math.max(merged.height + STATE_MARGIN_DELTA, STATE_MIN_HEIGHT);
  return { width, height };
}

/**
 * Dimension + shape for a `kind:'normal'` state, dispatching in the SAME
 * order as GeneralImageBuilder.createEntityImageBlockInternal's LeafType.STATE
 * branch (EntityPosition check excluded — entry/exit border points are T4's
 * concern, not reachable for a flat/composite-free diagram):
 *   1. hideEmptyDescription && no body lines → EmptyDescription
 *   2. stereotype === sdlreceive → EntityImageState2 (approximate)
 *   3. else → EntityImageState (name + fields)
 */
function measureNormalKind(
  state: State,
  hideEmptyDescription: boolean,
  font: FontSpec,
  measurer: StringMeasurer,
): { dim: Dim; shape: DotInputNodeShape } {
  const hasBody = (state.description?.length ?? 0) > 0;
  if (hideEmptyDescription && !hasBody) {
    return { dim: measureEmptyDescription(state, font, measurer), shape: 'rounded' };
  }
  if (state.stereotype?.toLowerCase() === 'sdlreceive') {
    return { dim: measureSdlReceive(state, font, measurer), shape: 'rect' };
  }
  return { dim: measureNormalState(state, font, measurer), shape: 'rounded' };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MeasuredState {
  width: number;
  height: number;
  shape: DotInputNodeShape;
}

/**
 * Measure one flat (non-composite) state node — dispatches to
 * {@link measureJsonState} for `kind:'json'`, else the fixed-size
 * pseudostate table for every other non-'normal' kind, else the
 * name+fields EntityImageState family (§1 of mechanisms.md).
 */
export function measureState(
  state: State,
  hideEmptyDescription: boolean,
  theme: Theme,
  measurer: StringMeasurer,
  rankdir: 'TB' | 'LR',
): MeasuredState {
  if (state.kind === 'json') {
    return { ...measureJsonState(state, theme, measurer), shape: 'plaintext' };
  }
  const fixedDim = fixedPseudostateDim(state.kind, rankdir);
  if (fixedDim !== undefined) {
    return { ...fixedDim, shape: FIXED_PSEUDOSTATE_SHAPE[state.kind]! };
  }
  // mission G4 S16: `skinparam stateFontSize<<X>> N` -- see
  // `resolveStateFontSize`'s own doc comment (state-render-colors.ts) for
  // why this is a LAYOUT-time concern (feeds the DOT node's own
  // width/height), unlike its `stateBackgroundColor<<X>>`/`stateFontColor
  // <<X>>` siblings, which are render-time-only.
  const fontSize = resolveStateFontSize(state, theme, theme.fontSize);
  const font: FontSpec = { family: theme.fontFamily, size: fontSize };
  const { dim, shape } = measureNormalKind(state, hideEmptyDescription, font, measurer);
  return { ...dim, shape };
}

// ---------------------------------------------------------------------------
// Render-time text metrics (mission G4 S2, mechanism 5)
// ---------------------------------------------------------------------------
//
// The renderer (renderer-box.ts/renderer-pseudostate.ts) has no
// `StringMeasurer` of its own (a pure-function, DOM-free design constraint —
// see StateNodeGeo.headerLines's own doc comment) — per-line measured widths
// for jar's exact `textLength="..."` centering must be computed HERE, once,
// at layout time, and threaded through StateNodeGeo, mirroring the class
// engine's `ClassifierGeo.rows[].width` precedent.

/** Header (display/name) lines, pre-measured — `kind:'normal'` leaf boxes.
 *  Jar-verified jocela-05-niba392 (1 line), votoki-67-gufa610 (1 line,
 *  centered against a WIDER body-dominated box). */
export function measureTextLines(displayText: string, font: FontSpec, measurer: StringMeasurer): StateTextLine[] {
  return splitCreoleLines(displayText).map((ln) => ({ text: ln, width: measurer.measure(ln, font).width }));
}

/**
 * Body/description lines, pre-measured — `kind:'normal'` leaf boxes.
 * Jar-verified votoki-67-gufa610 (2 lines), gefefe-91-xoge233 (`IDLE :`,
 * a truly empty captured line — jar substitutes a literal single SPACE
 * character for the row rather than drawing a zero-width empty `<text>`;
 * `textLength="3.85"`, content U+00A0 NBSP, NOT a plain U+0020 space --
 * confirmed byte-for-byte against the fixture's raw UTF-8, `\xc2\xa0` --
 * SAME NBSP-substitution convention the class engine's own creole atom
 * renderer already documents, `renderer-classifier-box.ts#renderRowAtoms`'s
 * `atom.renderText`/`renderWidth` doc comment, `DriverTextSvg.java`'s
 * whitespace-only-run branch). This is a render-time cosmetic substitution
 * only — it does NOT affect `hasBody`/box-height decisions elsewhere
 * (state-sizing.ts's own `measureNormalState`, which counts ARRAY entries,
 * not string emptiness — a blank description line already contributes one
 * full `theme.fontSize` of height either way).
 */
const NBSP = '\u00A0';
export function measureBodyTextLines(
  description: readonly string[] | undefined,
  font: FontSpec,
  measurer: StringMeasurer,
): StateTextLine[] {
  const lines = (description ?? []).flatMap(splitCreoleLines).map((ln) => (ln === '' ? NBSP : ln));
  return lines.map((ln) => ({ text: ln, width: measurer.measure(ln, font).width }));
}

/** `EntityImagePseudoState`/`EntityImageDeepHistory`'s own "H"/"H*" glyph —
 *  the SAME text for both shallow and deep history (only the box's shared
 *  fixed 22x22 size differs from every other pseudostate, not this label).
 *  @see ~/git/plantuml/.../svek/image/EntityImagePseudoState.java
 *  @see ~/git/plantuml/.../svek/image/EntityImageDeepHistory.java */
export function historyLabelText(kind: StateKind | 'note'): string {
  return kind === 'deepHistory' ? 'H*' : 'H';
}

/** Optional `StateNodeGeo` fields a leaf `state` spec/geo carries for
 *  render-time text layout (mission G4 S2) — `headerLines`/`bodyLines` for
 *  `kind:'normal'`, the single "H"/"H*" label for `kind:'history'`/
 *  `'deepHistory'`, `color` (raw, unresolved) for every kind. Shared by
 *  both the flat pipeline (`layout.ts#buildFlatStateGeos`) and the
 *  composite pipeline (`state-composite-pass.ts#resolveMember`) so the two
 *  don't independently re-derive the same per-kind dispatch. */
export interface StateGeoTextFields {
  headerLines?: readonly StateTextLine[];
  bodyLines?: readonly StateTextLine[];
  color?: string;
  /** mission G4 S5 -- see `StateNodeGeo.emptyDescription`'s own doc comment. */
  emptyDescription?: true;
  /** mission G4 S9 -- see `StateNodeGeo.stereotype`'s own doc comment. */
  stereotype?: string;
}

/**
 * mission G4 S5: `hideEmptyDescription` threads the SAME
 * `isHideEmptyDescriptionForState && rawBody.size()==0` gate
 * {@link measureNormalKind} already dimensions with (`plans/g4-state-svg/
 * ledger.md` S5) onto the RENDERED shape too, via the returned
 * `emptyDescription` marker (`StateNodeGeo.emptyDescription`'s own doc
 * comment) — `false` for every composite-title call site
 * (`state-composite-autonom.ts`/`state-composite-concurrent.ts`), since a
 * composite's own title never takes this leaf-only upstream branch.
 */
export function buildStateGeoTextFields(
  state: State,
  theme: Theme,
  measurer: StringMeasurer,
  hideEmptyDescription = false,
): StateGeoTextFields {
  // mission G4 S16: `skinparam stateFontSize<<X>> N` -- see
  // `measureState`'s own doc comment above; the SAME resolved font size
  // measures `StateTextLine.width` here so the renderer's `textLength`
  // attribute matches jar's own larger/smaller glyph metrics.
  const fontSize = resolveStateFontSize(state, theme, theme.fontSize);
  const font: FontSpec = { family: theme.fontFamily, size: fontSize };
  const fields: StateGeoTextFields = {};
  const hasBody = (state.description?.length ?? 0) > 0;
  if (state.kind === 'normal' && hideEmptyDescription && !hasBody) {
    fields.headerLines = measureTextLines(state.display, font, measurer);
    fields.emptyDescription = true;
  } else if (state.kind === 'normal') {
    fields.headerLines = measureTextLines(state.display, font, measurer);
    fields.bodyLines = measureBodyTextLines(state.description, font, measurer);
  } else if (state.kind === 'history' || state.kind === 'deepHistory') {
    fields.headerLines = measureTextLines(historyLabelText(state.kind), font, measurer);
  }
  if (state.color !== undefined) fields.color = state.color;
  if (state.stereotype !== undefined) fields.stereotype = state.stereotype;
  return fields;
}
