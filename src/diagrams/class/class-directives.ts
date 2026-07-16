/**
 * Hide/show directive parsing and post-processing for class diagrams.
 *
 * Split out of `parser.ts` to keep that file within the module line budget.
 * These functions operate only on the public `ClassDiagramAST` — they hold no
 * parse state — so they compose cleanly with the command-dispatch table.
 */

import type {
  ClassDiagramAST,
  ClassNote,
  HideShowDirective,
  HideShowPatternDirective,
  HideTarget,
} from './ast.js';

/**
 * Map from the lowercase target string to the canonical HideTarget value.
 * Only the supported global targets are listed here.
 */
const HIDE_TARGET_MAP: Record<string, HideTarget> = {
  'empty members': 'empty members',
  'members':       'members',
  'circle':        'circle',
  'empty fields':  'empty fields',
  'empty methods': 'empty methods',
};

/**
 * Parse a hide/show directive line.
 * Returns null if the line is not a recognised directive.
 *
 * Matches lines of the form:
 *   hide empty members
 *   hide members
 *   hide circle
 *   hide empty fields
 *   hide empty methods
 *   show <same targets>
 */
export function parseHideShowDirective(line: string): HideShowDirective | null {
  const m = /^(hide|show)\s+(.+)$/i.exec(line);
  if (m === null) return null;

  const action = m[1]!.toLowerCase() as 'hide' | 'show';
  const targetStr = m[2]!.trim().toLowerCase();
  const target = HIDE_TARGET_MAP[targetStr];
  if (target === undefined) return null;

  return { kind: 'hideshow', action, target };
}

/**
 * Parse a `hide`/`show <entity|$tag|<<stereotype>>|*|@unlinked>` entity-
 * pattern directive (upstream `CommandHideShow2`, G2 N7 --
 * {@link HideShowPatternDirective}'s own doc comment). `WHAT` must be either
 * a single whitespace-free token or a `<<...>>`-bracketed stereotype (which
 * MAY contain internal whitespace, e.g. `<<My Stereo>>`) -- upstream's own
 * regex (`"([^%s]+|\<\<.*\>\>)"`) requires exactly this shape, which is
 * what keeps a QUALIFIED form like `hide C2 circle` (two whitespace-
 * separated tokens, not bracketed) from matching here: that form belongs to
 * a different, unported upstream command
 * (`CommandHideShowByGender`/`CommandHideShowByVisibility`) and is left for
 * `parseHideShowDirective`'s null return to drop, same as today.
 * Returns null for the global-target forms `parseHideShowDirective` already
 * owns (`members`/`circle`/`empty members`/`empty fields`/`empty methods`) --
 * callers try that parser FIRST; this one is the fallback.
 */
export function parseHideShowPatternDirective(
  line: string,
): HideShowPatternDirective | null {
  const m = /^(hide(?:-class)?|show(?:-class)?)\s+(<<.*>>|\S+)$/i.exec(line);
  if (m === null) return null;

  const action: 'hide' | 'show' = /^hide/i.test(m[1]!) ? 'hide' : 'show';
  const what = m[2]!.trim();
  if (HIDE_TARGET_MAP[what.toLowerCase()] !== undefined) return null;

  return { kind: 'hideshowpattern', action, what };
}

/**
 * Apply the accumulated hide/show directives to classifiers and their members.
 * Later directives (higher index in the array) override earlier ones because
 * show/hide are additive and last-writer-wins per target.
 *
 * Effective state is determined by scanning directives in order; for each
 * target the last action seen wins.
 *
 * Note on hide empty fields / hide empty methods:
 *   These directives affect the divider/section visibility, which is computed in
 *   layout (layoutClass reads ast.directives directly). No per-member flag is
 *   needed here — the directives are already stored in ast.directives for layout.
 */
