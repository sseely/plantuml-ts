/**
 * Element-declaration helpers split out of parser.ts to stay under 500 lines
 * (CommandCreateElementFull.java, net.sourceforge.plantuml.descdiagram
 * .command) — the bracket-shorthand declaration form, the bare-id
 * decorated-display alias form, and the id/tag-based `remove`
 * (CommandRemoveRestore.java) splice helper. Pure logic only; `parser.ts`
 * owns all state mutation (emitNode, containerStack, etc).
 */

import type { USymbol } from '../../core/descriptive-keywords.js';
import type { DescriptiveLink, DescriptiveNode } from './ast.js';
import { cleanId, extractColor, extractNodeStereotype, finalizeDisplay } from './parse-helpers.js';
import { classifyEndpointShape } from './link-grammar.js';

// ---------------------------------------------------------------------------
// Bracket shorthand: [Name] [as Alias] [<<stereotype>>] [#color]
// ---------------------------------------------------------------------------

/** Alias suffix in bracket shorthand: `as Alias [rest]` */
const RE_BRACKET_ALIAS = /^as\s+(\S+)(.*)?$/i;

export interface BracketDeclaration {
  id: string;
  display: string;
  stereotype?: readonly string[];
  color?: string;
}

/** Imperative assignment satisfies exactOptionalPropertyTypes (spreading
 *  `{ stereotype: undefined }` is not allowed for `stereotype?: readonly
 *  string[]`). */
function buildBracketDeclaration(
  id: string,
  display: string,
  stereotype: readonly string[] | undefined,
  color: string | undefined,
): BracketDeclaration {
  const decl: BracketDeclaration = { id, display };
  if (stereotype !== undefined) decl.stereotype = stereotype;
  if (color !== undefined) decl.color = color;
  return decl;
}

/**
 * `[Name]` standalone declaration (CommandCreateElementFull, codeChar `[`
 * branch): `bracketName` is the display default; an `as Alias` suffix
 * overrides the id. `<<stereotype>>`/`#color` may appear on EITHER side of
 * `as alias` -- upstream's "CODE, STEREOTYPE, as, DISPLAY" alternative
 * (getRegexConcat:95-100, the CODE3 branch) places the stereotype BEFORE
 * `as`, while the generic trailing `StereotypePattern.optional("STEREOTYPE")`
 * (:110) accepts one AFTER the alias too. Stripping stereotype/color from
 * the WHOLE `extra` string first (both helpers scan for their pattern
 * wherever it occurs, not just at the start) before matching `as alias`
 * handles both positions uniformly — mirroring parseNameSection's order,
 * which already gets this right for keyword-prefixed declarations. Trying
 * the alias match FIRST (the previous order) required `as` to be the very
 * first token, so a leading `<<stereotype>>` blocked the alias entirely and
 * silently discarded it (zozutu-82-pupa220).
 */
export function parseBracketDeclaration(bracketName: string, rawExtra: string): BracketDeclaration {
  let extra = rawExtra.trim();
  let stereotype: readonly string[] | undefined;
  let color: string | undefined;
  const sr = extractNodeStereotype(extra);
  if (sr !== undefined) { stereotype = sr.stereotypes; extra = sr.remainder.trim(); }
  const cr = extractColor(extra);
  if (cr !== undefined) { color = cr.color; extra = cr.remainder.trim(); }
  let id = bracketName;
  const aliasMatch = RE_BRACKET_ALIAS.exec(extra);
  if (aliasMatch !== null) id = aliasMatch[1]!.trim();
  // G1 I5c: CommandCreateElementFull.executeArg:311/321 runs the
  // quote-strip + `Display.getWithNewlines` unconditionally on `display`
  // regardless of which CODE alternative matched -- `parseNameSection`'s
  // branches all reach this via `finalizeDisplay`, but this bracket-
  // shorthand path never did. `id` stays raw (cleaned only, same as
  // `parseNameSection`'s own "final id... always run through cleanId"
  // discipline) -- upstream's `quark.getName()` never passes through
  // `Display.getWithNewlines` either (see `finalizeDisplay`'s own doc
  // comment).
  return buildBracketDeclaration(cleanId(id), finalizeDisplay(bracketName), stereotype, color);
}

// ---------------------------------------------------------------------------
// Bare id, decorated display: `Admin as :Main Admin:` / `Use as (Use the
// application)` — CommandCreateElementFull's "CODE3 as DISPLAY3" alternative
// (no leading SYMBOL keyword; getRegexConcat:95-100).
// ---------------------------------------------------------------------------

