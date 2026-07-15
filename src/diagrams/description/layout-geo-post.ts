/**
 * Geo post-processing for the description layout engine (phases 4–6): after the
 * graphviz result is mapped to a raw geo tree, these turn it into final pixel
 * geometry — the global coordinate shift, edge-geo construction (spline
 * clipping at container bboxes + label placement), and total canvas dimensions.
 * Split out of layout.ts to keep each module within the complexity budget.
 */

import type { DescriptiveLink } from './ast.js';
import type { DotLayoutResult } from '../../core/graph-layout.js';
import {
  type DescriptionNodeGeo,
  type DescriptionEdgeGeo,
  type Bbox,
  type EdgeContainerEndpoints,
  LAYOUT_MARGIN,
  LAYOUT_MARGIN_LEADING,
} from './layout-helpers.js';
import { clipSplineStart, clipSplineEnd } from './spline-clip.js';

/** One edge from the graphviz layout result. */
export type ResultEdge = DotLayoutResult['edges'][number];

/** Everything buildEdgeGeos needs to map result edges back to link geometry. */
export interface EdgeMapping {
  dotEdgeToLinkIdx: Map<string, number>;
  edgeContainerEndpoints: Map<string, EdgeContainerEndpoints>;
  geoIndex: Map<string, DescriptionNodeGeo>;
  dx: number;
  dy: number;
}

// ── Phase 4: global coordinate shift ──

function scanNodeMin(g: DescriptionNodeGeo, minRef: { x: number; y: number }): void {
  if (g.x < minRef.x) minRef.x = g.x;
  if (g.y < minRef.y) minRef.y = g.y;
  for (const c of g.children) scanNodeMin(c, minRef);
}

export function computeGlobalShift(
  nodes: readonly DescriptionNodeGeo[],
  edgePoints: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>,
): { dx: number; dy: number } {
  const min = { x: Infinity, y: Infinity };
  for (const n of nodes) scanNodeMin(n, min);
  for (const pts of edgePoints) {
    for (const p of pts) {
      if (p.x < min.x) min.x = p.x;
      if (p.y < min.y) min.y = p.y;
    }
  }
  if (!isFinite(min.x)) min.x = 0;
  if (!isFinite(min.y)) min.y = 0;
  return { dx: LAYOUT_MARGIN_LEADING - min.x, dy: LAYOUT_MARGIN_LEADING - min.y };
}

// ── Phase 5: edge geo construction ──

function clipEdgePoints(
  pts: Array<{ x: number; y: number }>,
  info: EdgeContainerEndpoints | undefined,
  geoIndex: Map<string, DescriptionNodeGeo>,
): Array<{ x: number; y: number }> {
  let result = pts;
  const fromId = info?.fromContainerAstId;
  if (fromId !== undefined) {
    const g = geoIndex.get(fromId);
    if (g !== undefined) {
      const b: Bbox = { x: g.x, y: g.y, width: g.width, height: g.height };
      result = clipSplineStart(result, b);
    }
  }
  const toId = info?.toContainerAstId;
  if (toId !== undefined) {
    const g = geoIndex.get(toId);
    if (g !== undefined) {
      const b: Bbox = { x: g.x, y: g.y, width: g.width, height: g.height };
      result = clipSplineEnd(result, b);
    }
  }
  return result;
}

function edgeLabelGeo(
  re: ResultEdge,
  pts: Array<{ x: number; y: number }>,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const mid = Math.floor(pts.length / 2);
  const x = re.labelX !== undefined ? re.labelX + dx : (pts[mid]?.x ?? 0);
  const y = re.labelY !== undefined ? re.labelY + dy : (pts[mid]?.y ?? 0);
  return { x, y };
}

