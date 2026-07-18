/**
 * Class diagram layout engine.
 *
 * Synchronous: ClassDiagramAST + Theme + StringMeasurer → ClassGeometry
 * via the dot layout engine.
 *
 * Architecture decisions:
 *   D3 — Calls layout() from the shared dot engine.
 *   D4 — Nodes are pre-measured; dot only routes and positions.
 *   D5 — Namespaces are flattened into the root graph (D5 refers to
 *         ranking only now — see buildDotClusters); namespace bounds are
 *         derived from classifier positions after layout.
 *
 * No DOM, no SVG. All I/O is plain data.
 *
 * Classifier sizing/measurement is implemented in ./class-layout-helpers.ts
 * (split out to keep every function under the project's per-function
 * complexity/size caps; this file re-exports `formatMemberText` from there).
 * G2/N11: the pure ClassifierGeo/NamespaceGeo/EdgeGeo builders + the
 * degenerate single-classifier skip are implemented in
 * ./class-geo-builders.ts (same split rationale, no behavior change --
 * moved verbatim to keep THIS file under the 500-line file-size cap after
 * adding the ink-shift mechanism below).
 */

import type {
  ClassDiagramAST,
  ClassifierKind,
  HideTarget,
  LinkDecor,
  UrlInfo,
  Visibility,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import { filterRemovedEntities, computeHiddenIds } from './class-directives.js';
import { collapseEmptyNamespacesFinal } from './class-namespace.js';
import { mapNoteGeos, type NoteGeo } from './note-layout.js';
import { findFreestandingNoteConnectors } from './note-freestanding.js';
import {
  measureClassifier,
  isMethodMember,
  type MeasuredClassifier,
} from './class-layout-helpers.js';
import { buildDotGraph } from './class-dot-graph.js';
import type { GenericTagGeo } from './class-stereotype.js';
import type { EmptyPackageLeafDim } from './class-namespace-shape.js';
import type { EnhancedBodyGeo } from './class-body-enhanced-layout.js';
import { computeClassDocumentDims, computeClassInkShift, computeClassRawInkDims } from './layout-ink-extent.js';
import {
  buildClassifierGeos,
  buildNamespaceGeos,
  buildEdgeGeos,
  degenerateSingleClassifier,
} from './class-geo-builders.js';

export { formatMemberText, ROW_TEXT_LEFT_MARGIN } from './class-layout-helpers.js';
import type { MemberRenderAtom } from './class-member-creole.js';

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface ClassifierGeo {
  id: string;
  kind: ClassifierKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** y-offsets of section dividers within the box (relative to box top) */
  dividerYs: number[];
  /** Text rows to render: [header display, ...member strings] with y offset. */
  rows: Array<{
    text: string;
    y: number;
    indent: number;
    italic?: boolean; // abstract/interface header names — rendered in italic
    /** G2 N32: header-only, `skinparam classFontStyle bold` --
     *  `theme.ts#classFontBold`'s doc comment. Absent for every classifier
     *  with no such override (zero behavior change). */
    bold?: boolean;
    visibilityIcon?: Visibility; // colored icon left of member text
    /** G2 N6: true when this member is a FIELD (not a method) -- gates
     *  the filled-vs-stroke-only fill rule
     *  (`class-visibility-icon.ts#renderVisibilityIcon`'s own doc comment).
     *  Present only alongside `visibilityIcon`. */
    visibilityIsField?: boolean;
    /**
     * G2 N4: the row text's own pre-measured (unmargined) width, from the
     * SAME measurer `layoutClass` used for box sizing -- feeds the rendered
     * `<text textLength="..." lengthAdjust="spacing">` attributes
     * (`renderer.ts#renderRow`), matching jar's `-DPLANTUML_DETERMINISTIC_
     * TEXT=true` output exactly rather than leaving per-character rendering
     * up to the SVG viewer's own font. Optional: rows built by hand in unit
     * tests (bypassing layoutClass) simply omit `textLength` -- the
     * attribute is additive on `core/svg.ts#text()`.
     */
    width?: number;
    /** G2 N16: this row's source member's OWN parsed `[[url]]`/`[[[url]]]`
     *  link suffix -- `Member.ownUrl`'s doc comment (N15 tracked presence
     *  only via a boolean `hasUrl`; N16 carries the full value so the
     *  render-side per-primitive `<a>`-run splitting can compare DIFFERENT
     *  member rows' urls for value equality, not just presence). Read by
     *  `renderer.ts`'s classifier-level url-wrap decision
     *  (`renderer-url.ts`). */
    url?: UrlInfo;
    /**
     * G2 N22: this row's text run through the shared creole atom engine
     * (`class-member-creole.ts#buildMemberRow`) -- present on EVERY member
     * row `layoutClass` builds (a hand-built test geometry that bypasses
     * `measureGenericClassifier` may omit it, same optionality precedent as
     * `width`). ABSENT on the header row (upstream's `EntityImageClassHeader`
     * name text is a separate, non-creole mechanism -- `italic` above is its
     * own, narrower styling hook). `renderer-classifier-box.ts#renderRowText`
     * draws one `<text>`/`<image>` per atom, left-to-right, x-advancing by
     * each atom's own measured width -- mirrors `EntityImageDescriptionSupport
     * .ts#drawAtoms`'s identical reconstruction for description.
     */
    atoms?: readonly MemberRenderAtom[];
    /**
     * G2 N23: the header row's own kind-badge `<ellipse>` cx position,
     * relative to `geo.x` -- `HeaderLayout#drawU`'s `xCircle = h1` term
     * (`h1`/`h2` derived in `class-layout-helpers.ts#buildHeaderRow`'s doc
     * comment), PLUS the badge's own internal left-margin+radius inset
     * (`BADGE_LEFT_MARGIN + BADGE_RADIUS`). Present ONLY on the header row
     * (rows[0]); `renderer-classifier-box.ts#renderBadge` reads it directly
     * instead of back-solving from the header TEXT row's `indent` (which,
     * post-N23, no longer shares the same offset -- `h1 !== h1 + h2` once
     * `h2 > 0`, the wider-box-centering case). Optional: hand-built test
     * geometries that bypass `measureGenericClassifier` omit it, falling
     * back to `renderBadge`'s own pre-N23 constant.
     */
    badgeIndent?: number;
    /**
     * G2 N23: `skinparam class { AttributeFontSize/AttributeFontName }`
     * (`FontParam.CLASS_ATTRIBUTE`) override -- present ONLY on the header
     * row (rows[0]) when the classifier's `measureGenericClassifier` box
     * uses a non-default font (jar-verified `jisanu-32-gado231`: overrides
     * the header text's OWN `<text>` attrs too, not just member rows -- see
     * `class-layout-helpers.ts`'s `buildHeaderRow` doc comment). Member rows
     * carry their own per-atom font via `atoms` instead
     * (`class-member-creole.ts#buildMemberRow` already receives the SAME
     * overridden fontSpec). Absent (falls back to `theme.fontFamily`/
     * `theme.fontSize`) for every classifier with no override -- zero
     * behavior change for the common case.
     */
    fontFamily?: string;
    fontSize?: number;
  }>;
  hideCircle?: boolean; // suppress the circle badge (hide circle directive)
  /**
   * G2 N7: true when `hide <entity|$tag|<<stereotype>>|*|@unlinked>`
   * (`class-directives.ts#computeHiddenIds`) matched this classifier — the
   * renderer skips ALL drawn content for it, but layout/uid numbering runs
   * exactly as if it were visible (matches jar: the entity keeps its svek
   * node/creationIndex slot, only its `<g class="entity">` disappears).
   */
  hidden?: boolean;
  usymbol?: string; // for kind 'descriptive': the keyword whose USymbol icon renders
  /**
   * G2 N2 (mechanism 3): parse-time creation order, copied unchanged from
   * `Classifier.creationIndex` (`ast.ts`'s doc comment) — feeds
   * `renderer-uid.ts#buildClassUidPlan`'s exact/fallback gate.
   */
  creationIndex?: number;
  /**
   * G2 N15 (README item #7): copied unchanged from `Classifier.url`
   * (`ast.ts`'s doc comment) — feeds `renderer.ts`'s `<a>`-wrap emission.
   */
  url?: UrlInfo;
  /** G2 N19: copied unchanged from `Classifier.syntheticIdName` (`ast.ts`'s
   *  doc comment) — feeds `renderer.ts#linkIdForSvg`'s couple/lollipop
   *  synthetic-name resolution. */
  syntheticIdName?: string;
  /** G2 N19: copied unchanged from `Classifier.phantomSlot` (`ast.ts`'s doc
   *  comment) — feeds `renderer-uid.ts#buildClassUidPlan`'s phantom-rank
   *  bookkeeping. */
  phantomSlot?: true;
  /** G2 N19: copied unchanged from `Classifier.noUidSlot` (`ast.ts`'s doc
   *  comment) — feeds `renderer-uid.ts#buildClassUidPlan`'s
   *  never-write-a-classifierUid rule for `kind: 'assoc-circle'`. */
  noUidSlot?: true;
  /** G2 N19: copied unchanged from `Classifier.subsumedLinkCreationIndex`
   *  (`ast.ts`'s doc comment) — feeds `renderer-uid.ts#buildClassUidPlan`'s
   *  subsumed-explicit-association phantom-rank bookkeeping. */
  subsumedLinkCreationIndex?: number;
  /** G2 N20: copied unchanged from `Classifier
   *  .invertedClassEdgeOldCreationIndex` (`ast.ts`'s doc comment) — feeds
   *  `renderer-uid.ts#buildClassUidPlan`'s repeat-coupling phantom-rank
   *  bookkeeping. */
  invertedClassEdgeOldCreationIndex?: number;
  /** G2 N20: copied unchanged from `Classifier
   *  .repeatCoupleInvisLinkCreationIndex` (`ast.ts`'s doc comment) — feeds
   *  `renderer-uid.ts#buildClassUidPlan`'s repeat-coupling phantom-rank
   *  bookkeeping. */
  repeatCoupleInvisLinkCreationIndex?: number;
  /** G2 N24: copied unchanged from `MeasuredClassifier.headerRowCount`
   *  (`class-layout-helpers.ts`'s doc comment) — feeds
   *  `renderer-classifier-box.ts#buildHeaderPrimitive`/`#buildBodyPrimitives`'s
   *  header-vs-body row split. */
  headerRowCount?: number;
  /** G2 N26: copied unchanged from `MeasuredClassifier.badgeChar`/
   *  `.badgeColor` (`class-layout-helpers.ts`'s doc comment) — feeds
   *  `renderer-classifier-box.ts#renderBadge`'s `resolveBadgeLetter`/
   *  `resolveBadgeFill` calls. */
  badgeChar?: string;
  badgeColor?: string;
  /** G2 N31: copied unchanged from `Classifier.color` (`ast.ts`'s doc
   *  comment) -- feeds `renderer-classifier-box.ts#classifierFill`'s
   *  inline `class Foo #color { ... }` background override. */
  color?: string;
  /** G2 N32: copied unchanged from `MeasuredClassifier.genericTag`
   *  (`class-layout-helpers.ts`'s doc comment) -- feeds `renderer-
   *  classifier-box.ts#renderGenericTag`. Omitted for every classifier with
   *  no `typeParams`. */
  genericTag?: GenericTagGeo;
  /** G2 N33: copied unchanged from `MeasuredClassifier.folderTab`
   *  (`class-layout-helpers.ts`'s doc comment) -- feeds `renderer.ts`'s
   *  unwrapped folder-icon render dispatch for a collapsed-empty
   *  `package`/`namespace` leaf. */
  folderTab?: EmptyPackageLeafDim;
  /** G2 N42: copied unchanged from `MeasuredClassifier.enhancedBody`
   *  (`class-layout-helpers.ts`'s doc comment) -- feeds `renderer-
   *  classifier-box.ts#buildBodyPrimitives`'s enhanced-body dispatch
   *  (`renderer-body-enhanced.ts#renderEnhancedBody`). Omitted for every
   *  classifier whose body does not trigger `class-body-enhanced.ts
   *  #isEnhancedBody`. */
  enhancedBody?: EnhancedBodyGeo;
  /** G2 N37: EVERY stereotype label (2-or-3-bracket, `class-stereotype.ts
   *  #resolveStyleStereotypeTags`) this classifier carries -- feeds
   *  `renderer-classifier-box.ts`'s `.tagname` `<style>` cascade lookup
   *  (`theme.colors.graph.classTagCascade`). Deliberately NOT the same list
   *  as the rendered stereotype row(s) (`rows[]`, visible-only) -- see
   *  `class-stereotype.ts#splitStereotypeTokens`'s own doc comment. Omitted
   *  for every classifier with no stereotype at all. */
  stereotypeLabels?: readonly string[];
  /** G2 N39: copied unchanged from `Classifier.styleGeneration` (`ast.ts`'s
   *  doc comment) -- feeds `style-cascade-class.ts#resolveClassTagCascadeEntry`'s
   *  position-scoped `.tagname` cascade lookup alongside {@link
   *  stereotypeLabels}. Omitted for every classifier the parser did not
   *  stamp (0-or-1-`<style>`-block sources, hand-built fixtures). */
  styleGeneration?: number;
}

export interface EdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
  /** G2/N25: `Relationship.fromMultiplicity`/`.toMultiplicity` (or the
   *  `fromRole`/`toRole` fallback -- SvekEdge.java:447-466), positioned by
   *  graphviz-ts's own external-label placement (`core/graph-layout.ts
   *  #extractPortLabelPositions`) -- the SAME `xladjust` search real
   *  graphviz runs, since upstream never sets `labelangle`/`labeldistance`
   *  on a class-diagram edge (dead `LinkArg` fields, see `DotInputEdge
   *  .attributes.tailLabel`'s own doc comment). `x`/`y` is the CENTER of
   *  the label box in this geometry's coordinate frame -- `renderer.ts`
   *  converts to the left/baseline anchor jar's own `<text>` emits. */
  tailLabel?: { text: string; x: number; y: number; width: number };
  headLabel?: { text: string; x: number; y: number; width: number };
  /** Arrow decoration at the target end (from the arrow's target-side head). */
  targetDecor: LinkDecor;
  /** Arrow decoration at the source end (from the arrow's source-side head). */
  sourceDecor: LinkDecor;
  dashed: boolean;
  /** G2 N2 (mechanism 3): copied from `Relationship.creationIndex`. */
  creationIndex?: number;
  /** G2 N2 (mechanism 3): the relationship's raw AST endpoints, for the
   *  `<g class="link" data-entity-1="..." data-entity-2="...">` wrapper
   *  and `<!--link X to Y-->` comment — `renderer-uid.ts` resolves these
   *  through the classifier/namespace uid maps. */
  from: string;
  to: string;
  /** G2 N9: copied from `Relationship.idEntity1`/`.idEntity2`/
   *  `.idEntity1Decor`/`.idEntity2Decor`/`.sourceLine` -- the `<path
   *  id="..." codeLine="...">` attributes (`renderer.ts#linkIdForSvg`).
   *  See `ast.ts#Relationship.idEntity1`'s doc comment. */
  idEntity1?: string;
  idEntity2?: string;
  idEntity1Decor?: LinkDecor;
  idEntity2Decor?: LinkDecor;
  sourceLine?: number;
  /**
   * G2/N16 Kind B: true when this edge's OWN connector was consumed by a
   * freestanding note's Opale zigzag notch (`note-freestanding.ts`) --
   * jar draws NO separate `<g class="link">` for it at all
   * (`SvekEdge#drawU`'s `if (opale) return;`), but the edge is kept in
   * `ClassGeometry.edges` (not filtered out) so `renderer-uid.ts`'s
   * dense-renumbering merge still counts its `creationIndex` slot -- jar's
   * real counter increments for EVERY parsed relationship regardless of
   * whether it ends up drawn, the same "consumed slot must still occupy a
   * rank" principle N15's own `phantomSlot` already established for notes.
   * Consulted by `renderer.ts`'s edge-render loop and
   * `layout-ink-extent.ts#buildInkBox` to skip drawing/ink-counting it.
   */
  consumedByOpaleNote?: true;
  /** G2 N19: copied unchanged from `Relationship.phantomSlot` (`ast.ts`'s
   *  doc comment) — feeds `renderer-uid.ts#buildClassUidPlan`'s
   *  synthetic-default-link phantom-rank bookkeeping. */
  phantomSlot?: true;
  /**
   * G2 N26: computed once (`class-geo-builders.ts#buildEdgeGeos`) via the
   * shared `core/svek/svek-edge-stroke.ts#strokeForStyle` formula from
   * `Relationship.lineStyleOverride`/`.thicknessOverride` — present ONLY
   * when the relationship carried a bracket-modifier override; absent
   * edges keep the pre-existing `dashed`-boolean-driven default below
   * (`renderer.ts#renderEdge`'s own fallback), zero behavior change for
   * the ~700 fixtures with no `-[...]->` bracket.
   */
  strokeWidth?: number;
  /** Paired with `strokeWidth` above — `UStroke#getDasharraySvg()`'s
   *  `[dashVisible, dashSpace]` tuple, `undefined` for a solid override. */
  strokeDasharray?: readonly [number, number];
  /** G2 N26: copied unchanged from `Relationship.colorOverride` (`ast.ts`'s
   *  doc comment) — raw, `#`-stripped color token, resolved through
   *  `HColorSet.ts#resolveColorToSvgHex` at render time. */
  colorOverride?: string;
}

