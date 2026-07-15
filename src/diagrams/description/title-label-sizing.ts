/**
 * Title-bar dims for a cluster's own display name — split out of
 * layout-helpers.ts (500-line cap) as its own module, mirroring that file's
 * existing leaf-sizing.js split.
 */
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';
import type { USymbol } from '../../core/descriptive-keywords.js';

/** `SvekEdge.appendTable`'s constant `-5` reduction applied to
 *  `Cluster.getTitleAndAttributeHeight()` wherever the cluster's title is
 *  reused as an HTML `<TABLE ... HEIGHT="...">` label value
 *  (`ClusterDotString.java:134-135,177-184`). */
const TITLE_TABLE_HEIGHT_REDUCTION = 5;

/** `USymbol#suppHeightBecauseOfShape`/`#suppWidthBecauseOfShape`
 *  (decoration/symbol/USymbol*.java) — additional `[width, height]` pixels
 *  `ClusterHeader.getTitleAndAttributeWidth/Height` adds on top of the raw
 *  title text block for symbols whose decoration needs extra room. Only
 *  `node` (`USymbolNode.java:192-198`: height+5, width+60) and `database`
 *  (`USymbolDatabase.java:173-175`: height+15, no width override) override
 *  the base `USymbol`'s 0/0 default; every other symbol falls through.
 *  Jar-verified against 4 cached `svek-1.dot` anchor labels
 *  (`label=<TABLE ... WIDTH=".." HEIGHT="..">`): `component` "comp" -> 34x9
 *  (component/gafegu-06-nito976, gocexi-61-biso565, rapaji-98-xato067),
 *  `node` "srv1"/"srv2" -> 86x14 (component/bujige-52-gase998). */
const TITLE_SUPP_BY_SYMBOL: Partial<Record<USymbol, readonly [number, number]>> = {
  node: [60, 5],
  database: [0, 15],
};

/** Faithful port of `ClusterHeader.getTitleAndAttributeWidth/Height` (no
 *  stereotype merge, no attribute-list contribution — description-diagram
 *  containers never carry a `getStateDescription` attribute body, and this
 *  function's only callers are scoped to pure port-only containers with a
 *  plain single-line title) reduced by `SvekEdge.appendTable`'s constant
 *  `-5` (`ClusterDotString.java:134-135`). Jar-verified 34x9 (`component`
 *  "comp") / 86x14 (`node` "srv1"/"srv2") — see {@link TITLE_SUPP_BY_SYMBOL}'s
 *  doc comment for the source citations.
 *
 *  Two call sites, BOTH direct 1:1 jar-formula applications with no
 *  intermediate graphviz remodeling in between (verified byte-identical to
 *  jar's own cached `svek-1.dot`, `scripts/dot-sync-report.ts --slug`):
 *  `layout.ts#buildAnchorNode`'s real DOT-emission anchor
 *  (`ClusterDotString.empty()`'s `label=<TABLE...>` value) and
 *  `frontier-cluster-bbox.ts#ensureMinWidth`'s `getTitleAndAttributeWidth()
 *  + 10` floor (`Cluster.java:427-428`). NOT used for
 *  `frontier-shadow-layout.ts`'s isolated shadow-graph anchor node — see
 *  {@link measureShadowAnchorDims}'s doc comment for why that's a
 *  deliberately DIFFERENT (and NOT jar-faithful) value. */
export function measureTitleLabel(
  display: string,
  symbol: USymbol,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  const [suppWidth, suppHeight] = TITLE_SUPP_BY_SYMBOL[symbol] ?? [0, 0];
  const dimLabel = measurer.measure(display, fontSpec);
  return {
    width: Math.floor(dimLabel.width + suppWidth),
    height: Math.floor(dimLabel.height + suppHeight) - TITLE_TABLE_HEIGHT_REDUCTION,
  };
}

/** Legacy nominal padding this port's `frontier-shadow-layout.ts` isolated
 *  shadow graph needs fed as its OWN anchor node's declared width/height to
 *  reproduce jar's real cluster geometry — NOT jar's real anchor dims (see
 *  {@link measureTitleLabel} for those, jar-verified 34x9 for `component`
 *  "comp"). Mission G1b J3 instrumented this directly
 *  (`component/gafegu-06-nito976`, `scripts/_tmp-j3-shadow-probe.ts`,
 *  deleted): feeding the shadow graph the jar-exact anchor (34x9) yields
 *  `initial.maxY=113`, 8px SHORT of the value (121) a REAL `dot -Txdot`
 *  cross-check on jar's own full `svek-1.dot` text produces (decision-
 *  journal.md's J2 entry) — this legacy inflated height (16, +7 over jar's
 *  real 9) closes that exact 8px gap for gafegu-06/gocexi-61-biso565/
 *  rapaji-98-xato067 (all `computePortClusterBbox` height verified against
 *  jar: 98 vs jar's 99, a residual off-by-one, vs 91 with the jar-exact
 *  value — a regression, NOT an improvement). The 8px gap itself is real
 *  and NOT understood: the shadow graph mirrors ONLY the rank-chain+anchor
 *  subgraph structure (`svek-dot-emit.ts#portClusterBlock`'s core), not the
 *  FULL jar dot text's `protection0`/`protection1`/`thereALinkFromOrToGroup`
 *  wrapping subgraphs (`ClusterDotString.java`) — one of those is the most
 *  likely source of the missing 8px of real jar rank separation. Kept as
 *  its own named, deliberately DEFERRED divergence (ledger.md J3) pending a
 *  dedicated diagnosis of `frontier-shadow-layout.ts`'s own structural
 *  fidelity gap — swapping in the jar-exact anchor height here without
 *  first closing that gap would regress the 3 fixtures above. */
const SHADOW_ANCHOR_H_PADDING = 20;
const SHADOW_ANCHOR_HEIGHT = 16;

export function measureShadowAnchorDims(
  display: string,
  fontSpec: FontSpec,
  measurer: StringMeasurer,
): { width: number; height: number } {
  return {
    width: measurer.measure(display, fontSpec).width + SHADOW_ANCHOR_H_PADDING,
    height: SHADOW_ANCHOR_HEIGHT,
  };
}
