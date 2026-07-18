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
import { CARDINALITY_FONT_SIZE, splitEdgeLabelLines } from './class-layout-helpers.js';
import {
  ARROW_GLYPH_SIZE,
  parseMagicArrowLabel,
  magicArrowAngle,
  magicArrowGlyphPoints,
  type MagicArrowLabel,
} from './class-magic-arrow.js';
import { javaRound4 } from '../../core/number-format.js';
import {
  getHTitle,
  getWTitle,
  getTitleBaselineOffset,
  NAMESPACE_TOP_EXTRA,
  NAMESPACE_SIDE_PADDING,
} from './class-namespace-shape.js';
import { resolveStyleStereotypeTags } from './class-stereotype.js';
import { applyClassDocumentMargin } from './layout-ink-extent.js';
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
      ...(measured.nameRowCount !== undefined ? { nameRowCount: measured.nameRowCount } : {}),
      ...(measured.badgeChar !== undefined ? { badgeChar: measured.badgeChar } : {}),
      ...(measured.badgeColor !== undefined ? { badgeColor: measured.badgeColor } : {}),
      ...(measured.genericTag !== undefined ? { genericTag: measured.genericTag } : {}),
      ...(measured.folderTab !== undefined ? { folderTab: measured.folderTab } : {}),
      ...(measured.enhancedBody !== undefined ? { enhancedBody: measured.enhancedBody } : {}),
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
  const inkShape = resolveNamespaceInkShape(theme);
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
      ...(inkShape !== undefined ? { inkShape } : {}),
    });
  }
  return namespaces;
}

/**
 * G2 N60 (item 42): mirrors `renderer.ts#renderNamespace`'s own
 * `theme.packageStyle === 'rect' ? renderNamespaceRect : renderNamespaceFolder`
 * dispatch, and `renderNamespaceFolder`'s own `theme.strictUml === true ?
 * <polygon> : <path>` branch inside that -- see `NamespaceGeo.inkShape`'s
 * own doc comment (`layout.ts`) for the jar-verified `LimitFinder` ink-rule
 * consequence of each shape. Resolved ONCE per diagram (every namespace in
 * a class diagram shares the SAME theme-level `packageStyle`/`strictUml` --
 * this port has no per-group `PackageStyle` override yet, matching
 * `renderer.ts`'s own established scope note) rather than per-namespace.
 */
function resolveNamespaceInkShape(theme: Theme): 'polygon' | 'rect' | undefined {
  if (theme.packageStyle === 'rect') return 'rect';
  if (theme.strictUml === true) return 'polygon';
  return undefined;
}

/**
 * Attach the edge label if present, positioned from graphviz-ts's own
 * native edge `label=` placement (`edgeResult.labelX`/`.labelY`, already
 * computed by `getLayout()` -- `core/graph-layout.ts#toEdgeEntry`'s
 * `ge.label`, unconditional, no SVG-scan extraction needed unlike
 * `tailLabel`/`headLabel`'s xlabel mechanism).
 *
 * G2 N62: replaces a hand-rolled "geometric midpoint, offset right-
 * perpendicular" formula (`LABEL_OFFSET=10`) that was NEVER jar-verified
 * (no ratchet-pinned fixture ever exercised a plain edge label -- `ledger
 * .md` N62) -- confirmed wrong two ways: the position ignored graphviz's
 * own real placement entirely, and the render styling this feeds
 * (`renderer.ts#renderEdge`) used a placeholder `theme.colors.graph
 * .edgeLabel`/`theme.fontSize-2` formula instead of jar's real `arrow`
 * style block (`plantuml.skin`: `FontSize 13`, inherited `FontColor
 * black` -- the SAME `CARDINALITY_FONT_SIZE`/`#000000` formula
 * `tailLabel`/`headLabel` already use, confirmed via `GraphvizImageBuilder
 * .java:235-238`: `labelFont`/`cardinalityFont` are BOTH built from
 * `getDefaultStyleDefinitionArrow`, the same `arrow` style signature).
 * Reuses `portLabelAnchor`'s CENTER-to-left/baseline-anchor conversion
 * unchanged.
 *
 * Still bound by the SAME graphviz-ts-vs-real-graphviz label-placement
 * residual N25 already named (gvts-genuine, out of scope): graphviz-ts's
 * own internal label-box measurement doesn't match this port's real
 * sans-serif metrics, so the extracted position is structurally correct
 * (real engine decision, not a guess) but not guaranteed byte-exact.
 */
