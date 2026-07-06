/**
 * Namespace-splitting helpers for class diagrams.
 *
 * PlantUML derives nested namespaces from dotted (qualified) ids using the
 * namespace separator (default `.`, AbstractEntityDiagram.java:88), mirroring
 * its Quark hierarchy. Split out of `parser.ts` to keep that file within the
 * module line budget; these functions take explicit inputs rather than the
 * parser's mutable state.
 */

import type { Namespace } from './ast.js';

/**
 * Split a qualified id on the namespace separator into its non-empty segments,
 * or null when the id is not qualified (no separator) or splitting is disabled
 * (`sep` null/empty).
 */
/**
 * Characters that never appear in a namespace-qualified id (upstream name
 * charset is `[%pLN_][-%pLN_.:\/]*`). Their presence means decoration leaked
 * into a classifier id — a link `[[url]]`, color/style `#...line.dashed`,
 * quoted display, or whitespace — so the id must not be split into namespaces.
 * Kept as a string constant (not a regex literal) so lizard's brace-based
 * complexity parser is not confused by `{}`/`()` inside a pattern.
 */
const NON_QUALIFIED_ID_CHARS = ' \t[]#;<>(){}"\'';

export function splitOnSeparator(id: string, sep: string | null): string[] | null {
  if (sep === null || sep === '' || !id.includes(sep)) return null;
  for (const ch of id) {
    if (NON_QUALIFIED_ID_CHARS.includes(ch)) return null;
  }
  const parts = id.split(sep).filter((p) => p.length > 0);
  return parts.length >= 2 ? parts : null;
}

/**
 * Ensure the nested namespace chain for the given display segments exists in
 * `namespaces`, each level linked to its parent via `parentId`. Ids are the
 * cumulative join on the separator (`['a','b']` → namespaces `a` and `a.b`).
 * Returns the innermost namespace id.
 */
export function ensureNamespaceChain(
  namespaces: Namespace[],
  sep: string,
  segments: string[],
): string {
  let parent: string | undefined;
  let acc = '';
  for (const seg of segments) {
    acc = acc === '' ? seg : acc + sep + seg;
    if (namespaces.find((n) => n.id === acc) === undefined) {
      const ns: Namespace = { id: acc, display: seg, classifiers: [] };
      if (parent !== undefined) ns.parentId = parent;
      namespaces.push(ns);
    }
    parent = acc;
  }
  return acc;
}

export interface NsResolveInput {
  namespaces: Namespace[];
  sep: string | null;
  activeNamespace: string | null;
  id: string;
  display: string | undefined;
  /**
   * When false (`!pragma useIntermediatePackages false`), a dotted id collapses
   * to a single namespace of the whole qualifier instead of a nested chain
   * (`A.B.C.Z` → one namespace `A.B.C`, not `A` > `A.B` > `A.B.C`).
   */
  intermediatePackages: boolean;
}

/**
 * Resolve the namespace + display for a new classifier id. A qualified id at
 * the root level (no enclosing block) creates an implicit nested namespace
 * chain from its qualifier, e.g. `java.lang.Object` → namespaces `java` >
 * `java.lang` holding leaf `Object`; otherwise it inherits the active namespace.
 */
export function resolveClassifierNs(
  input: NsResolveInput,
): { nsId: string | null; display: string | undefined } {
  const { namespaces, sep, activeNamespace, id, display, intermediatePackages } = input;
  const segments = activeNamespace === null ? splitOnSeparator(id, sep) : null;
  if (segments === null) return { nsId: activeNamespace, display };
  const separator = sep ?? '.';
  const qualifier = segments.slice(0, -1);
  const nsSegments = intermediatePackages ? qualifier : [qualifier.join(separator)];
  // A plain dotted declaration shows the leaf name (`java.lang.Object` → box
  // labelled `Object`); an explicit alias/quoted display (display !== id) wins.
  const isDefaultDisplay = display === undefined || display === id;
  return {
    nsId: ensureNamespaceChain(namespaces, separator, nsSegments),
    display: isDefaultDisplay ? segments[segments.length - 1] : display,
  };
}
