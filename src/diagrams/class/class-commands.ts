/**
 * Command dispatch table for the class diagram parser.
 *
 * Split out of parser.ts (which is at the lint line cap) to make room for new
 * commands. See parser.ts for `ParseState`, the `ensureClassifier`/
 * `registerInNamespace` helpers, and the `parseClass` driver loop.
 */

import type { NotePosition } from './ast.js';
import {
  applyAssocCouple,
  applyDoubleCouple,
  ASSOC_COUPLE_RE,
  ASSOC_DOUBLE_COUPLE_RE,
} from './class-assoc-couple.js';
import {
  parseClassifierDecl,
  ALL_DESCRIPTIVE_LEAF,
  type ClassifierDecl,
} from './class-declaration-parser.js';
import { closeContainer, openNamespaceBlock } from './class-container.js';
import { parseHideShowDirective } from './class-directives.js';
import { addNote, isNoteId } from './class-notes.js';
import { parseMemberLine } from './class-member-parser.js';
import {
  parseRelationshipLine,
  REL_DISPATCH_RE,
  stripQuotes,
} from './class-relationship-parser.js';
import { ensureClassifier, type ParseState } from './parser.js';

/** Apply a parsed classifier declaration to the AST (create + set fields + body). */
function applyClassifierDecl(state: ParseState, decl: ClassifierDecl): void {
  const classifier = ensureClassifier(state, decl.id, decl.kind, decl.display);
  classifier.kind = decl.kind;
  if (decl.usymbol !== undefined) classifier.usymbol = decl.usymbol;
  if (decl.typeParams.length > 0) classifier.typeParams = decl.typeParams;
  if (decl.stereotype !== undefined) classifier.stereotype = decl.stereotype;
  if (decl.color !== undefined) classifier.color = decl.color;
  for (const memberStr of decl.inlineMembers) {
    const member = parseMemberLine(memberStr);
    if (member !== null) classifier.members.push(member);
  }
  if (decl.opensBody) state.pendingBodyId = classifier.id;
}

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

/**
 * Order matters: patterns are tested top-to-bottom; first match wins.
 */
