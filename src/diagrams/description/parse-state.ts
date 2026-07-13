/**
 * Mutable parse state + entity/note mutation helpers for the descriptive
 * diagram parser (component / use-case / deployment). Split out of
 * parser.ts (mission G0b/T6) purely to keep parser.ts under the project's
 * 500-line file cap — no behavior change; every export here is verbatim
 * code moved from parser.ts, still consumed by both `parser.ts` (the main
 * dispatch loop) and `command-table.ts` (the COMMANDS array).
 */

import { createAnnotations } from '../../core/annotations/index.js';
import type { DescriptionDiagramAST, DescriptiveLink, DescriptiveNode } from './ast.js';
import { makeNode } from './parse-helpers.js';
import type { EndpointShape } from './link-grammar.js';
import {
  noteAttachment,
  resolvePosition,
  type NoteOpenMatch,
  type NotePosition,
  type NoteTerminator,
} from './note-grammar.js';

export type { NoteOpenMatch };

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseDescription call)
// ---------------------------------------------------------------------------

export interface ParseState {
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
  /** `set separator <sep>` / `set namespaceseparator <sep>`
   *  (CommandNamespaceSeparator.java). `null` (the default) matches
   *  upstream `TitledDiagram`'s own field default — see
   *  `ast.ts#DescriptionDiagramAST.namespaceSeparator`'s doc for why this is
   *  NOT "." for description diagrams. Mirrored onto `state.ast` by the
   *  `set separator` command itself so `layoutDescription` can read it. */
  namespaceSeparator: string | null;
}

/** Discriminated multi-line note block in progress; see `ParseState.pendingNote`. */
export type PendingNoteState =
  | { kind: 'on-link'; terminator: NoteTerminator; lines: string[] }
  | { kind: 'floating'; terminator: NoteTerminator; lines: string[]; id: string }
  | {
      kind: 'on-entity';
      terminator: NoteTerminator;
      lines: string[];
      position: NotePosition;
      targetId: string | undefined;
    };

export function makeDefaultAST(): DescriptionDiagramAST {
  return { nodes: [], links: [], annotations: createAnnotations() };
}

export function emitNode(state: ParseState, node: DescriptiveNode): void {
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
export function ensureEndpoint(state: ParseState, ep: EndpointShape): void {
  if (state.nodesById.has(ep.id)) return;
  const node = makeNode(ep.id, ep.id, ep.symbol);
  if (ep.stillUnknown === true) node.stillUnknown = true;
  emitNode(state, node);
}

/** Link.sameConnections: same endpoint pair, either direction — identity
 *  only, ignoring style/type/label. */
function sameConnections(a: DescriptiveLink, b: DescriptiveLink): boolean {
  return (a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from);
}

/**
 * `CucaDiagram.addLink` (net.atmp.CucaDiagram.java:880-893): a `single` link
 * is silently dropped — not appended — when the diagram already holds any
 * OTHER link connecting the same two entities, regardless of that other
 * link's own style/type. Non-`single` links always append (upstream never
 * dedups them). Endpoints are still auto-created by the caller either way —
 * only the link record itself is skipped.
 */
export function addLink(state: ParseState, link: DescriptiveLink): void {
  if (link.single === true && state.ast.links.some((other) => sameConnections(other, link))) {
    return;
  }
  state.ast.links.push(link);
}

/**
 * DescriptionDiagram.makeDiagramReady (:81-88): STILL_UNKNOWN leaves mute to
 * the actor symbol when the diagram contains any usecase leaf or a plain
 * actor leaf (isUsecase(), :69-78), else to USymbols.INTERFACE — which then
 * gets svek's shielded plaintext shape.
 */
export function resolveStillUnknown(nodes: DescriptiveNode[]): void {
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
export function startNewPage(state: ParseState): void {
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
  state.namespaceSeparator = null;
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
  // CommandFactoryNoteOnEntity.java:322: `if (kermor && cl1.isGroup())
  // { cl1.addNote(display, position, colors); return; }` -- under
  // `!pragma kermor on`, a note attached to a GROUP entity is stored
  // directly on the Entity (rendered as cluster-label content by
  // ClusterDotStringKermor), never as a separate note leaf + edge. DOT-
  // parity scope: suppress the node/edge creation only -- the label content
  // itself is a rendering-layer concern this port does not carry yet
  // (mirrors Cluster.ts's own KERMOR-branch omission; see
  // description-dot-100 decision-journal.md I2). Note-on-LEAF targets are
  // unaffected either way (upstream's kermor branch only triggers when
  // `cl1.isGroup()`).
  if (state.ast.kermor === true && state.nodesById.get(resolvedTarget)?.declaredAsGroup === true) {
    return;
  }
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

export function executeNoteOpen(state: ParseState, m: NoteOpenMatch): void {
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
export function closePendingNote(state: ParseState): void {
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

