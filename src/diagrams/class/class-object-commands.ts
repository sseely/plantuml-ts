/**
 * `object` declaration commands for the class diagram parser.
 *
 * Upstream has NO separate object-diagram engine: `ClassDiagramFactory`
 * registers `CommandCreateEntityObject` (single-line) and
 * `CommandCreateEntityObjectMultilines` (brace-terminated body) directly,
 * alongside the class commands, on the SAME `AbstractClassOrObjectDiagram`.
 * Object diagrams are class diagrams with a different vocabulary of
 * leaf-creation commands, not a distinct diagram type — this module ports
 * both commands into the class engine's dispatch table (mission:
 * object-dot-sync, absorb object into class engine).
 *
 * `CommandCreateEntityObject` is single-line only (`SingleLineCommand2`).
 * Its regex must not match a line ending in `{` — that form belongs to
 * `CommandCreateEntityObjectMultilines`, whose body lines (`field = value` /
 * bare `field`) are collected via `parser.ts#pendingBodyId`, the same
 * mechanism `class X { ... }` bodies use, but routed to
 * {@link parseObjectField} instead of `parseMemberLine` whenever the target
 * classifier's `kind` is `'object'` (see parser.ts#handlePendingBodyLine and
 * class-commands.ts's rule 6-pre `X : field` command).
 *
 * Split into its own module (mirrors class-container.ts / class-lollipop.ts's
 * precedent for a synthesising command) to keep class-commands.ts under the
 * repo's 500-line-per-file cap.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObject.java
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObjectMultilines.java
 * @see ~/git/plantuml/.../command/NameAndCodeParser.java (nameAndCode())
 * @see ~/git/plantuml/.../objectdiagram/ClassDiagramFactory.java (registration)
 */

import type { Member } from './ast.js';
import { resolveReference } from './class-namespace.js';
import { ensureClassifier, type ParseState } from './parser.js';

// ---------------------------------------------------------------------------
// Grammar fragments (NameAndCodeParser.nameAndCode() + ColorParser.exp1())
// ---------------------------------------------------------------------------

/** Upstream CODE = `[^%s{}%g<>]+` — a bare id/display token: no whitespace,
 *  braces, quotes, or angle brackets. */
const CODE = '[^\\s{}"<>]+';

/**
 * `NameAndCodeParser.nameAndCode()`'s four ordered alternatives (a RegexOr —
 * JS alternation preserves the same try-order): quoted-display `as` code,
 * code `as` quoted-display, bare code, quoted-code-only (no `as`). Capture
 * groups within this fragment (1-based): 1 DISPLAY1, 2 CODE1, 3 CODE2,
 * 4 DISPLAY2, 5 CODE3, 6 CODE4.
 */
const NAME_AND_CODE =
  '(?:' +
  '"([^"]*)"\\s+as\\s+(' + CODE + ')' +
  '|(' + CODE + ')\\s+as\\s+"([^"]*)"' +
  '|(' + CODE + ')' +
  '|"([^"]+)"' +
  ')';

/** `StereotypePattern.optional("STEREO")` — `<< stereotype >>`. */
const STEREO = '(?:\\s*<<\\s*([^<>]+?)\\s*>>)?';

/**
 * `UrlBuilder.OPTIONAL` — matched and discarded: `Classifier` has no `url`
 * field (mirrors class-declaration-parser.ts's `extractDecorations`, which
 * strips a declaration's `[[url]]` the same way).
 */
const URL = '(?:\\s*\\[\\[[^\\]]*\\]\\])?';

/**
 * `ColorParser.exp1()` — the SAME `COLORS_REGEXP` grammar classifier
 * declarations use (PART2 multi-attribute form, or a bare `#colorname`).
 * Duplicated from class-declaration-parser.ts's (module-local) `COLOR_RE`
 * rather than imported: this task's write-set does not include that file.
 * @see ~/git/plantuml/.../klimt/color/ColorParser.java:43-46,89-90
 */
