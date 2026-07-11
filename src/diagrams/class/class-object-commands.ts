/**
 * `object` declaration command for the class diagram parser.
 *
 * Upstream has NO separate object-diagram engine: `ClassDiagramFactory`
 * registers `CommandCreateEntityObject` directly, alongside the class
 * commands, on the SAME `AbstractClassOrObjectDiagram`. Object diagrams are
 * class diagrams with a different vocabulary of leaf-creation commands, not a
 * distinct diagram type — this module ports that one command into the class
 * engine's dispatch table (mission: object-dot-sync, absorb object into class
 * engine).
 *
 * Single-line only (`CommandCreateEntityObject` extends `SingleLineCommand2`).
 * The multi-line body form (`object foo { field = value }`,
 * `CommandCreateEntityObjectMultilines`) is a SEPARATE upstream command,
 * ported by a later task — this module's regex must not match a line ending
 * in `{`, so it is left for that command to claim.
 *
 * Split into its own module (mirrors class-container.ts / class-lollipop.ts's
 * precedent for a synthesising command) to keep class-commands.ts under the
 * repo's 500-line-per-file cap.
 *
 * @see ~/git/plantuml/.../objectdiagram/command/CommandCreateEntityObject.java
 * @see ~/git/plantuml/.../command/NameAndCodeParser.java (nameAndCode())
 * @see ~/git/plantuml/.../objectdiagram/ClassDiagramFactory.java (registration)
 */

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
 * line. Exactly one of the CODE groups (2/3/5/6) or DISPLAY-only groups
 * (1/4, quoted-code-only form has no separate display) is set on any
 * successful match — the `!` below reflects that regex-guaranteed invariant,
 * not a runtime fallback.
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
 * Single-entry command array, spread into `COMMANDS` (class-commands.ts)
 * immediately after the classifier-declaration entry — mirrors upstream
 * `ClassDiagramFactory.initCommandsList`'s registration order:
 * `CommandCreateClass` (114/120) then `CommandCreateEntityObject` (121).
 */
export const OBJECT_COMMANDS: readonly Command[] = [
  { pattern: OBJECT_DECL_RE, execute: applyObjectDecl },
];