export interface NamespaceGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /** G2 N17: the folder-tab's own title-tab width/height, pre-computed at
   *  layout time (`class-namespace-shape.ts#getWTitle`/`getHTitle`) -- the
   *  render phase stays a pure `geometry -> SVG string` function with no
   *  `StringMeasurer` of its own, matching `ClassifierGeo.rows[].text`'s
   *  established "measure once, at layout time" convention. */
  wtitle: number;
  htitle: number;
  /** G2 N17: pre-computed title baseline Y offset (relative to `y`) --
   *  see `class-namespace-shape.ts#getTitleBaselineOffset`'s doc comment. */
  baselineOffset: number;
  /** G2 N2 (mechanism 3): parse-time creation order, copied unchanged from
   *  `Namespace.creationIndex`. */
  creationIndex?: number;
}

export interface ClassGeometry {
  totalWidth: number;
  totalHeight: number;
  /**
   * G2 N46: the PRE-`CucaDiagram#getDefaultMargins()`/`SvgGraphics
   * #ensureVisible` ink-walk dims (`layout-ink-extent.ts
   * #computeClassRawInkDims`) -- what jar's `DiagramChromeFactory.create`
   * receives as `raw` and every `DecorateEntityImage#getTextX` centering
   * computation runs against, DISTINCT from `totalWidth`/`totalHeight`
   * (post-margin, post-quirk -- the correct value for a NO-chrome canvas).
   * Optional: `assembleShiftedGeometry`'s main DOT-driven path AND
   * `class-geo-builders.ts#degenerateSingleClassifier` (G2 N48, item 24's
   * first of 3 named sub-cases) both set it. The empty-diagram sentinel and
   * `layoutMultiPage`'s page-stacking combiner still leave it `undefined`
   * -- `renderer.ts#renderClass` and `index.ts#applyAnnotationChrome`'s
   * class branch fall back to `totalWidth`/`totalHeight` in that case
   * (today's behavior, unchanged; named remainder, not chased this
   * iteration -- see `plans/g2-class-svg/ledger.md` N48).
   */
  rawWidth?: number;
  rawHeight?: number;
  classifiers: ClassifierGeo[];
  edges: EdgeGeo[];
  namespaces: NamespaceGeo[];
  notes: NoteGeo[];
}

