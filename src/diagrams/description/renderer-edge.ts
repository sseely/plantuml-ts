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

/** `theme.fontSize` delta for edge label/stereotype text (matches the
 *  legacy `renderer.ts`'s own `theme.fontSize - 2` convention). */
const EDGE_LABEL_SIZE_DELTA = -2;

/**
 * Fallback raw decor token when `DescriptionEdgeGeo.tailDecor`/`.headDecor`
 * (T17 write-set expansion — see `layout-helpers.ts`'s doc comment) are
 * absent: derived from the lossy `arrowHead` open/filled/none
 * classification alone. Only reachable for geometries built before the
 * expansion (e.g. hand-constructed test fixtures); every geometry built by
 * `layoutDescription` today carries the raw tokens directly.
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
  const headDecor = edge.headDecor ?? fallbackHeadToken(edge.arrowHead);
  const hasLabelText = edge.stereotype !== undefined || edge.label !== undefined;
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
    ...(edge.stereotype !== undefined ? { stereotype: edge.stereotype } : {}),
    ...(edge.label !== undefined ? { label: edge.label } : {}),
    ...(hasLabelText
      ? {
          labelFont: {
            family: theme.fontFamily,
            size: theme.fontSize + EDGE_LABEL_SIZE_DELTA,
            color: theme.colors.graph.edgeLabel,
            styles: new Set(),
          },
        }
      : {}),
  };
}

/** Builds and draws one edge. `nodeUid` maps AST node ids (both leaf and
 *  container — `edge.from`/`edge.to` are the link's own endpoint ids,
 *  never a synthetic group-anchor id) to their assigned `ent%04d` uid. */
export function drawEdge(
  ug: UGraphic,
  edge: DescriptionEdgeGeo,
  theme: Theme,
  uid: string,
  nodeUid: ReadonlyMap<string, string>,
): void {
  const fromUid = nodeUid.get(edge.from) ?? edge.from;
  const toUid = nodeUid.get(edge.to) ?? edge.to;
  new SvekEdge(buildInput(edge, theme, uid, fromUid, toUid)).drawU(ug);
}
