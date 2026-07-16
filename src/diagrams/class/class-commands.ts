/**
 * Command dispatch table for the class diagram parser.
 *
 * Split out of parser.ts (which is at the lint line cap) to make room for new
 * commands. See parser.ts for `ParseState`, the `ensureClassifier` helper,
 * and the `parseClass` driver loop; `registerInNamespace` lives in
 * class-namespace.ts.
 */

import type { NotePosition } from './ast.js';
import {
  applyAssocCouple,
  applyDoubleCouple,
  ASSOC_COUPLE_RE,
  ASSOC_DOUBLE_COUPLE_RE,
} from './class-assoc-couple.js';
import {
  applyClassifierDecl,
  parseClassifierDecl,
  parseTagTokens,
} from './class-declaration-parser.js';
import {
  closeBraceScope,
  openNamespaceBlock,
  openTogetherBlock,
  NAMESPACE_COMMANDS,
} from './class-container.js';
import { collapseEmptyNamespace } from './class-namespace.js';
import { parseHideShowDirective, parseHideShowPatternDirective } from './class-directives.js';
import {
  addFreestandingNote,
  addNote,
  applyConstraintOnLinks,
  applyNoteOnLink,
  CONSTRAINT_ON_LINKS_RE,
  isNoteId,
  NOTE_ON_LINK_RE,
  NOTE_STEREO,
  NOTE_COLOR,
  NOTE_URL,
  NOTE_TARGET,
} from './class-notes.js';
import { parseMemberLine } from './class-member-parser.js';
import { applyLollipop, LOLLIPOP_RE } from './class-lollipop.js';
import { OBJECT_COMMANDS, parseObjectField } from './class-object-commands.js';
import { MAP_COMMANDS } from './class-map-commands.js';
import { JSON_COMMANDS } from './class-json-commands.js';
import { DESCRIPTIVE_LEAF_COMMANDS } from './class-descriptive-leaf-command.js';
import {
  parseRelationshipLine,
  REL_DISPATCH_RE,
} from './class-relationship-parser.js';
import { ensureClassifier, startNewPage, type ParseState } from './parser.js';

// Moved for the line cap: declaration/note helpers → class-declaration-
// parser.ts/class-notes.ts; object/map/json/descriptive-leaf → their own modules.

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

/** A run of `$tag` tokens — upstream `Stereotag.pattern()` (the TAGS/TAGS1/
 *  TAGS2 note-command slots). Non-capturing form = acceptance only (attached
 *  notes' tags are never consulted — remove/restore delegates to the host);
 *  capturing form feeds `parseTagTokens` for freestanding notes. */
const NOTE_TAGS = '(?:\\s+\\$[^\\s{}"\'<>$]+)*';
const NOTE_TAGS_CAPTURE = '((?:\\s+\\$[^\\s{}"\'<>$]+)*)';

/**
 * Order matters: patterns are tested top-to-bottom; first match wins.
 */