// ---------------------------------------------------------------------------
// Directive resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the final effective action for each hide/show target.
 * Later directives in the array override earlier ones (last writer wins).
 */
function resolveEffectiveActions(
  ast: ClassDiagramAST,
): Map<HideTarget, 'hide' | 'show'> {
  const effectiveAction = new Map<HideTarget, 'hide' | 'show'>();
  for (const directive of ast.directives) {
    effectiveAction.set(directive.target, directive.action);
  }
  return effectiveAction;
}

/**
 * Pre-measure every classifier, honoring "hide members" / "hide empty
 * members" / "hide empty fields" / "hide empty methods".
 *
 * G2 N10: `hide empty members` is NOT "hide the whole section when BOTH
 * compartments are empty" (the port's original reading) — upstream expands
 * it into TWO independent per-portion directives, one per compartment
 * (`CommandHideShowByGender.java:267-279`'s `emptyMembers` special case:
 * `hideOrShow(FIELD, emptyByGender(FIELD))` + `hideOrShow(METHOD,
 * emptyByGender(METHOD))`), so a classifier with fields but no methods gets
 * ONLY its (empty) methods compartment suppressed, fields stay fully drawn.
 * `hide empty fields`/`hide empty methods` map directly to one portion each
 * and were previously parsed into the AST but never consulted here at all
 * (dead directives) — jar-verified `mezucu-18-lozi106` (`hide empty
 * members` + a field-only class: jar draws ONE divider, not two).
 */
