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
import {
  parseHideShowDirective,
  parseHideShowEntityDirective,
  parseHideShowKindDirective,
  parseHideShowPatternDirective,
  parseHideShowVisibilityDirective,
  parseHideStereotypeDirective,
} from './class-directives.js';
import {
  addFreestandingNote,
  addNote,
  applyConstraintOnLinks,
  applyNoteOnLink,
  CONSTRAINT_ON_LINKS_RE,
  isNoteId,
  NOTE_ON_LINK_RE,
  NOTE_STEREO_CAPTURE,
  NOTE_COLOR,
  NOTE_URL,
  NOTE_TARGET,
} from './class-notes.js';
import { parseMemberLine } from './class-member-parser.js';
import { applyUrlStatement, URL_STATEMENT_RE } from './class-url-command.js';
import {
  applyStereotypeStatement,
  STEREOTYPE_STATEMENT_RE,
} from './class-stereotype-command.js';
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

  // 3. hide/show directives, tried in order: (a) global targets (empty
  //    members/members/circle/empty fields/empty methods), (b) entity-
  //    selector forms (`hide $tag`/`*`/name/<<stereotype>>/@unlinked,
  //    upstream hideOrShow2 -> hides2, G2 N7), (c) entity-QUALIFIED compound
  //    forms (`hide C2 circle`/`hide X members`/`hide Dummy2 methods`,
  //    upstream CommandHideShowByGender, entity-id GENDER only, G2 N26 --
  //    the type-keyword/`<<stereotype>>` GENDER forms remain unported, see
  //    `parseHideShowEntityDirective`'s doc comment), (d) visibility-qualified
  //    member forms (`hide private members`/`hide public fields`, upstream
  //    CommandHideShowByVisibility, G2 N12). All four only ever gate SVG
  //    drawing, never the svek DOT export — a hidden entity/member still
  //    occupies its node/row (oracle: doseko-41's `hide *`+`show $z` DOT
  //    equals directive-free sevaxa-72).
  {
    // G2 N21: `-class` is a literal alternate spelling upstream accepts
    // for BOTH keywords (`CommandHideShow2.java`'s own regex: `(hide|hide-
    // class|show|show-class)`) -- `parseHideShowPatternDirective` already
    // matched it, but this dispatch gate (which decides whether the line
    // even reaches that parser) required whitespace immediately after
    // "hide"/"show", so `hide-class Foo` never routed here at all (jar-
    // verified against `nekali-92-loda300`).
    pattern: /^(hide|show)(-class)?\s/i,
    execute(state, match) {
      const directive = parseHideShowDirective(match.input);
      if (directive !== null) {
        state.ast.directives.push(directive);
        return;
      }
      // `hide [<<pattern>>] stereotype(s)` (G2 N24) — tried BEFORE the
      // entity-pattern parser below: that parser's own `\S+` alternative
      // ambiguously matches a BARE "hide stereotype" (no bracket) as if
      // "stereotype" were a literal entity id (upstream registers both
      // `CommandHideShowByGender` and `CommandHideShow2` against the same
      // single-token shape) — the keyword-specific parser wins the
      // collision, an entity actually named "stereotype" is not a realistic
      // corpus case.
      const stereotype = parseHideStereotypeDirective(match.input);
      if (stereotype !== null) {
        (state.ast.hideStereotypeDirectives ??= []).push(stereotype);
        return;
      }
      // Entity-qualified compound form (`hide C2 circle`, G2 N26) — tried
      // BEFORE both the single-token pattern parser (that one's `\S+`
      // never matches a two-token line anyway, so ordering here is purely
      // for readability) and the visibility-compound parser below (this
      // parser itself excludes the four visibility keywords as a valid
      // entity id, so `hide private members` still falls through to it).
      const entity = parseHideShowEntityDirective(match.input);
      if (entity !== null) {
        (state.ast.hideEntityDirectives ??= []).push(entity);
        return;
      }
      // G3/O3: type-keyword GENDER form (`hide object fields`) -- the OTHER
      // alternative of the same upstream command, see
      // `parseHideShowKindDirective`'s own doc comment. Mutually exclusive
      // with the entity-id form above by construction (that parser rejects
      // every recognized type keyword as an entity id).
      const kindDirective = parseHideShowKindDirective(match.input);
      if (kindDirective !== null) {
        (state.ast.hideKindDirectives ??= []).push(kindDirective);
        return;
      }
      const pattern = parseHideShowPatternDirective(match.input);
      if (pattern !== null) {
        (state.ast.hidePatternDirectives ??= []).push(pattern);
        return;
      }
      // Compound qualifier form (`hide private members`, G2 N12) — tried
      // last: neither parser above matches a multi-word, visibility-
      // prefixed target.
      const visibility = parseHideShowVisibilityDirective(match.input);
      if (visibility !== null) {
        (state.ast.hideVisibilityDirectives ??= []).push(visibility);
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
      // G2 N19: single-coupling-only creationIndex/synthetic-name tracking
      // -- see `AssocCoupleCounter`'s doc comment (class-assoc-couple.ts).
      applyAssocCouple(
        state.ast,
        (id) => ensureClassifier(state, id, undefined, undefined, true),
        match.input,
        state.creationCounter,
      );
    },
  },

  // 5e. `note on|of link: text` — see NOTE_ON_LINK_RE's doc (class-notes.ts).
  // G2 N34: NOTE_COLOR is now capturing -- the text group shifted from
  // match[1] to match[2] (the color itself is not yet consumed here, same
  // "captured but not wired to render" posture as the link-note-color
  // cluster generally -- surveyed, named remainder, not this iteration's
  // scope).
  { pattern: NOTE_ON_LINK_RE, execute: (state, match) => applyNoteOnLink(state.ast, match[2]!) },

  // 5f. `constraint on links` — see CONSTRAINT_ON_LINKS_RE (class-notes.ts).
  { pattern: CONSTRAINT_ON_LINKS_RE, execute: (state) => applyConstraintOnLinks(state.ast) },

  // 5g. `url [of|for] <Code> [is] [[...]]` — CommandUrl.java (README item
  //     #7, G2 N15). Attaches a url to an ALREADY-DECLARED classifier;
  //     silent no-op when the target doesn't exist (mirrors this port's
  //     established no-throw posture for unresolvable post-hoc directives —
  //     see class-notes.ts's "Nothing to note to" precedent — rather than
  //     upstream's thrown error).
  { pattern: URL_STATEMENT_RE, execute: (state, match) => applyUrlStatement(state, match[1]!, match[2]!) },

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
      // G2 N59: auto-create endpoints in jar's REAL creation order -- pure
      // left-to-right SOURCE TEXT order, NOT `rel.from`/`rel.to` order
      // (`rel.swapDirection`'s own doc comment, ast.ts, derives this from
      // `CommandLinkClass.executeArg:295-333`: `ent1String`/`ent2String`
      // are always created in that order, entirely independent of
      // arrowhead/`LinkType` semantics). A relationship with NEITHER
      // endpoint auto-created (the overwhelmingly common case -- both
      // already declared) is unaffected either way, since `ensureClassifier`
      // reuses the existing entry without re-stamping `creationIndex`.
      const ensureEndpoint = (id: string): string =>
        isNoteId(state.ast, id) ? id : ensureClassifier(state, id, undefined, undefined, true).id;
      if (rel.swapDirection === true) {
        rel.to = ensureEndpoint(rel.to);
        rel.from = ensureEndpoint(rel.from);
      } else {
        rel.from = ensureEndpoint(rel.from);
        rel.to = ensureEndpoint(rel.to);
      }
      // G2 N2 (mechanism 3): stamp AFTER both endpoints resolve/auto-create
      // -- matches upstream's shared-counter ordering (an auto-created
      // endpoint's own uid always precedes the link's), see
      // ast.ts#Relationship.creationIndex's doc comment.
      state.creationCounter.value += 1;
      rel.creationIndex = state.creationCounter.value;
      // G2 N9: `<path codeLine="...">` -- see ast.ts#Relationship.sourceLine's
      // doc comment.
      if (state.currentLine !== undefined) rel.sourceLine = state.currentLine;
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
      // G2 N19: creationIndex/synthetic-name tracking -- see
      // `LollipopCounter`'s doc comment (class-lollipop.ts).
      applyLollipop(
        state.ast,
        (id) => ensureClassifier(state, id, undefined, undefined, true),
        state.activeNamespace,
        match.input,
        state.creationCounter,
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
        NOTE_STEREO_CAPTURE +
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
        // G2 N37: NOTE_STEREO_CAPTURE is now capturing (group 3) -- COLOR
        // shifted from match[3] to match[4], the brace-closer from match[4]
        // to match[5].
        ...(match[3] !== undefined ? { stereotype: match[3] } : {}),
        ...(match[4] !== undefined ? { color: match[4] } : {}),
        ...(match[5] !== undefined ? { closer: 'brace' } : {}),
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
        NOTE_STEREO_CAPTURE +
        NOTE_TAGS +
        NOTE_COLOR +
        NOTE_URL +
        '\\s*:\\s*(.+)$',
      'i',
    ),
    execute(state, match) {
      const target = match[2] ?? state.lastEntity ?? undefined;
      if (target === undefined) return; // "Nothing to note to" — silent no-op
      // G2 N37: NOTE_STEREO_CAPTURE is now capturing (group 3) -- COLOR
      // shifted from match[3] to match[4], the text group from match[4] to
      // match[5].
      const id = addNote(
        state.ast,
        match[1]!.toLowerCase() as NotePosition,
        target,
        match[5]!.trim(),
        {
          namespace: state.activeNamespace,
          implicitTarget: match[2] === undefined,
          ...(match[3] !== undefined ? { stereotype: match[3] } : {}),
          ...(match[4] !== undefined ? { color: match[4] } : {}),
        },
        state.creationCounter,
        state.tipGroupsSeen,
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
      '^note\\s+as\\s+(\\w+|"[^"]+")' + NOTE_TAGS_CAPTURE + NOTE_STEREO_CAPTURE + NOTE_COLOR + '\\s*$',
      'i',
    ),
    execute(state, match) {
      state.pendingNote = {
        kind: 'freestanding',
        alias: match[1]!,
        textLines: [],
        namespace: state.activeNamespace,
        // G2 N37: NOTE_STEREO_CAPTURE is now capturing, group 3 (after
        // alias/tags) -- COLOR shifted from match[3] to match[4].
        ...(match[3] !== undefined ? { stereotype: match[3] } : {}),
        ...(match[4] !== undefined ? { color: match[4] } : {}),
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
        NOTE_STEREO_CAPTURE +
        NOTE_COLOR +
        '\\s*$',
      'i',
    ),
    execute(state, match) {
      // G2 N37: NOTE_STEREO_CAPTURE is now capturing, group 4 (after
      // text/alias/tags) -- COLOR shifted from match[4] to match[5].
      const id = addFreestandingNote(
        state.ast,
        match[2]!,
        match[1]!.trim(),
        state.activeNamespace,
        match[5],
        state.creationCounter,
        match[4],
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

  // 10. `<Name> <<stereotype>>` post-hoc stereotype assignment (G2 N24) —
  //     tried LAST: the broadest catch-all in this table (`\S+` name +
  //     mandatory bracket, no keyword), every more specific command above
  //     (declarations, members, relationships, hide/show) is tried first.
  {
    pattern: STEREOTYPE_STATEMENT_RE,
    execute(state, match) {
      applyStereotypeStatement(state, match[1]!, match[2]!);
    },
  },
];
