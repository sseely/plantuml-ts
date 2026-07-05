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
  CONTAINER_OPEN_RE,
  KEYWORD_RE,
  extractNodeStereotype,
  extractColor,
  makeNode,
  parseInlineBody,
  parseNameSection,
} from './parse-helpers.js';
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

/** Alias suffix in bracket shorthand: `as Alias [rest]` */
const RE_BRACKET_ALIAS = /^as\s+(\S+)(.*)?$/i;

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
  /** Stack of open container nodes (package, node, folder, etc.). */
  containerStack: DescriptiveNode[];
  /** Every node created so far, by id — lets the link grammar auto-create
   *  (CommandLinkElement.getDummy) skip endpoints that already exist. */
  nodesById: Map<string, DescriptiveNode>;
  /** The array (a container's `children`, or the AST's top-level `nodes`)
   *  each node currently lives in — lets `remove <id>` (CommandRemoveRestore,
   *  simple-identifier form only) splice it back out regardless of whether
   *  its enclosing `{ }` block has already been closed. */
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
}

/** Discriminated multi-line note block in progress; see `ParseState.pendingNote`. */
type PendingNoteState =
  | { kind: 'drop'; terminator: NoteTerminator; lines: string[] }
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
 * `remove <id>` (CommandRemoveRestore.java, simple-identifier `WHAT` form
 * only — `<<stereotype>>` and `@unlinked` matching are a separate,
 * out-of-scope HideOrShow pattern-matching feature; see
 * plans/dot-oracle-sync/phase-2-description/cluster-mechanism.md). Splices
 * the node out of whichever array (container children, or top-level AST
 * nodes) it currently lives in — this is what lets an enclosing container
 * become empty (isEmpty()) and fall through the existing
 * empty-container-as-leaf demotion in the layout engine, exactly like
 * upstream's `Entity.isEmpty()` after a child's removal.
 */
function removeEntity(state: ParseState, id: string): void {
  const node = state.nodesById.get(id);
  const arr = state.parentArrayById.get(id);
  if (node === undefined || arr === undefined) return;
  const idx = arr.indexOf(node);
  if (idx !== -1) arr.splice(idx, 1);
  state.nodesById.delete(id);
  state.parentArrayById.delete(id);
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
function executeNoteOpen(state: ParseState, m: NoteOpenMatch): void {
  if (m.kind === 'drop-single') return;
  if (m.kind === 'drop-open') {
    state.pendingNote = { kind: 'drop', terminator: 'endnote', lines: [] };
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
  if (pending.kind === 'drop') return;
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

const COMMANDS: readonly Command[] = [
  // 1. Comment lines
  {
    pattern: /^'/,
    execute() { /* ignore */ },
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

  // 3b. `remove <id>` — CommandRemoveRestore.java, simple-identifier form.
  //     Must precede the generic ignore rule above only in intent, not
  //     order (disjoint patterns); placed here to stay next to it.
  {
    pattern: /^remove\s+(\S+)\s*$/i,
    execute(state, match) { removeEntity(state, match[1]!); },
  },

  // 4. Closing brace — pops the current container
  {
    pattern: /^\}\s*$/,
    execute(state) { state.containerStack.pop(); },
  },

  // 5. Business-actor shorthand: :Name:/ or :Name: /
  //    More specific than plain :Name:, so must come first.
  {
    pattern: /^:([^:]+):\s*\/\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'actor-business'));
    },
  },

  // 6. Actor shorthand: :Name:
  {
    pattern: /^:([^:]+):\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'actor'));
    },
  },

  // 7. Business-usecase shorthand: (Name)/ or (Name) /
  {
    pattern: /^\(([^)]+)\)\s*\/\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'usecase-business'));
    },
  },

  // 8. Interface shorthand: () InterfaceName (standalone, no arrow)
  {
    pattern: /^\(\)\s+(\S+)\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'interface'));
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
      const bracketName = match[1]!.trim();
      let extra = (match[2] ?? '').trim();
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
      emitNode(state, makeNode(id, bracketName, 'component', stereotype, color));
    },
  },

  // 11. Use-case shorthand: (Name) standalone
  {
    pattern: /^\(([^)]+)\)\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'usecase'));
    },
  },

  // 12. Container inline block: CONTAINER header { body }
  {
    pattern: CONTAINER_INLINE_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw) ?? 'node';
      const { id, display, stereotype, color } = parseNameSection(match[2]!.trim());
      const container = makeNode(id, display, symbol, stereotype, color);
      container.declaredAsGroup = true;
      for (const child of parseInlineBody(match[3]!)) {
        container.children.push(child);
      }
      emitNode(state, container);
    },
  },

  // 13. Container open block: CONTAINER header {
  {
    pattern: CONTAINER_OPEN_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw) ?? 'node';
      const { id, display, stereotype, color } = parseNameSection(match[2]!.trim());
      const container = makeNode(id, display, symbol, stereotype, color);
      container.declaredAsGroup = true;
      emitNode(state, container);
      state.containerStack.push(container);
    },
  },

  // 14. Generic keyword dispatch: any KEYWORD_TO_SYMBOL key followed by a name.
  //     Handles non-container keywords (artifact, person, boundary, …) and
  //     container keywords used standalone without braces (node Foo).
  //     Business-variant keywords: actor/ Name, usecase/ Name.
  {
    pattern: KEYWORD_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw);
      if (symbol === undefined) return;
      const { id, display, stereotype, color } = parseNameSection(match[2]!);
      emitNode(state, makeNode(id, display, symbol, stereotype, color));
    },
  },
];

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a UmlSource block for a descriptive diagram (component / use-case /
 * deployment) into a DescriptionDiagramAST.
 */
export function parseDescription(block: UmlSource): DescriptionDiagramAST {
  const state: ParseState = {
    ast: makeDefaultAST(),
    containerStack: [],
    nodesById: new Map(),
    parentArrayById: new Map(),
    lastEntityId: undefined,
    noteCounter: 0,
    pendingNote: undefined,
  };

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    // `!exit` is a preprocessor directive (net.sourceforge.plantuml.preproc)
    // that halts all further line processing — confirmed against the pinned
    // oracle golden for jesibe-85-sozu187 (`component bidon`/`component
    // bidon2`, then `!exit`, then a note + two links to it: the oracle DOT
    // has only the two components, no note, no edges). Surfaced by this
    // task's auto-create feature: without it, a link past `!exit` referring
    // to an undeclared endpoint would spuriously auto-create that endpoint.
    if (/^!exit\b/i.test(line)) break;

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
      continue;
    }

    const noteOpen = classifyNoteOpen(line);
    if (noteOpen !== undefined) {
      executeNoteOpen(state, noteOpen);
      continue;
    }

    for (const cmd of COMMANDS) {
      const match = cmd.pattern.exec(line);
      if (match !== null) {
        cmd.execute(state, match);
        break;
      }
    }
  }

  resolveStillUnknown(state.ast.nodes);
  return state.ast;
}