const COLOR =
  '(#(?:\\w+[-\\\\|/]?\\w+;)?(?:(?:text|back|header|line|line\\.dashed|' +
  'line\\.dotted|line\\.bold|shadowing)(?::\\w+[-\\\\|/]?\\w+)?' +
  '(?:;|(?![\\w;:.])))+|#\\w+[-\\\\|/]?\\w+)?';

/**
 * `object <name-and-code> [<<stereo>>] [[[url]]] [#color]`. The leading
 * `(?!.*\{\s*$)` lookahead excludes any line ending in `{` — the multi-line
 * opener is a separate command (see file doc); without the guard this
 * pattern would swallow `object foo {` lines that command must own.
 * Capture groups: 1-6 NAME_AND_CODE, 7 STEREO, 8 COLOR.
 */
const OBJECT_DECL_RE = new RegExp(
  '^object\\s+(?!.*\\{\\s*$)' + NAME_AND_CODE + STEREO + URL + '\\s*' + COLOR + '\\s*$',
  'i',
);

/** Same grammar as {@link OBJECT_DECL_RE} but requiring a trailing `{` (and
 *  no exclusion lookahead — this command OWNS the brace-terminated form). */
const OBJECT_MULTILINE_DECL_RE = new RegExp(
  '^object\\s+' + NAME_AND_CODE + STEREO + URL + '\\s*' + COLOR + '\\s*\\{\\s*$',
  'i',
);

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

interface ObjectMatch {
  rawId: string;
  rawDisplay: string | undefined;
  stereotype: string | undefined;
  color: string | undefined;
}

/**
 * Pull id/display/stereotype/color out of a matched {@link OBJECT_DECL_RE}
 * or {@link OBJECT_MULTILINE_DECL_RE} line (both share the same capture
 * layout — the multi-line pattern only appends a mandatory trailing `{`).
 * Exactly one of the CODE groups (2/3/5/6) or DISPLAY-only groups (1/4,
 * quoted-code-only form has no separate display) is set on any successful
 * match — the `!` below reflects that regex-guaranteed invariant, not a
 * runtime fallback.
 */
function parseObjectMatch(match: RegExpExecArray): ObjectMatch {
  const rawCode = match[2] ?? match[3] ?? match[5] ?? match[6];
  const rawDisplay = match[1] ?? match[4];
  return {
    rawId: (rawCode ?? rawDisplay)!,
    rawDisplay,
    stereotype: match[7]?.trim(),
    color: match[8],
  };
}

/**
 * Apply one matched `object` declaration line.
 *
 * `CommandCreateEntityObject#executeArg` resolves the quark with
 * `quarkInContext(true, ...)` — `reuseExistingChild=true`, UNLIKE
 * `CommandCreateClass`'s scope-local `quarkInContext(false, ...)` (see
 * class-declaration-parser.ts's `applyClassifierDecl`, which always creates
 * scope-local). An `object` reference therefore reuses an ALREADY-CREATED
 * entity of the same unique name from anywhere in the diagram — including
 * one auto-created as a relationship endpoint (`A --> foo` then `object
 * foo`) — exactly like a relationship endpoint would.
 *
 * Upstream then errors ("Object already exists") when the resolved quark
 * already carries entity data — this fires for BOTH a genuine
 * re-declaration and the auto-created-endpoint case above, since both leave
 * `quark.getData() != null`. This parser has no error-reporting channel for
 * command execution (no site in class-commands.ts surfaces diagnostics —
 * see class-lollipop.ts's `applyLollipop` doc for the same gap), so the
 * observable behavior is a silent no-op: an existing classifier is left
 * completely untouched by a re-declaration, unlike `applyClassifierDecl`
 * (class/interface/…), which always re-applies fields on redeclaration.
 *
 * The resolved id is computed via `resolveReference` (the same helper
 * `ensureClassifier` uses internally) BEFORE calling `ensureClassifier`,
 * because `ensureClassifier`'s return value alone cannot distinguish
 * "found existing" from "just created" — the duplicate check needs that
 * distinction, `ensureClassifier` does not expose it.
 */
