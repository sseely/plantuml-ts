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
import { cleanId, extractColor, extractNodeStereotype } from './parse-helpers.js';
import { classifyEndpointShape } from './link-grammar.js';

// ---------------------------------------------------------------------------
// Bracket shorthand: [Name] [as Alias] [<<stereotype>>] [#color]
// ---------------------------------------------------------------------------

/** Alias suffix in bracket shorthand: `as Alias [rest]` */
const RE_BRACKET_ALIAS = /^as\s+(\S+)(.*)?$/i;

export interface BracketDeclaration {
  id: string;
  display: string;
  stereotype?: string;
  color?: string;
}

/** Imperative assignment satisfies exactOptionalPropertyTypes (spreading
 *  `{ stereotype: undefined }` is not allowed for `stereotype?: string`). */
function buildBracketDeclaration(
  id: string,
  display: string,
  stereotype: string | undefined,
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
 * overrides the id, and `<<stereotype>>`/`#color` may follow either form.
 */
export function parseBracketDeclaration(bracketName: string, rawExtra: string): BracketDeclaration {
  let extra = rawExtra.trim();
  let id = bracketName;
  const aliasMatch = RE_BRACKET_ALIAS.exec(extra);
  if (aliasMatch !== null) {
    id = aliasMatch[1]!.trim();
    extra = (aliasMatch[2] ?? '').trim();
  }
  let stereotype: string | undefined;
  let color: string | undefined;
  const sr = extractNodeStereotype(extra);
  if (sr !== undefined) {
    stereotype = sr.stereotype;
    const cr = extractColor(sr.remainder.trim());
    if (cr !== undefined) color = cr.color;
  } else {
    const cr = extractColor(extra);
    if (cr !== undefined) color = cr.color;
  }
  return buildBracketDeclaration(id, bracketName, stereotype, color);
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
 * Simple-identifier and Stereotag forms only — `<<stereotype>>`/`@unlinked`
 * HideOrShow pattern matching, and wildcard `*` matching, stay out of scope
 * (see plans/dot-oracle-sync/phase-2-description/cluster-mechanism.md).
 * `HideOrShow#isApplyableTag` matches a `$`-prefixed `what` against every
 * entity carrying that Stereotag, not a single id — `remove $a` can remove
 * several entities in one line. Splices the node(s) out of whichever array
 * (container children, or top-level AST nodes) they currently live in — this
 * is what lets an enclosing container become empty (isEmpty()) and fall
 * through the existing empty-container-as-leaf demotion in the layout
 * engine, exactly like upstream's `Entity.isEmpty()` after a child's removal.
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
  const node = nodesById.get(what);
  if (node !== undefined) setRemoved(node, removed);
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