/**
 * Matches the whole line: a genuinely BARE CODE (letters/digits/underscore/
 * dot only — CODE_CORE's bare alternative; NOT `(`/`:`/`[`/quote-decorated,
 * which would instead satisfy upstream's "DISPLAY2 as CODE2" alternative,
 * tried BEFORE this one — see {@link parseBareAsDecorated}), `as`, then a
 * `:...:` or `(...)` DISPLAY (each with the optional business-variant
 * trailing `/`).
 */
export const RE_BARE_AS_DECORATED = /^([\p{L}\p{N}_.]+)\s+as\s+(:[^:]+:\/?|\([^)]+\)\/?)\s*$/iu;

export interface BareAsDecorated {
  id: string;
  display: string;
  symbol: USymbol;
}

/**
 * No leading SYMBOL keyword is present in this form, so the symbol is
 * sniffed from the DISPLAY token's decoration — exactly like
 * {@link classifyEndpointShape} does for a link endpoint (both are
 * `CommandLinkElement.getDummy`'s codeChar sniff / `DescriptionDiagram
 * .cleanId`, the same normalizer upstream applies everywhere).
 *
 * Deliberately NOT extended to the reverse "DISPLAY2 as CODE2" alternative
 * (a decorated LHS, e.g. `(Application) as (App)`) — that shape is
 * ambiguous with a bare/quoted alias and needs its own drill-down; ledgered
 * rather than guessed at (see phase-2-description/ledger.md).
 */
export function parseBareAsDecorated(idToken: string, decoratedToken: string): BareAsDecorated {
  const id = cleanId(idToken.trim());
  const decorated = classifyEndpointShape(decoratedToken.trim());
  return { id, display: decorated.id, symbol: decorated.symbol };
}

// ---------------------------------------------------------------------------
// Bare quoted declaration, no keyword, no alias: CommandCreateElementFull's
// CODE1 branch (CODE_WITH_QUOTE, java:88) with the SYMBOL group entirely
// omitted (java:84, optional) and no "as" clause. executeArg (java:236-268)
// finds no paren/colon/bracket decoration on the quoted CODE, so symbol
// stays null, defaulting to LeafType.DESCRIPTION / actorStyle().toUSymbol()
// (java:273-275) -- the plain STICKMAN actor rendering (renderer-symbol.ts's
// documented ActorStyle default). isForbidden (java:134-138) declines a
// PURE bare token, so only a quoted line qualifies -- a bare unquoted
// identifier alone is never this branch upstream. Trailing TAGS/
// STEREOTYPE/URL/color (java:108-115) are permitted after the close-quote
// and stripped by parseNameSection exactly as elsewhere. Built via
// new RegExp (Lizard-safe: literal angle-bracket/brace chars in a /regex/
// literal desync lizard's brace-depth counting for this file's functions).
// ---------------------------------------------------------------------------

export const RE_BARE_QUOTED_DECL = new RegExp(
  '^"[^"]+"(?:\\s*(?:#[\\w:;.#\\\\/|-]+|<<[^>]+>>|\\$[^\\s{}"\'<>$]+|' +
    '\\[\\[[^\\]]*(?:\\][^\\]]+)*\\]\\]))*\\s*$',
);

// ---------------------------------------------------------------------------
// `remove <id>` / `remove $tag` (CommandRemoveRestore.java `WHAT` group)
// ---------------------------------------------------------------------------

/** Splice a single already-resolved node out of its recorded parent array. */
/** Apply `remove`/`restore` to one node — upstream's lazy marker, NOT a
 *  splice (CucaDiagram.isRemoved is evaluated at print time; the entity
 *  stays in the diagram for magma chaining and the degenerate count). */
function setRemoved(node: DescriptiveNode, removed: boolean): void {
  if (removed) node.removed = true;
  else delete node.removed;
}

