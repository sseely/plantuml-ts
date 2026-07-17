/**
 * The standalone `url [of|for] <Code> [is] [[url]]` statement — attaches a
 * url to an already-declared classifier (`classdiagram/command/
 * CommandUrl.java`). Split out of `class-commands.ts` (500-line cap) and
 * `class-url.ts` (that module is pure grammar, no `ParseState` — mirrors
 * `class-notes.ts` vs `class-commands.ts`'s existing split).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandUrl.java
 */
import { resolveReference } from './class-namespace.js';
import { stripQuotes } from './class-relationship-parser.js';
import { parseUrlBracket } from './class-url.js';
import type { ParseState } from './parser.js';

/**
 * `url [of|for] <Code> [is] [[...]]` (`CommandUrl.java:62-75`). `CODE` is
 * either a bare `[%pLN_.]+` token or a quoted string; `of`/`for` and `is`
 * are both optional keywords.
 */
export const URL_STATEMENT_RE = new RegExp(
  String.raw`^url\s*(?:of|for)?\s+(\w[\w.]*|"[^"]+")\s+(?:is\s*)?(\[\[[^\]]*\]\])$`,
  'i',
);

/**
 * Resolves `rawCode` to an EXISTING classifier (read-only — unlike
 * `ensureClassifier`, never auto-creates: `CommandUrl.java`'s own
 * `quark.getData() == null` branch errors rather than creating a phantom
 * entity, and this port's silent-no-op posture for that case must still
 * not draw a node the diagram never declared) and, if found, sets its
 * `url` field from the parsed `[[...]]` bracket. No-ops (does not mutate
 * `state.ast.namespaces`) when `rawCode` doesn't resolve to a known
 * classifier — `resolveReference`'s own intermediate-namespace-creation
 * side effect only fires for a dotted qualifier that resolves to a REAL
 * namespace chain, the same shared code path relationship endpoints and
 * `class-json-commands.ts#applyJsonOpen` already exercise.
 */
export function applyUrlStatement(state: ParseState, rawCode: string, bracket: string): void {
  const url = parseUrlBracket(bracket);
  if (url === undefined) return;

  const { id } = resolveReference({
    namespaces: state.ast.namespaces,
    sep: state.namespaceSeparator,
    activeNamespace: state.activeNamespace,
    name: stripQuotes(rawCode),
    display: undefined,
    intermediatePackages: state.intermediatePackages,
    classifiers: state.ast.classifiers,
    reuseExistingChild: true,
  });
  const idx = state.classifierIndex.get(id);
  if (idx === undefined) return;
  state.ast.classifiers[idx]!.url = url;
}
