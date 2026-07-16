/**
 * renderer-group.ts — G2 N2 (mechanism 3): the per-element `<g class=
 * "entity"|"cluster"|"link">` wrapper + `<!--...-->` comment every jar
 * class-diagram fixture stamps around each drawn classifier/namespace/
 * edge (verified against `bedogi-86-kala547`, `bajotu-30-soku184`,
 * `befasi-62-vimu310` — see `plans/g2-class-svg/ledger.md` N1 mechanism 3
 * and N2's own entry).
 *
 * A pure-string sibling of `core/svek/DecorateEntityImage.ts
 * #decorateEntityDrawing` / `core/svek/Cluster.ts` / `core/svek/SvekEdge
 * .ts` (the klimt-`UGraphic`-based machinery description already uses for
 * the SAME wrapper shape) — NOT a klimt adoption: `class/renderer.ts`
 * draws every classifier/namespace/edge as a plain SVG string (`core/svg
 * .ts`'s `rect`/`text`/`path`/… helpers), never through a `UGraphic`, so
 * reusing the klimt-based wrapper would mean either migrating the whole
 * classifier-drawing path to klimt (EntityImageClass has no port yet — a
 * much larger, un-scoped iteration) or round-tripping through a throwaway
 * `UGraphicSvg` document per element (extra allocation/extraction
 * overhead for no behavioral gain, since `class="..."`/`id="..."`
 * ordering doesn't matter here — see below). Deliberately duplicates only
 * the OBSERVABLE shape (attribute names/values), not the klimt
 * `UGroup`/`UGroupType` machinery itself.
 *
 * Attribute VALUE correctness matters far less than it looks: `tests/
 * oracle/svg-conformance/normalize.ts` strips every `data-*` attribute
 * before comparison (adaptation #2) and sorts the survivors alphabetically
 * (attribute ORDER is irrelevant), so `data-qualified-name`/
 * `data-entity-1`/`data-entity-2`/`data-link-type` never affect
 * conformance — only `class` and `id` (the uid) do, plus the wrapping
 * `<g>` itself (structural `childCount`). The data-* values are still
 * populated here for genuine upstream fidelity (porting discipline), not
 * because the census requires it.
 *
 * `data-source-line` is OMITTED entirely — this port's class parser has
 * no line-number tracking yet (a separate, un-scoped write-set expansion,
 * comparable in size to description's own I3b `creationIndex` threading;
 * named remainder, `plans/g2-class-svg/ledger.md` N2). Harmless for
 * conformance (also `data-*`, also stripped).
 */
import { group } from '../../core/svg.js';
import { getLinkTypeName, looksLikeRevertedForSvg } from '../../core/svek/extremity/link-decor.js';
import type { LinkDecorName } from '../../core/svek/extremity/link-decor.js';

// XML-attribute-value escaping — a local duplicate of `core/svg.ts`'s own
// (module-private, unexported) `escapeXml`, per this codebase's
// established one-small-helper-per-call-site convention (e.g. `Cluster.ts`
// /`DecorateEntityImage.ts`'s duplicated `requireGroups`). Built from a
// string, not a regex literal containing `<`/`>` — the complexity checker
// miscounts those (same workaround `core/svg.ts`/`paint.ts` already use).
const XML_UNSAFE_RE = new RegExp('[&<>"]', 'g');
const XML_REPLACEMENTS: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escAttr(value: string): string {
  return value.replace(XML_UNSAFE_RE, (ch) => XML_REPLACEMENTS[ch]!);
}

/** Leaf (unqualified) portion of a dotted `Classifier.id`/`Relationship
 *  .from`/`.to` — the jar entity comment (`<!--class NAME-->`) and link
 *  comment (`<!--link X to Y-->`) both use the bare declared/alias name,
 *  never the namespace-qualified id (verified: `besepi-37-rori892`'s
 *  aliased, unnamespaced classifiers; `bajotu-30-soku184`'s namespaced
 *  `p1.cl1` comments as `<!--class cl1-->`). A fixed `.` split (not the
 *  diagram's real, possibly-customized `set separator`) — the comment
 *  text does not affect conformance (see module doc comment), so this is
 *  a documented best-effort approximation, not a precision requirement. */
export function leafPortion(id: string): string {
  const idx = id.lastIndexOf('.');
  return idx === -1 ? id : id.slice(idx + 1);
}

/** Wraps a classifier or note's rendered body in the jar's `<g
 *  class="entity" data-qualified-name="..." id="...">` group, preceded by
 *  `<!--class NAME-->` when `withComment` (upstream: `EntityImageClass
 *  .java:142` always comments; `EntityImageNote.java` never does — see
 *  `core/svek/DecorateEntityImage.ts#decorateEntityDrawing`'s own
 *  `withComment` precedent for the identical description-side split). */
export function wrapEntity(name: string, uid: string, qualifiedName: string, withComment: boolean, inner: string): string {
  const comment = withComment ? `<!--class ${name}-->` : '';
  return comment + group(inner, { class: 'entity', 'data-qualified-name': escAttr(qualifiedName), id: uid });
}

/** Wraps a namespace's rendered body in the jar's `<g class="cluster"
 *  data-qualified-name="..." id="...">` group, preceded by `<!--cluster
 *  NAME-->` (upstream `Cluster#drawU`, `svek/Cluster.java` — same
 *  synthetic-`##`-name comment skip `core/svek/Cluster.ts#drawU` already
 *  ports, reproduced here for the class-local plain-string path). */
export function wrapCluster(name: string, uid: string, qualifiedName: string, inner: string): string {
  const comment = name.startsWith('##') ? '' : `<!--cluster ${name}-->`;
  return comment + group(inner, { class: 'cluster', 'data-qualified-name': escAttr(qualifiedName), id: uid });
}

/** Parameter bundle for {@link wrapLink} — collapsed from 8 positional
 *  args into one object to stay inside this project's per-function
 *  param-count budget (mirrors `DecorateEntityImageParts`'s own precedent
 *  in `core/svek/DecorateEntityImage.ts`). */
export interface WrapLinkInfo {
  readonly from: string;
  readonly to: string;
  readonly uid: string;
  readonly fromUid: string;
  readonly toUid: string;
  /** HEAD-side resolved decor name — see `SvekEdge.ts`'s class doc
   *  comment for the upstream `LinkType(d2, d1)` swap this mirrors. */
  readonly decor1: LinkDecorName | undefined;
  /** TAIL-side resolved decor name. */
  readonly decor2: LinkDecorName | undefined;
}

/** Wraps an edge's rendered body in the jar's `<g class="link"
 *  data-entity-1="..." data-entity-2="..." id="..." data-link-type="...">`
 *  group, preceded by `<!--link X to Y-->`/`<!--reverse link X to Y-->`
 *  (upstream `Link#commentForSvg`/`idCommentForSvg`, `core/svek/SvekEdge
 *  .ts`'s own identical decor-pair-driven logic, reused directly rather
 *  than duplicated). */
export function wrapLink(info: WrapLinkInfo, inner: string): string {
  const { from, to, uid, fromUid, toUid, decor1, decor2 } = info;
  const reversed = looksLikeRevertedForSvg(decor1, decor2);
  const comment = reversed ? `<!--reverse link ${from} to ${to}-->` : `<!--link ${from} to ${to}-->`;
  const linkType = getLinkTypeName(decor1, decor2);
  return (
    comment +
    group(inner, {
      class: 'link',
      'data-entity-1': fromUid,
      'data-entity-2': toUid,
      id: uid,
      ...(linkType !== undefined ? { 'data-link-type': linkType } : {}),
    })
  );
}
