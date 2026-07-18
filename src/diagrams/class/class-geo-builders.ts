/**
 * class-geo-builders.ts — pure `ClassifierGeo`/`NamespaceGeo`/`EdgeGeo`
 * builders + the degenerate single-classifier skip, split out of
 * `layout.ts` to keep that file under the project's per-file size cap
 * (mirrors the existing `class-layout-helpers.ts` split precedent — see
 * `layout.ts`'s own file-header doc comment). Every function here was
 * originally a verbatim move; G2 N17 changed `buildNamespaceGeos`'s
 * footprint formula (was an invented flat padding, now the jar-verified
 * folder-tab-driven formula — see `class-namespace-shape.ts`).
 */
import type { ClassDiagramAST, Relationship } from './ast.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import type { MeasuredClassifier } from './class-layout-helpers.js';
import type { Theme } from '../../core/theme.js';
import type { StringMeasurer } from '../../core/measurer.js';
import { EDGE_DECORATION_MAP } from './class-dot-graph.js';
import { strokeForStyle } from '../../core/svek/svek-edge-stroke.js';
import { CARDINALITY_FONT_SIZE } from './class-layout-helpers.js';
import { javaRound4 } from '../../core/number-format.js';
import {
  getHTitle,
  getWTitle,
  getTitleBaselineOffset,
  NAMESPACE_TOP_EXTRA,
  NAMESPACE_SIDE_PADDING,
} from './class-namespace-shape.js';
import { resolveStyleStereotypeTags } from './class-stereotype.js';
import type { ClassifierGeo, EdgeGeo, NamespaceGeo, ClassGeometry } from './layout.js';

/** Build ClassifierGeo entries from pre-measured sizes + dot-assigned positions. */
export function buildClassifierGeos(
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
      ...(measured.headerRowCount !== undefined ? { headerRowCount: measured.headerRowCount } : {}),
      ...(measured.badgeChar !== undefined ? { badgeChar: measured.badgeChar } : {}),
      ...(measured.badgeColor !== undefined ? { badgeColor: measured.badgeColor } : {}),
      ...(measured.genericTag !== undefined ? { genericTag: measured.genericTag } : {}),
      ...(measured.folderTab !== undefined ? { folderTab: measured.folderTab } : {}),
      ...(classifier.hideCircle === true ? { hideCircle: true } : {}),
      ...(classifier.usymbol !== undefined ? { usymbol: classifier.usymbol } : {}),
      ...(classifier.creationIndex !== undefined ? { creationIndex: classifier.creationIndex } : {}),
      ...(classifier.url !== undefined ? { url: classifier.url } : {}),
      ...(classifier.color !== undefined ? { color: classifier.color } : {}),
      ...(classifier.syntheticIdName !== undefined ? { syntheticIdName: classifier.syntheticIdName } : {}),
      ...(classifier.phantomSlot === true ? { phantomSlot: true as const } : {}),
      ...(classifier.noUidSlot === true ? { noUidSlot: true as const } : {}),
      ...(classifier.subsumedLinkCreationIndex !== undefined
        ? { subsumedLinkCreationIndex: classifier.subsumedLinkCreationIndex }
        : {}),
      ...(classifier.invertedClassEdgeOldCreationIndex !== undefined
        ? { invertedClassEdgeOldCreationIndex: classifier.invertedClassEdgeOldCreationIndex }
        : {}),
      ...(classifier.repeatCoupleInvisLinkCreationIndex !== undefined
        ? { repeatCoupleInvisLinkCreationIndex: classifier.repeatCoupleInvisLinkCreationIndex }
        : {}),
      ...(hiddenIds.has(classifier.id) ? { hidden: true } : {}),
      ...(classifier.stereotype !== undefined
        ? { stereotypeLabels: resolveStyleStereotypeTags(classifier) }
        : {}),
      ...(classifier.styleGeneration !== undefined
        ? { styleGeneration: classifier.styleGeneration }
        : {}),
    });
  }
  return classifiers;
}