function attachEdgeLabel(
  edgeGeo: EdgeGeo,
  rel: Relationship,
  edgeResult: DotLayoutResult['edges'][number],
  measurer: StringMeasurer,
  fontFamily: string,
  // G2 item 44: the edge's OWN from-to-ordered points (post-`normalizeEdgePoints`,
  // reversed to entity1->entity2 order when that function flipped the raw
  // dot points) -- ONLY consumed by the magic-arrow angle formula below,
  // which needs jar's exact `dotPath` start/end convention. See
  // `class-magic-arrow.ts#magicArrowAngle`'s doc comment.
  fromToPoints: Array<{ x: number; y: number }>,
): void {
  if (rel.label === undefined) return;
  if (edgeResult.labelX === undefined || edgeResult.labelY === undefined) return;
  const center = { x: edgeResult.labelX, y: edgeResult.labelY };

  // G2 item 43: a `\n`/`\l`/`\r`-split label draws ONE `<text>` per line
  // in jar's real golden SVG (`Display.hasSeveralGuideLines`/`create0`'s
  // line-wrapping, `SvekEdge.java:299`) -- see `multiLineLabelAnchor`'s doc
  // comment for the jar-verified per-line layout formula. A label with no
  // line breaks keeps the EXACT pre-existing single-`<text>` path below,
  // unchanged (`EdgeGeo.label`, N62).
  const { lines, align } = splitEdgeLabelLines(rel.label);
  if (lines.length > 1) {
    edgeGeo.labelLines = multiLineLabelAnchor(lines, align, center, measurer, fontFamily);
    return;
  }

  // G2 item 44: a single-line label ending in `" >"`/`" <"` (or the bare
  // `>`/`<`/`"< "`/`"> "` forms) strips the arrow token and draws a small
  // triangle glyph instead -- see `attachMagicArrow`'s doc comment. A label
  // with no arrow token (`parseMagicArrowLabel` returns `undefined`) keeps
  // the EXACT pre-existing plain-text path below, unchanged.
  const magic = parseMagicArrowLabel(rel.label);
  if (magic !== undefined) {
    attachMagicArrow(edgeGeo, magic, fromToPoints, center, measurer, fontFamily);
    return;
  }

  edgeGeo.label = portLabelAnchor(rel.label, center, measurer, fontFamily);
}

/**
 * G2 item 44: position the magic-arrow glyph (+ its optional remaining
 * text) as ONE combined block, mirroring jar's `TextBlockUtils.mergeLR
 * (arrow, label, CENTER)` (`SvekEdge.java:284,304`, `descdiagram/command/
 * StringWithArrow.java:105-113`) -- width SUMS (`ARROW_GLYPH_SIZE` +
 * text width), height/vertical-center is shared (mergeLR's CENTER
 * alignment). `blockLeft` generalizes `portLabelAnchor`'s own
 * `center.x - width/2` formula from a single `width` to the combined
 * block's `totalWidth` (algebraically identical when `hasText` is
 * `false` and `totalWidth === ARROW_GLYPH_SIZE`). The glyph always sits
 * in the LEFT `ARROW_GLYPH_SIZE`-wide slot regardless of arrow direction
 * (`mergeLR(arrow, label, ...)`'s fixed argument order) -- the triangle's
 * own ROTATION (`magicArrowAngle`) encodes direction, not its position.
 * Text position reuses `portLabelAnchor` verbatim by passing it the
 * TEXT-ONLY sub-block's own center (`blockLeft + ARROW_GLYPH_SIZE +
 * textWidth/2`), so its `y`/baseline formula is byte-identical to the
 * plain single-line label path. Jar-verified byte-exact SHAPE (glyph
 * triangle) against `lojepe-37-liri985`'s golden `<polygon>`; absolute
 * block position carries the SAME gvts-genuine placement residual N25/N62
 * already named.
 */