function applyObjectDecl(state: ParseState, match: RegExpExecArray): void {
  const { rawId, rawDisplay, stereotype, color } = parseObjectMatch(match);

  const { id } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: rawId,
    display: rawDisplay,
    intermediatePackages: state.intermediatePackages,
    classifiers: state.ast.classifiers,
    reuseExistingChild: true,
  });
  if (state.classifierIndex.has(id)) return; // "Object already exists" — no-op

  const classifier = ensureClassifier(state, rawId, 'object', rawDisplay, true);
  if (stereotype !== undefined) classifier.stereotype = stereotype;
  if (color !== undefined) classifier.color = color;
}

/**
 * Open an `object ... {` body (`CommandCreateEntityObjectMultilines`):
 * resolve/create the entity — `entity == null` -> `reallyCreateLeaf(...,
 * LeafType.OBJECT, ...)`, else the EXISTING entity is reused untouched
 * (`ensureClassifier` never mutates `kind` on an already-registered
 * classifier) — then apply stereotype/color UNCONDITIONALLY (unlike the
 * single-line form's duplicate no-op above, upstream's `executeArg0` sets
 * both on whichever entity results either way), and arm `pendingBodyId` so
 * subsequent lines collect as object fields until the closing `}`.
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObjectMultilines.java:152-177
 */
function applyObjectMultilineOpen(state: ParseState, match: RegExpExecArray): void {
  const { rawId, rawDisplay, stereotype, color } = parseObjectMatch(match);
  const classifier = ensureClassifier(state, rawId, 'object', rawDisplay, true);
  if (stereotype !== undefined) classifier.stereotype = stereotype;
  if (color !== undefined) classifier.color = color;
  state.pendingBodyId = classifier.id;
}

/**
 * Parse one `object { ... }` body line, or a post-hoc `X : field` line whose
 * target is an already-`object`-kind classifier (rule 6-pre in
 * class-commands.ts). Mirrors upstream's `Bodier` field deduction for object
 * entities: `name = value` -> a member with `type` set to the raw
 * right-hand side; a bare `name` -> a member with no type. Any other line
 * (e.g. a `--` separator row) is dropped — this matches the class engine's
 * existing behavior for unparseable body lines (`parseMemberLine` returning
 * null in `handlePendingBodyLine`), not a new divergence introduced here.
 *
 * Replicated from (not imported from — the object plugin is deleted in T5)
 * `src/diagrams/object/parser.ts`'s `parseField`.
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObjectMultilines.java:147
 * @see ~/git/plantuml/.../classdiagram/command/CommandAddMethod.java:97
 */
export function parseObjectField(rawLine: string): Member | null {
  const line = rawLine.trim();
  const eqMatch = /^(\w+)\s*=\s*(.+)$/.exec(line);
  if (eqMatch !== null) {
    return {
      visibility: '+',
      name: eqMatch[1]!,
      type: eqMatch[2]!.trim(),
      isStatic: false,
      isAbstract: false,
    };
  }
  const nameOnly = /^(\w+)$/.exec(line);
  if (nameOnly !== null) {
    return { visibility: '+', name: nameOnly[1]!, isStatic: false, isAbstract: false };
  }
  return null;
}

/**
 * Object commands, spread into `COMMANDS` (class-commands.ts) immediately
 * after the classifier-declaration entry — mirrors upstream
 * `ClassDiagramFactory.initCommandsList`'s registration order:
 * `CommandCreateClassMultilines`/`CommandCreateClass` (115/120) bracket
 * `CommandCreateEntityObjectMultilines` (116) then `CommandCreateEntityObject`
 * (121); the multi-line object form is listed first here to preserve that
 * multilines-before-single relative order (the two never collide: the
 * single-line pattern excludes a trailing `{`, the multi-line one requires
 * it).
 */
export const OBJECT_COMMANDS: readonly Command[] = [
  { pattern: OBJECT_MULTILINE_DECL_RE, execute: applyObjectMultilineOpen },
  { pattern: OBJECT_DECL_RE, execute: applyObjectDecl },
];