function assembleEdgeGeo(
  linkIdx: number,
  link: DescriptiveLink,
  pts: Array<{ x: number; y: number }>,
  hidden: ReadonlySet<string>,
): DescriptionEdgeGeo {
  const geo: DescriptionEdgeGeo = {
    id: `edge-${linkIdx}`, from: link.from, to: link.to,
    points: pts, style: link.style,
  };
  if (link.thicknessOverride !== undefined) geo.styleThickness = link.thicknessOverride;
  if (link.colorOverride !== undefined) geo.styleColor = link.colorOverride;
  if (link.stereotype !== undefined) geo.stereotype = link.stereotype;
  if (link.stereotypeIsLinkLabel) geo.stereotypeIsLinkLabel = true;
  if (link.arrowHead !== undefined) geo.arrowHead = link.arrowHead;
  // T17 write-set expansion — see DescriptionEdgeGeo's doc comment.
  if (link.tailDecor !== undefined) geo.tailDecor = link.tailDecor;
  if (link.headDecor !== undefined) geo.headDecor = link.headDecor;
  if (link.creationIndex !== undefined) geo.creationIndex = link.creationIndex;
  // G1 I-hideshow: `Link#isHidden()`'s `cl1.isHidden() || cl2.isHidden()`
  // disjunct (abel/Link.java:458-459) -- see `DescriptionEdgeGeo.hidden`'s
  // doc comment for why the `-[hidden]-` keyword disjunct is NOT folded in
  // here (G1 I-linkstyle: attempted and REVERTED -- see that doc comment).
  if (hidden.has(link.from) || hidden.has(link.to)) geo.hidden = true;
  return geo;
}

function addEdgeLabel(
  geo: DescriptionEdgeGeo,
  link: DescriptiveLink,
  re: ResultEdge,
  dx: number,
  dy: number,
): void {
  if (link.label === undefined) return;
  geo.label = { text: link.label, ...edgeLabelGeo(re, geo.points, dx, dy) };
}

export function buildEdgeGeos(
  links: readonly DescriptiveLink[],
  resultEdges: ResultEdge[],
  m: EdgeMapping,
  hidden: ReadonlySet<string> = new Set(),
): DescriptionEdgeGeo[] {
  const byIdx = new Map<number, DescriptionEdgeGeo>();
  for (const re of resultEdges) {
    const linkIdx = m.dotEdgeToLinkIdx.get(re.id);
    if (linkIdx === undefined) continue;
    const link = links[linkIdx];
    if (link === undefined) continue;
    const clipped = clipEdgePoints(re.points, m.edgeContainerEndpoints.get(re.id), m.geoIndex);
    const pts = clipped.map((p) => ({ x: p.x + m.dx, y: p.y + m.dy }));
    const geo = assembleEdgeGeo(linkIdx, link, pts, hidden);
    addEdgeLabel(geo, link, re, m.dx, m.dy);
    byIdx.set(linkIdx, geo);
  }
  return [...byIdx.entries()].sort(([a], [b]) => a - b).map(([, g]) => g);
}

// ── Phase 6: total dimensions ──

function scanNodeDims(g: DescriptionNodeGeo, ref: { w: number; h: number }): void {
  const rw = g.x + g.width + LAYOUT_MARGIN;
  const rh = g.y + g.height + LAYOUT_MARGIN;
  if (rw > ref.w) ref.w = rw;
  if (rh > ref.h) ref.h = rh;
  for (const c of g.children) scanNodeDims(c, ref);
}

/**
 * @deprecated (G0/T3, journaled — write-set-boundary doc-comment-only
 * note; do NOT delete in this task) NO LONGER the source of the
 * description engine's SVG document dimensions. `renderer.ts#
 * renderDescription` used to feed this function's output
 * (`geo.totalWidth`/`totalHeight`) straight into `SvgOption#minDim`; as
 * of G0/T3 it computes `minDim` via the `SvekResult` recipe instead
 * (`renderer-ink-extent.ts#computeDocumentDims` — a `LimitFinder` ink
 * walk + the `CucaDiagram` outer margin; see that module's doc comment
 * for the full upstream chain and the F4 "document dimensions 1px
 * short" defect this replaced it for). This function's only remaining
 * caller is `layout.ts#layoutDescription`, which still populates
 * `DescriptionGeometry#totalWidth`/`totalHeight` from it — that field
 * remains part of the public geometry shape (exercised by
 * `tests/unit/description/layout.test.ts`) and MAY still be a
 * reasonable "content bounding box" approximation for callers that are
 * not the SVG renderer; it is simply no longer authoritative for the
 * emitted document's `width`/`height`/`viewBox`.
 */
export function computeTotalDimensions(
  nodes: readonly DescriptionNodeGeo[],
  edges: readonly DescriptionEdgeGeo[],
): { totalWidth: number; totalHeight: number } {
  const ref = { w: 0, h: 0 };
  for (const n of nodes) scanNodeDims(n, ref);
  for (const e of edges) {
    for (const p of e.points) {
      if (p.x + LAYOUT_MARGIN > ref.w) ref.w = p.x + LAYOUT_MARGIN;
      if (p.y + LAYOUT_MARGIN > ref.h) ref.h = p.y + LAYOUT_MARGIN;
    }
  }
  return { totalWidth: ref.w, totalHeight: ref.h };
}