function preMeasureClassifiers(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
  effectiveActions: Map<HideTarget, 'hide' | 'show'>,
): Map<string, MeasuredClassifier> {
  const hideMembers      = effectiveActions.get('members')       === 'hide';
  const hideEmptyMembers = effectiveActions.get('empty members') === 'hide';
  const hideEmptyFields  = effectiveActions.get('empty fields')  === 'hide';
  const hideEmptyMethods = effectiveActions.get('empty methods') === 'hide';

  const measuredMap = new Map<string, MeasuredClassifier>();
  for (const classifier of ast.classifiers) {
    const visibleMembers = classifier.members.filter((m) => m.hidden !== true);
    // Object leaves route EVERY member into "fields" regardless of
    // method-like syntax (`BodierLikeClassOrObject#getFieldsToDisplay`'s
    // `type != LeafType.OBJECT` guard) — no separate methods compartment.
    const isObjectLike = classifier.kind === 'object';
    const fieldsEmpty = isObjectLike
      ? visibleMembers.length === 0
      : visibleMembers.filter((m) => !isMethodMember(m)).length === 0;
    const methodsEmpty = isObjectLike ? true : visibleMembers.filter(isMethodMember).length === 0;
    // G2 N26: entity-qualified `hide <entity> members|fields|attributes|
    // methods` (`class-directives.ts#applyHideShowEntityDirectives`) already
    // stamped these two flags directly onto the classifier post-parse --
    // OR'd in alongside the diagram-global targets above.
    const suppressFields  =
      hideMembers || ((hideEmptyMembers || hideEmptyFields)  && fieldsEmpty) ||
      classifier.suppressFields === true;
    const suppressMethods =
      hideMembers || ((hideEmptyMembers || hideEmptyMethods) && methodsEmpty) ||
      classifier.suppressMethods === true;
    measuredMap.set(
      classifier.id,
      measureClassifier(
        classifier, theme, measurer, { fields: suppressFields, methods: suppressMethods }, ast.sprites,
      ),
    );
  }
  return measuredMap;
}

