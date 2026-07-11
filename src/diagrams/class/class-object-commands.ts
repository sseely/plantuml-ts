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
 * bare `field` / any other raw line, see {@link parseObjectField}'s doc) are
 * collected via `parser.ts#pendingBodyId`, the same mechanism `class X { ... }`
 * bodies use, but routed to {@link parseObjectField} instead of
 * `parseMemberLine` whenever the target classifier's `kind` is `'object'`
 * (see parser.ts#handlePendingBodyLine and class-commands.ts's rule 6-pre
 * `X : field` command).
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

import type { Member, Visibility } from './ast.js';
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

/** `StereotypePattern.optional("STEREO")` — `<< stereotype >>`. Lazy `.+?`
 *  (not `[^<>]+?`): upstream's lazy group, composed into ONE anchored line
 *  regex, backtracks across stacked stereotypes so `<<Bar>> <<Foo>>`
 *  captures `Bar>> <<Foo` as one blob — same behavior the class-declaration
 *  path replicates (extractDecorations, gabejo-44-juki791). `[^<>]` cannot
 *  span the inner `>> <<` and dropped the whole declaration
 *  (fafozi-27-reja300). */
const STEREO = '(?:\\s*<<\\s*(.+?)\\s*>>)?';

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

// ---------------------------------------------------------------------------
// Object body-line parsing (Bodier field deduction)
// ---------------------------------------------------------------------------

/** `VisibilityModifier.regexForVisibilityCharacter()`'s char class. */
const VISIBILITY_CHARS = new Set<string>(['-', '#', '+', '~', '*']);

/**
 * `VisibilityModifier.isVisibilityCharacter`: a leading visibility char is
 * recognized only when the (already-trimmed) line is longer than 2 chars,
 * starts with one of `-#+~*`, and its second char DIFFERS from the first —
 * the second-char guard is what excludes a `--`/`==` block-separator line
 * and a `**bold**` creole run (donoki-79-riku189's `** ASub item`, whose two
 * leading `*` are identical) from being misread as a visibility marker.
 * @see ~/git/plantuml/.../skin/VisibilityModifier.java#isVisibilityCharacter
 */
function detectVisibilityChar(line: string): Visibility | undefined {
  if (line.length <= 2) return undefined;
  const c = line.charAt(0);
  if (line.charAt(1) === c) return undefined;
  return VISIBILITY_CHARS.has(c) ? (c as Visibility) : undefined;
}

/**
 * `BodyEnhancedAbstract#isBlockSeparator`: a `--`/`==`/`__` run bracketing
 * both ends of the line, or a `..` run that isn't exactly `...`. Upstream
 * uses a separator line to split an object body into multiple titled
 * `MethodsOrFieldsArea` blocks (`BodyEnhanced1#getArea`) — that multi-block
 * splitting is NOT ported here (no fixture in this task's scope needs it;
 * an object body renders as a single member-rows block). Rather than show a
 * literal `"--"` text row (a clear visual regression from the pre-existing
 * silent drop), a recognized separator line is still dropped — matching
 * this parser's prior conservative behavior for a line it cannot structure.
 * @see ~/git/plantuml/.../cucadiagram/BodyEnhancedAbstract.java#isBlockSeparator
 */
function isBlockSeparatorLine(line: string): boolean {
  if (line.startsWith('--') && line.endsWith('--')) return true;
  if (line.startsWith('==') && line.endsWith('==')) return true;
  if (line.startsWith('..') && line.endsWith('..') && line !== '...') return true;
  if (line.startsWith('__') && line.endsWith('__')) return true;
  return false;
}

/** Attach `visibilityExplicit: true` only when an explicit char was
 *  detected — omitted (not `false`) otherwise, so member-literal equality
 *  assertions written before this field existed keep passing (vitest's
 *  `toEqual` treats a missing key and an `undefined`-valued key the same,
 *  but NOT a missing key and a `false`-valued key). */
function withVisibilityFlag(member: Omit<Member, 'visibilityExplicit'>, explicit: boolean): Member {
  return explicit ? { ...member, visibilityExplicit: true } : member;
}

/**
 * Try the two structured object-field shapes — `name = value` (type set to
 * the raw right-hand side) or a bare `name` (no type) — against the
 * (visibility-stripped) remainder. Kept as its own function purely so
 * {@link parseObjectField} stays under the project's per-function NLOC/CCN
 * cap; the two shapes exist for backward-compatible `.name`/`.type` access
 * and exact "name = value" display reconstruction (formatObjectMemberText).
 * Returns `undefined` (not `null`, to distinguish from the field-level
 * `Member | null` return type) when neither shape matches — the caller
 * falls back to a raw display row (Bodier never rejects a line).
 */
function tryStructuredObjectMember(
  remainder: string,
  visibility: Visibility | undefined,
): Omit<Member, 'visibilityExplicit'> | undefined {
  const eqMatch = /^(\w+)\s*=\s*(.+)$/.exec(remainder);
  if (eqMatch !== null) {
    return {
      visibility: visibility ?? '+',
      name: eqMatch[1]!,
      type: eqMatch[2]!.trim(),
      isStatic: false,
      isAbstract: false,
    };
  }
  const nameOnly = /^(\w+)$/.exec(remainder);
  if (nameOnly !== null) {
    return { visibility: visibility ?? '+', name: nameOnly[1]!, isStatic: false, isAbstract: false };
  }
  return undefined;
}

/**
 * Parse one `object { ... }` body line, or a post-hoc `X : field` line whose
 * target is an already-`object`-kind classifier (rule 6-pre in
 * class-commands.ts).
 *
 * Mirrors upstream's actual field deduction end-to-end:
 * `BodierLikeClassOrObject#addFieldOrMethod` NEVER rejects a raw line (blank
 * lines are the sole exception — upstream's `lines.trim().removeEmptyLines()`
 * strips them before `executeNow` ever sees them), and `Member`'s
 * constructor strips a leading visibility char off ANY line before display
 * (`VisibilityModifier.isVisibilityCharacter`), independent of whether the
 * remainder happens to look like `name = value` or a bare `name`. This
 * function therefore: drops a blank/separator line; strips a leading
 * visibility char if present ({@link detectVisibilityChar}); tries the two
 * structured shapes on the remainder ({@link tryStructuredObjectMember});
 * and — since upstream never rejects a line — falls back to a raw, verbatim
 * `Member.rawDisplay` row for everything else (e.g. nukera-08-dige359's
 * `-String toto = "hello"`, donoki-79-riku189's `* ABullet list`).
 *
 * Replicated from (not imported from — the object plugin is deleted in T5)
 * `src/diagrams/object/parser.ts`'s `parseField`.
 * @see ~/git/plantuml/.../cucadiagram/Member.java (constructor)
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObjectMultilines.java:147
 * @see ~/git/plantuml/.../classdiagram/command/CommandAddMethod.java:97
 */
export function parseObjectField(rawLine: string): Member | null {
  const line = rawLine.trim();
  if (line === '' || isBlockSeparatorLine(line)) return null;

  const visibility = detectVisibilityChar(line);
  const explicit = visibility !== undefined;
  const remainder = explicit ? line.slice(1).trim() : line;

  const structured = tryStructuredObjectMember(remainder, visibility);
  if (structured !== undefined) return withVisibilityFlag(structured, explicit);

  // Bodier never rejects a line: whatever remains becomes a raw display row.
  return withVisibilityFlag(
    {
      visibility: visibility ?? '+',
      name: remainder,
      rawDisplay: remainder,
      isStatic: false,
      isAbstract: false,
    },
    explicit,
  );
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
