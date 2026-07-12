/**
 * Parser for PlantUML descriptive diagrams (component / use-case / deployment).
 *
 * Merges the component and use-case parsers into one upstream-faithful engine
 * keyed by KEYWORD_TO_SYMBOL (mirrors CommandCreateElementFull.ALL_TYPES in
 * net.sourceforge.plantuml.descdiagram.command). Uses a command-dispatch table
 * tested against each trimmed line in priority order — first match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import { KEYWORD_TO_SYMBOL } from '../../core/descriptive-keywords.js';
import type { DescriptionDiagramAST, DescriptiveNode } from './ast.js';
import {
  CONTAINER_INLINE_RE,
  ELEMENT_MULTILINE_OPEN_RE,
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
} from './element-grammar.js';
import { LINK_LINE_RE, parseLinkLine, type EndpointShape } from './link-grammar.js';
import {
  classifyNoteOpen,
  isNoteTerminator,
  noteAttachment,
  resolvePosition,
  type NoteOpenMatch,
  type NotePosition,
  type NoteTerminator,
} from './note-grammar.js';

export { CONTAINER_SYMBOLS } from './parse-helpers.js';

// ---------------------------------------------------------------------------
// Module-level regex constants
// Lizard 1.23.0 miscounts brace depth for $ inside /regex/ in function bodies.
// ---------------------------------------------------------------------------

const RE_SKINPARAM_LINETYPE = new RegExp('^skinparam\\s+linetype\\s+(ortho|polyline)\\b', 'i');
/** `left to right direction` — CommandRankDir.java sets skinparam Rankdir=LR. */
const RE_LEFT_TO_RIGHT_DIRECTION = /^left\s+to\s+right\s+direction\b/i;
/** `top to bottom direction` — explicit no-op; TB is already the default. */
const RE_TOP_TO_BOTTOM_DIRECTION = /^top\s+to\s+bottom\s+direction\b/i;

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseDescription call)
// ---------------------------------------------------------------------------

interface ParseState {
  ast: DescriptionDiagramAST;
  /** Inside a `sprite $name [WxH/16z] { ... }` block — every body line is
   *  consumed verbatim (base64 pixel data would otherwise misparse as link
   *  lines: bivira-53's `...b1t-R3xpD...` matched the arrow grammar). */
  inSpriteBlock: boolean;
  /** Inside a `<keyword> <code> [ … ]` multi-line description block
   *  (CommandCreateElementMultilines TYPE1) — body lines are consumed until
   *  one ends with `]`. */
  inElementBlock: boolean;
  /** Stack of open container nodes (package, node, folder, etc.). */
  containerStack: DescriptiveNode[];
  /** Every node created so far, by id — lets the link grammar auto-create
   *  (CommandLinkElement.getDummy) skip endpoints that already exist. */
  nodesById: Map<string, DescriptiveNode>;
  /** The array (a container's `children`, or the AST's top-level `nodes`)
   *  each node currently lives in — lets `remove <id>`/`remove $tag`
   *  (CommandRemoveRestore, simple-identifier and Stereotag forms) splice it
   *  back out regardless of whether its enclosing `{ }` block has already
   *  been closed. */
  parentArrayById: Map<string, DescriptiveNode[]>;
  /** `CucaDiagram.lastEntity` — the most recently created LEAF entity (any
   *  symbol, notes included; `reallyCreateLeaf` sets it unconditionally).
   *  Group/container creation (`createGroup`) never touches it. Resolves
   *  `note <pos> : text` / `note <pos>` (CODE omitted) attachment targets. */
  lastEntityId: string | undefined;
  /** Sequence for auto-generated note-on-entity ids (`CucaDiagram
   *  .getUniqueSequence("GMN")`) — floating notes always carry an explicit
   *  `as N` id and never consume this counter. */
  noteCounter: number;
  /** In-progress `CommandMultilines2` note block (floating, on-entity, or a
   *  dropped note-on-link). Every subsequent raw line is consumed as note
   *  body text until its terminator — never re-dispatched through COMMANDS,
   *  mirroring upstream (CommandMultilines2 owns the lines outright). */
  pendingNote: PendingNoteState | undefined;
  /** Completed pages, in source order, accumulated by `newpage`
   *  (upstream `NewpagedDiagram`). Does NOT include the in-progress
   *  `state.ast` — that is appended once parsing finishes.
   *  @see class/parser.ts's `ParseState.pages` (identical mechanism, T7). */
  pages: DescriptionDiagramAST[];
}

