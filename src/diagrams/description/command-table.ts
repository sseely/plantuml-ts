/**
 * Command dispatch table for the descriptive diagram parser (component /
 * use-case / deployment). Split out of parser.ts (mission G0b/T6) purely to
 * keep parser.ts under the project's 500-line file cap — no behavior
 * change; every export here is verbatim code moved from parser.ts.
 *
 * Order matters: patterns are tested top-to-bottom; first match wins. More
 * specific patterns MUST precede more general ones.
 */

import { KEYWORD_TO_SYMBOL } from '../../core/descriptive-keywords.js';
import type { DescriptiveNode } from './ast.js';
import {
  CONTAINER_INLINE_RE,
  CONTAINER_OPEN_RE,
  KEYWORD_RE,
  makeNode,
  parseInlineBody,
  parseNameSection,
} from './parse-helpers.js';
import {
  RE_BARE_AS_DECORATED,
  RE_BARE_QUOTED_DECL,
  parseBareAsDecorated,
  parseBracketDeclaration,
  removeMatching,
  removeMatchingLinks,
} from './element-grammar.js';
import { LINK_LINE_RE, parseLinkLine, type EndpointShape } from './link-grammar.js';
import {
  addLink, emitNode, ensureEndpoint, nextCreationIndex, startNewPage, type ParseState,
} from './parse-state.js';
import { leafDisplayName, resolveQualifiedNode, scopedKey } from './namespace-groups.js';
import { matchScaleCommand } from '../../core/scale-command.js';


// ---------------------------------------------------------------------------
// Module-level regex constants
// Lizard 1.23.0 miscounts brace depth for $ inside /regex/ in function bodies.
// ---------------------------------------------------------------------------

const RE_SKINPARAM_LINETYPE = new RegExp('^skinparam\\s+linetype\\s+(ortho|polyline)\\b', 'i');
/** `left to right direction` — CommandRankDir.java sets skinparam Rankdir=LR. */
const RE_LEFT_TO_RIGHT_DIRECTION = /^left\s+to\s+right\s+direction\b/i;
/** `top to bottom direction` — explicit no-op; TB is already the default. */
const RE_TOP_TO_BOTTOM_DIRECTION = /^top\s+to\s+bottom\s+direction\b/i;
/** `set separator <sep>` / `set namespaceseparator <sep>`
 *  (CommandNamespaceSeparator.java:58-69) — SEPARATOR is `(?:none|null)` or
 *  any non-space run (CommandLinkClass.getSeparator()). */
const RE_SET_SEPARATOR = /^set\s+(?:separator|namespaceseparator)\s+(\S+)\s*$/i;

export interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

// Trailing decorations on shorthand declarations (`(uc) #green $tag`):
// restricted to tag/stereotype/color tokens so link lines never match.
const SHORTHAND_TRAILER =
  '((?:\\s*(?:\\$[\\w]+|<<[^>]+>>|#[\\w:;.#\\\\/|-]+|\\[\\[[^\\]]*\\]\\]))*)\\s*';

function shorthandNode(
  state: ParseState,
  name: string,
  symbol: DescriptiveNode['symbol'],
  trailer: string | undefined,
): void {
  const { id, display, stereotype, color, tags } = parseNameSection(
    name + ' ' + (trailer ?? '').trim(),
  );
  emitNode(state, makeNode(id, display, symbol, stereotype, color, tags));
}

/**
 * `quarkInContextSafe`'s `reuseExistingChild=true` path (CucaDiagram.java
 * :264-271), restricted to an id whose first segment names an EXISTING
 * top-level container walked down through already-declared children
 * (`resolveQualifiedNode`) — the shape both `bujige-52-gase998`-family
 * fixtures need (`srv1.br0` resolving into `node srv1 { portin br0 }`).
 * Falls through to the endpoint unchanged (ordinary flat-id auto-create via
 * `ensureEndpoint`) when no such chain exists yet, mirroring upstream's own
 * fallback to `currentQuark.child(full)`.
 *
 * Mission I1b (container-scoped entity identity): the returned `id` is the
 * FULL ancestor-chain-qualified path (`scopedKey`), never the resolved
 * node's bare `.id` alone — a bare id cannot distinguish `srv1.br0` from
 * `srv2.br0` once both resolve to a leaf literally named `br0` (two
 * DIFFERENT real containers' same-named children are structurally distinct
 * Quark objects upstream, plasma/Quark.java:54's per-parent `children`
 * map). `parse-state.ts#ensureEndpoint` and `layout.ts#classifyAst` both
 * recognize this qualified form: the former via `state.qualifiedNodesById`
 * (populated unconditionally by `emitNode`), the latter via
 * `ClassifyCtx.qualifiedPathToDotKey` (populated unconditionally by
 * `classifyAst`, regardless of whether the target actually needed
 * disambiguation) — see the description-dot-100 decision journal (I1b).
 */