// ---------------------------------------------------------------------------
// Ink-shift application (G2/N11) — post-dot-layout, pre-render uniform
// translate. `SvekResult#calculateDimension`'s own `moveDelta(6 - minMax
// .getMinX(), 6 - minMax.getMinY())` side effect (svek/SvekResult.java:133,
// see `layout-ink-extent.ts`'s own doc comment for the full jar citation).
// Shared by `layoutSinglePage` (the real ink shift, both axes) and
// `layoutMultiPage` (the y-only, OUR-OWN `NEWPAGE_GAP` page-stacking offset
// — same shape of translate, different origin, so the SAME helpers apply
// with `dx=0`).
// ---------------------------------------------------------------------------

/** Shift a ClassifierGeo's absolute position by `(dx, dy)`. */
function shiftClassifierGeo(c: ClassifierGeo, dx: number, dy: number): ClassifierGeo {
  return { ...c, x: c.x + dx, y: c.y + dy };
}

/** Shift a NamespaceGeo's absolute position by `(dx, dy)`. */
function shiftNamespaceGeo(n: NamespaceGeo, dx: number, dy: number): NamespaceGeo {
  return { ...n, x: n.x + dx, y: n.y + dy };
}

/** Shift every coordinate in an EdgeGeo by `(dx, dy)` (labels included). */
function shiftEdgeGeo(edge: EdgeGeo, dx: number, dy: number): EdgeGeo {
  return {
    ...edge,
    points: edge.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    ...(edge.label !== undefined
      ? { label: { text: edge.label.text, x: edge.label.x + dx, y: edge.label.y + dy } }
      : {}),
    ...(edge.tailLabel !== undefined
      ? { tailLabel: { ...edge.tailLabel, x: edge.tailLabel.x + dx, y: edge.tailLabel.y + dy } }
      : {}),
    ...(edge.headLabel !== undefined
      ? { headLabel: { ...edge.headLabel, x: edge.headLabel.x + dx, y: edge.headLabel.y + dy } }
      : {}),
  };
}

