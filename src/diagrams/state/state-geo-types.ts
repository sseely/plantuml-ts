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
  kind: StateKind | 'note';
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
  /**
   * mission G4 S6, mechanism 13: for a CONCURRENT-region-owning composite
   * ONLY (`state X { region1 -- region2 -- ... }`) -- the SAME content as
   * `children`/`transitions` (which stay a flat, region-order concatenation,
   * unchanged in shape, for `layout-ink-extent.ts#addNodeInk`'s and
   * `renderer-uid.ts#buildStateUidPlan`'s existing flat walks) but GROUPED
   * per stacked region, so `renderer.ts#renderNodeWrapped` can interleave
   * each region's own states+transitions and draw a dashed `separators`
   * line BETWEEN each pair -- jar's real document structure never wraps a
   * region in its own `<g>` (`ConcurrentStates.java#drawU` draws each
   * `inner`'s content directly, then the separator, in a single flat
   * sequence inside the OWNING composite's own image) -- `undefined` for
   * every non-concurrent node. The SAME `StateNodeGeo`/`TransitionGeo`
   * object instances appear in both `concurrentRegions[i].children`/
   * `.transitions` and the flat `children`/`transitions` arrays
   * (`state-composite-geo.ts#materializeAutonom` builds the flat arrays BY
   * CONCATENATING the per-region ones, not the reverse) -- `renderer-uid.ts`'s
   * `edgeUid` Map is keyed by `TransitionGeo` object IDENTITY, so this
   * sharing is load-bearing, not an optimization.
   */
  concurrentRegions?: readonly StateRegionGeo[];
  /** mission G4 S6, mechanism 13: dashed separator lines between stacked
   *  concurrent regions (`ConcurrentStates.java#Separator.drawSeparator`,
   *  `stroke-width:1.5;stroke-dasharray:8,10;`) -- length `concurrentRegions!.
   *  length - 1`, absolute (already dx/dy-shifted into this node's own
   *  coordinate frame, same convention as `children`/`transitions`).
   *  `undefined` for every non-concurrent node. */
  separators?: readonly StateSeparatorGeo[];
  /**
   * mission G4 S7 (mechanism 10, id-numbering creation-index gap): the
   * parse-time tick (`State.creationIndex`, or the lazily-assigned
   * pseudostate tick for an `'initial'`/`'final'` node -- ast.ts's
   * `StateDiagramAST.pseudoCreationIndex` doc) this node's own uid slot was
   * assigned. `renderer-uid.ts#buildStateUidPlan` uses this RAW value
   * directly (`ent%04d(creationIndex)`, no dense re-packing) when present --
   * see `State.creationIndex`'s own doc comment for why raw values already
   * reproduce jar's real id gaps. `undefined` for a hand-built test
   * geometry (falls back to the pre-mission-S7 dense-numbering scheme).
   * @see plans/g4-state-svg/ledger.md (S7)
   */
  creationIndex?: number;
  /**
   * mission G4 S9 (`StateBorderColor<<X>>` cascade): this node's OWN
   * `<<stereotype>>` label (`State.stereotype`, raw case as written in the
   * source -- lowercased only at LOOKUP time,
   * `state-render-colors.ts#resolveStateBorder`, matching `core/skinparam
   * .ts`'s own lowercased-key storage for `stateBorderColorByStereo`).
   * Threaded onto BOTH a plain leaf (`buildStateGeoTextFields`) and a
   * composite's own title node (`kind:'state'`/`'autonom'` GeoSpec
   * variants, state-composite-pass.ts) -- NOT onto a non-autonom `'cluster'`
   * node, which stays on its pre-existing dashed-rect fallback shape
   * (mechanism 16, unrelated/unbounded, `plans/g4-state-svg/ledger.md` S3).
   * `undefined` for a state with no `<<tag>>`.
   */
  stereotype?: string;
  /**
   * mission G4 S10 (notes never render): present ONLY for `kind: 'note'` --
   * per-line note-body text + measured width (mirrors `headerLines`'s
   * identical per-line-width rationale, `state-note-layout.ts#measureNote`).
   * A note has no `display`/`headerLines`/`bodyLines` shape of its own.
   */
  noteLines?: readonly StateTextLine[];
  /**
   * mission G4 S10: present ONLY for `kind: 'note'` WITH a resolved host
   * (`note <pos> of X` / implicit-position-attached -- `StateNote.target !==
   * undefined`) whose connector spline resolved to a real notch (`../class/
   * note-opale.ts#resolveOpaleConnector`) -- the Opale zigzag-notch merge
   * REPLACES the plain folded-corner box + separate line every OTHER note
   * takes (`renderer-note.ts#renderStateNoteFreestanding`). `pp1`/`pp2` are
   * LOCAL to this node's own (0,0)-at-top-left frame (`note-opale.ts
   * #OpaleConnector`'s own doc) -- safe under the document-margin shift
   * (`layout.ts#shiftStateNode` only ever translates `x`/`y`, never touches
   * this field, mirroring how `separators`' own absolute coordinates are
   * the ones that DO need re-shifting while opale's LOCAL offsets don't).
   * `undefined` for a freestanding note or an attached note whose connector
   * spline didn't resolve (falls back to the plain-box shape).
   */
  noteOpale?: {
    readonly direction: 'left' | 'right' | 'up' | 'down';
    readonly pp1: { readonly x: number; readonly y: number };
    readonly pp2: { readonly x: number; readonly y: number };
  };
}

/** One stacked concurrent region's own materialized content -- see
 *  `StateNodeGeo.concurrentRegions`'s own doc comment. */
export interface StateRegionGeo {
  readonly children: readonly StateNodeGeo[];
  readonly transitions: readonly TransitionGeo[];
}

/** One dashed separator line between two stacked concurrent regions -- see
 *  `StateNodeGeo.separators`'s own doc comment. Absolute coordinates. */
export interface StateSeparatorGeo {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface TransitionGeo {
  from: string;
  to: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  /** mission G4 S7 -- see `StateNodeGeo.creationIndex`'s own doc comment;
   *  same raw-value contract, sourced from `Transition.creationIndex`. */
  creationIndex?: number;
}

export interface StateGeometry {
  totalWidth: number;
  totalHeight: number;
  states: StateNodeGeo[];
  transitions: TransitionGeo[];
  /**
   * mission G4 S14: `StateDiagramAST.concurrentGlobalIds`, carried through
   * layout unchanged so the renderer can translate a CONC-region pseudo-
   * anchor path id from this port's own owner-local numbering to jar's
   * diagram-global one -- see that field's own doc comment (ast.ts) for
   * the full mechanism. Optional/absent is equivalent to an empty map
   * (no concurrent regions in this diagram, or a hand-built geometry
   * literal predating this mission).
   */
  concurrentGlobalIds?: ReadonlyMap<string, number>;
}