/**
 * Build NamespaceGeo entries by computing bounds from member classifier
 * positions plus the folder-tab's own footprint constants -- G2 N17
 * (`class-namespace-shape.ts`'s own doc comments carry the jar evidence):
 * `NAMESPACE_SIDE_PADDING` (16, unchanged) on left/right/bottom,
 * `getHTitle(...) + NAMESPACE_TOP_EXTRA` on top (was an invented flat 28;
 * jar-verified `htitle + 13` at TWO independent font sizes). `wtitle`/
 * `htitle` are stored on the returned `NamespaceGeo` so the render phase
 * never needs its own `StringMeasurer` (see `NamespaceGeo`'s own doc
 * comment in `layout.ts`).
 */
export function buildNamespaceGeos(
  ast: ClassDiagramAST,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  theme: Theme,
  measurer: StringMeasurer,
  anchors: ReadonlyMap<string, string>,
): NamespaceGeo[] {
  const namespaces: NamespaceGeo[] = [];
  for (const ns of ast.namespaces) {
    const memberPositions = ns.classifiers
      .map((id) => posMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    // G2 N18: a package used as a relationship/note endpoint carries a REAL
    // `zaent-*` point anchor as an extra direct member of its own dot
    // cluster (`class-dot-graph.ts#buildDotClusters`), occupying a rank
    // slot ABOVE the topmost classifier -- `ns.classifiers` alone misses
    // it, undercounting the footprint's top extent by the anchor's own
    // rank offset (jar-verified 41px vs the base 33px top gap,
    // `plans/g2-class-svg/ledger.md` N17/N18). Folding the anchor's own
    // dot-assigned position into the SAME min/max walk (rather than a
    // special-cased extra offset) keeps left/right/bottom correct too, in
    // case the anchor ever lands off-center.
    const anchorId = anchors.get(ns.id);
    const anchorPos = anchorId !== undefined ? posMap.get(anchorId) : undefined;
    if (anchorPos !== undefined) memberPositions.push(anchorPos);

    if (memberPositions.length === 0) continue;

    const htitle = getHTitle(measurer, theme, ns.display);
    const wtitle = getWTitle(measurer, theme, ns.display, 0);
    const baselineOffset = getTitleBaselineOffset(measurer, theme, ns.display);
    const topPad = htitle + NAMESPACE_TOP_EXTRA;
    const minX = Math.min(...memberPositions.map((p) => p.x)) - NAMESPACE_SIDE_PADDING;
    const minY = Math.min(...memberPositions.map((p) => p.y)) - topPad;
    const maxX = Math.max(...memberPositions.map((p) => p.x + p.width)) + NAMESPACE_SIDE_PADDING;
    const maxY = Math.max(...memberPositions.map((p) => p.y + p.height)) + NAMESPACE_SIDE_PADDING;

    namespaces.push({
      id: ns.id,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      label: ns.display,
      wtitle,
      htitle,
      baselineOffset,
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
 * Convert a `graph-layout.ts#extractPortLabelPositions` CENTER point into
 * the left/baseline anchor jar's own `<text>` emits (no `text-anchor`/
 * `dominant-baseline` attribute at all -- unlike the pre-existing `label`
 * center-label render, which uses `dominant-baseline:middle`, this mirrors
 * every OTHER text element in this engine's own established convention,
 * `class-member-rows.ts`'s doc comment: "un-centered `<text>`... `y =
 * lineTop + baselineOffset`"). `measurer`/`CARDINALITY_FONT_SIZE` give the
 * SAME box graphviz-ts itself measured the text with (`core/graph-layout.ts
 * #addEdges`'s `labelfontsize`), so the conversion is self-consistent.
 */
function portLabelAnchor(
  text: string,
  center: { x: number; y: number },
  measurer: StringMeasurer,
  fontFamily: string,
): { text: string; x: number; y: number; width: number } {
  const font = { family: fontFamily, size: CARDINALITY_FONT_SIZE };
  const m = measurer.measure(text, font);
  const baselineOffset = CARDINALITY_FONT_SIZE - measurer.getDescent(font, text);
  // G2 N35: `javaRound4` -- every OTHER measured width in this engine
  // rounds through it (`class-layout-helpers.ts#measureClassifier`'s
  // header/row widths, `note-layout.ts#measureNote`'s per-line widths);
  // this was the one measured-width field left as a raw float, producing
  // spurious `textLength` mismatches against jar's `%.4f`-formatted value
  // (jar-verified `jaloja-18-tisu915`: `19.418750000000003` vs jar's
  // `19.4188`).
  const width = javaRound4(m.width);
  return {
    text,
    x: center.x - width / 2,
    y: center.y - m.height / 2 + baselineOffset,
    width,
  };
}

/** Attach `tailLabel`/`headLabel` (G2/N25) if `graph-layout.ts` computed a
 *  position for them -- absent when the relationship carries no
 *  `fromMultiplicity`/`toMultiplicity` (`edgeLabelAttrs` then never set
 *  `tailLabel`/`headLabel` on the DOT input, so `extractPortLabelPositions`
 *  never ran for this edge). */
function attachPortLabels(
  edgeGeo: EdgeGeo,
  rel: Relationship,
  edgeResult: DotLayoutResult['edges'][number],
  measurer: StringMeasurer,
  fontFamily: string,
): void {
  if (rel.fromMultiplicity !== undefined && edgeResult.tailLabelX !== undefined && edgeResult.tailLabelY !== undefined) {
    edgeGeo.tailLabel = portLabelAnchor(
      rel.fromMultiplicity, { x: edgeResult.tailLabelX, y: edgeResult.tailLabelY }, measurer, fontFamily,
    );
  }
  if (rel.toMultiplicity !== undefined && edgeResult.headLabelX !== undefined && edgeResult.headLabelY !== undefined) {
    edgeGeo.headLabel = portLabelAnchor(
      rel.toMultiplicity, { x: edgeResult.headLabelX, y: edgeResult.headLabelY }, measurer, fontFamily,
    );
  }
}

/**
 * G2 N26: `-[#color]->`/`-[bold]->`/`-[thickness=N]->` bracket-modifier
 * render overrides -- computed ONLY when the relationship actually
 * carried one (`Relationship.lineStyleOverride`/`.thicknessOverride`/
 * `.colorOverride`, all `undefined` for the ~700 fixtures with no
 * bracket), reusing the shared `LinkStyle#getStroke3()` formula
 * (`core/svek/svek-edge-stroke.ts#strokeForStyle`) description's own
 * edge renderer already uses for the identical upstream mechanism (see
 * `Relationship.lineStyleOverride`'s doc comment, ast.ts). Absent when
 * `!hasOverride` -- `renderer.ts#renderEdge` falls back to the
 * pre-existing `dashed`-boolean-driven default in that case, zero
 * behavior change for every other edge.
 */
function buildStrokeOverride(
  rel: Relationship,
  dashed: boolean,
): Pick<EdgeGeo, 'strokeWidth' | 'strokeDasharray' | 'colorOverride'> {
  const hasOverride =
    rel.lineStyleOverride !== undefined ||
    rel.thicknessOverride !== undefined ||
    rel.colorOverride !== undefined;
  if (!hasOverride) return {};
  const style = rel.lineStyleOverride ?? (dashed ? 'dashed' : 'solid');
  const stroke = strokeForStyle(style, rel.thicknessOverride);
  const dasharray = stroke.getDasharraySvg();
  return {
    strokeWidth: stroke.getThickness(),
    ...(dasharray !== undefined ? { strokeDasharray: dasharray } : {}),
    ...(rel.colorOverride !== undefined ? { colorOverride: rel.colorOverride } : {}),
  };
}

/** Node-center lookup for `normalizeEdgePoints` below -- resolves a
 *  namespace endpoint through its DOT point anchor the same way
 *  `class-dot-graph.ts#buildDotEdges` does for the edge itself. */
function nodeCenter(
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  anchors: Map<string, string>,
  id: string,
): { x: number; y: number } | undefined {
  const pos = posMap.get(anchors.get(id) ?? id);
  return pos === undefined ? undefined : { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
}

function pointDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Normalize a raw dot-returned point list to run `idEntity1FullId` ->
 * `idEntity2FullId`, mirroring jar's `SvekEdge.java#solveLine:637-654`
 * exactly: after layout, if the path is closer (summed endpoint distance)
 * to node2->node1 than node1->node2, reverse it. REPLACES the prior
 * hardcoded "always reverse hierarchical edges" rule -- jar's real check is
 * distance-based and type-agnostic, not gated by relationship type at all
 * (byte-diff evidence against `bivize-12-xiko303`'s single extension edge,
 * `plans/g2-class-svg/ledger.md` N30). Falls back to the pre-existing
 * `swappedEdges`-index reversal for relationships built outside the
 * arrow-token/inline-inheritance grammar (couples/lollipop/map rows,
 * `idEntity1FullId` absent -- see that field's own doc comment, ast.ts).
 *
 * Returns `matchesFromTo` alongside `points` so the caller can keep
 * `sourceDecor`/`targetDecor` correctly paired with `points[0]`/
 * `points[last]` WITHOUT reading `idEntity1Decor`/`idEntity2Decor` --
 * those track a separately-computed decor pair
 * (`class-relationship-parser.ts#parseArrowDecorsRaw`) that a jar-verified
 * corpus probe (G2 N30, `bob x--> alice`) found genuinely diverges from
 * `sourceDecor`/`targetDecor` for cross (`x`) notation -- an unrelated,
 * pre-existing bug in that OTHER field, out of this mechanism's scope
 * (`idEntity1Decor`/`idEntity2Decor` are only jar-verified for the
 * `<path id>` string, N9). `matchesFromTo` sidesteps it entirely: `true`
 * when `points[0]` is `rel.from`'s end (so `sourceDecor`/`targetDecor` need
 * no swap -- the common case, identical to pre-N30 behavior), `false` when
 * the entity-distance check (or, for non-arrow-grammar edges, the
 * `swappedEdges` fallback) flipped the array so `points[0]` is `rel.to`'s
 * end instead.
 */
interface NormalizedEdgePoints {
  points: Array<{ x: number; y: number }>;
  matchesFromTo: boolean;
}

function normalizeEdgePoints(
  rawPts: Array<{ x: number; y: number }>,
  rel: Relationship,
  i: number,
  swappedEdges: Set<number>,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  anchors: Map<string, string>,
): NormalizedEdgePoints {
  // `rawPts` (dot tail->head) is `rel.to -> rel.from` when the DOT graph
  // swapped this edge for hierarchical ranking (`class-dot-graph.ts
  // #buildDotEdges`'s `swap`), else `rel.from -> rel.to`.
  const dotSwap = swappedEdges.has(i);
  const start = rawPts[0];
  const end = rawPts[rawPts.length - 1];
  let reversed = dotSwap;
  if (rel.idEntity1FullId !== undefined && rel.idEntity2FullId !== undefined && start !== undefined && end !== undefined) {
    const c1 = nodeCenter(posMap, anchors, rel.idEntity1FullId);
    const c2 = nodeCenter(posMap, anchors, rel.idEntity2FullId);
    if (c1 !== undefined && c2 !== undefined) {
      const normal = pointDist(start, c1) + pointDist(end, c2);
      const inversed = pointDist(start, c2) + pointDist(end, c1);
      reversed = inversed < normal;
    }
  }
  const points = reversed ? [...rawPts].reverse() : [...rawPts];
  // points[0] is rel.from's end iff exactly one of {dotSwap, reversed} holds.
  const matchesFromTo = dotSwap === reversed;
  return { points, matchesFromTo };
}

/**
 * Build EdgeGeo entries from the dot layout result, normalizing each edge's
 * drawn direction (see `normalizeEdgePoints`). G2 N8: an `invis: true`
 * relationship (the association-class-couple sibling-circle connector,
 * `class-assoc-couple.ts#makeCoupleCircle`) is skipped entirely -- it still
 * constrains the DOT layout (`style=invis`, `class-dot-graph.ts`) but is
 * NEVER drawn, matching upstream's own early-return for an invisible link
 * (`svek/SvekEdge.java#drawU`/`#solveLine`, both `if (link.isInvis())
 * return;` before emitting any `<g>`/comment/path at all).
 */
export function buildEdgeGeos(
  ast: ClassDiagramAST,
  result: DotLayoutResult,
  swappedEdges: Set<number>,
  measurer: StringMeasurer,
  fontFamily: string,
  posMap: Map<string, DotLayoutResult['nodes'][number]>,
  anchors: Map<string, string>,
): EdgeGeo[] {
  const edges: EdgeGeo[] = [];
  for (let i = 0; i < ast.relationships.length; i++) {
    const rel = ast.relationships[i]!;
    if (rel.invis === true) continue;
    const edgeResult = result.edges.find((e) => e.id === `edge-${i}`);
    if (edgeResult === undefined) continue;

    const decor = EDGE_DECORATION_MAP[rel.type];
    const rawPts = edgeResult.points;
    const { points: pts, matchesFromTo } = normalizeEdgePoints(rawPts, rel, i, swappedEdges, posMap, anchors);
    // G2 N8: `rel.dashed` overrides the type-derived default for the
    // association-class couple's class-link edge -- see `Relationship
    // .dashed`'s own doc comment (ast.ts).
    const dashed = rel.dashed ?? decor.dashed;
    // G2 N30: keep sourceDecor/targetDecor paired with points[0]/points
    // [last] -- swap them together with `pts` when `normalizeEdgePoints`
    // flipped the array relative to `rel.from`/`rel.to` (see that
    // function's own doc comment for why `idEntity1Decor`/`idEntity2Decor`
    // are deliberately NOT used here).
    const fromDecor = rel.sourceDecor ?? decor.sourceDecor;
    const toDecor = rel.targetDecor ?? decor.targetDecor;
    const edgeGeo: EdgeGeo = {
      id: edgeResult.id,
      points: pts,
      sourceDecor: matchesFromTo ? fromDecor : toDecor,
      targetDecor: matchesFromTo ? toDecor : fromDecor,
      dashed,
      from: rel.from,
      to: rel.to,
      ...(rel.creationIndex !== undefined ? { creationIndex: rel.creationIndex } : {}),
      ...(rel.idEntity1 !== undefined ? { idEntity1: rel.idEntity1 } : {}),
      ...(rel.idEntity2 !== undefined ? { idEntity2: rel.idEntity2 } : {}),
      ...(rel.idEntity1Decor !== undefined ? { idEntity1Decor: rel.idEntity1Decor } : {}),
      ...(rel.idEntity2Decor !== undefined ? { idEntity2Decor: rel.idEntity2Decor } : {}),
      ...(rel.sourceLine !== undefined ? { sourceLine: rel.sourceLine } : {}),
      ...(rel.phantomSlot === true ? { phantomSlot: true as const } : {}),
      ...buildStrokeOverride(rel, dashed),
    };

    attachEdgeLabel(edgeGeo, rel, pts);
    attachPortLabels(edgeGeo, rel, edgeResult, measurer, fontFamily);
    edges.push(edgeGeo);
  }
  return edges;
  // #lizard forgives -- verbatim move from layout.ts (pre-existing code,
  // not touched this iteration); one EdgeGeo literal with 10 optional
  // jar-verified fields (G2 N2/N8/N9), each gated by its own `?? decor`/
  // `!== undefined` check -- reducible only by splitting the single
  // EdgeGeo construction across functions, which would obscure the
  // field-by-field jar citations far more than it simplifies control flow.
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
export function degenerateSingleClassifier(
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
    ...(measured.headerRowCount !== undefined ? { headerRowCount: measured.headerRowCount } : {}),
    ...(measured.badgeChar !== undefined ? { badgeChar: measured.badgeChar } : {}),
    ...(measured.badgeColor !== undefined ? { badgeColor: measured.badgeColor } : {}),
    ...(measured.genericTag !== undefined ? { genericTag: measured.genericTag } : {}),
    ...(measured.folderTab !== undefined ? { folderTab: measured.folderTab } : {}),
    ...(classifier.hideCircle === true ? { hideCircle: true } : {}),
    ...(classifier.usymbol !== undefined ? { usymbol: classifier.usymbol } : {}),
    ...(classifier.url !== undefined ? { url: classifier.url } : {}),
    ...(classifier.color !== undefined ? { color: classifier.color } : {}),
    ...(classifier.stereotype !== undefined
      ? { stereotypeLabels: resolveStyleStereotypeTags(classifier) }
      : {}),
    ...(classifier.styleGeneration !== undefined
      ? { styleGeneration: classifier.styleGeneration }
      : {}),
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