/**
 * Simple-identifier, Stereotag (`$tag`), wildcard (`*`), and stereotype
 * (`<<...>>`) `WHAT` forms (HideOrShow.java:53-69's `isApplyable(Entity)`
 * dispatch). `@unlinked` is handled separately by the caller (command-
 * table.ts's rule 3b matches it before ever calling this function; see
 * `ast.ts#DescriptionDiagramAST.removeUnlinked`'s doc). A LAZY marker per
 * node (CucaDiagram.isRemoved is evaluated at print time) — every matching
 * node currently in `nodesById` gets its `removed` flag set/cleared, but no
 * node is spliced out of its parent array; empty-container-as-leaf demotion
 * happens later, at layout time, over the removal-FILTERED view (layout.ts's
 * `isEffectiveCluster`).
 *
 * `HideOrShow#isApplyableTag` matches a `$`-prefixed `what` against every
 * entity carrying that Stereotag — `remove $a` can remove several entities
 * in one line, same as `*` and `<<stereotype>>`.
 *
 * Stereotype form (HideOrShow.java:60-61,88-97 `isApplyableStereotype`):
 * matches if ANY of the node's stereotype labels equals `pattern` (no `*`
 * wildcard inside the pattern — HideOrShow.match:113-119's wildcard branch
 * is unexercised by this port's corpus and stays unported), mirroring
 * `isApplyableStereotype`'s own `for (String label :
 * stereotype.getMultipleLabels())` loop (G1 I5b — `DescriptiveNode
 * .stereotype` widened to `readonly string[]`). See `removeMatchingLinks`
 * below for the sibling mechanism that applies the SAME stereotype pattern
 * to LINKS (Link.isRemoved, independent of this function, single-label
 * only — `DescriptiveLink.stereotype` stays a single string, no corpus
 * fixture exercises a multi-stereotype link).
 */
export function removeMatching(
  what: string,
  nodesById: Map<string, DescriptiveNode>,
  removed = true,
): void {
  if (what === '*') {
    for (const node of nodesById.values()) setRemoved(node, removed);
    return;
  }
  if (what.startsWith('$')) {
    const tag = what.slice(1);
    for (const node of nodesById.values()) {
      if (node.tags?.includes(tag) === true) setRemoved(node, removed);
    }
    return;
  }
  if (what.startsWith('<<') && what.endsWith('>>')) {
    const pattern = what.slice(2, -2).trim();
    for (const node of nodesById.values()) {
      if (node.stereotype?.includes(pattern) === true) setRemoved(node, removed);
    }
    return;
  }
  const node = nodesById.get(what);
  if (node !== undefined) setRemoved(node, removed);
}

/**
 * `Link.isRemoved()` (net/sourceforge/plantuml/abel/Link.java:492-498): a
 * link carrying a `<<stereotype>>` whose pattern is `remove`d is dropped
 * from DOT emission INDEPENDENTLY of its endpoints — `cucaDiagram
 * .isStereotypeRemoved(stereotype)` (CucaDiagram.java:739-745) folds the
 * SAME `removed` HideOrShow list as `removeMatching` above, matched via
 * `HideOrShow.isApplyable(Stereotype)` (HideOrShow.java:71-75), which —
 * unlike `isApplyable(Entity)` — returns `false` for every non-stereotype
 * `what` shape (id / `$tag` / `*` never touch a Link; only the `<<...>>`
 * form does). Exact match only, same scope line as `removeMatching`'s
 * stereotype branch (no `*` wildcard inside the pattern, no composite
 * multi-label match). A lazy per-link marker (`DescriptiveLink.removed`),
 * filtered out only at DOT-edge build time (`layout.ts#buildDotEdges`) — an
 * untagged sibling link between the same two endpoints is unaffected.
 */
export function removeMatchingLinks(
  what: string,
  links: readonly DescriptiveLink[],
  removed = true,
): void {
  if (!(what.startsWith('<<') && what.endsWith('>>'))) return;
  const pattern = what.slice(2, -2).trim();
  for (const link of links) {
    if (link.stereotype === pattern) {
      if (removed) link.removed = true;
      else delete link.removed;
    }
  }
}

/**
 * `CucaDiagram.isRemoved` (net/atmp/CucaDiagram.java:762-775) +
 * `isNoteWithSingleLinkAttachedTo` (:777-797): a NOTE entity with exactly one
 * non-hidden link is *itself* considered removed once the entity at the
 * other end of that link is removed — "remove should remove notes too"
 * (kokebo-27-vafi688's originating forum thread). Evaluated lazily at
 * layout time, mirroring upstream's print-time isRemoved: returns the
 * effective removed-id set (explicit markers + fixed-point note cascade).
 */
/** Entity.isAloneAndUnlinked:457-476 — every link touching the leaf is
 *  invisible (hidden) or its other endpoint is removed; a group qualifies
 *  when all its children do. */
