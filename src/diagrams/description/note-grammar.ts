/**
 * Note-command grammar for the descriptive-diagram parser — a faithful port
 * of `CommandFactoryNote`, `CommandFactoryNoteOnEntity`, and
 * `CommandFactoryNoteOnLink` (`net.sourceforge.plantuml.command.note`), as
 * wired by `DescriptionDiagramFactory.initCommandsList` (:100-110).
 *
 * Split out of parser.ts so both files stay under 500 lines. Pure regex
 * classification + position/attachment math only — state mutation (node/link
 * creation, containerStack, lastEntityId) stays in parser.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import { cleanId } from './parse-helpers.js';

/** `net.sourceforge.plantuml.utils.Position` — always one of these four; the
 *  upstream regex group is mandatory (`(right|left|top|bottom)`), so there is
 *  no "default" position to resolve for the note-on-entity forms. */
export type NotePosition = 'left' | 'right' | 'top' | 'bottom';

/** Which closing line ends a multi-line note block: `end note`/`endnote`
 *  (CommandFactoryNote*.END) or a bare `}` (the `withBracket` variant). */
export type NoteTerminator = 'endnote' | 'brace';

// ---------------------------------------------------------------------------
// Regexes (module scope — Lizard 1.23.0 miscounts brace depth for regex
// literals containing $ / " / ' inside function bodies).
// ---------------------------------------------------------------------------

// CommandFactoryNoteOnLink — registered BEFORE CommandFactoryNoteOnEntity
// (DescriptionDiagramFactory:97-99 precede :103-110), so a line like
// `note left of link : ...` resolves as on-link, not on-entity with CODE
// "link" (CODE's bare-identifier alternative would otherwise also match).
const RE_NOTE_ON_LINK_SINGLE = new RegExp(
  '^note\\s+(?:(left|right|top|bottom)\\s+)?(?:on|of)\\s+link\\b[^:]*:\\s*(.+)$',
  'i',
);
const RE_NOTE_ON_LINK_OPEN = new RegExp(
  '^note\\s+(?:(left|right|top|bottom)\\s+)?(?:on|of)\\s+link(?:\\s+#\\w+)?\\s*$',
  'i',
);

// CommandFactoryNote — floating, named note (usable as a link endpoint).
const RE_NOTE_FLOATING_SINGLE = new RegExp(
  '^note\\s+"([^"]*)"\\s+as\\s+([\\w.]+)\\s*(.*)$',
  'i',
);
const RE_NOTE_FLOATING_OPEN = new RegExp('^note\\s+as\\s+([\\w.]+)\\s*(.*)$', 'i');

// CommandFactoryNoteOnEntity — attached to an entity (`of X`) or the last
// created entity (bare position, CODE omitted).
const RE_NOTE_ON_ENTITY_SINGLE = new RegExp(
  '^note\\s+(left|right|top|bottom)(?:\\s+of\\s+((?:\\(\\)\\s*)?"[^"]+"|\\(\\)[\\w.]+|\\([^)]+\\)|:[^:]+:|\\[[^\\]]+\\]|[\\w.]+))?(?:\\s+#\\w+)?\\s*:\\s*(.+)$',
  'i',
);
const RE_NOTE_ON_ENTITY_OPEN_BRACE = new RegExp(
  '^note\\s+(left|right|top|bottom)(?:\\s+of\\s+((?:\\(\\)\\s*)?"[^"]+"|\\(\\)[\\w.]+|\\([^)]+\\)|:[^:]+:|\\[[^\\]]+\\]|[\\w.]+))?(?:\\s+#\\w+)?\\s*\\{\\s*$',
  'i',
);
const RE_NOTE_ON_ENTITY_OPEN_PLAIN = new RegExp(
  '^note\\s+(left|right|top|bottom)(?:\\s+of\\s+((?:\\(\\)\\s*)?"[^"]+"|\\(\\)[\\w.]+|\\([^)]+\\)|:[^:]+:|\\[[^\\]]+\\]|[\\w.]+))?(?:\\s+#\\w+)?\\s*$',
  'i',
);

const RE_END_NOTE = /^end\s?note$/i;
const RE_END_BRACE = /^\}$/;

/** CommandMultilines2 END pattern — matched against the (already trimmed)
 *  current line only; a body line that merely CONTAINS "end note" (e.g. as
 *  part of an embedded `{{ }}` diagram) never terminates the block. */
export function isNoteTerminator(line: string, terminator: NoteTerminator): boolean {
  return terminator === 'brace' ? RE_END_BRACE.test(line) : RE_END_NOTE.test(line);
}

function stripQuotes(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t.slice(1, -1) : t;
}

/**
 * `Position.withRankdir` (net.sourceforge.plantuml.utils.Position): under
 * `left to right direction`, every note position rotates 90° (RIGHT<->BOTTOM,
 * LEFT<->TOP). Read at note-command time — CommandRankDir mutates skinparam
 * immediately, so a `left to right direction` line earlier in the same
 * source affects every note command after it, order-dependently, exactly as
 * upstream's single-pass parser does.
 */