function attachMagicArrow(
  edgeGeo: EdgeGeo,
  magic: MagicArrowLabel,
  fromToPoints: Array<{ x: number; y: number }>,
  center: { x: number; y: number },
  measurer: StringMeasurer,
  fontFamily: string,
): void {
  const angle = magicArrowAngle(fromToPoints, magic.direction);
  const hasText = magic.text !== undefined && magic.text !== '';
  const font = { family: fontFamily, size: CARDINALITY_FONT_SIZE };
  const textWidth = hasText ? javaRound4(measurer.measure(magic.text!, font).width) : 0;
  const totalWidth = ARROW_GLYPH_SIZE + textWidth;
  const blockLeft = center.x - totalWidth / 2;
  edgeGeo.arrowGlyph = {
    points: magicArrowGlyphPoints(blockLeft, center.y - ARROW_GLYPH_SIZE / 2, angle),
  };
  if (hasText) {
    edgeGeo.label = portLabelAnchor(
      magic.text!,
      { x: blockLeft + ARROW_GLYPH_SIZE + textWidth / 2, y: center.y },
      measurer,
      fontFamily,
    );
  }
}

/**
 * G2 item 43: lay out a `\n`/`\l`/`\r`-split edge label as one `<text>`
 * per line, generalizing `portLabelAnchor`'s single-line CENTER-to-left/
 * baseline conversion (reduces to the EXACT SAME formula when `lines.length
 * === 1`, verified algebraically below). Jar draws every line via ONE
 * `TextBlock` translated as a whole to `labelXY`'s top-left corner
 * (`SvekEdge.java:953`, `Display#create0`) -- each line is then
 * individually positioned WITHIN that block's own max-line-width per the
 * block's resolved `HorizontalAlignment` (default CENTER, or LEFT/RIGHT
 * when the label carried a trailing `\l`/`\r` -- {@link
 * splitEdgeLabelLines}). Jar-verified byte-exact SHAPE against
 * `sicile-99-pefa679`'s 3 sibling edges (identical 3-line text, one
 * alignment mode each): the block's LEFT edge sits at the SAME x for every
 * mode (`center.x - maxWidth/2`), and each line offsets from that left
 * edge by `0` (LEFT), `maxWidth-lineWidth` (RIGHT), or
 * `(maxWidth-lineWidth)/2` (CENTER) -- exactly `portLabelAnchor`'s own
 * `center.x - width/2` formula generalized from a single `width` to the
 * block's `maxWidth`. Line spacing is `CARDINALITY_FONT_SIZE` (13) exactly
 * -- jar's real per-line `y` delta on every sampled fixture. `totalHeight`
 * folds the extra `(lines.length-1)` rows into the SAME single-line
 * `m.height`/`baselineOffset` formula `portLabelAnchor` already uses, so at
 * `lines.length === 1` this function's `x`/`y` are algebraically identical
 * to `portLabelAnchor`'s. Still bound by the SAME gvts-genuine
 * label-placement residual N25/N62 already named (graphviz-ts's own
 * box-center doesn't match jar's sub-pixel placement) -- structurally
 * correct, not guaranteed byte-exact.
 */