export function applyDirectives(ast: ClassDiagramAST): void {
  if (ast.directives.length === 0) return;

  // Resolve the final effective action for each target (last wins).
  const effectiveAction = new Map<HideTarget, 'hide' | 'show'>();
  for (const directive of ast.directives) {
    effectiveAction.set(directive.target, directive.action);
  }

  const hideMembers = effectiveAction.get('members') === 'hide';
  const hideCircle  = effectiveAction.get('circle')  === 'hide';

  for (const classifier of ast.classifiers) {
    // hide circle — suppress the C/I/A/E badge in the renderer
    if (hideCircle) {
      classifier.hideCircle = true;
    }

    // hide members — mark every member as hidden regardless of type
    if (hideMembers) {
      for (const member of classifier.members) {
        member.hidden = true;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// remove / restore (CommandRemoveRestore → CucaDiagram#removeOrRestore)
// ---------------------------------------------------------------------------
//
// Unlike hide/show — which never reaches the svek export (a hidden entity
// still occupies its node in the DOT graph; verified against the oracle:
// doseko-41-mavu661's `hide *` + `show $z` DOT is byte-identical to the
// directive-free sevaxa-72-pudi231) — `remove` excludes the matched entities
// from the exported graph entirely. The predicate is evaluated LAZILY at
// export time (GraphvizImageBuilder#printEntities / printGroups / the
// link.isRemoved() skip), after ALL parsing, over the accumulated directive
// list in source order with last-applicable-writer-wins per entity.
// @see ~/git/plantuml/.../svek/GraphvizImageBuilder.java:230,350,413
// @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:762-806
// @see ~/git/plantuml/.../cucadiagram/HideOrShow.java

/** A non-invisible link (relationship or attached-note connector), the unit
 *  the `@unlinked` predicate and note-delegation both iterate. Member-anchored
 *  notes (`targetPort` set) route as `style=invis` (note-layout.ts), matching
 *  upstream's invisible note link — those are excluded here, which is exactly
 *  what makes cejili-77's member-note "@unlinked" while its host stays linked. */
interface VisibleLink {
  a: string;
  b: string;
}

function collectVisibleLinks(ast: ClassDiagramAST): VisibleLink[] {
  const links: VisibleLink[] = [];
  for (const rel of ast.relationships) {
    if (rel.invis !== true) links.push({ a: rel.from, b: rel.to });
  }
  for (const note of ast.notes) {
    if (note.target !== undefined && note.targetPort === undefined) {
      links.push({ a: note.id, b: note.target });
    }
  }
  return links;
}

/** What an entity exposes to directive matching (classifier or note). */
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
 * HideOrShow#match: `*` wildcards become `.*` (other regex metacharacters are
 * NOT escaped — faithful to upstream's raw `pattern.replace("*", ".*")`);
 * a non-wildcard pattern is plain string equality.
 */
function matchPattern(name: string, pattern: string): boolean {
  if (pattern.includes('*')) {
    return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(name);
  }
  return name === pattern;
}

/**
 * Entity-name matching strips the qualified name down to its leaf segment
 * first (upstream `name.lastIndexOf(Plasma.MAGIC_SEPARATOR)` — the Quark
 * qualified-name separator; our ids qualify with `.`/`::` instead). Tag and
 * stereotype matching (isApplyableTag/-Stereotype) use {@link matchPattern}
 * directly — upstream applies match() to them too, but tag/stereotype labels
 * never contain the separator, so the strip is a no-op there.
 */
function matchEntityName(id: string, pattern: string): boolean {
  const m = /(?:::|\.)([^.:]+)$/.exec(id);
  return matchPattern(m !== null ? m[1]! : id, pattern);
}

/** HideOrShow#isApplyable(Entity): `$tag` → stereotags; `<<s>>` → stereotype;
 *  `@unlinked` → isAloneAndUnlinked; else leaf-name match. */
function isApplyable(
  e: RemovableEntity,
  what: string,
  unlinked: (id: string) => boolean,
): boolean {
  if (what.startsWith('$')) {
    return (e.tags ?? []).some((t) => matchPattern(t, what.slice(1)));
  }
  if (what.startsWith('<<') && what.endsWith('>>')) {
    return (
      e.stereotype !== undefined &&
      matchPattern(e.stereotype, what.slice(2, -2).trim())
    );
  }
  if (isAboutUnlinked(what)) return unlinked(e.id);
  return matchEntityName(e.id, what);
}

/** A `remove`/`restore` OR `hide`/`show`-pattern directive — both upstream
 *  command families accumulate into the SAME `HideOrShow` matcher shape
 *  (`what` + a two-valued action), just into different lists consulted at
 *  different boundaries (G2 N7 — {@link HideShowPatternDirective}'s own doc
 *  comment). Generic over the action's literal union so `foldDirectives`/
 *  `buildUnlinkedPredicate` serve both `computeRemovedIds` and
 *  `computeHiddenIds` without duplicating the matching logic. */
interface PatternDirective<A extends string> {
  what: string;
  action: A;
}

/** Fold the directive list over one entity — HideOrShow#apply chain: each
 *  applicable directive overwrites the running verdict (`return !show`), so
 *  the LAST applicable directive wins (`remove *` then `restore $tag1` /
 *  `hide *` then `show $tag1`). `positiveAction` is the action value that
 *  sets the verdict true (`'remove'` for remove/restore, `'hide'` for
 *  hide/show-pattern). */
function foldDirectives<A extends string>(
  dirs: readonly PatternDirective<A>[],
  e: RemovableEntity,
  includeUnlinked: boolean,
  unlinked: (id: string) => boolean,
  positiveAction: A,
): boolean {
  let matched = false;
  for (const d of dirs) {
    if (!includeUnlinked && isAboutUnlinked(d.what)) continue;
    if (isApplyable(e, d.what, unlinked)) matched = d.action === positiveAction;
  }
  return matched;
}

/**
 * CucaDiagram#isNoteWithSingleLinkAttachedTo: a note with exactly ONE
 * non-invisible link whose other end is not itself a note delegates its
 * entire removed/hidden status to that neighbor. Returns the neighbor id, or
 * null when the note has zero, several, invisible-only, or note-to-note links
 * (then the note answers for itself).
 */
function noteSingleLinkOther(
  note: ClassNote,
  links: readonly VisibleLink[],
  noteIds: ReadonlySet<string>,
): string | null {
  let other: string | null = null;
  for (const l of links) {
    const o = l.a === note.id ? l.b : l.b === note.id ? l.a : null;
    if (o === null) continue;
    if (other !== null) return null; // more than one link
    if (noteIds.has(o)) return null; // other end is a note
    other = o;
  }
  return other;
}

/**
 * Compute the set of removed entity ids (classifiers AND notes) for the
 * accumulated `remove`/`restore` directives. Pure — evaluated once at the
 * layout-input boundary (mirroring upstream's export-time evaluation; by then
 * all parsing is done, which is what makes `@unlinked` see the final link
 * set).
 *
 * `Entity#isAloneAndUnlinked`: an entity is unlinked when every one of its
 * non-invisible links connects to an entity already removed by a
 * NON-`@unlinked` directive (`isRemovedIgnoreUnlinked` — no delegation, no
 * unlinked recursion; that restriction is what keeps the predicate
 * terminating and order-independent).
 * @see ~/git/plantuml/.../abel/Entity.java:457-476
 */
export function computeRemovedIds(ast: ClassDiagramAST): Set<string> {
  const dirs = ast.removeDirectives ?? [];
  const removed = new Set<string>();
  if (dirs.length === 0) return removed;

  const links = collectVisibleLinks(ast);
  const noteIds = new Set(ast.notes.map((n) => n.id));
  const unlinked = buildUnlinkedPredicate(ast, dirs, links, 'remove');

  for (const c of ast.classifiers) {
    if (foldDirectives(dirs, c, true, unlinked, 'remove')) removed.add(c.id);
  }
  for (const n of ast.notes) {
    const other = noteSingleLinkOther(n, links, noteIds);
    const isRemoved =
      other !== null
        ? removed.has(other)
        : foldDirectives(dirs, n, true, unlinked, 'remove');
    if (isRemoved) removed.add(n.id);
  }
  return removed;
}

/**
 * Compute the set of HIDDEN entity ids (classifiers AND notes) for the
 * accumulated `hide`/`show <entity|$tag|<<stereotype>>|*|@unlinked>`
 * directives ({@link HideShowPatternDirective}) — same shape and same
 * matching engine as {@link computeRemovedIds} (upstream shares the
 * `HideOrShow` class between `hides2` and `removed`), but the caller MUST
 * NOT filter the AST with this set — a hidden entity keeps its svek/DOT
 * node; only its drawn content is suppressed (`layout.ts` marks
 * `ClassifierGeo.hidden` from this set; `renderer.ts` skips content for a
 * hidden classifier while every uid/creationIndex/layout computation runs
 * exactly as if it were visible).
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java#isHidden
 */
export function computeHiddenIds(ast: ClassDiagramAST): Set<string> {
  const dirs = ast.hidePatternDirectives ?? [];
  const hidden = new Set<string>();
  if (dirs.length === 0) return hidden;

  const links = collectVisibleLinks(ast);
  const noteIds = new Set(ast.notes.map((n) => n.id));
  const unlinked = buildUnlinkedPredicate(ast, dirs, links, 'hide');

  for (const c of ast.classifiers) {
    if (foldDirectives(dirs, c, true, unlinked, 'hide')) hidden.add(c.id);
  }
  for (const n of ast.notes) {
    const other = noteSingleLinkOther(n, links, noteIds);
    const isHiddenNote =
      other !== null
        ? hidden.has(other)
        : foldDirectives(dirs, n, true, unlinked, 'hide');
    if (isHiddenNote) hidden.add(n.id);
  }
  return hidden;
}

/** `Entity#isAloneAndUnlinked`'s core: an id is unlinked when every visible
 *  link touching it connects to an entity removed by a NON-`@unlinked`
 *  directive (`isRemovedIgnoreUnlinked` — folded directly, no note delegation,
 *  no unlinked recursion — which keeps the predicate terminating). */
function buildUnlinkedPredicate<A extends string>(
  ast: ClassDiagramAST,
  dirs: readonly PatternDirective<A>[],
  links: readonly VisibleLink[],
  positiveAction: A,
): (id: string) => boolean {
  const byId = new Map<string, RemovableEntity>();
  for (const c of ast.classifiers) byId.set(c.id, c);
  for (const n of ast.notes) byId.set(n.id, n);

  const neverUnlinked = (): boolean => false;
  const removedIgnoreUnlinked = (id: string): boolean => {
    const e = byId.get(id);
    return e !== undefined && foldDirectives(dirs, e, false, neverUnlinked, positiveAction);
  };
  return (id: string): boolean =>
    links.every((l) => {
      const o = l.a === id ? l.b : l.b === id ? l.a : null;
      return o === null || removedIgnoreUnlinked(o);
    });
}

/**
 * Exclude removed entities from the AST handed to the DOT-graph builder —
 * the port's equivalent of upstream's export-boundary `isRemoved()` skips
 * (printEntities / printGroups / link.isRemoved()). Returns the SAME object
 * when nothing is removed so the common no-directive path costs nothing.
 *
 * Group (namespace) removal — `remove aPackageName` — is not implemented:
 * `Namespace` carries no tags and no fixture in the current group exercises
 * it; membership lists are still filtered so clusters shrink with their
 * removed members.
 */
export function filterRemovedEntities(ast: ClassDiagramAST): ClassDiagramAST {
  const removed = computeRemovedIds(ast);
  if (removed.size === 0) return ast;
  return {
    ...ast,
    classifiers: ast.classifiers.filter((c) => !removed.has(c.id)),
    notes: ast.notes.filter((n) => !removed.has(n.id)),
    relationships: ast.relationships.filter(
      (r) => !removed.has(r.from) && !removed.has(r.to),
    ),
    namespaces: ast.namespaces.map((ns) => ({
      ...ns,
      classifiers: ns.classifiers.filter((id) => !removed.has(id)),
    })),
  };
}