export const COMMANDS: readonly Command[] = [
  // 1. Ignore: comments starting with '
  {
    pattern: /^'/,
    execute() { /* no-op */ },
  },

  // 1b. `left to right direction` → rankdir LR (upstream CommandRankDir).
  //     `top to bottom direction` is a no-op (TB is the default). Both must
  //     precede the skinparam/title ignore so they are consumed here.
  {
    pattern: /^left\s+to\s+right\s+direction\b/i,
    execute(state) {
      state.ast.rankdir = 'LR';
    },
  },
  {
    pattern: /^top\s+to\s+bottom\s+direction\b/i,
    execute() { /* no-op — TB is the default */ },
  },

  // 2. Ignore: skinparam and title lines
  {
    pattern: /^(skinparam|title\s)/i,
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

  // 3. hide/show directives — parse and store; unrecognised targets are ignored
  {
    pattern: /^(hide|show)\s/i,
    execute(state, match) {
      const directive = parseHideShowDirective(match.input);
      if (directive !== null) {
        state.ast.directives.push(directive);
      }
    },
  },

  // 4. Closing brace — ends a pending body or namespace block
  {
    pattern: /^\}\s*$/,
    execute(state) {
      if (state.pendingBodyId !== null) {
        state.pendingBodyId = null;
      } else if (state.activeNamespace !== null) {
        closeContainer(state, state.activeNamespace);
        state.activeNamespace = state.namespaceStack.pop() ?? null;
      }
    },
  },

  // 5. Namespace block. The name stops at the first space/'#'/'<'; any trailing
  //    decoration (color/stereotype) up to '{' is ignored (no DOT effect).
  {
    pattern: /^namespace\s+("[^"]*"|[^\s#<{]+)\s*(?:[#<][^{]*)?\{?\s*$/i,
    execute(state, match) {
      const nsId = stripQuotes(match[1]!);
      openNamespaceBlock(state, nsId, nsId);
    },
  },

  // 5b. Package block (named/quoted/stereotyped/colored/anonymous). Upstream
  //     routes package through the same PACKAGE group as namespace
  //     (CommandPackage → gotoGroup(GroupType.PACKAGE)), so it clusters alike.
  {
    pattern:
      /^package\b\s*(?:"([^"]*)"|([^\s#<{]+))?(?:\s+as\s+([^\s{]+))?(?:\s*\[\[[^\]]*\]\])?\s*(?:[#<][^{]*)?\{\s*$/i,
    execute(state, match) {
      const name = match[1] ?? match[2];
      if (name !== undefined) {
        openNamespaceBlock(state, match[3] ?? name, name);
      } else {
        const id = '__pkg' + String(state.ast.namespaces.length);
        openNamespaceBlock(state, id, '');
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
  {
    pattern: ASSOC_DOUBLE_COUPLE_RE,
    execute(state, match) {
      applyDoubleCouple(state.ast, (id) => ensureClassifier(state, id), match.input);
    },
  },
  {
    pattern: ASSOC_COUPLE_RE,
    execute(state, match) {
      applyAssocCouple(state.ast, (id) => ensureClassifier(state, id), match.input);
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
      const rel = parseRelationshipLine(match.input);
      if (rel === null) return;
      // A note-referencing endpoint (e.g. `N4 .> DrawableAdapter`) must not
      // spawn a phantom classifier for the note's alias. For class endpoints,
      // rewrite from/to to the resolved fully-qualified id so the edge connects
      // the same node the (namespace-qualified) classifier was created under.
      if (!isNoteId(state.ast, rel.from)) rel.from = ensureClassifier(state, rel.from).id;
      if (!isNoteId(state.ast, rel.to)) rel.to = ensureClassifier(state, rel.to).id;
      state.ast.relationships.push(rel);
    },
  },

  // 7. Classifier declarations (native class keywords).
  {
    pattern: /^(?:abstract\s+class|class|interface|enum|annotation|entity|circle)\s+/i,
    execute(state, match) {
      const decl = parseClassifierDecl(match.input);
      if (decl !== null) applyClassifierDecl(state, decl);
    },
  },

  // 6b. Single-line note on entity: note <pos> of <Entity> : text
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*:\s*(.+)$/i,
    execute(state, match) {
      addNote(state.ast, match[1]!.toLowerCase() as NotePosition, match[2]!, match[3]!.trim());
    },
  },

  // 6c. Multi-line note on entity opener: note <pos> of <Entity>  (… end note)
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*$/i,
    execute(state, match) {
      state.pendingNote = {
        kind: 'attached',
        position: match[1]!.toLowerCase() as NotePosition,
        target: match[2]!,
        textLines: [],
      };
    },
  },

  // 6d. Multi-line freestanding note opener: note as <alias> (… end note).
  //     Unattached; referenced later by a relationship (`N4 .> Drawable`).
  {
    pattern: /^note\s+as\s+(\w+|"[^"]+")\s*$/i,
    execute(state, match) {
      state.pendingNote = {
        kind: 'freestanding',
        alias: match[1]!,
        textLines: [],
      };
    },
  },

  // 7. Standalone member: `ClassName : +member`. Before relationship detection;
  //    the `(?!:)` lookahead leaves `Class::member` port syntax to rule 8.
  {
    pattern: /^(\w+)\s*:(?!:)\s*(.+)$/,
    execute(state, match) {
      const classId = match[1]!;
      const memberStr = match[2]!.trim();
      const classifier = ensureClassifier(state, classId);
      const member = parseMemberLine(memberStr);
      if (member !== null) {
        classifier.members.push(member);
      }
    },
  },

  // 9. Descriptive-element leaf declarations (`database X`) — AFTER the member
  //    rule so a class NAMED like a keyword with members is a member line, not a
  //    descriptive element. Only the leaf form reaches here (no container `{`).
  {
    pattern: new RegExp('^(?:' + ALL_DESCRIPTIVE_LEAF + ')\\s+\\S', 'i'),
    execute(state, match) {
      const decl = parseClassifierDecl(match.input);
      if (decl !== null) applyClassifierDecl(state, decl);
    },
  },

];
