/**
 * Namespace-splitting helpers for class diagrams.
 *
 * PlantUML derives nested namespaces from dotted (qualified) ids using the
 * namespace separator (default `.`, AbstractEntityDiagram.java:88), mirroring
 * its Quark hierarchy. Split out of `parser.ts` to keep that file within the
 * module line budget; these functions take explicit inputs rather than the
 * parser's mutable state.
 */

import type { Classifier, ClassifierKind, ClassDiagramAST, Namespace } from './ast.js';

/**
 * Register an id (classifier or note) as a direct member of the given
 * namespace, if one is set. Shared by `parser.ts` (classifiers) and
 * `class-notes.ts` (notes) — both are leaves that must land in
 * `Namespace.classifiers`, the sole source `buildDotClusters` (class-dot-graph.ts)
 * reads for cluster membership.
 */
export function registerInNamespace(
  namespaces: Namespace[],
  nsId: string | null,
  id: string,
): void {
  if (nsId === null) return;
  const ns = namespaces.find((n) => n.id === nsId);
  if (ns !== undefined) {
    ns.classifiers.push(id);
  }
}

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
 * Collapse a namespace/package into a plain rect leaf classifier when it is
 * empty, mirroring upstream `CommandNamespaceEmpty`/`CommandPackageEmpty`'s
 * `gotoGroup` + immediate `endGroup()` pair. Two callers, both immediate
 * (never look ahead): `class-commands.ts`'s same-line `X {}` handler, and
 * `class-container.ts#closeContainer`'s multi-line `}` close — but the
 * latter ONLY for descriptive containers (`rectangle`/`component`/…), which
 * cannot be reopened by name afterward. A plain `package`/`namespace` CAN be
 * reopened by a later block adding real content under it, so collapsing it
 * immediately on close is unsound in general — see
 * `collapseEmptyNamespacesFinal` below, which handles that case once on the
 * fully-parsed tree. Verified against the oracle DOT for gatula-10-bifu561
 * (same-line: `package foo {}` / `namespace bar {}` / `class qux {}`, all
 * three flat `shape=rect` leaves, no cluster).
 *
 * "Empty" means no direct classifier members AND no live child namespace —
 * `ns.classifiers` tracks only direct classifier ids (registered by
 * `registerInNamespace`), not nested sub-namespaces, which are separate
 * `Namespace` objects until THEY collapse or close. A namespace whose only
 * content is a still-open child namespace (e.g. `package P { rectangle R {
 * class C } }` closing `P` after `R` closed non-empty) is not empty, even
 * though `P.classifiers` is itself empty — mirrors upstream's
 * `Entity.isEmpty()` (abel/Entity.java:677-682), which iterates ALL quark
 * children (leaves and sub-groups alike), not just leaf classifiers.
 * Returns the updated namespaces array (the caller reassigns
 * `state.ast.namespaces`).
 * @see ~/git/plantuml/.../command/CommandNamespaceEmpty.java:104-135
 * @see ~/git/plantuml/.../command/CommandPackageEmpty.java:105-134
 */
export function collapseEmptyNamespace(
  namespaces: Namespace[],
  classifierIndex: Map<string, number>,
  classifiers: Classifier[],
  nsId: string,
): Namespace[] {
  const ns = namespaces.find((n) => n.id === nsId);
  const hasChildNamespace = namespaces.some((n) => n.parentId === nsId);
  if (ns === undefined || ns.classifiers.length > 0 || hasChildNamespace) return namespaces;
  const remaining = namespaces.filter((n) => n.id !== nsId);
  const parentId = ns.parentId ?? null;
  const classifier = makeClassifier(nsId, 'descriptive', ns.display, parentId);
  classifierIndex.set(nsId, classifiers.length);
  classifiers.push(classifier);
  if (parentId !== null) {
    remaining.find((n) => n.id === parentId)?.classifiers.push(nsId);
  }
  return remaining;
}

