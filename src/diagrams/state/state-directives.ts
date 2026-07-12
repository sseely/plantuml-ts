/**
 * `remove`/`restore` directive evaluation for state diagrams — the port's
 * equivalent of upstream's export-time `CucaDiagram#isRemoved()` skip.
 *
 * Upstream registers `CommandRemoveRestore` (a `classdiagram.command` class,
 * NOT state-specific — `StateDiagramFactory` reuses it verbatim, same as
 * `CucaDiagram#removeOrRestore`/`HideOrShow` are shared base-class
 * machinery) so the matching semantics are IDENTICAL to the class engine's
 * `remove`/`restore`: `$tag`, `<<stereotype>>`, `@unlinked`, and bare/
 * wildcard id all resolve the same way. This file mirrors
 * `class-directives.ts`'s remove/restore section, adapted for the state
 * engine's NESTED entity tree (`State.children`/`.concurrentRegions`) in
 * place of class diagrams' flat `classifiers` list, and transitions that can
 * live either at the top scope (`ast.transitions`) or inside a composite's
 * own inner scope (`State.transitions`).
 * @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:87
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:611-624,762-786
 * @see ~/git/plantuml/.../cucadiagram/HideOrShow.java
 */

import type { State, StateDiagramAST, StateNote, RemoveRestoreDirective, Transition } from './ast.js';

/** What an entity exposes to directive matching (state or note). */
interface RemovableEntity {
  id: string;
  tags?: string[];
  stereotype?: string;
}

/** `what.equalsIgnoreCase("@unlinked")` — HideOrShow#isAboutUnlinked. */
function isAboutUnlinked(what: string): boolean {
  return what.toLowerCase() === '@unlinked';
}

/**
 * HideOrShow#match: `*` wildcards become `.*` (other regex metacharacters
 * are NOT escaped — faithful to upstream's raw `pattern.replace("*", ".*")`
 * ); a non-wildcard pattern is plain string equality.
 */
function matchPattern(name: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(name);
  }
  return name === pattern;
}

/** Entity-name matching strips a dotted id down to its leaf segment first
 *  (upstream `name.lastIndexOf(Plasma.MAGIC_SEPARATOR)` — mirrors
 *  class-directives.ts's `matchEntityName`, same rationale: tag/stereotype
 *  labels never contain the separator, so the strip is a no-op for them). */
function matchEntityName(id: string, pattern: string): boolean {
  const m = /\.([^.]+)$/.exec(id);
  return matchPattern(m !== null ? m[1]! : id, pattern);
}

/** HideOrShow#isApplyable(Entity): `$tag` → stereotags; `<<s>>` → stereotype;
 *  `@unlinked` → isAloneAndUnlinked; else leaf-name match. */
function isApplyable(e: RemovableEntity, what: string, unlinked: (id: string) => boolean): boolean {
  if (what.startsWith('$')) {
    return (e.tags ?? []).some((t) => matchPattern(t, what.slice(1)));
  }
  if (what.startsWith('<<') && what.endsWith('>>')) {
    return e.stereotype !== undefined && matchPattern(e.stereotype, what.slice(2, -2).trim());
  }
  if (isAboutUnlinked(what)) return unlinked(e.id);
  return matchEntityName(e.id, what);
}

/** Fold the directive list over one entity — HideOrShow#apply chain: each
 *  applicable directive overwrites the running verdict (`return !show`), so
 *  the LAST applicable directive wins (`remove *` then `restore $tagB`). */
function foldDirectives(
  dirs: readonly RemoveRestoreDirective[],
  e: RemovableEntity,
  includeUnlinked: boolean,
  unlinked: (id: string) => boolean,
): boolean {
  let removed = false;
  for (const d of dirs) {
    if (!includeUnlinked && isAboutUnlinked(d.what)) continue;
    if (isApplyable(e, d.what, unlinked)) removed = d.action === 'remove';
  }
  return removed;
}

/** Recursively flatten every State in the tree — the top scope plus every
 *  nested `children`/`concurrentRegions` entry, regardless of depth. Mirrors
 *  upstream's flat leaf/group registry (`CucaDiagram`'s entities are all
 *  keyed by quark, irrespective of nesting) despite this port's AST being a
 *  literal nested tree. */
function flattenStates(states: readonly State[], out: State[] = []): State[] {
  for (const s of states) {
    out.push(s);
    flattenStates(s.children, out);
    for (const region of s.concurrentRegions) flattenStates(region, out);
  }
  return out;
}

/** Every transition in the tree — the top scope's `ast.transitions` plus
 *  each composite's own inner-scope `.transitions` (composite bodies are
 *  NOT hoisted to the top level — see `State.transitions`'s doc). */
function flattenTransitions(ast: StateDiagramAST): Transition[] {
  const out: Transition[] = [...ast.transitions];
  for (const s of flattenStates(ast.states)) out.push(...s.transitions);
  return out;
}