export function resolvePosition(pos: NotePosition, rankdir: 'LR' | undefined): NotePosition {
  if (rankdir !== 'LR') return pos;
  const rotated: Record<NotePosition, NotePosition> = {
    right: 'bottom',
    left: 'top',
    bottom: 'right',
    top: 'left',
  };
  return rotated[pos];
}

/**
 * CommandFactoryNoteOnEntity.executeInternal (:305-356): `LinkType(NONE,
 * NONE).goDashed()`. RIGHT/BOTTOM run entity->note; LEFT/TOP run note->entity.
 * Length 1 for the horizontal positions (left/right — LinkArg.noDisplay(1)),
 * 2 for the vertical ones (top/bottom — LinkArg.noDisplay(2)); minLen flows
 * from `length - 1` in the existing link-edge-attrs pipeline.
 */
export function noteAttachment(
  position: NotePosition,
  targetId: string,
  noteId: string,
): { from: string; to: string; length: 1 | 2 } {
  const length = position === 'left' || position === 'right' ? 1 : 2;
  const fromNote = position === 'left' || position === 'top';
  return fromNote
    ? { from: noteId, to: targetId, length }
    : { from: targetId, to: noteId, length };
}

// ---------------------------------------------------------------------------
// Open-line classification
// ---------------------------------------------------------------------------

export type NoteOpenMatch =
  | { kind: 'on-link-single'; text: string }
  | { kind: 'on-link-open' }
  | { kind: 'floating-single'; id: string; text: string }
  | { kind: 'floating-open'; id: string }
  | { kind: 'on-entity-single'; position: NotePosition; targetId: string | undefined; text: string }
  | {
      kind: 'on-entity-open';
      position: NotePosition;
      targetId: string | undefined;
      terminator: NoteTerminator;
    };

/** `note [pos] on|of link [#color][: text]` — CommandFactoryNoteOnLink. In
 *  svek DOT the note becomes the LINK's label table (SvekEdge
 *  hasNoteLabelText — fogiku-22's oracle counts it as label [1,0,0,0]). */
function matchOnLink(line: string): NoteOpenMatch | undefined {
  const single = RE_NOTE_ON_LINK_SINGLE.exec(line);
  if (single !== null) return { kind: 'on-link-single', text: single[2]! };
  if (RE_NOTE_ON_LINK_OPEN.test(line)) return { kind: 'on-link-open' };
  return undefined;
}

function matchFloating(line: string): NoteOpenMatch | undefined {
  const single = RE_NOTE_FLOATING_SINGLE.exec(line);
  if (single !== null) return { kind: 'floating-single', id: single[2]!, text: single[1]! };
  const open = RE_NOTE_FLOATING_OPEN.exec(line);
  if (open !== null) return { kind: 'floating-open', id: open[1]! };
  return undefined;
}

function onEntityTargetId(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  // `()"my interface"` / `(uc)` / `:a:` / `[c]` — same normalization the
  // link endpoints get (DescriptionDiagram.cleanId).
  const t = raw.startsWith('()') ? raw.slice(2).trim() : raw.trim();
  return cleanId(stripQuotes(t));
}

function matchOnEntitySingle(line: string): NoteOpenMatch | undefined {
  const m = RE_NOTE_ON_ENTITY_SINGLE.exec(line);
  if (m === null) return undefined;
  return {
    kind: 'on-entity-single',
    position: m[1]!.toLowerCase() as NotePosition,
    targetId: onEntityTargetId(m[2]),
    text: m[3]!,
  };
}

function matchOnEntityOpen(line: string): NoteOpenMatch | undefined {
  const brace = RE_NOTE_ON_ENTITY_OPEN_BRACE.exec(line);
  if (brace !== null) {
    return {
      kind: 'on-entity-open',
      position: brace[1]!.toLowerCase() as NotePosition,
      targetId: onEntityTargetId(brace[2]),
      terminator: 'brace',
    };
  }
  const plain = RE_NOTE_ON_ENTITY_OPEN_PLAIN.exec(line);
  if (plain === null) return undefined;
  return {
    kind: 'on-entity-open',
    position: plain[1]!.toLowerCase() as NotePosition,
    targetId: onEntityTargetId(plain[2]),
    terminator: 'endnote',
  };
}

function matchOnEntity(line: string): NoteOpenMatch | undefined {
  return matchOnEntitySingle(line) ?? matchOnEntityOpen(line);
}

/**
 * Classify a trimmed line as a note-command opener, in upstream registration
 * priority (on-link before floating before on-entity — see matchOnLink).
 * Returns undefined for anything that isn't a note command at all.
 */
export function classifyNoteOpen(line: string): NoteOpenMatch | undefined {
  return matchOnLink(line) ?? matchFloating(line) ?? matchOnEntity(line);
}
