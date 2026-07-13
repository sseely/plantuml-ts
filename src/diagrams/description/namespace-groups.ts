/**
 * `set separator`-driven namespace splitting for descriptive diagrams
 * (component / use-case / deployment) — the shared `Quark<Entity>`
 * resolution behind `CucaDiagram#quarkInContext`/`quarkInContextSafe`
 * (net/atmp/CucaDiagram.java:244-283), ported at its two upstream call
 * sites: declaration time (`reuseExistingChild=false`,
 * CommandCreateElementFull.java:302) and link-endpoint time
 * (`reuseExistingChild=true`, CommandLinkElement).
 *
 * Two independent pieces, each mirroring a DIFFERENT upstream timing:
 *
 *  - `leafDisplayName` / `resolveQualifiedNode` run at PARSE time (same
 *    timing as `quarkInContext` itself) — the declaration's default display
 *    text (`quark.getName()`, CommandCreateElementFull.java:317-318) and an
 *    existing-entity lookup for a dotted link-endpoint reference that
 *    already resolves into a real (explicitly `{ }`-declared) container.
 *
 *  - `buildNamespaceGroups` runs at LAYOUT time, mirroring
 *    `CucaDiagram#eventuallyBuildPhantomGroups` (CucaDiagram.java:323-336),
 *    which upstream calls ONLY from `getTextBlock` (CucaDiagram.java:465) —
 *    i.e. AFTER `applySingleStrategy` (CucaDiagram.java:679-702, the magma/
 *    standalone-chaining pass) already ran on the un-grouped tree at
 *    parse-end (`DescriptionDiagram#checkFinalError`, DescriptionDiagram
 *    .java:96). Calling this at parse time instead would make dotted-id
 *    leaves visible to `magma.ts#magmaGroups` as ordinary container members,
 *    incorrectly triggering standalone-chaining that the oracle DOT does
 *    NOT produce (see the description-dot-100 decision journal, iteration
 *    I1, for the traced example). `magma.ts` additionally excludes any
 *    `phantomGroup` container from consideration by id, since a caller that
 *    ignores this module's timing convention could otherwise feed the
 *    grouped tree to magma computation directly.
 */

import type { DescriptiveNode } from './ast.js';

/**
 * Split `id` on the namespace separator into its segments, or `null` when
 * the id is not qualified (fewer than two non-empty segments) or splitting
 * is disabled (`sep` null/empty). Mirrors upstream `Quark.child`'s split
 * loop (plasma/Quark.java:116-132) at the id-shape level; unlike the class
 * engine's `splitOnSeparator` (class-namespace.ts), no decoration-leak guard
 * is needed here — a descriptive-diagram CODE token is `[%pLN_.]+`
 * (CommandCreateElementFull.java:127), which cannot itself contain the
 * bracket/quote/angle characters that would signal leaked decoration.
 */
export function splitNamespacePath(id: string, sep: string | null | undefined): string[] | null {
  if (sep === null || sep === undefined || sep === '' || !id.includes(sep)) return null;
  const parts = id.split(sep).filter((p) => p.length > 0);
  return parts.length >= 2 ? parts : null;
}

/**
 * `display = quark.getName()` (CommandCreateElementFull.java:317-318): a
 * dotted declaration with no explicit alias/display defaults to its LEAF
 * segment only, not the full qualified path. Returns `id` unchanged when
 * not namespace-qualified.
 */
export function leafDisplayName(id: string, sep: string | null | undefined): string {
  const segments = splitNamespacePath(id, sep);
  return segments === null ? id : segments[segments.length - 1]!;
}

/**
 * Existing-quark lookup for a dotted link-endpoint reference
 * (`quarkInContextSafe`'s `reuseExistingChild=true` path,
 * CucaDiagram.java:264-271, restricted to the case both our fixtures need:
 * an id whose first segment names an EXISTING top-level container, walked
 * down through already-declared children). Returns the resolved leaf
 * `DescriptiveNode` when the full chain already exists, else `undefined` —
 * the caller falls back to ordinary flat-id auto-creation (`ensureEndpoint`),
 * matching upstream's own fallback to `currentQuark.child(full)` when the
 * first segment does not yet exist at root.
 */