/** Discriminated multi-line note block in progress; see `ParseState.pendingNote`. */
type PendingNoteState =
  | { kind: 'on-link'; terminator: NoteTerminator; lines: string[] }
  | { kind: 'floating'; terminator: NoteTerminator; lines: string[]; id: string }
  | {
      kind: 'on-entity';
      terminator: NoteTerminator;
      lines: string[];
      position: NotePosition;
      targetId: string | undefined;
    };

function makeDefaultAST(): DescriptionDiagramAST {
  return { nodes: [], links: [] };
}

function emitNode(state: ParseState, node: DescriptiveNode): void {
  const parent = state.containerStack[state.containerStack.length - 1];
  const arr = parent !== undefined ? parent.children : state.ast.nodes;
  arr.push(node);
  state.nodesById.set(node.id, node);
  state.parentArrayById.set(node.id, arr);
  // CucaDiagram.reallyCreateLeaf unconditionally sets `lastEntity` for every
  // leaf (LeafType.NOTE included); createGroup (containers) never does.
  if (node.declaredAsGroup !== true) state.lastEntityId = node.id;
}

/**
 * CommandLinkElement.getDummy(): create a leaf for a link endpoint that has
 * no prior declaration. `emitNode` already places it in the innermost open
 * container (upstream `quarkInContext`), since `containerStack` reflects
 * whatever `{`-block is open at the point the link line is processed.
 */
function ensureEndpoint(state: ParseState, ep: EndpointShape): void {
  if (state.nodesById.has(ep.id)) return;
  const node = makeNode(ep.id, ep.id, ep.symbol);
  if (ep.stillUnknown === true) node.stillUnknown = true;
  emitNode(state, node);
}

/**
 * DescriptionDiagram.makeDiagramReady (:81-88): STILL_UNKNOWN leaves mute to
 * the actor symbol when the diagram contains any usecase leaf or a plain
 * actor leaf (isUsecase(), :69-78), else to USymbols.INTERFACE — which then
 * gets svek's shielded plaintext shape.
 */
function resolveStillUnknown(nodes: DescriptiveNode[]): void {
  let usecaseish = false;
  const scan = (list: DescriptiveNode[]): void => {
    for (const n of list) {
      if (n.stillUnknown !== true && (n.symbol === 'usecase' || n.symbol === 'actor')) {
        usecaseish = true;
      }
      scan(n.children);
    }
  };
  scan(nodes);
  const target = usecaseish ? 'actor' : 'interface';
  const mute = (list: DescriptiveNode[]): void => {
    for (const n of list) {
      if (n.stillUnknown === true) {
        n.symbol = target;
        delete n.stillUnknown;
      }
      mute(n.children);
    }
  };
  mute(nodes);
}

/**
 * `newpage` (CommandNewpage): finalize the current page and start an
 * entirely fresh one. Upstream creates a brand-new empty diagram and wraps
 * the pair in `NewpagedDiagram`, which routes every subsequent command to
 * `getLastDiagram()` — only `dpi` carries over, which this parser does not
 * model, so a page reset here means every mutable field returns to its
 * `makeInitialState` initial value. `resolveStillUnknown` must run on the
 * completing page HERE (not just once at the very end) — each page is an
 * independent diagram upstream, so a page's own leaf-symbol mix (any
 * usecase/actor leaf vs none) decides ITS still-unknown resolution, not the
 * source's overall mix.
 * @see ~/git/plantuml/.../descdiagram/command/CommandNewpage.java:76-88
 * @see ~/git/plantuml/.../NewpagedDiagram.java:61-162
 * @see class/parser.ts#startNewPage (identical mechanism, T7)
 */
function startNewPage(state: ParseState): void {
  resolveStillUnknown(state.ast.nodes);
  state.pages.push(state.ast);
  state.ast = makeDefaultAST();
  state.inSpriteBlock = false;
  state.inElementBlock = false;
  state.containerStack = [];
  state.nodesById = new Map();
  state.parentArrayById = new Map();
  state.lastEntityId = undefined;
  state.noteCounter = 0;
  state.pendingNote = undefined;
}

