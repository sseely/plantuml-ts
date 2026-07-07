/**
 * Namespace-splitting helpers for class diagrams.
 *
 * PlantUML derives nested namespaces from dotted (qualified) ids using the
 * namespace separator (default `.`, AbstractEntityDiagram.java:88), mirroring
 * its Quark hierarchy. Split out of `parser.ts` to keep that file within the
 * module line budget; these functions take explicit inputs rather than the
 * parser's mutable state.
 */

import type { Classifier, ClassifierKind, Namespace } from './ast.js';

/** Build a fresh Classifier assigned to the given namespace id (or none). */
export function makeClassifier(
  id: string,
  kind: ClassifierKind,
  display: string | undefined,
  nsId: string | null,
): Classifier {
  return {
    id,
    display: display ?? id,
    kind,
    typeParams: [],
    members: [],
    ...(nsId !== null ? { namespace: nsId } : {}),
  };
}

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
 * complexity parser is not confused by `{}`/`()` inside a pattern. Whitespace is
 * intentionally NOT included: a quoted package/namespace name may contain spaces
 * (`"Voici mon package"`), and its members' qualified ids inherit those spaces.
 */
const NON_QUALIFIED_ID_CHARS = '[]#;<>(){}"\'';

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

export interface ResolveInput {
  namespaces: Namespace[];
  sep: string | null;
  activeNamespace: string | null;
  /** The raw reference as written (a declaration name or relationship endpoint). */
  name: string;
  /** Declaration display (defaulted to the raw name); undefined for endpoints. */
  display: string | undefined;
  /**
   * When false (`!pragma useIntermediatePackages false`), a dotted qualifier
   * collapses to a single namespace instead of a nested chain (`A.B.C.Z` → one
   * namespace `A.B.C`, not `A` > `A.B` > `A.B.C`).
   */
  intermediatePackages: boolean;
}

export interface ResolvedRef {
  /** Fully-qualified classifier id (the entity's identity). */
  id: string;
  /** Innermost owning namespace id, or null at the root. */
  nsId: string | null;
  /** Leaf display for a default display; an explicit alias/quoted display wins. */
  display: string | undefined;
}

/**
 * Compute a reference's fully-qualified id under the resolution rule: at the
 * root it is the name as written; inside a namespace it is absolute (the name
 * as written) when the name is dotted and its first segment matches an existing
 * namespace, else relative (`activeNamespace + sep + name`).
 */
function qualifiedId(
  name: string,
  activeNamespace: string | null,
  sep: string | null,
  namespaces: Namespace[],
): string {
  if (activeNamespace === null) return name;
  const head = splitOnSeparator(name, sep)?.[0];
  const absolute = head !== undefined && namespaces.some((n) => n.id === head);
  return absolute ? name : activeNamespace + (sep ?? '.') + name;
}

/**
 * Resolve a class reference to its fully-qualified id + owning namespace,
 * mirroring upstream's Quark resolution (verified against the class DOT oracle):
 *  - not dotted → local to the active namespace (`C.name`, or `name` at root);
 *  - dotted whose first segment matches an EXISTING namespace → absolute
 *    (the name as written) — e.g. `classic.collections.ArrayList` when a
 *    `classic` namespace exists, or a self-reference `net.…` from inside `net`;
 *  - dotted otherwise → relative to the active namespace.
 * The resolved qualifier's nested namespace chain is created as a side effect.
 */
export function resolveReference(input: ResolveInput): ResolvedRef {
  const { namespaces, sep, activeNamespace, name, display, intermediatePackages } = input;
  // `set separator none` (sep null/empty): no qualification — the entity keeps
  // its raw id and belongs directly to the active namespace, if any.
  if (sep === null || sep === '') return { id: name, nsId: activeNamespace, display };
  // Leading-dot = absolute reference from the root namespace: strip the leading
  // separator and resolve the remainder at root, mirroring upstream
  // `CucaDiagram.quarkInContextSafe` (`root.child(full.substring(sep.length))`).
  if (name.startsWith(sep) && name.length > sep.length) {
    return resolveReference({
      ...input,
      name: name.slice(sep.length),
      activeNamespace: null,
    });
  }
  const separator = sep;
  const id = qualifiedId(name, activeNamespace, sep, namespaces);
  const qSegments = splitOnSeparator(id, sep);
  if (qSegments === null) return { id, nsId: null, display };
  const leaf = qSegments[qSegments.length - 1]!;
  const qualifier = qSegments.slice(0, -1);
  const nsSegments = intermediatePackages ? qualifier : [qualifier.join(separator)];
  const isDefaultDisplay = display === undefined || display === name;
  return {
    id,
    nsId: ensureNamespaceChain(namespaces, separator, nsSegments),
    display: isDefaultDisplay ? leaf : display,
  };
}
