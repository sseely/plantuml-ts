/**
 * renderer-edge.ts — T17: adapts one `DescriptionEdgeGeo` (this port's
 * layout output) into `SvekEdgeInput` (T13's decoupled drawing-half
 * contract — see `SvekEdge.ts`'s "Adapter boundary" doc comment, which
 * explicitly names this as a later task's job) and draws it.
 */
import type { UGraphic } from '../../core/klimt/UGraphic.js';
import type { Theme } from '../../core/theme.js';
import { SvekEdge, type SvekEdgeInput, type SvekLinkStyle } from '../../core/svek/SvekEdge.js';
import type { DescriptionEdgeGeo } from './layout-helpers.js';
import { bareEntityName } from './namespace-groups.js';
import { JAR_DEFAULT_TEXT_COLOR } from './renderer-symbol.js';

/** Edge/link label font size — `klimt/font/FontParam.java:54`,
 *  `ARROW(13, UFontFace.normal())`. A FIXED constant, NOT derived from
 *  `theme.fontSize` (G1 I2 finding: a prior `theme.fontSize - 2`
 *  convention here happened to also equal 13 under this port's default
 *  `theme.fontSize` of 14, but diverges from the jar the moment
 *  `theme.fontSize` differs from 14 — `FontParam.ARROW`'s default size is
 *  independent of every other `FontParam` entry). */
const ARROW_LABEL_FONT_SIZE = 13;

/**
 * Fallback raw decor token when `DescriptionEdgeGeo.tailDecor`/`.headDecor`
 * (T17 write-set expansion — see `layout-helpers.ts`'s doc comment) are
 * BOTH absent: derived from the lossy `arrowHead` open/filled/none
 * classification alone. Reachable only for geometries built before the
 * expansion (e.g. hand-constructed test fixtures) — every geometry built by
 * `layoutDescription` today carries `tailDecor`/`headDecor` directly,
 * per-side, straight from `DescriptiveLink` (`layout-geo-post.ts:107-110`).
 *
 * CORRECTION (G1 I3, mission g1-description-svg): `buildInput` previously
 * called this whenever `edge.headDecor` alone was absent, regardless of
 * whether `edge.tailDecor` already carried the link's real (single-sided)
 * decor. `edge.arrowHead` is an independent, aggregate open/filled/none
 * classification of the WHOLE link (not "which side"), so for a real
 * tail-only-decorated link (e.g. `B <-- A`: `tailDecor: '<'`, `headDecor`
 * absent, `arrowHead: 'open'`) the old call synthesized a PHANTOM `'>'`
 * head decor from `arrowHead` alone, turning a single-sided link into a
 * both-sides-decorated one for `looksLikeRevertedForSvg`/
 * `looksLikeNoDecorAtAllSvg` (`link-decor.ts`) — collapsing the jar's
 * `X-backto-Y` path id (`Link#idCommentForSvg`, Link.java:106-114) into a
 * bare `X-Y`. Now gated on `edge.tailDecor === undefined` too, so the
 * fallback only fires when NEITHER raw token is present (the legacy/
 * hand-built-geometry case this function's own doc comment already
 * claimed was the only reachable one).
 */
function fallbackHeadToken(arrowHead: DescriptionEdgeGeo['arrowHead']): string | undefined {
  if (arrowHead === 'filled') return '>>';
  if (arrowHead === 'open') return '>';
  return undefined;
}

function edgeStyle(edge: DescriptionEdgeGeo): SvekLinkStyle {
  return edge.dashed ? 'dashed' : 'solid';
}

function buildInput(edge: DescriptionEdgeGeo, theme: Theme, uid: string, fromUid: string, toUid: string): SvekEdgeInput {
  const headDecor = edge.headDecor ?? (edge.tailDecor === undefined ? fallbackHeadToken(edge.arrowHead) : undefined);
  // G1 I5e: only the POST-colon-embedded stereotype form is ever drawn as
  // visible edge text upstream -- see `DescriptiveLink.stereotypeIsLinkLabel`'s
  // doc comment. The PRE-colon form (e.g. an auto-created endpoint's own
  // `Name<<tag>>`) is a style-selector/`remove` input only.
  const visibleStereotype = edge.stereotypeIsLinkLabel === true ? edge.stereotype : undefined;
  const hasLabelText = visibleStereotype !== undefined || edge.label !== undefined;
  return {
    uid,
    points: edge.points,
    // `SvekEdgeInput.from`/`.to` are DISPLAY names (`Link#getEntity().
    // getName()`, SvekEdge.ts's own doc comment) -- `edge.from`/`.to`
    // are the `dotKeyFor` DOT/geo identity key (may carry the internal
    // `SCOPE_KEY_SEP` disambiguation separator for a collision-resolved
    // qualified endpoint); `bareEntityName` strips that back to the
    // bare leaf name for display, matching `Quark#getName()`.
    from: bareEntityName(edge.from),
    to: bareEntityName(edge.to),
    fromUid,
    toUid,
    style: edgeStyle(edge),
    color: theme.colors.arrow,
    backgroundColor: theme.colors.background,
    ...(edge.tailDecor !== undefined ? { tailDecor: edge.tailDecor } : {}),
    ...(headDecor !== undefined ? { headDecor } : {}),
    ...(visibleStereotype !== undefined ? { stereotype: visibleStereotype } : {}),
    ...(edge.label !== undefined ? { label: edge.label } : {}),
    ...(hasLabelText
      ? {
          labelFont: {
            family: theme.fontFamily,
            size: ARROW_LABEL_FONT_SIZE,
            // Jar default text color (`FontParamConstant.COLOR = "black"`,
            // `klimt/font/FontParam.java:44` — `ARROW` has no color
            // override entry, so it resolves to this default), NOT
            // `theme.colors.graph.edgeLabel` (`#444444` — that field is a
            // SHARED default across class/state/dot renderers with a
            // different jar-verified role there; out of this fix's scope
            // to change, see `theme.ts`).
            color: JAR_DEFAULT_TEXT_COLOR,
            styles: new Set(),
          },
        }
      : {}),
  };
}

/** Builds and draws one edge. `nodeUid` maps AST node ids (both leaf and
 *  container — `edge.from`/`edge.to` are the link's own endpoint ids,
 *  never a synthetic group-anchor id) to their assigned `ent%04d` uid.
 *  `sharedIds` mirrors upstream `SvekResult#drawU`'s single `Set<String>
 *  ids` (SvekResult.java:93-101, one instance created per diagram, passed
 *  to every `SvekEdge#setSharedIds` before its own `drawU`) — the caller
 *  owns the Set's lifetime (one per `renderDescription` call), so two
 *  links whose `idCommentForSvg()` collide get the jar's `-1`/`-2`-suffixed
 *  disambiguation (`SvekEdge#uniq`, SvekEdge.java:1093) instead of a
 *  duplicate bare id. */
export function drawEdge(
  ug: UGraphic,
  edge: DescriptionEdgeGeo,
  theme: Theme,
  uid: string,
  nodeUid: ReadonlyMap<string, string>,
  sharedIds: Set<string>,
): void {
  const fromUid = nodeUid.get(edge.from) ?? edge.from;
  const toUid = nodeUid.get(edge.to) ?? edge.to;
  const svekEdge = new SvekEdge(buildInput(edge, theme, uid, fromUid, toUid));
  svekEdge.setSharedIds(sharedIds);
  svekEdge.drawU(ug);
}