// ---------------------------------------------------------------------------
// Note commands (CommandFactoryNote / CommandFactoryNoteOnEntity /
// CommandFactoryNoteOnLink) — regex classification lives in note-grammar.ts;
// state mutation (node/link creation, lastEntityId) stays here.
// ---------------------------------------------------------------------------

/** Notes are ordinary leaves upstream (EntityImageNote/svek) — `emitNode`
 *  already updates `lastEntityId` since a note node never sets
 *  `declaredAsGroup`. */
function emitNoteLeaf(state: ParseState, id: string, text: string): void {
  emitNode(state, makeNode(id, text, 'note'));
}

/**
 * CommandFactoryNoteOnEntity.executeInternal (:295-323): resolves cl1 (the
 * `of X` target, or `getLastEntity()` when CODE is omitted) BEFORE creating
 * the note leaf — "Nothing to note to" / "Not known: X" abort the whole
 * command. No AST error channel exists here, so an unresolved target is
 * simply skipped: nothing is created, matching upstream's net effect.
 */
function attachNoteToEntity(
  state: ParseState,
  position: NotePosition,
  targetId: string | undefined,
  text: string,
): void {
  const resolvedTarget = targetId ?? state.lastEntityId;
  if (resolvedTarget === undefined || !state.nodesById.has(resolvedTarget)) return;
  const pos = resolvePosition(position, state.ast.rankdir);
  const noteId = `__note_${state.noteCounter++}`;
  emitNoteLeaf(state, noteId, text);
  const link = noteAttachment(pos, resolvedTarget, noteId);
  state.ast.links.push({ ...link, style: 'dashed', arrowHead: 'none' });
}

/** Runs a fully-resolved single-line note command, or opens a pending
 *  multi-line block for the parser loop to accumulate lines into. */
/** CommandFactoryNoteOnLink: in svek DOT the note text becomes the LAST
 *  link's label table (SvekEdge.hasNoteLabelText — fogiku-22 oracle). */
function attachNoteToLastLink(state: ParseState, text: string): void {
  const link = state.ast.links[state.ast.links.length - 1];
  if (link === undefined) return;
  link.label = link.label === undefined ? text : link.label + '\n' + text;
}

function executeNoteOpen(state: ParseState, m: NoteOpenMatch): void {
  if (m.kind === 'on-link-single') {
    attachNoteToLastLink(state, m.text);
    return;
  }
  if (m.kind === 'on-link-open') {
    state.pendingNote = { kind: 'on-link', terminator: 'endnote', lines: [] };
    return;
  }
  if (m.kind === 'floating-single') {
    emitNoteLeaf(state, m.id, m.text);
    return;
  }
  if (m.kind === 'floating-open') {
    state.pendingNote = { kind: 'floating', terminator: 'endnote', lines: [], id: m.id };
    return;
  }
  if (m.kind === 'on-entity-single') {
    attachNoteToEntity(state, m.position, m.targetId, m.text);
    return;
  }
  state.pendingNote = {
    kind: 'on-entity',
    terminator: m.terminator,
    lines: [],
    position: m.position,
    targetId: m.targetId,
  };
}

/** CommandMultilines2.executeNow: fires once the terminator line is seen,
 *  joining the accumulated body lines into the note's Display text. */
function closePendingNote(state: ParseState): void {
  const pending = state.pendingNote;
  if (pending === undefined) return;
  state.pendingNote = undefined;
  if (pending.kind === 'on-link') {
    attachNoteToLastLink(state, pending.lines.join('\n'));
    return;
  }
  const text = pending.lines.join('\n');
  if (pending.kind === 'floating') {
    emitNoteLeaf(state, pending.id, text);
    return;
  }
  attachNoteToEntity(state, pending.position, pending.targetId, text);
}

// ---------------------------------------------------------------------------
// Command dispatch table
// Order matters: patterns are tested top-to-bottom; first match wins.
// More specific patterns MUST precede more general ones.
// ---------------------------------------------------------------------------