/** Shift every coordinate in a NoteGeo by `(dx, dy)` (connector included). */
function shiftNoteGeo(note: NoteGeo, dx: number, dy: number): NoteGeo {
  return {
    ...note,
    x: note.x + dx,
    y: note.y + dy,
    connector: note.connector.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

// ---------------------------------------------------------------------------
// Single-page layout (internal)
// ---------------------------------------------------------------------------

/**
 * Lay out a single class diagram page using the dot layout engine
 * (synchronous). Called once per page by `layoutClass` when `ast.pages` is
 * present (T7); called directly for the common single-page case.
 *
 * Nodes are pre-measured (D4); the dot engine handles routing and positioning.
 * Namespaces are flattened into the root graph (D5); their bounding boxes are
 * computed from classifier positions after layout.
 *
 * @param ast      - Parsed class diagram AST (one page's worth of content).
 * @param theme    - Visual theme for font metrics and sizing.
 * @param measurer - Text measurement implementation.
 * @returns        Pixel geometry for all classifiers, edges, and namespaces.
 */
function layoutSinglePage(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ClassGeometry {
  // Empty diagram (isDegeneratedWithFewEntities(0): 0 groups, 0 links, 0
  // leafs — leafs includes notes, so a lone freestanding note must NOT hit
  // this shortcut or it would be silently dropped) — zero-size result.
  if (
    ast.namespaces.length === 0 &&
    ast.relationships.length === 0 &&
    ast.classifiers.length === 0 &&
    ast.notes.length === 0
  ) {
    return { totalWidth: 0, totalHeight: 0, classifiers: [], edges: [], namespaces: [], notes: [] };
  }

  // Collapse any namespace left empty by parsing into a flat leaf classifier
  // (reopen-safe counterpart of the parse-time collapse — see
  // class-namespace.ts#collapseEmptyNamespacesFinal). Before measuring.
  const collapsedAst = collapseEmptyNamespacesFinal(ast);

  // Resolve effective hide/show directive actions (last writer wins per target)
  const effectiveActions = resolveEffectiveActions(collapsedAst);
  // Pre-measure all classifiers
  const measuredMap = preMeasureClassifiers(collapsedAst, theme, measurer, effectiveActions);

  // Degenerate diagram (0-1 entities, no relationships) — skip graphviz
  // entirely, mirroring GraphvizImageBuilder.buildImage:211-223. Checked on
  // the RAW ast: upstream's isDegeneratedWithFewEntities counts getLeafs()/
  // getLinks() UNFILTERED, so removed entities still count here (a graph
  // reduced to one node by `remove` still runs graphviz — pijode-83).
  const degenerate = degenerateSingleClassifier(collapsedAst, measuredMap);
  if (degenerate !== undefined) return degenerate;

  // remove/restore exclusion at the layout-input boundary — the port's
  // equivalent of upstream's export-time isRemoved() skips in
  // GraphvizImageBuilder (printEntities:350, printGroups:413, link:230).
  // Same object back when no remove directives exist (the common path).
  // Everything below — dot graph, note synthesis, geo building — sees only
  // the surviving entities, keeping edge-index alignment consistent.
  const effAst = filterRemovedEntities(collapsedAst);

  // Build dot graph (classifiers + notes flattened into root graph, D5)
  const { dotGraph, swappedEdges, noteParts, anchors } = buildDotGraph(effAst, measuredMap, theme, measurer);

  const result = layout(dotGraph);

  // Build position map from dot layout result
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));
  const hiddenIds = computeHiddenIds(effAst);
  const classifiers = buildClassifierGeos(effAst, measuredMap, posMap, hiddenIds);
  const namespaces = buildNamespaceGeos(effAst, posMap, theme, measurer, anchors);
  const edges = buildEdgeGeos(
    effAst, result, swappedEdges, measurer, theme.fontFamily, posMap, anchors,
    theme.colors.graph.arrowThickness,
  );
  // G2/N13: classifiers computed FIRST -- mapNoteGeos needs their positions
  // + row text to resolve member-tip (`::member`) note connectors. G2/N16
  // Kind B: a freestanding note's ONE real relationship connector (if any)
  // feeds the SAME Opale mechanism `mapGroupNoteGeos` already tries for an
  // attached single-link note (Kind C) -- `findFreestandingNoteConnectors`'s
  // own doc comment. `visibleEdges` drops whichever candidate edge actually
  // resolved via Opale (`n.opale !== undefined`) -- jar draws NO separate
  // `<g class="link">` for an opalisable note's connector at all
  // (`SvekEdge#drawU`'s `if (opale) return;`); a candidate that FAILED to
  // resolve (degenerate spline) keeps its ordinary edge draw, the same
  // safe fallback `buildOpaleNoteGeo ?? plainNoteGeo` already applies.
  const freestandingConnectors = findFreestandingNoteConnectors(effAst.notes, edges, effAst.classifiers);
  const notes: NoteGeo[] = mapNoteGeos(
    effAst.notes, result, noteParts, { classifiers, theme, measurer }, freestandingConnectors,
  );
  const opaleNoteIds = new Set(notes.filter((n) => n.opale !== undefined).map((n) => n.id));
  const consumedEdgeIds = new Set(
    [...freestandingConnectors.entries()]
      .filter(([noteId]) => opaleNoteIds.has(noteId))
      .map(([, edge]) => edge.id),
  );
  // NOT filtered out of `edges` -- `EdgeGeo.consumedByOpaleNote`'s own doc
  // comment: `renderer-uid.ts` still needs every edge's `creationIndex`
  // slot counted in the dense-renumbering merge, even one that never draws.
  const markedEdges = edges.map((e) =>
    consumedEdgeIds.has(e.id) ? { ...e, consumedByOpaleNote: true as const } : e,
  );

  return assembleShiftedGeometry(classifiers, namespaces, markedEdges, notes);
  // #lizard forgives -- linear orchestration (empty-diagram guard,
  // namespace-collapse, hide/show resolution, pre-measure, degenerate skip,
  // dot-graph build+layout, geo builders, final assembly), each step ALREADY
  // its own named helper (`class-geo-builders.ts`/`class-layout-helpers.ts`/
  // `class-directives.ts`) -- one extra assembly-call line over the NLOC cap
  // after G2/N11's `assembleShiftedGeometry` split; not reducible further
  // without a step count no upstream boundary justifies.
}

/**
 * G2/N11: dimensions first (translation-invariant, mirrors Java's own
 * evaluation order — `SvekResult#calculateDimension` reads the PRE-shift
 * `minMax`'s dimension before `moveDelta` ever runs), THEN apply the
 * uniform ink shift (`moveDelta`) EVERY already-laid-out position needs —
 * this port's raw graphviz-normalized positions were previously returned
 * unshifted, off by a constant `(dx, dy)` per fixture (the "~7-8px
 * multi-component/box position/margin residual" named since N7/N10 — see
 * `layout-ink-extent.ts`'s own doc comment for the jar citation and
 * derivation). Split out of `layoutSinglePage` to keep that function under
 * the project's per-function size cap.
 */
function assembleShiftedGeometry(
  classifiers: ClassifierGeo[],
  namespaces: NamespaceGeo[],
  edges: EdgeGeo[],
  notes: NoteGeo[],
): ClassGeometry {
  const documentDims = computeClassDocumentDims(classifiers, namespaces, edges, notes);
  // G2 N46: raw (pre-margin, pre-quirk) ink dims -- see `ClassGeometry
  // .rawWidth`'s own doc comment for why chrome centering needs this
  // instead of `documentDims`.
  const rawDims = computeClassRawInkDims(classifiers, namespaces, edges, notes);
  const shift = computeClassInkShift(classifiers, namespaces, edges, notes);

  return {
    totalWidth: documentDims.width,
    totalHeight: documentDims.height,
    rawWidth: rawDims.width,
    rawHeight: rawDims.height,
    classifiers: classifiers.map((c) => shiftClassifierGeo(c, shift.dx, shift.dy)),
    edges: edges.map((e) => shiftEdgeGeo(e, shift.dx, shift.dy)),
    namespaces: namespaces.map((n) => shiftNamespaceGeo(n, shift.dx, shift.dy)),
    notes: notes.map((n) => shiftNoteGeo(n, shift.dx, shift.dy)),
  };
}

// ---------------------------------------------------------------------------
// Multi-page (`newpage`) combination — T7
// ---------------------------------------------------------------------------

/**
 * Vertical gap (px) inserted between stacked pages. This offset is OURS, not
 * upstream's: upstream's `NewpagedDiagram` lays out each page as an
 * independent svek graph and (per `NewpagedDiagram.java`, which never
 * overrides `AbstractDiagram.getNbImages()`) the reference CLI only ever
 * exports page 1 as a separate file per source — there is no upstream
 * "stacked" rendering to match pixel-for-pixel. Since this library returns a
 * single SVG string rather than one file per page, we stack pages vertically
 * ourselves; see CHANGELOG.md.
 */
const NEWPAGE_GAP = 20;

/**
 * Lay out every page independently (each page is a complete, standalone
 * diagram per upstream `NewpagedDiagram` semantics — see T6/ast.ts), then
 * stack the resulting geometries vertically with `NEWPAGE_GAP` between them.
 * One dot-layout pass per non-degenerate page, in page order (a degenerate
 * page still contributes its own geometry via `layoutSinglePage`'s internal
 * skip — it just never reaches the graphviz call). Each page's own G2/N11
 * ink shift is already baked in by `layoutSinglePage` before this function
 * ever sees it; this is a SEPARATE, purely additive y-only offset (`dx=0`)
 * stacked on top.
 */
function layoutMultiPage(
  pages: ClassDiagramAST[],
  theme: Theme,
  measurer: StringMeasurer,
): ClassGeometry {
  const classifiers: ClassifierGeo[] = [];
  const edges: EdgeGeo[] = [];
  const namespaces: NamespaceGeo[] = [];
  const notes: NoteGeo[] = [];
  let maxWidth = 0;
  let yOffset = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const geo = layoutSinglePage(page, theme, measurer);
    const dy = yOffset;

    for (const c of geo.classifiers) classifiers.push(shiftClassifierGeo(c, 0, dy));
    for (const e of geo.edges) edges.push(shiftEdgeGeo(e, 0, dy));
    for (const n of geo.namespaces) namespaces.push(shiftNamespaceGeo(n, 0, dy));
    for (const n of geo.notes) notes.push(shiftNoteGeo(n, 0, dy));

    maxWidth = Math.max(maxWidth, geo.totalWidth);
    yOffset += geo.totalHeight;
    if (i < pages.length - 1) yOffset += NEWPAGE_GAP;
  }

  return { totalWidth: maxWidth, totalHeight: yOffset, classifiers, edges, namespaces, notes };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Lay out a class diagram using the dot layout engine (synchronous).
 *
 * When the source contained `newpage` (`ast.pages` is set — see ast.ts), each
 * page is laid out independently via `layoutSinglePage` and the resulting
 * geometries are stacked vertically (`layoutMultiPage`); otherwise the single
 * top-level AST is laid out directly, unchanged from pre-T7 behavior.
 *
 * @param ast      - Parsed class diagram AST.
 * @param theme    - Visual theme for font metrics and sizing.
 * @param measurer - Text measurement implementation.
 * @returns        Pixel geometry for all classifiers, edges, and namespaces.
 */
export function layoutClass(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
): ClassGeometry {
  if (ast.pages !== undefined) return layoutMultiPage(ast.pages, theme, measurer);
  return layoutSinglePage(ast, theme, measurer);
}
