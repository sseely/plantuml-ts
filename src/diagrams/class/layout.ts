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
 */

import type {
  ClassDiagramAST,
  ClassifierKind,
  HideTarget,
  LinkDecor,
  Relationship,
  Visibility,
} from './ast.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { layoutGraph as layout } from '../../core/graph-layout.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import { filterRemovedEntities, computeHiddenIds } from './class-directives.js';
import { collapseEmptyNamespacesFinal } from './class-namespace.js';
import { mapNoteGeos, type NoteGeo } from './note-layout.js';
import {
  measureClassifier,
  type MeasuredClassifier,
} from './class-layout-helpers.js';
import { buildDotGraph, EDGE_DECORATION_MAP } from './class-dot-graph.js';
import { computeClassDocumentDims } from './layout-ink-extent.js';

export { formatMemberText, ROW_TEXT_LEFT_MARGIN } from './class-layout-helpers.js';

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
}

export interface EdgeGeo {
  id: string;
  points: Array<{ x: number; y: number }>;
  label?: { text: string; x: number; y: number };
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
}

export interface NamespaceGeo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  /** G2 N2 (mechanism 3): parse-time creation order, copied unchanged from
   *  `Namespace.creationIndex`. */
  creationIndex?: number;
}

export interface ClassGeometry {
  totalWidth: number;
  totalHeight: number;
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

/** Pre-measure every classifier, honoring "hide members" / "hide empty members". */
function preMeasureClassifiers(
  ast: ClassDiagramAST,
  theme: Theme,
  measurer: StringMeasurer,
  effectiveActions: Map<HideTarget, 'hide' | 'show'>,
): Map<string, MeasuredClassifier> {
  const hideMembers  = effectiveActions.get('members')       === 'hide';
  const hideEmptyMem = effectiveActions.get('empty members') === 'hide';

  const measuredMap = new Map<string, MeasuredClassifier>();
  for (const classifier of ast.classifiers) {
    // suppressMemberSection when:
    //   - "hide members" is active (all members hidden for every classifier), OR
    //   - "hide empty members" is active AND this classifier has no visible members
    const visibleCount = classifier.members.filter((m) => m.hidden !== true).length;
    const suppressMemberSection = hideMembers || (hideEmptyMem && visibleCount === 0);
    measuredMap.set(
      classifier.id,
      measureClassifier(classifier, theme, measurer, suppressMemberSection),
    );
  }
  return measuredMap;
}

/** Build ClassifierGeo entries from pre-measured sizes + dot-assigned positions. */
function buildClassifierGeos(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  hiddenIds: ReadonlySet<string>,
): ClassifierGeo[] {
  const classifiers: ClassifierGeo[] = [];
  for (const classifier of ast.classifiers) {
    const pos = posMap.get(classifier.id);
    const measured = measuredMap.get(classifier.id);
    if (pos === undefined || measured === undefined) continue;

    classifiers.push({
      id: classifier.id,
      kind: classifier.kind,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      dividerYs: measured.dividerYs,
      rows: measured.rows,
      ...(classifier.hideCircle === true ? { hideCircle: true } : {}),
      ...(classifier.usymbol !== undefined ? { usymbol: classifier.usymbol } : {}),
      ...(classifier.creationIndex !== undefined ? { creationIndex: classifier.creationIndex } : {}),
      ...(hiddenIds.has(classifier.id) ? { hidden: true } : {}),
    });
  }
  return classifiers;
}

/** Build NamespaceGeo entries by computing bounds from member classifier positions. */
function buildNamespaceGeos(
  ast: ClassDiagramAST,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
): NamespaceGeo[] {
  const namespaces: NamespaceGeo[] = [];
  for (const ns of ast.namespaces) {
    const memberPositions = ns.classifiers
      .map((id) => posMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (memberPositions.length === 0) continue;

    const padding = 16;
    const topPad = 28;
    const minX = Math.min(...memberPositions.map((p) => p.x)) - padding;
    const minY = Math.min(...memberPositions.map((p) => p.y)) - topPad;
    const maxX = Math.max(...memberPositions.map((p) => p.x + p.width)) + padding;
    const maxY = Math.max(...memberPositions.map((p) => p.y + p.height)) + padding;

    namespaces.push({
      id: ns.id,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      label: ns.display,
      ...(ns.creationIndex !== undefined ? { creationIndex: ns.creationIndex } : {}),
    });
  }
  return namespaces;
}

/** Attach the edge label (geometric midpoint, offset right-perpendicular) if present. */
function attachEdgeLabel(
  edgeGeo: EdgeGeo,
  rel: Relationship,
  pts: Array<{ x: number; y: number }>,
): void {
  if (rel.label === undefined) return;

  const n = pts.length;
  const lo = Math.floor((n - 1) / 2);
  const hi = Math.ceil((n - 1) / 2);
  const mid = {
    x: (pts[lo]!.x + pts[hi]!.x) / 2,
    y: (pts[lo]!.y + pts[hi]!.y) / 2,
  };
  const first = pts[0]!;
  const last = pts[n - 1]!;
  const edgeDx = last.x - first.x;
  const edgeDy = last.y - first.y;
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
  const LABEL_OFFSET = 10;
  edgeGeo.label = {
    text: rel.label,
    x: mid.x + (edgeDy / edgeLen) * LABEL_OFFSET,
    y: mid.y + (-edgeDx / edgeLen) * LABEL_OFFSET,
  };
}

/**
 * Build EdgeGeo entries from the dot layout result, reversing hierarchical
 * edges. G2 N8: an `invis: true` relationship (the association-class-couple
 * sibling-circle connector, `class-assoc-couple.ts#makeCoupleCircle`) is
 * skipped entirely -- it still constrains the DOT layout (`style=invis`,
 * `class-dot-graph.ts`) but is NEVER drawn, matching upstream's own
 * early-return for an invisible link (`svek/SvekEdge.java#drawU`/
 * `#solveLine`, both `if (link.isInvis()) return;` before emitting any
 * `<g>`/comment/path at all).
 */
function buildEdgeGeos(
  ast: ClassDiagramAST,
  result: DotLayoutResult,
  swappedEdges: Set<number>,
): EdgeGeo[] {
  const edges: EdgeGeo[] = [];
  for (let i = 0; i < ast.relationships.length; i++) {
    const rel = ast.relationships[i]!;
    if (rel.invis === true) continue;
    const edgeResult = result.edges.find((e) => e.id === `edge-${i}`);
    if (edgeResult === undefined) continue;

    const decor = EDGE_DECORATION_MAP[rel.type];
    // Reverse points for hierarchical edges so the visual arrow flows child →
    // parent with the triangle at the parent end (dot routes parent → child).
    const rawPts = edgeResult.points;
    const pts = swappedEdges.has(i) ? [...rawPts].reverse() : rawPts;
    const edgeGeo: EdgeGeo = {
      id: edgeResult.id,
      points: pts,
      targetDecor: rel.targetDecor ?? decor.targetDecor,
      sourceDecor: rel.sourceDecor ?? decor.sourceDecor,
      // G2 N8: `rel.dashed` overrides the type-derived default for the
      // association-class couple's class-link edge -- see `Relationship
      // .dashed`'s own doc comment (ast.ts).
      dashed: rel.dashed ?? decor.dashed,
      from: rel.from,
      to: rel.to,
      ...(rel.creationIndex !== undefined ? { creationIndex: rel.creationIndex } : {}),
      ...(rel.idEntity1 !== undefined ? { idEntity1: rel.idEntity1 } : {}),
      ...(rel.idEntity2 !== undefined ? { idEntity2: rel.idEntity2 } : {}),
      ...(rel.idEntity1Decor !== undefined ? { idEntity1Decor: rel.idEntity1Decor } : {}),
      ...(rel.idEntity2Decor !== undefined ? { idEntity2Decor: rel.idEntity2Decor } : {}),
      ...(rel.sourceLine !== undefined ? { sourceLine: rel.sourceLine } : {}),
    };

    attachEdgeLabel(edgeGeo, rel, pts);
    edges.push(edgeGeo);
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Degenerate-diagram skip (0-1 entities -> no DOT graph)
// ---------------------------------------------------------------------------

/**
 * `GraphvizImageBuilder.buildImage:211-223` gates graphviz entirely on
 * `dotData.isDegeneratedWithFewEntities(nb)` (`dot/DotData.java:69-71`):
 * `entityFactory.groups().size() == 0 && getLinks().size() == 0 &&
 * getLeafs().size() == nb`. "Groups" means ANY declared namespace/package —
 * even an empty one still creates a group entity, so `ast.namespaces` (never
 * filtered for emptiness — see `Namespace` in ast.ts) is the exact raw-group
 * proxy; no "non-empty namespace" filtering like `buildDotClusters` applies
 * here. "Leafs" (`CucaDiagram#leafs()`) counts every non-group entity,
 * INCLUDING notes (`LeafType.NOTE` created via `reallyCreateLeaf`) — so a
 * class with one attached or floating note is NOT degenerate (2 leafs).
 *
 * We only special-case the single-*classifier* leaf here (the `nb === 1`
 * path: `createEntityImageBlock` + the hexagon guard at
 * `GraphvizImageBuilder.java:217`, `single.getUSymbol() instanceof
 * USymbolHexagon == false`). A lone freestanding note (zero classifiers, one
 * note) falls through to the normal dot path — out of scope for this port;
 * see the T5 task report for the rationale.
 */
function degenerateSingleClassifier(
  ast: ClassDiagramAST,
  measuredMap: Map<string, MeasuredClassifier>,
): ClassGeometry | undefined {
  if (ast.namespaces.length !== 0) return undefined;
  if (ast.relationships.length !== 0) return undefined;
  if (ast.classifiers.length !== 1 || ast.notes.length !== 0) return undefined;
  const classifier = ast.classifiers[0]!;
  if (classifier.kind === 'descriptive' && classifier.usymbol === 'hexagon') return undefined;
  const measured = measuredMap.get(classifier.id)!;

  // `EntityImageDegenerated.java`: `delta = 7`, applied as a translate on
  // BOTH edges (`drawU`: `orig.drawU(ug.apply(new UTranslate(delta,
  // delta)))`, then an empty `(delta, delta)` block appended at the far
  // corner) -- so `calculateDimension` grows by `delta*2 = 14` total. A
  // FURTHER flat +6 (both axes) is added upstream of `GraphvizImageBuilder`
  // (page-level margin; exact Java origin not pinned this iteration): total
  // near-edge margin (left/top) = 7; far-edge margin (right/bottom) = 13.
  // Jar's own canvas `width`/`height`/`viewBox` are whole-pixel, even
  // though internal element geometry stays fractional -- G2 N4: the
  // whole-pixel conversion is TRUNCATION (`Math.floor`), NOT rounding --
  // N3's own `Math.round` was verified against only integer/near-integer
  // totals (68 exactly, twice) and one width whose fractional part
  // happened to be < 0.5, masking the direction; jar-verified with ZERO
  // residual against 7 fresh fixtures whose fractional part is >= 0.5
  // (e.g. `dimile-20-saki799`: `54.575 + 20 = 74.575` -> jar `74`, NOT the
  // `75` `Math.round` would produce -- `plans/g2-class-svg/ledger.md` N4).
  const DEGENERATE_NEAR_MARGIN = 7;
  const DEGENERATE_FAR_MARGIN = 13;
  const geo: ClassifierGeo = {
    id: classifier.id,
    kind: classifier.kind,
    x: DEGENERATE_NEAR_MARGIN,
    y: DEGENERATE_NEAR_MARGIN,
    width: measured.width,
    height: measured.height,
    dividerYs: measured.dividerYs,
    rows: measured.rows,
    ...(classifier.hideCircle === true ? { hideCircle: true } : {}),
    ...(classifier.usymbol !== undefined ? { usymbol: classifier.usymbol } : {}),
  };
  return {
    totalWidth: Math.floor(measured.width + DEGENERATE_NEAR_MARGIN + DEGENERATE_FAR_MARGIN),
    totalHeight: Math.floor(measured.height + DEGENERATE_NEAR_MARGIN + DEGENERATE_FAR_MARGIN),
    classifiers: [geo],
    edges: [],
    namespaces: [],
    notes: [],
  };
  // #lizard forgives — flat chain of early-return guards encoding upstream's
  // single conjunctive predicate (isDegeneratedWithFewEntities) plus the
  // hexagon exclusion, mirroring description's degenerateSingleLeaf; not
  // reducible without splitting one upstream check across functions.
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
  const { dotGraph, swappedEdges, noteParts } = buildDotGraph(effAst, measuredMap, theme, measurer);

  const result = layout(dotGraph);

  // Build position map from dot layout result
  const posMap = new Map(result.nodes.map((n) => [n.id, n]));
  const { measurements, groups } = noteParts;
  const notes: NoteGeo[] = mapNoteGeos(effAst.notes, measurements, posMap, result, groups);
  const hiddenIds = computeHiddenIds(effAst);
  const classifiers = buildClassifierGeos(effAst, measuredMap, posMap, hiddenIds);
  const namespaces = buildNamespaceGeos(effAst, posMap);
  const edges = buildEdgeGeos(effAst, result, swappedEdges);

  const documentDims = computeClassDocumentDims(classifiers, namespaces, edges, notes);

  return {
    totalWidth: documentDims.width,
    totalHeight: documentDims.height,
    classifiers,
    edges,
    namespaces,
    notes,
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

/** Shift every coordinate in an EdgeGeo down by `dy` (label included). */
function offsetEdgeGeo(edge: EdgeGeo, dy: number): EdgeGeo {
  return {
    ...edge,
    points: edge.points.map((p) => ({ x: p.x, y: p.y + dy })),
    ...(edge.label !== undefined
      ? { label: { text: edge.label.text, x: edge.label.x, y: edge.label.y + dy } }
      : {}),
  };
}

/** Shift every coordinate in a NoteGeo down by `dy` (connector included). */
function offsetNoteGeo(note: NoteGeo, dy: number): NoteGeo {
  return {
    ...note,
    y: note.y + dy,
    connector: note.connector.map((p) => ({ x: p.x, y: p.y + dy })),
  };
}

/**
 * Lay out every page independently (each page is a complete, standalone
 * diagram per upstream `NewpagedDiagram` semantics — see T6/ast.ts), then
 * stack the resulting geometries vertically with `NEWPAGE_GAP` between them.
 * One dot-layout pass per non-degenerate page, in page order (a degenerate
 * page still contributes its own geometry via `layoutSinglePage`'s internal
 * skip — it just never reaches the graphviz call).
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

    for (const c of geo.classifiers) classifiers.push({ ...c, y: c.y + dy });
    for (const e of geo.edges) edges.push(offsetEdgeGeo(e, dy));
    for (const n of geo.namespaces) namespaces.push({ ...n, y: n.y + dy });
    for (const n of geo.notes) notes.push(offsetNoteGeo(n, dy));

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