function markUnlinked(
  all: readonly DescriptiveNode[],
  links: readonly DescriptiveLink[],
  removed: Set<string>,
): void {
  const aloneLeaf = (id: string): boolean =>
    links.every(
      (l) =>
        (l.from !== id && l.to !== id) ||
        l.hidden === true ||
        removed.has(l.from === id ? l.to : l.from),
    );
  const alone = (n: DescriptiveNode): boolean =>
    n.children.length > 0 ? n.children.every(alone) : aloneLeaf(n.id);
  for (const n of all) if (alone(n)) removed.add(n.id);
}

export function effectiveRemovedIds(
  nodes: readonly DescriptiveNode[],
  links: readonly DescriptiveLink[],
  removeUnlinked = false,
): Set<string> {
  const all: DescriptiveNode[] = [];
  const removed = new Set<string>();
  // Hierarchical: removing a group removes its whole subtree (upstream
  // isRemoved checks the parent chain — gogosu-37: `remove a` where a is a
  // container also removes a_sub).
  const walk = (list: readonly DescriptiveNode[], ancestorRemoved: boolean): void => {
    for (const n of list) {
      all.push(n);
      const isRemoved = ancestorRemoved || n.removed === true;
      if (isRemoved) removed.add(n.id);
      walk(n.children, isRemoved);
    }
  };
  walk(nodes, false);
  if (removeUnlinked) markUnlinked(all, links, removed);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of all) {
      if (n.symbol !== 'note' || removed.has(n.id)) continue;
      const attached = links.filter(
        (l) => l.hidden !== true && (l.from === n.id || l.to === n.id),
      );
      if (attached.length !== 1) continue;
      const other = attached[0]!.from === n.id ? attached[0]!.to : attached[0]!.from;
      if (removed.has(other)) {
        removed.add(n.id);
        changed = true;
      }
    }
  }
  return removed;
}
// ---------------------------------------------------------------------------
// `hide <id|$tag|*|<<stereotype>>>` / `show ...` -- entity-visibility rules
// (CommandHideShow2.java -- HideOrShow.isApplyable(Entity), java:53-69)
// ---------------------------------------------------------------------------

/**
 * `HideOrShow#isApplyable(Entity)` dispatch (HideOrShow.java:53-69), scoped
 * to the WHAT shapes this port's `hide`/`show` corpus exercises: bare id
 * (fullName match), `$tag` (isApplyableTag), `*` (wildcard match, whole
 * diagram), `<<stereotype>>` (isApplyableStereotype -- matches ANY of the
 * node's OWN multiple labels, same convention as `removeMatching`'s
 * sibling stereotype branch above). `@unlinked` (isAboutUnlinked) is not
 * built for `hide`/`show` -- zero corpus reach, see ledger.md I-hideshow --
 * a `what` of that shape simply matches nothing here (falls to the bare-id
 * branch).
 */
function isApplyableEntity(node: DescriptiveNode, what: string): boolean {
  if (what === '*') return true;
  if (what.startsWith('$')) return node.tags?.includes(what.slice(1)) === true;
  if (what.startsWith('<<') && what.endsWith('>>')) {
    const pattern = what.slice(2, -2).trim();
    return node.stereotype?.includes(pattern) === true;
  }
  return node.id === what;
}

/**
 * `CucaDiagram#isHidden`/`Entity#isHidden` (net/atmp/CucaDiagram.java
 * :747-760, abel/Entity.java:429-441): folds the diagram-wide ORDERED
 * `hideShowRules` list per-entity (last matching rule wins,
 * `HideOrShow#apply`, java:129-134), THEN propagates down the container
 * tree -- `Entity#isHidden`'s own `parentContainer.isHidden()` check
 * short-circuits to `true` for every descendant of a hidden container
 * BEFORE even consulting that descendant's own rules (java:437-438: `if
 * (parentContainer != null && parentContainer.isHidden()) return true;`).
 * Draw-time-only (see `DescriptionDiagramAST.hideShowRules`'s doc comment)
 * -- unlike `effectiveRemovedIds`, this NEVER filters what layout.ts feeds
 * to the DOT graph; it only marks `DescriptionNodeGeo.hidden` for the
 * render pass (layout.ts#buildGeoNode) to suppress drawing.
 *
 * LAZY by construction (contrast `effectiveRemovedIds`, which reads each
 * node's parse-time-incremental `.removed` marker): evaluates every rule
 * against the FINAL node set on every call, so a rule declared before its
 * matching entities exist (mavuxi/ciboso/tusugu/sufedi all declare AFTER,
 * but jar's own `isHidden` is unconditionally lazy regardless) still
 * applies correctly.
 */