export const COMMANDS: readonly Command[] = [
  // 1. Ignore: comments starting with '
  { pattern: /^'/, execute() { /* no-op */ } },

  // 1b. `left to right direction` → rankdir LR (upstream CommandRankDir).
  //     `top to bottom direction` is a no-op (TB is the default). Both must
  //     precede the skinparam/title ignore so they are consumed here.
  {
    pattern: /^left\s+to\s+right\s+direction\b/i,
    execute(state) {
      state.ast.rankdir = 'LR';
    },
  },
  { pattern: /^top\s+to\s+bottom\s+direction\b/i, execute() { /* no-op — TB default */ } },

  // 2. Ignore: skinparam, scale lines (scale is global/structurally inert).
  //    `title` is NOT ignored here -- it is claimed by the shared annotation
  //    matcher (matchAnnotationCommand, called before COMMANDS in parser.ts)
  //    so `title ...`/`title\n...\nend title` lands in
  //    `state.ast.annotations.title` instead of being silently dropped.
  {
    pattern: /^(skinparam|scale\b)/i,
    execute() { /* no-op */ },
  },

  // 2a. allow_mixing / allowmixing — upstream CommandAllowMixing flips a flag;
  //     here a no-op directive (the class parser renders descriptive elements
  //     unconditionally). Consume so it is not a stray declaration.
  {
    pattern: /^allow_?mixing\s*$/i,
    execute() { /* no-op */ },
  },

  // 2b. Namespace separator directive: `set namespaceSeparator ::`,
  //     `set separator .`, or `set separator none` (disables splitting).
  {
    pattern: /^set\s+(?:namespace)?separator\s+(\S+)\s*$/i,
    execute(state, match) {
      const value = match[1]!;
      state.namespaceSeparator = /^none$/i.test(value) ? null : value;
    },
  },

  // 2c. `!pragma useIntermediatePackages false` — collapse a dotted id to a
  //     single namespace instead of a nested chain.
  {
    pattern: /^!pragma\s+useintermediatepackages\s+(true|false)\s*$/i,
    execute(state, match) {
      state.intermediatePackages = !/^false$/i.test(match[1]!);
    },
  },

  // 2d. `newpage` (CommandNewpage) — finalize the current page and start an
  //     entirely fresh, empty diagram; every subsequent command mutates the
  //     new page. See parser.ts#startNewPage for the field-reset mechanism.
  {
    pattern: /^newpage\s*$/i,
    execute(state) {
      startNewPage(state);
    },
  },

  // 3. hide/show directives — global targets first (empty members/members/
  //    circle/empty fields/empty methods), then entity-selector forms
  //    (`hide $tag`/`*`/name/<<stereotype>>/@unlinked, upstream hideOrShow2
  //    -> hides2, G2 N7). Both only ever gate SVG drawing, never the svek
  //    DOT export — a hidden entity still occupies its node (oracle:
  //    doseko-41's `hide *`+`show $z` DOT equals directive-free sevaxa-72).
  //    Compound qualifier forms (`hide C2 circle`, `hide <<even>> methods`)
  //    match neither parser and are still dropped (unported, ledgered).
  {
    pattern: /^(hide|show)\s/i,
    execute(state, match) {
      const directive = parseHideShowDirective(match.input);
      if (directive !== null) {
        state.ast.directives.push(directive);
        return;
      }
      const pattern = parseHideShowPatternDirective(match.input);
      if (pattern !== null) {
        (state.ast.hidePatternDirectives ??= []).push(pattern);
      }
    },
  },

  // 3b. remove/restore (CommandRemoveRestore) — unlike hide, excludes the
  //     matched entities from the DOT export entirely. Stored raw; evaluated
  //     lazily at the layout-input boundary (layout.ts → filterRemovedEntities),
  //     mirroring upstream's export-time isRemoved().
  //     @see ~/git/plantuml/.../classdiagram/command/CommandRemoveRestore.java:55-90
  {
    pattern: /^(remove|restore)\s+(\S.*)$/i,
    execute(state, match) {
      (state.ast.removeDirectives ??= []).push({
        kind: 'removerestore',
        action: match[1]!.toLowerCase() === 'restore' ? 'restore' : 'remove',
        what: match[2]!.trim(),
      });
    },
  },

  // 4. Closing brace — ends a pending body, together block, or namespace
  //    block (LIFO; see closeBraceScope in class-container.ts).
  { pattern: /^\}\s*$/, execute: (state) => closeBraceScope(state) },

  // 4b. `together {` (CommandTogether, ClassDiagramFactory.java:131) — a
  //     layout-proximity grouping with no comparator-visible DOT cluster; see
  //     openTogetherBlock (class-container.ts).
  { pattern: /^together\s*\{\s*$/i, execute: (state) => openTogetherBlock(state) },

  // 4b/5. Namespace block commands (CommandNamespace2 + CommandNamespace) —
  //       moved to class-container.ts (NAMESPACE_COMMANDS) to keep this file
  //       under the line cap; order preserved (2 tried first).
  ...NAMESPACE_COMMANDS,

  // 5b. Package block. Upstream routes package through the same PACKAGE group
  //     as namespace, so it clusters alike. Trailing `(\s*\})?` (group 4)
  //     captures same-line 'X {}' (CommandPackageEmpty) for immediate collapse.
  //     `$tag` tokens after the name (CommandPackage's Stereotag.pattern()
  //     TAGS slot — `package p1 $txn {`) are accepted and discarded: group
  //     removal/tag-selection on packages is not implemented, and `hide $tag`
  //     never affects the DOT export (see rule 3).
  {
    pattern:
      /^package\b\s*(?:"([^"]*)"|([^\s#<{]+))?(?:\s+as\s+([^\s{]+))?(?:\s+\$[^\s{}"'<>$]+)*(?:\s*\[\[[^\]]*\]\])?\s*(?:[#<][^{]*)?\{(\s*\})?\s*$/i,
    execute(state, match) {
      const name = match[1] ?? match[2];
      let effectiveId: string;
      if (name !== undefined) {
        effectiveId = openNamespaceBlock(state, match[3] ?? name, name);
      } else {
        const id = '__pkg' + String(state.ast.namespaces.length);
        effectiveId = openNamespaceBlock(state, id, '');
      }
      if (match[4] !== undefined) {
        state.ast.namespaces = collapseEmptyNamespace(
          state.ast.namespaces,
          state.classifierIndex,
          state.ast.classifiers,
          effectiveId,
        );
        state.activeNamespace = state.namespaceStack.pop() ?? null;
      }
    },
  },

  // 5b'. Descriptive container (CommandPackageWithUSymbol): `stack a as a {`,
  //      `rectangle "Y" as Z [[url]] {`. Non-empty → cluster; EMPTY → rect leaf on close.
  {
    pattern:
      /^(rectangle|node|component|folder|frame|cloud|database|storage|artifact|file|card|queue|stack|hexagon|agent)\s+(?:"([^"]*)"|([^\s{]+))(?:\s+as\s+([^\s{]+))?(?:\s*\[\[[^\]]*\]\])?\s*(?:[#<][^{]*)?\{\s*$/i,
    execute(state, match) {
      const usymbol = match[1]!.toLowerCase();
      const name = match[2] !== undefined ? match[2] : match[3]!;
      const id = match[4] ?? name;
      const effectiveId = openNamespaceBlock(state, id, name);
      state.descriptiveContainers.set(effectiveId, usymbol);
    },
  },

  // 5b''. `() "name"` interface lollipop (CommandCreateElementParenthesis) — a
  //       plaintext circle node (same svek shape as a `circle` element).
  {
    pattern: /^\(\)\s+(?:"([^"]*)"|(\S+))(?:\s+as\s+(\S+))?\s*$/,
    execute(state, match) {
      const name = match[1] ?? match[2]!;
      ensureClassifier(state, match[3] ?? name, 'circle', name).kind = 'circle';
    },
  },

  // 5c. Association diamond: `<> name` (CommandDiamondAssociation) — a
  //     diamond-shaped n-ary/association-class connector node.
  {
    pattern: /^<>\s+(\S+)\s*$/,
    execute(state, match) {
      // Force kind even if a relationship endpoint auto-created it as a class.
      ensureClassifier(state, match[1]!, 'association').kind = 'association';
    },
  },

  // 5d. Association-class couple. Double `(A,B).(C,D)` before single `(A,B)..C`.
  // Endpoint resolution mirrors CommandLinkClass's couple handling
  // (executeArgSpecial1/2/3, reuseExistingChild=true for every A/B/C/D
  // endpoint) — a bare endpoint name may reuse an existing classifier.
  {
    pattern: ASSOC_DOUBLE_COUPLE_RE,
    execute(state, match) {
      applyDoubleCouple(
        state.ast,
        (id) => ensureClassifier(state, id, undefined, undefined, true),
        match.input,
      );
    },
  },
  {
    pattern: ASSOC_COUPLE_RE,
    execute(state, match) {
      applyAssocCouple(
        state.ast,
        (id) => ensureClassifier(state, id, undefined, undefined, true),
        match.input,
      );
    },
  },

  // 5e. `note on|of link: text` — see NOTE_ON_LINK_RE's doc (class-notes.ts).
  { pattern: NOTE_ON_LINK_RE, execute: (state, match) => applyNoteOnLink(state.ast, match[1]!) },

  // 5f. `constraint on links` — see CONSTRAINT_ON_LINKS_RE (class-notes.ts).
  { pattern: CONSTRAINT_ON_LINKS_RE, execute: (state) => applyConstraintOnLinks(state.ast) },

  // 6-pre. Standalone member (dotted ids allowed) — BEFORE relationship
  //    dispatch: CommandAddMethod runs before CommandLinkClass upstream; a
  //    bare `.` is a valid bodyless REL_ARROW (vuresa-33-kumu160).
  {
    pattern: /^(\.?\w+(?:\.\w+)*)\s*:(?!:)\s*(.+)$/,
    execute(state, match) {
      const classId = match[1]!;
      const memberStr = match[2]!.trim();
      const classifier = ensureClassifier(state, classId, undefined, undefined, true);
      // An already-`object`-kind target uses object field semantics
      // (`name = value`); a missing target is created as a plain `class`
      // (CommandAddMethod always uses LeafType.CLASS) and parsed as a
      // class member line. See class-object-commands.ts#parseObjectField.
      const member =
        classifier.kind === 'object' ? parseObjectField(memberStr) : parseMemberLine(memberStr);
      if (member !== null) {
        classifier.members.push(member);
      }
    },
  },

  // 6. Relationship lines — BEFORE classifier declarations so a class NAMED
  //    like a keyword used as a relationship endpoint (`CLASS *-- f1`, where
  //    `CLASS` is a class named "CLASS") is parsed as a relationship, not a
  //    declaration named `*-- f1`. Declarations never match REL_DISPATCH_RE
  //    (they carry no arrow), so this ordering does not steal them. The dispatch
  //    pattern mirrors REL_RE's endpoint/qualifier/arrow alternatives (built from
  //    the same CLASS_ID/REL_ARROW fragments) so only genuine relationship lines
  //    reach parseRelationshipLine.
  {
    pattern: REL_DISPATCH_RE,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const rel = parseRelationshipLine(match.input, state.namespaceSeparator, state.ast.classifiers);
      if (rel === null) return;
      // A note-referencing endpoint (e.g. `N4 .> DrawableAdapter`) must not
      // spawn a phantom classifier for the note's alias. For class endpoints,
      // rewrite from/to to the resolved fully-qualified id so the edge connects
      // the same node the (namespace-qualified) classifier was created under.
      // reuseExistingChild=true mirrors CommandLinkClass's endpoint resolution
      // (CucaDiagram.java quarkInContext(true, ...)) — a bare endpoint name
      // that uniquely matches an existing classifier reuses it instead of
      // spawning a scope-local duplicate.
      if (!isNoteId(state.ast, rel.from)) {
        rel.from = ensureClassifier(state, rel.from, undefined, undefined, true).id;
      }
      if (!isNoteId(state.ast, rel.to)) {
        rel.to = ensureClassifier(state, rel.to, undefined, undefined, true).id;
      }
      // G2 N2 (mechanism 3): stamp AFTER both endpoints resolve/auto-create
      // -- matches upstream's shared-counter ordering (an auto-created
      // endpoint's own uid always precedes the link's), see
      // ast.ts#Relationship.creationIndex's doc comment.
      state.creationCounter.value += 1;
      rel.creationIndex = state.creationCounter.value;
      state.ast.relationships.push(rel);
    },
  },

  // 6a. Interface lollipop shorthand (CommandLinkLollipop) — registered right
  //     after the general relationship dispatch (rule 6), mirroring upstream's
  //     ClassDiagramFactory registration order (CommandLinkClass immediately
  //     followed by CommandLinkLollipop). Creates a NEW small-circle leaf and
  //     links it to an already-declared entity; see class-lollipop.ts for why
  //     this needs its own command (distinct from both the general relationship
  //     arrow's single `(`/`)` decor glyph and the standalone `() "name"`
  //     declaration, rule 5b'' above).
  {
    pattern: LOLLIPOP_RE,
    execute(state, match) {
      applyLollipop(
        state.ast,
        (id) => ensureClassifier(state, id, undefined, undefined, true),
        state.activeNamespace,
        match.input,
      );
    },
  },

  // 7. Classifier declarations; bare `abstract Name` also matches (murotu-83-cebo380).
  {
    pattern: /^(?:abstract\s+class|abstract|class|interface|enum|annotation|entity|circle)\s+/i,
    execute(state, match) {
      const decl = parseClassifierDecl(match.input);
      if (decl !== null) applyClassifierDecl(state, decl, true);
    },
  },

  // 7a. `object` declaration (CommandCreateEntityObject) — registered right
  //     after the classifier-declaration entry, mirroring upstream
  //     ClassDiagramFactory.initCommandsList's order (CommandCreateClass then
  //     CommandCreateEntityObject). Moved to class-object-commands.ts (line
  //     cap); see that module for the full port + duplicate-declaration
  //     semantics.
  ...OBJECT_COMMANDS,

  // 7b. `map` declaration (CommandCreateMap) — registered right after the
  //     object-multiline opener, mirroring upstream's
  //     CommandCreateEntityObjectMultilines(116) -> CommandCreateMap(117)
  //     order. Moved to class-map-commands.ts (line cap); see that module
  //     for the full port + row/link body semantics.
  ...MAP_COMMANDS,

  // 7c. `json` declaration (CommandCreateJson/-SingleLine) — after `map`,
  //     mirroring upstream's registration order (117-119); see class-json-commands.ts.
  ...JSON_COMMANDS,

  // 6c. Multi-line note opener: note <pos> [of <Entity>] [<<s>>] [#c] [[u]]
  //     (… end note), OR ending in `{` (… `}`) — upstream's two SEPARATE
  //     withBracket=false/true commands merged (header identical, only the
  //     closer differs). @see CommandFactoryNoteOnEntity#createMultiLine
  //
  //     Tried BEFORE 6b: 6b ends in a MANDATORY `:`+text, and a `::member`
  //     target supplies a spare `:` for that — `note left of A::counter`
  //     would otherwise satisfy 6b by backtracking the target to `A` and
  //     reading `:counter` as bogus text. Real single-line notes always have
  //     text after `:`, so 6c's no-colon tail can't match them and they
  //     still fall through to 6b.
  {
    pattern: new RegExp(
      '^note\\s+(left|right|top|bottom)(?:\\s+of\\s+' + NOTE_TARGET + ')?' +
        NOTE_TAGS +
        NOTE_STEREO +
        NOTE_TAGS +
        NOTE_COLOR +
        NOTE_URL +
        '\\s*(\\{)?\\s*$',
      'i',
    ),
    execute(state, match) {
      state.pendingNote = {
        kind: 'attached',
        position: match[1]!.toLowerCase() as NotePosition,
        target: match[2] ?? state.lastEntity ?? undefined,
        implicitTarget: match[2] === undefined,
        textLines: [],
        namespace: state.activeNamespace,
        ...(match[3] !== undefined ? { closer: 'brace' } : {}),
      };
    },
  },

  // 6b. Single-line note: note <pos> [of <Entity>] [<<s>>][#c][[u]] : text
  //     `of <Entity>` absent -> attaches to the last created entity. Tried
  //     after 6c — see that entry's comment for why.
  // @see ~/git/plantuml/.../CommandFactoryNoteOnEntity.java:92-116 (regex),
  //      :293-301 (idShort==null -> getLastEntity(); null -> no-op here)
  {
    pattern: new RegExp(
      '^note\\s+(left|right|top|bottom)(?:\\s+of\\s+' + NOTE_TARGET + ')?' +
        NOTE_TAGS +
        NOTE_STEREO +
        NOTE_TAGS +
        NOTE_COLOR +
        NOTE_URL +
        '\\s*:\\s*(.+)$',
      'i',
    ),
    execute(state, match) {
      const target = match[2] ?? state.lastEntity ?? undefined;
      if (target === undefined) return; // "Nothing to note to" — silent no-op
      const id = addNote(
        state.ast,
        match[1]!.toLowerCase() as NotePosition,
        target,
        match[3]!.trim(),
        { namespace: state.activeNamespace, implicitTarget: match[2] === undefined },
      );
      state.lastEntity = id;
    },
  },

  // 6d. Multi-line freestanding note opener: note as <alias> [$tags]
  //     [<<stereo>>] [#color]  (… end note). Unattached; referenced later by
  //     a relationship (`N4 .> Drawable`). No URL group upstream —
  //     CommandFactoryNote.java's multiLine regex has none. TAGS captured and
  //     attached on finalize via ParseState.pendingNoteTags (PendingNote
  //     itself lives in class-notes.ts and carries no tags field).
  {
    pattern: new RegExp(
      '^note\\s+as\\s+(\\w+|"[^"]+")' + NOTE_TAGS_CAPTURE + NOTE_STEREO + NOTE_COLOR + '\\s*$',
      'i',
    ),
    execute(state, match) {
      state.pendingNote = {
        kind: 'freestanding',
        alias: match[1]!,
        textLines: [],
        namespace: state.activeNamespace,
      };
      state.pendingNoteTags = parseTagTokens(match[2] ?? '');
    },
  },

  // 6e. Single-line freestanding note: note "text" as <alias> [$tags]
  //     [<<stereo>>] [#color]. A distinct upstream command from 6b-6d
  //     (CommandFactoryNote's `singleLine`, not CommandFactoryNoteOnEntity) —
  //     creates the note leaf immediately; there is no `end note` to wait for.
  //     TAGS sit right after CODE (before STEREO) in the upstream grammar.
  // @see ~/git/plantuml/.../CommandFactoryNote.java:91-107 (regex), :189-212
  //      (executeInternal), :210 (addTags)
  {
    pattern: new RegExp(
      '^note\\s+"([^"]+)"\\s+as\\s+(\\w+|"[^"]+")' +
        NOTE_TAGS_CAPTURE +
        NOTE_STEREO +
        NOTE_COLOR +
        '\\s*$',
      'i',
    ),
    execute(state, match) {
      const id = addFreestandingNote(
        state.ast,
        match[2]!,
        match[1]!.trim(),
        state.activeNamespace,
      );
      const tags = parseTagTokens(match[3] ?? '');
      if (tags.length > 0) {
        const note = state.ast.notes.find((n) => n.id === id);
        if (note !== undefined) note.tags = tags;
      }
      state.lastEntity = id;
    },
  },

  // 9. Descriptive-element leaf declarations — moved to
  //    class-descriptive-leaf-command.ts (line cap); see that module.
  ...DESCRIPTIVE_LEAF_COMMANDS,
];