/**
 * Collapse every remaining EMPTY namespace/package (no direct classifiers,
 * no live child namespace) once, on the fully-parsed + remove-filtered AST —
 * the reopen-safe counterpart of `collapseEmptyNamespace`'s parse-time
 * collapse. Mirrors upstream `GraphvizImageBuilder#printGroups`
 * (svek/GraphvizImageBuilder.java:406-419), which mutes ANY still-empty
 * `GroupType.PACKAGE` to `LeafType.EMPTY_PACKAGE` at DOT-export time, on the
 * COMPLETE diagram model — not per-block-close. Call after
 * `filterRemovedEntities` (class-directives.ts) so a namespace emptied only
 * because its sole member was excluded by `remove`/`restore` (which already
 * strips removed ids from `Namespace.classifiers`) is caught too, alongside
 * one declared empty in source.
 *
 * A namespace closed empty at parse time but later reopened with real
 * content (`namespace f1 {}` … `namespace f1.function { class Fox }`) is
 * fine here: by the time this runs, `f1` already has `f1.function` as a
 * live child namespace, so it fails the emptiness check and is left alone —
 * confirmed against the oracle DOT for delano-03-xino845/faxoga-34-moja699/
 * jabeme-35-logi109 (all reopen a previously-empty-closed namespace; all
 * regressed when this collapse was attempted eagerly at parse-time close
 * instead).
 *
 * Loops because collapsing one empty leaf can make its now-childless parent
 * eligible in turn (a chain of nested empty packages); each iteration either
 * collapses exactly one namespace or halts, so it terminates in at most
 * `ast.namespaces.length` steps. Returns `ast` unchanged (same reference)
 * when nothing collapses.
 */