function multiLineLabelAnchor(
  lines: string[],
  align: 'center' | 'left' | 'right',
  center: { x: number; y: number },
  measurer: StringMeasurer,
  fontFamily: string,
): Array<{ text: string; x: number; y: number; width: number }> {
  const font = { family: fontFamily, size: CARDINALITY_FONT_SIZE };
  const widths = lines.map((l) => javaRound4(measurer.measure(l, font).width));
  const maxWidth = Math.max(...widths);
  const blockLeft = center.x - maxWidth / 2;
  const firstLine = lines[0] ?? '';
  const m0 = measurer.measure(firstLine, font);
  const baselineOffset = CARDINALITY_FONT_SIZE - measurer.getDescent(font, firstLine);
  const totalHeight = (lines.length - 1) * CARDINALITY_FONT_SIZE + m0.height;
  const blockTop = center.y - totalHeight / 2;
  return lines.map((text, i) => {
    const width = widths[i]!;
    const offset = align === 'left' ? 0 : align === 'right' ? maxWidth - width : (maxWidth - width) / 2;
    return {
      text,
      x: blockLeft + offset,
      y: blockTop + baselineOffset + i * CARDINALITY_FONT_SIZE,
      width,
    };
  });
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
  defaultArrowThickness: number | undefined,
): Pick<EdgeGeo, 'strokeWidth' | 'strokeDasharray' | 'colorOverride'> {
  // G2 N51: `skinparam arrowThickness N` -- a theme-level DEFAULT thickness
  // every edge picks up when it carries no bracket override of its own,
  // see `theme.ts#arrowThickness`'s doc comment for the exact upstream
  // `LinkType#getStroke3(UStroke defaultThickness)` formula this reduces
  // to (a per-edge bracket override always wins over this default).
  const hasOverride =
    rel.lineStyleOverride !== undefined ||
    rel.thicknessOverride !== undefined ||
    rel.colorOverride !== undefined ||
    defaultArrowThickness !== undefined;
  if (!hasOverride) return {};
  const style = rel.lineStyleOverride ?? (dashed ? 'dashed' : 'solid');
  const stroke = strokeForStyle(style, rel.thicknessOverride ?? defaultArrowThickness);
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
  // G2 N51: `theme.colors.graph.arrowThickness` (`skinparam arrowThickness
  // N`) -- threaded through to `buildStrokeOverride` below; see that
  // function's own doc comment.
  defaultArrowThickness?: number,
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
      ...buildStrokeOverride(rel, dashed, defaultArrowThickness),
    };

    attachEdgeLabel(
      edgeGeo, rel, edgeResult, measurer, fontFamily,
      matchesFromTo ? pts : [...pts].reverse(),
    );
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
  // G2 N48: the far-edge margin (13 = near-edge delta 7 + `applyClass
  // DocumentMargin`'s own `5 + 1` recipe) is no longer a separate literal
  // -- computed below via `applyClassDocumentMargin` directly, the SAME
  // shared recipe the main DOT-driven path uses (see this function's own
  // return-statement doc comment for the value-preserving proof).
  const DEGENERATE_NEAR_MARGIN = 7;
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
    ...(measured.nameRowCount !== undefined ? { nameRowCount: measured.nameRowCount } : {}),
    ...(measured.badgeChar !== undefined ? { badgeChar: measured.badgeChar } : {}),
    ...(measured.badgeColor !== undefined ? { badgeColor: measured.badgeColor } : {}),
    ...(measured.genericTag !== undefined ? { genericTag: measured.genericTag } : {}),
    ...(measured.folderTab !== undefined ? { folderTab: measured.folderTab } : {}),
    ...(measured.enhancedBody !== undefined ? { enhancedBody: measured.enhancedBody } : {}),
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
  // G2 N48 (item 24): expose `rawWidth`/`rawHeight` (the PRE-`applyClass
  // DocumentMargin` ink dims, `ClassGeometry.rawWidth`'s own doc comment)
  // so a titled/legend'd/etc degenerate-single-classifier diagram's chrome
  // centers against the SAME raw value the main DOT-driven path already
  // does (N46) instead of silently falling back to the POST-margin
  // `totalWidth`/`totalHeight` -- jar-verified `dipune-93-sare489`/
  // `farinu-74-fuco238`/`takeze-87-zuge906` (all single-classifier, titled):
  // centering the title against the OLD `totalWidth` produced `x=18.7875`,
  // 2.8937px right of jar's real `x=15.8938`; `rawWidth` here reuses the
  // EXACT SAME `applyClassDocumentMargin` recipe the main path calls, so
  // `totalWidth`/`totalHeight`'s OWN numeric value is unchanged (provably:
  // `applyClassDocumentMargin({w: measured.width + 2*DEGENERATE_NEAR_MARGIN,
  // ...}).width === Math.floor(measured.width + 20)` (the OLD literal
  // formula) for every input, since the old far-edge constant 13 =
  // `DEGENERATE_NEAR_MARGIN` (7) + the margin recipe's own `5 + 1`
  // constant) -- a value-preserving refactor for every already-passing
  // no-chrome degenerate fixture (jar-verified unchanged: `bovuze-89-
  // noja934`).
  const rawDims = {
    width: measured.width + DEGENERATE_NEAR_MARGIN * 2,
    height: measured.height + DEGENERATE_NEAR_MARGIN * 2,
  };
  const totalDims = applyClassDocumentMargin(rawDims);
  return {
    totalWidth: totalDims.width,
    totalHeight: totalDims.height,
    rawWidth: rawDims.width,
    rawHeight: rawDims.height,
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
