/**
 * The standalone `<Name> <<stereotype>>` statement — sets the stereotype of
 * an ALREADY-DECLARED classifier (upstream `CommandStereotype`, G2 N24).
 * Split out of `class-commands.ts` (500-line cap) — mirrors
 * `class-url-command.ts`'s identical "resolve an existing classifier,
 * no-op if missing" shape for the sibling `url of X is [[...]]` statement.
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandStereotype.java
 */
import { resolveReference } from './class-namespace.js';
import { stripQuotes } from './class-relationship-parser.js';
import type { ParseState } from './parser.js';

/**
 * `NAME <<STEREO>>` (`CommandStereotype.java:62-69`). `NAME` is a bare
 * `[%pLN_.]+` token or a quoted string; `STEREO` is a mandatory `<<...>>`
 * bracket with no other trailing content (distinguishes this from a
 * `class`/`enum`/... DECLARATION line, which requires a leading type
 * keyword this pattern has none of, and from `hide|show [<<pattern>>]
 * stereotype(s)`, which requires that literal leading keyword).
 */
export const STEREOTYPE_STATEMENT_RE = /^(\w[\w.]*|"[^"]+")\s+(<<.*>>)\s*$/;

/**
 * Resolves `rawName` to an EXISTING classifier (read-only — never
 * auto-creates, matching upstream's `entity == null` error branch and this
 * port's `applyUrlStatement`'s identical no-op-when-missing posture) and,
 * if found, sets its `stereotype` field from the bracket's inner text
 * (brackets stripped, trimmed — matches `Classifier.stereotype`'s existing
 * storage convention for the inline-declaration form,
 * `class-declaration-parser.ts#extractDecorations`'s own doc comment).
 */
export function applyStereotypeStatement(state: ParseState, rawName: string, bracket: string): void {
  const { id } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: stripQuotes(rawName),
    display: undefined,
    intermediatePackages: state.intermediatePackages,
    classifiers: state.ast.classifiers,
    reuseExistingChild: true,
  });
  const idx = state.classifierIndex.get(id);
  if (idx === undefined) return;
  state.ast.classifiers[idx]!.stereotype = bracket.slice(2, -2).trim();
}