export function resolveQualifiedNode(
  topLevel: readonly DescriptiveNode[],
  id: string,
  sep: string | null | undefined,
): DescriptiveNode | undefined {
  const segments = splitNamespacePath(id, sep);
  if (segments === null) return undefined;
  let siblings: readonly DescriptiveNode[] = topLevel;
  let found: DescriptiveNode | undefined;
  for (const segment of segments) {
    found = siblings.find((n) => n.id === segment);
    if (found === undefined) return undefined;
    siblings = found.children;
  }
  return found;
}

/** A qualified node still being nested, paired with the path segments it
 *  has yet to descend through (`remaining[0]` is the NEXT segment to
 *  bucket by; `remaining.length === 1` means this node itself belongs
 *  directly in the group currently being built — no deeper nesting left). */
interface PendingEntry {
  node: DescriptiveNode;
  remaining: readonly string[];
}

/** A synthesized `GroupType.PACKAGE` wrapper for one namespace segment —
 *  `display` is just that segment (matching `Quark.getName()`); `id` is the
 *  full accumulated path so it can never collide with a real leaf's own
 *  (always fully-qualified) id. */
function buildPhantomGroup(
  qualifiedPath: string,
  segment: string,
  children: DescriptiveNode[],
): DescriptiveNode {
  return {
    id: qualifiedPath,
    display: segment,
    symbol: 'package',
    children,
    phantomGroup: true,
  };
}

/** One nesting level: buckets `entries` by their next unconsumed segment,
 *  recursing per bucket, until an entry's last segment is reached (it then
 *  becomes a direct member of the group for that segment). */
function buildLevel(
  entries: readonly PendingEntry[],
  prefix: string,
  sep: string,
): DescriptiveNode[] {
  const result: DescriptiveNode[] = [];
  const buckets = new Map<string, PendingEntry[]>();
  const order: string[] = [];
  for (const entry of entries) {
    if (entry.remaining.length === 1) {
      result.push(entry.node);
      continue;
    }
    const first = entry.remaining[0]!;
    let bucket = buckets.get(first);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(first, bucket);
      order.push(first);
    }
    bucket.push({ node: entry.node, remaining: entry.remaining.slice(1) });
  }
  for (const first of order) {
    const qualifiedPath = prefix === '' ? first : prefix + sep + first;
    const children = buildLevel(buckets.get(first)!, qualifiedPath, sep);
    result.push(buildPhantomGroup(qualifiedPath, first, children));
  }
  return result;
}

/** One level of the AST walk: separates non-qualified nodes (passed through
 *  unchanged, recursing into any explicit-container children so a nested
 *  dotted grandchild is still grouped) from qualified nodes (fed to
 *  `buildLevel`), in first-appearance-preserving order for the passthrough
 *  half — order among synthesized phantom groups is by first-segment
 *  first-appearance (structural DOT parity does not depend on sibling
 *  order; see `tests/oracle/svek-dot.ts#compareStructural`). */
function buildNamespaceGroupsAt(
  nodes: readonly DescriptiveNode[],
  sep: string,
  prefix = '',
): DescriptiveNode[] {
  const passthrough: DescriptiveNode[] = [];
  const entries: PendingEntry[] = [];
  for (const n of nodes) {
    const segments = splitNamespacePath(n.id, sep);
    if (segments === null) {
      passthrough.push(
        n.children.length > 0 ? { ...n, children: buildNamespaceGroupsAt(n.children, sep) } : n,
      );
      continue;
    }
    entries.push({ node: n, remaining: segments });
  }
  return [...passthrough, ...buildLevel(entries, prefix, sep)];
}

/**
 * Layout-time phantom-package synthesis (see file doc for the upstream
 * timing this mirrors). No-op (returns a shallow copy of `nodes`) when
 * `sep` is disabled or no id is namespace-qualified.
 */
export function buildNamespaceGroups(
  nodes: readonly DescriptiveNode[],
  sep: string | null | undefined,
): DescriptiveNode[] {
  if (sep === null || sep === undefined || sep === '') return [...nodes];
  return buildNamespaceGroupsAt(nodes, sep);
}