export function effectiveHiddenIds(
  nodes: readonly DescriptiveNode[],
  rules: ReadonlyArray<{ what: string; show: boolean }>,
): Set<string> {
  const hidden = new Set<string>();
  const walk = (list: readonly DescriptiveNode[], ancestorHidden: boolean): void => {
    for (const n of list) {
      let own = ancestorHidden;
      if (!ancestorHidden) {
        for (const rule of rules) {
          if (isApplyableEntity(n, rule.what)) own = !rule.show;
        }
      }
      if (own) hidden.add(n.id);
      walk(n.children, own);
    }
  };
  walk(nodes, false);
  return hidden;
}

// ---------------------------------------------------------------------------
// `hide|show [<<label>>] stereotype` -- per-label stereotype visibility
// (CommandHideShowByGender.java, PORTION === STEREOTYPE)
// ---------------------------------------------------------------------------

/**
 * `CucaDiagram#isStereotypeLabelShown`/`#getVisibleStereotypeLabels`
 * (net/atmp/CucaDiagram.java:574-598): filters a node's OWN stereotype
 * labels against the diagram-wide ORDERED `stereotypeVisibilityRules` list,
 * folded PER LABEL (not per entity) -- a rule with `pattern === undefined`
 * matches every label (`EntityGenderUtils.all()`); a defined `pattern`
 * matches only that exact label (`EntityGenderUtils.byStereotype`). Last
 * matching rule wins per label, same "ordered fold" shape as
 * `effectiveHiddenIds` above, and LAZY for the identical reason (see
 * `DescriptionDiagramAST.stereotypeVisibilityRules`'s doc comment).
 *
 * Returns `labels` UNCHANGED (same reference) when there is nothing to
 * filter (`labels` undefined/empty or no rules) -- callers (layout.ts,
 * leaf-sizing.ts via a shallow-cloned node) can use this directly as the
 * SAME array every non-hide fixture already threads through sizing and
 * rendering, with zero extra allocation on the common path.
 */
export function visibleStereotypeLabels(
  labels: readonly string[] | undefined,
  rules: ReadonlyArray<{ pattern?: string; show: boolean }>,
): readonly string[] | undefined {
  if (labels === undefined || labels.length === 0 || rules.length === 0) return labels;
  return labels.filter((label) => {
    let shown = true;
    for (const rule of rules) {
      if (rule.pattern === undefined || rule.pattern === label) shown = rule.show;
    }
    return shown;
  });
}

/**
 * `measureLeafNode`/`degenerateSingleLeaf` (leaf-sizing.ts, layout-helpers
 * .ts) both take a whole `DescriptiveNode`, not a bare stereotype array --
 * this builds the shallow clone `visibleStereotypeLabels`'s filtered result
 * needs to feed sizing consistently with rendering (see layout.ts
 * #buildDotNodes's own doc comment for why sizing must use the SAME
 * filtered list `buildGeoNode` renders). `exactOptionalPropertyTypes`
 * forbids `{ ...node, stereotype: undefined }` (assigning `undefined` to
 * an optional property is a type error under that flag), so an
 * undefined result deletes the key instead of assigning it. Returns the
 * SAME node reference when nothing changes (zero allocation on the
 * common, non-hide-stereotype path).
 */
export function nodeWithVisibleStereotype(
  node: DescriptiveNode,
  rules: ReadonlyArray<{ pattern?: string; show: boolean }>,
): DescriptiveNode {
  const visible = visibleStereotypeLabels(node.stereotype, rules);
  if (visible === node.stereotype) return node;
  const clone: DescriptiveNode = { ...node };
  // Never an empty array (DescriptiveNode.stereotype's own invariant,
  // I5b) -- a rule can filter every label out (G1 I-hideshow), and
  // `visibleStereotypeLabels` itself stays a pure filter (no invariant
  // opinion); normalize to "absent" here, at the one place that produces
  // a DescriptiveNode-shaped value from the filtered result.
  if (visible === undefined || visible.length === 0) delete clone.stereotype;
  else clone.stereotype = visible;
  return clone;
}