function resolveEndpointNamespace(state: ParseState, ep: EndpointShape): EndpointShape {
  const resolved = resolveQualifiedNode(state.ast.nodes, ep.id, state.namespaceSeparator);
  return resolved === undefined
    ? ep
    : { id: scopedKey(resolved.segments), symbol: resolved.node.symbol };
}

export const COMMANDS: readonly Command[] = [
  // 1. Comment lines
  {
    pattern: /^'/,
    execute() { /* ignore */ },
  },

  // 1b. `newpage` (CommandNewpage) — finalize the current page, start a
  //     fresh one. See startNewPage's doc comment.
  {
    pattern: /^newpage\s*$/i,
    execute(state) { startNewPage(state); },
  },

  // 2. Direction directives — must precede the general ignore rule (3) since
  //    both patterns would otherwise match. left-to-right sets skinparam
  //    Rankdir=LR (CommandRankDir.java); top-to-bottom is an explicit no-op
  //    because top-to-bottom is already our unset default.
  {
    pattern: RE_LEFT_TO_RIGHT_DIRECTION,
    execute(state) { state.ast.rankdir = 'LR'; },
  },
  {
    pattern: RE_TOP_TO_BOTTOM_DIRECTION,
    execute() { /* explicit TB is the default; no-op */ },
  },

  // 2b. skinparam linetype ortho|polyline — svek routes edge labels through
  //     xlabel under ortho (SvekEdge.java:434-441). Must precede rule 3.
  {
    pattern: RE_SKINPARAM_LINETYPE,
    execute(state, match) {
      state.ast.linetype = match[1]!.toLowerCase() as 'ortho' | 'polyline';
    },
  },

  // 2c. `set separator <sep>` / `set namespaceseparator <sep>`
  //     (CommandNamespaceSeparator.java) — mirrored onto `state.ast` (not
  //     just `state`) so `layoutDescription` can read it; see
  //     `ast.ts#DescriptionDiagramAST.namespaceSeparator`'s doc for why the
  //     default is `null`, not ".". Must precede rule 3 (the general
  //     `skinparam|hide|show` ignore) — the `set` verb overlaps no other
  //     rule, but is placed with its sibling directives for readability.
  {
    pattern: RE_SET_SEPARATOR,
    execute(state, match) {
      const value = match[1]!;
      const sep = /^(?:none|null)$/i.test(value) ? null : value;
      state.namespaceSeparator = sep;
      state.ast.namespaceSeparator = sep;
    },
  },

  // 2e. `!pragma kermor on` (skin/PragmaKey.java:55) -- svek's alternate
  //     cluster/note DOT-emission path (ClusterDotStringKermor.java,
  //     Cluster.java:595-609). See ast.ts's `kermor` field doc + the
  //     description-dot-100 decision journal (I2) for the full mechanism.
  //     Must precede rule 3 (the general skinparam|hide|show ignore) -- the
  //     `!pragma` verb overlaps no other rule, but is placed with its
  //     sibling directives for readability.
  {
    pattern: /^!pragma\s+kermor\s+on\s*$/i,
    execute(state) {
      state.ast.kermor = true;
    },
  },

  // 2f. `scale ...` directive (net/sourceforge/plantuml/command/
  //     CommandScale*.java, 6 forms -- see scale-command.ts's module doc
  //     for the full mechanism and jar Java citations). A loose trigger
  //     regex gates entry into this slot; the real 6-way grammar lives in
  //     the shared `matchScaleCommand` (`match.input` is always the exact
  //     `line` this table was dispatched against -- RegExpExecArray's own
  //     `.input` field, never re-derived). An unrecognized/rejected scale
  //     line (e.g. `scale 0`) leaves `state.ast.scale` unset, the same
  //     no-op disposition rule 3b's `remove`/`restore` already established
  //     for an input its own upstream command would itself reject.
  {
    pattern: /^scale\s/i,
    execute(state, match) {
      const spec = matchScaleCommand(match.input);
      if (spec !== undefined) state.ast.scale = spec;
    },
  },

  // 3. Ignored directives: skinparam, hide, show. `title` used to be ignored
  //    here too; it is now consumed by the shared annotation matcher at the
  //    top-level dispatch point in parser.ts#processLine, BEFORE this table
  //    is ever tried (mission G0b/T6, decisions.md D3).
  {
    pattern: /^(?:skinparam|hide|show)\b/i,
    execute() { /* ignore */ },
  },

  // 3b. `remove|restore <id|$tag|*>` — CommandRemoveRestore.java. A LAZY
  //     marker (upstream isRemoved evaluates at print time): the note
  //     cascade + filtering happen in layout via effectiveRemovedIds.
  {
    pattern: /^(remove|restore)\s+(\S+)\s*$/i,
    execute(state, match) {
      const isRemove = match[1]!.toLowerCase() === 'remove';
      if (match[2]!.toLowerCase() === '@unlinked') {
        if (isRemove) state.ast.removeUnlinked = true;
        else delete state.ast.removeUnlinked;
        return;
      }
      removeMatching(match[2]!, state.nodesById, isRemove);
      // Link.isRemoved (net/sourceforge/plantuml/abel/Link.java:492-498):
      // the SAME <<stereotype>> pattern independently removes LINKS
      // carrying that stereotype, regardless of node.removed above -- a
      // no-op for id/$tag/* forms (removeMatchingLinks only matches
      // `<<...>>`-shaped `what`, mirroring HideOrShow.isApplyable
      // (Stereotype) never matching a non-stereotype `what`).
      removeMatchingLinks(match[2]!, state.ast.links, isRemove);
    },
  },

  // 3c. `together {` — groups elements for layout proximity WITHOUT a
  //     visible container (CommandTogether.java; svek emits a clusterNtK
  //     wrapper whose members belong to the enclosing cluster). Transparent
  //     frame: children fall through to the enclosing container's array and
  //     the closing `}` pops it like any block (previously the stray `}`
  //     popped a REAL container, orphaning later siblings).
  {
    pattern: /^together\s*\{\s*$/i,
    execute(state) {
      const top = state.containerStack[state.containerStack.length - 1];
      const passthrough: DescriptiveNode = {
        id: `__together_${state.containerStack.length}_${state.ast.nodes.length}`,
        display: '',
        symbol: 'rectangle',
        children: top !== undefined ? top.children : state.ast.nodes,
      };
      state.containerStack.push(passthrough);
    },
  },

  // 4. Closing brace — pops the current container
  {
    pattern: /^\}\s*$/,
    execute(state) { state.containerStack.pop(); },
  },

  // 5. Business-actor shorthand: :Name:/ [decorations]
  //    More specific than plain :Name:, so must come first.
  {
    pattern: new RegExp('^:([^:]+):\\s*\\/' + SHORTHAND_TRAILER + '$'),
    execute(state, match) {
      shorthandNode(state, match[1]!.trim(), 'actor-business', match[2]);
    },
  },

  // 6. Actor shorthand: :Name: [decorations]
  {
    pattern: new RegExp('^:([^:]+):' + SHORTHAND_TRAILER + '$'),
    execute(state, match) {
      shorthandNode(state, match[1]!.trim(), 'actor', match[2]);
    },
  },

  // 7. Business-usecase shorthand: (Name)/ [decorations]
  {
    pattern: new RegExp('^\\(([^)]+)\\)\\s*\\/' + SHORTHAND_TRAILER + '$'),
    execute(state, match) {
      shorthandNode(state, match[1]!.trim(), 'usecase-business', match[2]);
    },
  },

  // 8. Interface shorthand: ()InterfaceName / () InterfaceName (standalone,
  //    no arrow). Upstream's CODE_CORE allows zero-or-more whitespace after
  //    the "()" prefix (`\(\)[%s]*[%pLN_.]+`), not one-or-more.
  //    CommandCreateElementFull.java's leading SYMBOL group
  //    (getRegexConcat:84, `(?:(ALL_TYPES|\(\))[%s]+)?`) matches a literal
  //    `()` in the SAME slot as the `interface`/`component`/… keywords --
  //    `() "text" as alias` reduces to the ordinary "DISPLAY as CODE" alias
  //    form once `()` is stripped (DISPLAY2=`"text"`, CODE2=`alias`),
  //    identical to `interface "text" as alias`. The name/alias unit is
  //    captured as ONE group so parseNameSection's own alias-form matching
  //    (RE_DQ_AS_ALIAS / RE_PLAIN_ALIAS) resolves it — SHORTHAND_TRAILER
  //    (tag/stereotype/color/url only) still gates what may follow.
  {
    pattern: new RegExp(
      '^\\(\\)\\s*("[^"]+"(?:\\s+as\\s+\\S+)?|\\S+(?:\\s+as\\s+\\S+)?)' +
        SHORTHAND_TRAILER + '$',
    ),
    execute(state, match) {
      shorthandNode(state, match[1]!.trim(), 'interface', match[2]);
    },
  },

  // 8b. Bare id, decorated display: `Admin as :Main Admin:` / `Use as (Use
  //     the application)` — CommandCreateElementFull's "CODE3 as DISPLAY3"
  //     alternative (no leading SYMBOL keyword).
  {
    pattern: RE_BARE_AS_DECORATED,
    execute(state, match) {
      const decl = parseBareAsDecorated(match[1]!, match[2]!);
      emitNode(state, makeNode(decl.id, decl.display, decl.symbol));
    },
  },

  // 9. Links — MUST come before bracket (10) and paren (11) shorthands.
  //    Full CommandLinkElement.java grammar (see link-grammar.ts): endpoint
  //    shapes ([Comp], () IFace, (UseCase), :Actor:, bare/quoted identifier),
  //    LinkDecor head tokens, direction hints (-r->, -left->), inline
  //    [#color,style] brackets, and qualifier labels ("1" --> "0..*").
  {
    pattern: LINK_LINE_RE,
    execute(state, match) {
      // LINK_LINE_RE always carries named capture groups, so `.groups` is
      // never undefined when the pattern matches (see parseLinkLine).
      const parsed = parseLinkLine(match.groups!);
      const from = resolveEndpointNamespace(state, parsed.from);
      const to = resolveEndpointNamespace(state, parsed.to);
      // CommandLinkElement.executeArg:317-318: `cl1 = getDummy(ent1); cl2 =
      // getDummy(ent2);` -- both endpoints auto-create in RAW ENT1-then-ENT2
      // order, BEFORE the `dir == LEFT || dir == UP` inversion swap (:325-326)
      // ever runs. `parsed.from`/`.to` are ALREADY post-inversion (see
      // ParsedLink.inverted's doc comment), so when inverted, `to` is the
      // raw-first (ENT1) endpoint and `from` is raw-second (ENT2) --
      // ensureEndpoint must run in that raw order, not `from`-then-`to`.
      if (parsed.inverted) {
        ensureEndpoint(state, to);
        ensureEndpoint(state, from);
      } else {
        ensureEndpoint(state, from);
        ensureEndpoint(state, to);
      }
      parsed.link.from = from.id;
      parsed.link.to = to.id;
      // Link#getInv() (abel/Link.java:145-147) constructs a WHOLE NEW Link
      // on inversion, burning a SECOND shared-counter value beyond the
      // discarded pre-inversion Link's own -- see DescriptiveLink
      // .creationIndex's doc comment.
      if (parsed.inverted) nextCreationIndex(state);
      parsed.link.creationIndex = nextCreationIndex(state);
      addLink(state, parsed.link);
    },
  },

  // 10. Bracket shorthand: [Name] [as Alias] [<<stereotype>>] [#color]
  {
    pattern: /^\[([^\]]+)\](.*)?$/,
    execute(state, match) {
      const decl = parseBracketDeclaration(match[1]!.trim(), match[2] ?? '');
      emitNode(state, makeNode(decl.id, decl.display, 'component', decl.stereotype, decl.color));
    },
  },

  // 11. Use-case shorthand: (Name) [as Alias] [decorations] — the alias may
  //     itself be wrapped ((uc1), :a:, [c]); parseNameSection + cleanId
  //     normalize it (cimare-47: `(another use case) as (uc1)`).
  {
    pattern: new RegExp(
      '^(\\([^)]+\\)(?:\\s+as\\s+(?:\\([^)]+\\)|:[^:]+:|\\S+))?)' +
        SHORTHAND_TRAILER + '$',
    ),
    execute(state, match) {
      shorthandNode(state, match[1]!.trim(), 'usecase', match[2]);
    },
  },

  // 11b. Quoted display with wrapped alias: `"another use case" as (uc4)` —
  //      the alias notation picks the symbol (paren→usecase, colon→actor,
  //      bracket→component), mirroring getDummy's codeChar dispatch.
  {
    pattern: new RegExp(
      '^("[^"]+"\\s+as\\s+(\\([^)]+\\)|:[^:]+:|\\[[^\\]]+\\]))' +
        SHORTHAND_TRAILER + '$',
    ),
    execute(state, match) {
      const alias = match[2]!;
      const symbol =
        alias.startsWith('(') ? 'usecase' : alias.startsWith(':') ? 'actor' : 'component';
      shorthandNode(state, match[1]!.trim(), symbol, match[3]);
    },
  },

  // 12. Container inline block: CONTAINER header { body }
  {
    pattern: CONTAINER_INLINE_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw) ?? 'node';
      const { id, display, stereotype, color, tags } = parseNameSection(match[2]!.trim());
      const container = makeNode(id, display, symbol, stereotype, color, tags);
      container.declaredAsGroup = true;
      for (const child of parseInlineBody(match[3]!)) {
        container.children.push(child);
      }
      // CommandPackageWithUSymbol.java:178-180: an anonymous container (no
      // CODE) burns ONE extra shared-counter value generating its internal
      // quark name (`getUniqueSequence("##")`) BEFORE the group Entity's own
      // uid is assigned -- see DescriptiveNode.creationIndex's doc comment.
      if (id.length === 0) nextCreationIndex(state);
      emitNode(state, container);
    },
  },

  // 13. Container open block: CONTAINER header {
  //     CucaDiagram.quarkInContext: a container id is a GLOBAL quark
  //     identity -- reopening the SAME id later in the source (the same
  //     `KEYWORD "..." as SameId {` appearing twice) reuses the SAME group
  //     entity rather than creating a duplicate sibling cluster; new body
  //     lines become additional children of that one group
  //     (tajuki-26-bime046: clusterOk).
  {
    pattern: CONTAINER_OPEN_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw) ?? 'node';
      const { id, display, stereotype, color, tags } = parseNameSection(match[2]!.trim());
      const existing = state.nodesById.get(id);
      if (existing !== undefined && existing.declaredAsGroup === true) {
        state.containerStack.push(existing);
        return;
      }
      const container = makeNode(id, display, symbol, stereotype, color, tags);
      container.declaredAsGroup = true;
      // CommandPackageWithUSymbol.java:178-180: an anonymous container (no
      // CODE) burns ONE extra shared-counter value generating its internal
      // quark name (`getUniqueSequence("##")`) BEFORE the group Entity's own
      // uid is assigned -- see DescriptiveNode.creationIndex's doc comment.
      if (id.length === 0) nextCreationIndex(state);
      emitNode(state, container);
      state.containerStack.push(container);
    },
  },

  // 14. Generic keyword dispatch: any KEYWORD_TO_SYMBOL key followed by a name.
  //     Handles non-container keywords (artifact, person, boundary, …) and
  //     container keywords used standalone without braces (node Foo).
  //     Business-variant keywords: actor/ Name, usecase/ Name.
  //     `port`/`portin`/`portout` (CommandCreateElementFull.java:276-284,
  //     :316-317): only valid inside an open container — at root level the
  //     command errors and creates nothing; else the raw keyword (not the
  //     unified `port` USymbol) decides the EntityPosition direction.
  {
    pattern: KEYWORD_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw);
      if (symbol === undefined) return;
      if (symbol === 'port' && state.containerStack.length === 0) return;
      const { id, display, stereotype, color, tags } = parseNameSection(match[2]!);
      // CommandCreateElementFull.java:317-318: `display = quark.getName()`
      // when no explicit alias/display was given — the LEAF segment only,
      // not the full dotted path, once `set separator` is active.
      const finalDisplay =
        display === id ? leafDisplayName(id, state.namespaceSeparator) : display;
      const decl = makeNode(id, finalDisplay, symbol, stereotype, color, tags);
      if (symbol === 'port') decl.position = kw === 'portout' ? 'portout' : 'portin';
      emitNode(state, decl);
    },
  },

  // 15. Bare quoted declaration, no keyword, no alias
  //     (CommandCreateElementFull.java:84,88,236-268,273-275): SYMBOL is
  //     optional and CODE1 (CODE_WITH_QUOTE) allows a standalone quoted
  //     string with no "as" clause -- symbol stays null, defaulting to
  //     LeafType.DESCRIPTION / actorStyle().toUSymbol() (plain actor).
  //     MUST be last: every other declaration/link/shorthand rule takes a
  //     leading keyword, bracket, paren, or colon that a quote can't supply.
  {
    pattern: RE_BARE_QUOTED_DECL,
    execute(state, match) {
      const { id, display, stereotype, color, tags } = parseNameSection(match[0]);
      emitNode(state, makeNode(id, display, 'actor', stereotype, color, tags));
    },
  },
];