export function collapseEmptyNamespacesFinal(ast: ClassDiagramAST): ClassDiagramAST {
  if (ast.namespaces.length === 0) return ast;
  let namespaces = ast.namespaces;
  const classifiers = [...ast.classifiers];
  const classifierIndex = new Map(classifiers.map((c, i) => [c.id, i] as const));
  for (;;) {
    const emptyLeaf = namespaces.find(
      (ns) => ns.classifiers.length === 0 && !namespaces.some((n) => n.parentId === ns.id),
    );
    if (emptyLeaf === undefined) break;
    namespaces = collapseEmptyNamespace(namespaces, classifierIndex, classifiers, emptyLeaf.id);
  }
  if (namespaces === ast.namespaces) return ast;
  return { ...ast, namespaces, classifiers };
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

/**
 * Split `id` on the namespace separator, guarding against decoration leaking
 * into a FRESH reference — but not against a caller-supplied `trustedPrefix`
 * (an already-resolved namespace id) that legitimately carries such
 * characters. A `package`/`namespace` given no `as CODE` alias uses its raw
 * quoted DISPLAY text as its id verbatim (mirrors upstream `CommandPackage`'s
 * `idShort = display`, `AbstractEntityDiagram.cleanId` only strips
 * surrounding quotes) — so a creole-decorated display like
 * `"<size:18>styled</size>\nshould be styled"` is a valid, EXISTING namespace
 * id, not leaked decoration. Re-qualifying a reference inside that namespace
 * (`activeNamespace + sep + name`) must not re-reject those characters just
 * because they came along for the ride in the trusted prefix — only the
 * freshly-appended tail is scanned in that case. Verified against the oracle
 * DOT for daxeno-00-kasu166: `package "<size:18>styled2</size>\nshould be
 * styled" <<Database>> { class foo }` — without the exemption, `foo`'s
 * `nsId` resolved to null (dropped from its cluster) because the guard saw
 * the package's own `<`/`>` markup in the fully-qualified id.
 */
export function splitOnSeparator(
  id: string,
  sep: string | null,
  trustedPrefix?: string,
): string[] | null {
  if (sep === null || sep === '' || !id.includes(sep)) return null;
  const scanFrom =
    trustedPrefix !== undefined && id.startsWith(trustedPrefix + sep)
      ? trustedPrefix.length + sep.length
      : 0;
  for (let i = scanFrom; i < id.length; i++) {
    if (NON_QUALIFIED_ID_CHARS.includes(id[i]!)) return null;
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
  /** All classifiers declared so far in the diagram — read by the
   *  unique-match reuse lookup below (`countByName`/`firstWithName`). */
  classifiers: Classifier[];
  /**
   * Mirrors upstream `quarkInContext(reuseExistingChild, full)`
   * (`CucaDiagram.java:244-245`): true at relation-endpoint resolution sites
   * (`CommandLinkClass`'s link/couple endpoints), false at declaration sites
   * (`CommandCreateClass`). When true and `name` is a bare (non-dotted)
   * reference that uniquely matches (`countByName` === 1) an existing
   * classifier anywhere in the diagram, resolution reuses that classifier's
   * id/namespace instead of creating a new scope-local one.
   */
  reuseExistingChild: boolean;
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
 * Compute the "simple/leaf name" of a fully-qualified id: the last segment
 * after splitting on the namespace separator, or the whole id when it is not
 * namespace-qualified. Mirrors what upstream registers as a Quark's identity
 * (`Quark.java`'s `name` field — the raw path segment passed to `child()`),
 * which is the key `Plasma#firstWithName`/`countByName` look up.
 * @see ~/git/plantuml/.../net/sourceforge/plantuml/plasma/Plasma.java:57-108
 */
function leafName(id: string, sep: string | null): string {
  const segments = splitOnSeparator(id, sep);
  return segments === null ? id : segments[segments.length - 1]!;
}

/**
 * Count classifiers across the WHOLE diagram whose leaf/simple name equals
 * `name`, mirroring upstream `CucaDiagram#countByName` → `Plasma#countByName`:
 * every classifier is a registered Quark, keyed by its simple name regardless
 * of its namespace qualifier — a plain (unmemoized) equivalent of that map.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:923-925
 * @see ~/git/plantuml/.../net/sourceforge/plantuml/plasma/Plasma.java:104-108
 */
export function countByName(
  classifiers: Classifier[],
  sep: string | null,
  name: string,
): number {
  return classifiers.filter((c) => leafName(c.id, sep) === name).length;
}

/**
 * The first classifier (in declaration order) whose leaf/simple name equals
 * `name`, mirroring upstream `CucaDiagram#firstWithName` → `Plasma#firstWithName`.
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:919-921
 * @see ~/git/plantuml/.../net/sourceforge/plantuml/plasma/Plasma.java:96-100
 */
export function firstWithName(
  classifiers: readonly Classifier[],
  sep: string | null,
  name: string,
): Classifier | undefined {
  return classifiers.find((c) => leafName(c.id, sep) === name);
}

/**
 * Unique-match reuse: a bare (non-dotted) RELATION-ENDPOINT reference that
 * matches exactly one existing classifier anywhere in the diagram resolves
 * to that classifier instead of spawning a new scope-local one. Mirrors
 * `quarkInContext`'s x===-1 branch (`CucaDiagram.java:264-271`). Returns null
 * when the reuse rule does not apply (dotted name, disabled, or no unique
 * match), signalling the caller to fall through to scope-local resolution.
 *
 * The `found.id !== activeNamespace` guard mirrors upstream's
 * `byName != currentQuark` (`CucaDiagram.java:269`): in upstream's unified
 * Quark tree, a package and a same-named classifier declared before the
 * package opens are literally the SAME node — `getCurrentGroup().getQuark()`
 * (`currentQuark`) IS that node once you're inside the package. Our port
 * keeps `classifiers`/`namespaces` as separate id spaces, so the guard
 * becomes an id-string comparison: a bare self-named reference from INSIDE a
 * package must not resolve to that package's own (pre-existing, same-id)
 * classifier — it creates a new nested `P.P` instead. Verified against
 * bejusa-95-gafo325 (`class PCAN_DRV` never declared; `VCAN_DRV -- PCAN_DRV`
 * at root creates a root classifier `PCAN_DRV`, then `package PCAN_DRV { PCAN_DRV
 * -- Bus_Control }` must still nest `PCAN_DRV.PCAN_DRV`, not reuse the root one).
 */
function tryReuseExisting(input: ResolveInput): ResolvedRef | null {
  const { sep, name, display, classifiers, reuseExistingChild, activeNamespace } = input;
  if (!reuseExistingChild || splitOnSeparator(name, sep) !== null) return null;
  if (countByName(classifiers, sep, name) !== 1) return null;
  const found = firstWithName(classifiers, sep, name)!;
  if (found.id === activeNamespace) return null;
  return { id: found.id, nsId: found.namespace ?? null, display };
}

/**
 * Resolve a class reference to its fully-qualified id + owning namespace,
 * mirroring upstream's Quark resolution (verified against the class DOT oracle):
 *  - not dotted, `reuseExistingChild` and a unique existing match → that
 *    classifier's own id/namespace, wherever it lives (see `tryReuseExisting`);
 *  - not dotted otherwise → local to the active namespace (`C.name`, or
 *    `name` at root);
 *  - dotted whose first segment matches an EXISTING namespace → absolute
 *    (the name as written) — e.g. `classic.collections.ArrayList` when a
 *    `classic` namespace exists, or a self-reference `net.…` from inside `net`;
 *  - dotted otherwise → relative to the active namespace.
 * The resolved qualifier's nested namespace chain is created as a side effect
 * (skipped when an existing classifier is reused).
 */
/**
 * The non-reuse, non-absolute resolution path: qualify `input.name` under
 * `input.activeNamespace`, split the result into namespace segments, and
 * ensure the chain exists. Split out of `resolveReference` to keep that
 * function's branch count under the complexity gate. `sep` is the caller's
 * already-null-checked separator (narrowed from `input.sep`).
 */
function resolveQualified(input: ResolveInput, sep: string): ResolvedRef {
  const { namespaces, activeNamespace, name, display, intermediatePackages } = input;
  const id = qualifiedId(name, activeNamespace, sep, namespaces);
  // `activeNamespace` is an already-resolved, existing namespace id — trust
  // any decoration-looking characters it contributes to `id` (see
  // `splitOnSeparator`'s doc); only the freshly-appended tail is scanned.
  const qSegments = splitOnSeparator(id, sep, activeNamespace ?? undefined);
  if (qSegments === null) return { id, nsId: null, display };
  const leaf = qSegments[qSegments.length - 1]!;
  const qualifier = qSegments.slice(0, -1);
  const nsSegments = intermediatePackages ? qualifier : [qualifier.join(sep)];
  const isDefaultDisplay = display === undefined || display === name;
  return {
    id,
    nsId: ensureNamespaceChain(namespaces, sep, nsSegments),
    display: isDefaultDisplay ? leaf : display,
  };
}

export function resolveReference(input: ResolveInput): ResolvedRef {
  const { sep, activeNamespace, name, display } = input;
  // `set separator none` (sep null/empty): no qualification — the entity keeps
  // its raw id and belongs directly to the active namespace, if any.
  if (sep === null || sep === '') return { id: name, nsId: activeNamespace, display };
  // Leading-dot = absolute reference from the root namespace: strip the leading
  // separator and resolve the remainder at root, mirroring upstream
  // `CucaDiagram.quarkInContextSafe` (`root.child(full.substring(sep.length))`).
  // That upstream branch returns immediately, before ever reaching the
  // reuseExistingChild check below — so the recursive call disables it too.
  if (name.startsWith(sep) && name.length > sep.length) {
    return resolveReference({
      ...input,
      name: name.slice(sep.length),
      activeNamespace: null,
      reuseExistingChild: false,
    });
  }
  const reused = tryReuseExisting(input);
  if (reused !== null) return reused;
  return resolveQualified(input, sep);
}