/** A non-invisible link (transition or attached-note connector) — the unit
 *  the `@unlinked` predicate iterates. */
interface VisibleLink {
  a: string;
  b: string;
}

function collectVisibleLinks(ast: StateDiagramAST): VisibleLink[] {
  const links: VisibleLink[] = flattenTransitions(ast).map((t) => ({ a: t.from, b: t.to }));
  for (const note of ast.notes ?? []) {
    if (note.target !== undefined) links.push({ a: note.id, b: note.target });
  }
  return links;
}

/** `Entity#isAloneAndUnlinked`'s core: an id is unlinked when every visible
 *  link touching it connects to an entity removed by a NON-`@unlinked`
 *  directive (`isRemovedIgnoreUnlinked` — folded directly, no recursion,
 *  which keeps the predicate terminating). */
function buildUnlinkedPredicate(
  byId: ReadonlyMap<string, RemovableEntity>,
  dirs: readonly RemoveRestoreDirective[],
  links: readonly VisibleLink[],
): (id: string) => boolean {
  const neverUnlinked = (): boolean => false;
  const removedIgnoreUnlinked = (id: string): boolean => {
    const e = byId.get(id);
    return e !== undefined && foldDirectives(dirs, e, false, neverUnlinked);
  };
  return (id: string): boolean =>
    links.every((l) => {
      const o = l.a === id ? l.b : l.b === id ? l.a : null;
      return o === null || removedIgnoreUnlinked(o);
    });
}

/** Index every state and note by id — the lookup `buildUnlinkedPredicate`
 *  consults for the recursive `@unlinked` neighbor check. */
function buildEntityIndex(
  allStates: readonly State[],
  notes: readonly StateNote[],
): Map<string, RemovableEntity> {
  const byId = new Map<string, RemovableEntity>();
  for (const s of allStates) byId.set(s.id, s);
  for (const n of notes) byId.set(n.id, { id: n.id });
  return byId;
}

/** Fold `dirs` over every entity in `entities`, adding each one that ends up
 *  removed to `removed` (mutates in place — shared by the states and notes
 *  passes in `computeRemovedIds`). */
function markRemoved(
  entities: readonly RemovableEntity[],
  dirs: readonly RemoveRestoreDirective[],
  unlinked: (id: string) => boolean,
  removed: Set<string>,
): void {
  for (const e of entities) {
    if (foldDirectives(dirs, e, true, unlinked)) removed.add(e.id);
  }
}

/**
 * Compute the set of removed entity ids (states AND notes) for the
 * accumulated `remove`/`restore` directives. Pure — evaluated once at the
 * layout-input boundary (mirroring upstream's export-time evaluation; by
 * then all parsing is done, which is what makes `@unlinked` see the final
 * transition set).
 */
export function computeRemovedIds(ast: StateDiagramAST): Set<string> {
  const dirs = ast.removeDirectives ?? [];
  const removed = new Set<string>();
  if (dirs.length === 0) return removed;

  const allStates = flattenStates(ast.states);
  const notes = ast.notes ?? [];
  const unlinked = buildUnlinkedPredicate(buildEntityIndex(allStates, notes), dirs, collectVisibleLinks(ast));

  markRemoved(allStates, dirs, unlinked, removed);
  markRemoved(
    notes.map((n): RemovableEntity => ({ id: n.id })),
    dirs,
    unlinked,
    removed,
  );
  return removed;
}

/** Recursively prune removed states out of the tree, dropping their
 *  inner-scope transitions that touch a removed endpoint along the way. */
function pruneState(s: State, removed: ReadonlySet<string>): State {
  if (s.children.length === 0 && s.concurrentRegions.length === 0 && s.transitions.length === 0) {
    return s;
  }
  return {
    ...s,
    children: pruneStates(s.children, removed),
    concurrentRegions: s.concurrentRegions.map((region) => pruneStates(region, removed)),
    transitions: s.transitions.filter((t) => !removed.has(t.from) && !removed.has(t.to)),
  };
}

function pruneStates(states: readonly State[], removed: ReadonlySet<string>): State[] {
  return states.filter((s) => !removed.has(s.id)).map((s) => pruneState(s, removed));
}

/**
 * Exclude removed entities from the AST handed to the layout stage — the
 * port's equivalent of upstream's export-boundary `isRemoved()` skips
 * (GraphvizImageBuilder's printEntities/printGroups/link.isRemoved()).
 * Returns the SAME object when nothing is removed so the common
 * no-directive path costs nothing.
 */
export function filterRemovedEntities(ast: StateDiagramAST): StateDiagramAST {
  const removed = computeRemovedIds(ast);
  if (removed.size === 0) return ast;
  return {
    ...ast,
    states: pruneStates(ast.states, removed),
    transitions: ast.transitions.filter((t) => !removed.has(t.from) && !removed.has(t.to)),
    notes: (ast.notes ?? []).filter(
      (n: StateNote) => !removed.has(n.id) && (n.target === undefined || !removed.has(n.target)),
    ),
  };
}
