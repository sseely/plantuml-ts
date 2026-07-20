/**
 * Public geometry types for the state-diagram layout engine. Split out of
 * ./layout.ts (which re-exports them, preserving the public import path used
 * by ./renderer.ts and ./index.ts) so the composite-pass modules can share
 * them without an import cycle through layout.ts.
 */

import type { StateKind } from './ast.js';

/** One measured text line (`state-sizing.ts#measureTextLines`/
 *  `measureBodyTextLines`) — `width` is the line's own measured advance
 *  width at the diagram's theme font, feeding `<text textLength="...">`. */
export interface StateTextLine {
  readonly text: string;
  readonly width: number;
}

export interface StateNodeGeo {
  id: string;
  kind: StateKind;
  display: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: StateNodeGeo[];
  /**
   * mission G4 S5 (transition-nesting mechanism): the transitions belonging
   * to THIS node's own svek pass (only ever non-empty for an 'autonom'
   * composite pass boundary -- a plain leaf or non-autonom `cluster` node
   * never owns any transitions of its own, since clusters share their
   * container pass's edges). Rendered as siblings of `children` INSIDE this
   * node's own `<g>` wrap (`renderer.ts#renderNodeWrapped`), matching jar's
   * real nesting (`GroupMakerState#getImage` draws a pass's own edges as
   * direct children of that pass's own image, never at the outer document
   * level) -- replaces the pre-S5 flat-sibling simplification named in
   * `renderer-group.ts`'s own "Transitions render as FLAT siblings" doc
   * comment. jar-verified `bajelo-54-dixe684` (`lnk10`/`lnk11` both nest
   * inside `Track_FSM`'s own `<g>`, siblings of its entity/cluster children,
   * not inside the specific entity/cluster their endpoints happen to sit in).
   */
  transitions: TransitionGeo[];
  /**
   * mission G4 S2 (mechanism 5): pre-measured header (display/name) line(s)
   * for `kind:'normal'`/`'json'` leaf boxes, or the single short pseudostate
   * glyph label ("H"/"H*") for `kind:'history'`/`'deepHistory'` — the
   * renderer itself has no `StringMeasurer` (a pure-function, DOM-free
   * design constraint), so per-line text width for jar's exact
   * `lengthAdjust="spacing" textLength="..."` centering must be measured
   * once at layout time and threaded through, mirroring `ClassifierGeo
   * .rows[].width`'s identical precedent in the class engine. `undefined`
   * for every OTHER kind (initial/final/fork/join/syncBar/choice draw no
   * measured inline text) and for `kind:'json'` (whose box content is a
   * genuinely different, unmeasured approximation — `renderJson`'s own doc
   * comment in renderer.ts).
   */
  headerLines?: readonly StateTextLine[];
  /** mission G4 S2: pre-measured body/description line(s) (`State X : text`)
   *  for a `kind:'normal'` leaf box — same rationale as {@link headerLines}.
   *  `undefined`/empty when the state has no description lines. */
  bodyLines?: readonly StateTextLine[];
  /**
   * mission G4 S5: `true` iff this leaf `kind:'normal'` state takes jar's
   * `EntityImageStateEmptyDescription` shape (`hide empty description` +
   * zero body lines, `GeneralImageBuilder#createEntityImageBlockInternal`'s
   * `isHideEmptyDescriptionForState && leaf.getBodier().getRawBody().size()
   * == 0` gate) rather than the regular `EntityImageState` box: NO divider
   * `<line>`, the label CENTERED both horizontally AND vertically (not the
   * regular header-line offset), and NOT wrapped in a `<g>` at all
   * (`renderer.ts#wrapClassFor`'s existing "unwrapped" precedent for fork/
   * join/history/deepHistory). `undefined` (the pre-S5, still-correct
   * default) for every other case, including a composite's own title
   * (composites never take this branch upstream — `LeafType.STATE`'s own
   * dispatch is LEAF-only). jar-verified `gopumi-11-pise779`'s `S1`.
   */
  emptyDescription?: true;
  /** mission G4 S2: `State.color`'s raw `#color`/`#back:color;...` inline
   *  override, threaded through unresolved (same raw-string convention as
   *  `ClassifierGeo.color`) — resolved to a hex fill at RENDER time via
   *  `state-render-colors.ts#resolveStateFill`, not here, so every leaf
   *  kind (including pseudostates, which support the same override
   *  mechanism upstream, `Colors#getColor(BackGroundColor)`) can share one
   *  resolution function. */
  color?: string;
}

export interface TransitionGeo {
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
}

export interface StateGeometry {
  totalWidth: number;
  totalHeight: number;
  states: StateNodeGeo[];
  transitions: TransitionGeo[];
}