interface Command {
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

const COMMANDS: readonly Command[] = [
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

  // 3. Ignored directives: skinparam, title, hide, show
  {
    pattern: /^(?:skinparam|title|hide|show)\b/i,
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
      ensureEndpoint(state, parsed.from);
      ensureEndpoint(state, parsed.to);
      state.ast.links.push(parsed.link);
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
      const decl = makeNode(id, display, symbol, stereotype, color, tags);
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

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function makeInitialState(): ParseState {
  return {
    inSpriteBlock: false,
    inElementBlock: false,
    ast: makeDefaultAST(),
    containerStack: [],
    nodesById: new Map(),
    parentArrayById: new Map(),
    lastEntityId: undefined,
    noteCounter: 0,
    pendingNote: undefined,
    pages: [],
  };
}

/**
 * Dispatch one trimmed, non-blank line. Returns `false` when the line was
 * `!exit` (net.sourceforge.plantuml.preproc) — the preprocessor directive
 * that halts all further line processing (confirmed against the pinned
 * oracle golden for jesibe-85-sozu187: a link past `!exit` referring to an
 * undeclared endpoint must NOT spuriously auto-create that endpoint).
 */
const RE_SPRITE_BLOCK_OPEN = new RegExp('^sprite\\s+\\$?[\\w]+.*\\{\\s*$', 'i');
const RE_SPRITE_SINGLE = new RegExp('^sprite\\s+\\$?[\\w]+\\b(?!.*\\{)', 'i');

function processLine(state: ParseState, line: string): boolean {
  if (/^!exit\b/i.test(line)) return false;

  // `sprite $name [dims] { base64… }` blocks (LanguageDescriptor sprite
  // commands) are pixel data, not diagram content — consume them whole.
  if (state.inSpriteBlock) {
    if (/^\}\s*$/.test(line)) state.inSpriteBlock = false;
    return true;
  }
  if (RE_SPRITE_BLOCK_OPEN.test(line)) {
    state.inSpriteBlock = true;
    return true;
  }
  if (RE_SPRITE_SINGLE.test(line)) return true;

  // `<keyword> <code> [ … ]` multi-line element description
  // (CommandCreateElementMultilines TYPE1) — body lines are label content;
  // consume until a line ends with `]`.
  if (state.inElementBlock) {
    if (/\]\s*$/.test(line)) state.inElementBlock = false;
    return true;
  }
  const elemOpen = ELEMENT_MULTILINE_OPEN_RE.exec(line);
  if (elemOpen !== null) {
    const kw = elemOpen[1]!.toLowerCase();
    const symbol = KEYWORD_TO_SYMBOL.get(kw);
    if (symbol !== undefined) {
      const code = elemOpen[2]!;
      emitNode(state, makeNode(code, code, symbol));
      // A one-line form (`component c [ desc ]`) closes on the same line.
      if (!/\]\s*$/.test(line)) state.inElementBlock = true;
      return true;
    }
  }

  // A note-command multi-line body owns every line until its terminator
  // (CommandMultilines2) — never re-dispatched through COMMANDS, so a body
  // line that happens to look like another command (e.g. razefo-71-pice114's
  // embedded `{{ skinparam note { ... } }}`) is never misparsed as one.
  if (state.pendingNote !== undefined) {
    if (isNoteTerminator(line, state.pendingNote.terminator)) {
      closePendingNote(state);
    } else {
      state.pendingNote.lines.push(line);
    }
    return true;
  }

  const noteOpen = classifyNoteOpen(line);
  if (noteOpen !== undefined) {
    executeNoteOpen(state, noteOpen);
    return true;
  }

  for (const cmd of COMMANDS) {
    const match = cmd.pattern.exec(line);
    if (match !== null) {
      cmd.execute(state, match);
      break;
    }
  }
  return true;
}

/**
 * Parse a UmlSource block for a descriptive diagram (component / use-case /
 * deployment) into a DescriptionDiagramAST.
 */
export function parseDescription(block: UmlSource): DescriptionDiagramAST {
  const state = makeInitialState();

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (!processLine(state, line)) break;
  }

  resolveStillUnknown(state.ast.nodes);

  if (state.pages.length === 0) {
    return state.ast;
  }

  // Multi-page: the first page carries `pages` (itself included), per the
  // ast.ts `DescriptionDiagramAST.pages` interface contract consumed by
  // `layoutDescription` (layout.ts). Mirrors class/parser.ts#parseClass.
  state.pages.push(state.ast);
  state.pages[0]!.pages = state.pages;
  return state.pages[0]!;
}
