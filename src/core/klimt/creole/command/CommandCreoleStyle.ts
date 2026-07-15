/**
 * CommandCreoleStyle — the BOLD/ITALIC/UNDERLINE/STRIKE/WAVE inline style
 * commands: `**text**`/`//text//`/`__text__`/`--text--`/`~~text~~` (pure
 * Creole double-punctuation) and `<b>text</b>`/`<b>text to end of line`
 * (HTML-tag-style, with or without a closing tag).
 *
 * Upstream: klimt/creole/command/CommandCreoleStyle.java — three factories
 * (`createCreole`/`createLegacy`/`createLegacyEol`), each building a
 * `com.plantuml.ubrex.UnicodeBracketedExpression` (a whole bespoke
 * bracketed-regex DSL/engine — `com/plantuml/ubrex/*`, ~30 files) from a
 * `FontStyle`'s `getUbrexCreoleSyntax`/`getUbrexActivationPattern`/
 * `getUbrexDeactivationPattern` strings, then matching/capturing through it.
 *
 * Scope decision (journaled, `plans/e2r-creole/decision-journal.md`):
 * `com.plantuml.ubrex` is a general-purpose pattern-matching ENGINE, not
 * creole-specific logic — porting it symbol-for-symbol (its own
 * Challenge/Repetition/CharClass/LookAround hierarchy) is out of this
 * mission's charter the same way graphviz-ts is out of E2r's charter (a
 * foundational dependency, not diagram behavior). This file instead
 * implements the exact OBSERABLE match semantics the three factories
 * produce for L1's five styles directly:
 * - creole form: literal syntax token, then the SHORTEST (lazy) run of 1+
 *   chars up to the next occurrence of the same token (upstream:
 *   `ChallengeOneOrMoreUpToOldVersion` — verified via
 *   `ubrex/ChallengeOneOrMoreUpToOldVersion.java`'s `runChallenge`: advance
 *   one origin-match at a time, testing the end pattern after each).
 * - legacy form: an activation tag, then the shortest (lazy) run of 0+ chars
 *   up to a deactivation tag (upstream: `ChallengeUpTo` — zero-or-more,
 *   unlike the creole form's one-or-more; `ChallengeUpTo.runChallenge`
 *   scans one character forward at a time testing the end pattern, and can
 *   accept a zero-length match immediately).
 * - legacyEol form: an activation tag, then 1+ chars (greedy — upstream:
 *   `ChallengeOneOrMore`) to the end of the line, no closing tag needed.
 *
 * `matchingSize`/`executeAndAdvance` are two separate upstream calls that
 * each independently re-run the ubrex match (`CommandCreoleStyle.java`'s own
 * shape) — this port keeps that same two-call shape (`match()` invoked once
 * per method) rather than caching, matching upstream's actual
 * cost/simplicity trade-off for what are always short (one display line)
 * strings.
 *
 * L1 does not model the `<u:color>`/`<w:color>`/`<s:color>`/`<strike:color>`
 * colon-suffixed EXTENDED-COLOR activation variant (mission brief NOT-in-
 * scope list's `<u:>` entry) — `ACTIVATION_SOURCE`/`DEACTIVATION_SOURCE`
 * below match ONLY the bare `<u>`/`<w>`/`<s>` forms, so a colon-suffixed tag
 * falls through unrecognized (unchanged from pre-L1 behavior — no
 * regression, no new partial support of an explicitly out-of-scope tag).
 */
import { FontStyle, type FontConfiguration } from '../../shape/UText.js';
import type { Command, StripeBuilder } from './Command.js';
import { addFontStyle } from './AddStyle.js';

interface MatchResult {
  readonly fullLength: number;
  readonly inner: string;
}

/** Creole form: literal `syntax` + shortest 1+-char run up to the NEXT
 *  occurrence of `syntax` (upstream: `ChallengeOneOrMoreUpToOldVersion`). */
function matchCreole(syntax: string, line: string, pos: number): MatchResult | null {
  if (line.slice(pos, pos + syntax.length) !== syntax) return null;
  const afterOpen = pos + syntax.length;
  const closeIdx = line.indexOf(syntax, afterOpen + 1);
  if (closeIdx === -1) return null;
  return { inner: line.slice(afterOpen, closeIdx), fullLength: closeIdx + syntax.length - pos };
}

/** Legacy form: `activation` + shortest 0+-char run up to `deactivation`
 *  (upstream: `ChallengeUpTo`). */
function matchLegacy(activation: RegExp, deactivation: RegExp, line: string, pos: number): MatchResult | null {
  const openMatch = activation.exec(line.slice(pos));
  if (openMatch === null || openMatch.index !== 0) return null;
  const afterOpen = pos + openMatch[0].length;
  for (let i = afterOpen; i <= line.length; i++) {
    const closeMatch = deactivation.exec(line.slice(i));
    if (closeMatch !== null && closeMatch.index === 0) {
      return { inner: line.slice(afterOpen, i), fullLength: i + closeMatch[0].length - pos };
    }
  }
  return null;
}

/** LegacyEol form: `activation` + 1+ chars to end of line, greedy, no
 *  closing tag (upstream: `ChallengeOneOrMore`). */
function matchLegacyEol(activation: RegExp, line: string, pos: number): MatchResult | null {
  const openMatch = activation.exec(line.slice(pos));
  if (openMatch === null || openMatch.index !== 0) return null;
  const afterOpen = pos + openMatch[0].length;
  if (afterOpen >= line.length) return null;
  return { inner: line.slice(afterOpen), fullLength: line.length - pos };
}

function applyStyleAndRecurse(style: FontStyle, inner: string, stripe: StripeBuilder): void {
  const saved: FontConfiguration = stripe.getActualFontConfiguration();
  stripe.setActualFontConfiguration(addFontStyle(saved, style));
  stripe.analyzeAndAddInline(inner);
  stripe.setActualFontConfiguration(saved);
}

/** Upstream: `FontStyle#getUbrexCreoleSyntax` — the pure-Creole
 *  double-punctuation token per style. `undefined` styles (none, for L1's
 *  five) would mean "no creole-pure form"; every L1 style has one. */
const CREOLE_SYNTAX: Partial<Record<FontStyle, string>> = {
  [FontStyle.BOLD]: '**',
  [FontStyle.ITALIC]: '//',
  [FontStyle.UNDERLINE]: '__',
  [FontStyle.STRIKE]: '--',
  [FontStyle.WAVE]: '~~',
};

/** Upstream: `FontStyle#getUbrexActivationPattern`/`getUbrexDeactivationPattern`
 *  (bare-tag branches only — no extended-color suffix, see module doc
 *  comment). Regex SOURCE strings (not literals) per this project's
 *  complexity-hook workaround for `<`/`>` in a pattern. */
const ACTIVATION_SOURCE: Record<string, string> = {
  [FontStyle.BOLD]: '^<[bB]>',
  [FontStyle.ITALIC]: '^<[iI]>',
  [FontStyle.UNDERLINE]: '^<[uU]>',
  [FontStyle.STRIKE]: '^<(?:strike|STRIKE|s|S|del|DEL)>',
  [FontStyle.WAVE]: '^<[wW]>',
};

const DEACTIVATION_SOURCE: Record<string, string> = {
  [FontStyle.BOLD]: '^</[bB]>',
  [FontStyle.ITALIC]: '^</[iI]>',
  [FontStyle.UNDERLINE]: '^</[uU]>',
  [FontStyle.STRIKE]: '^</(?:strike|STRIKE|s|S|del|DEL)>',
  [FontStyle.WAVE]: '^</[wW]>',
};

/** Upstream: `FontStyle#starters(isCreolePure)`, the `false` (legacy)
 *  branch. Ported VERBATIM, including WAVE's own single-case asymmetry
 *  (`Arrays.asList("<w")` — no `"<W"` entry, even though the activation
 *  pattern itself matches both cases) — see this project's porting
 *  discipline: preserve upstream's exact starter list, not a "corrected"
 *  one. */
const LEGACY_STARTERS: Record<string, readonly string[]> = {
  [FontStyle.BOLD]: ['<b', '<B'],
  [FontStyle.ITALIC]: ['<i', '<I'],
  [FontStyle.UNDERLINE]: ['<u', '<U'],
  [FontStyle.STRIKE]: ['<s', '<S', '<d', '<D'],
  [FontStyle.WAVE]: ['<w'],
};

function createCreoleForm(style: FontStyle): Command {
  const syntax = CREOLE_SYNTAX[style];
  if (syntax === undefined) throw new Error(`CommandCreoleStyle: no creole-pure syntax for ${style}`);
  return {
    starters: [syntax],
    matchingSize(line, pos) {
      const m = matchCreole(syntax, line, pos);
      return m === null ? 0 : m.inner.length;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matchCreole(syntax, line, pos);
      if (m === null) return 0;
      applyStyleAndRecurse(style, m.inner, stripe);
      return m.fullLength;
    },
  };
}

function createLegacyForm(style: FontStyle): Command {
  const activation = new RegExp(ACTIVATION_SOURCE[style]!);
  const deactivation = new RegExp(DEACTIVATION_SOURCE[style]!);
  return {
    starters: LEGACY_STARTERS[style]!,
    matchingSize(line, pos) {
      const m = matchLegacy(activation, deactivation, line, pos);
      return m === null ? 0 : m.inner.length;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matchLegacy(activation, deactivation, line, pos);
      if (m === null) return 0;
      applyStyleAndRecurse(style, m.inner, stripe);
      return m.fullLength;
    },
  };
}

function createLegacyEolForm(style: FontStyle): Command {
  const activation = new RegExp(ACTIVATION_SOURCE[style]!);
  return {
    starters: LEGACY_STARTERS[style]!,
    matchingSize(line, pos) {
      const m = matchLegacyEol(activation, line, pos);
      return m === null ? 0 : m.inner.length;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matchLegacyEol(activation, line, pos);
      if (m === null) return 0;
      applyStyleAndRecurse(style, m.inner, stripe);
      return m.fullLength;
    },
  };
}

/** Upstream: `CommandCreoleBuilder`'s per-style `addCommand` triplet
 *  (`createCreole`, `createLegacy`, `createLegacyEol`). Returns all three
 *  Commands for one style, in upstream's exact registration order (matters
 *  for `searchCommand`'s "first match wins" tie-break among Commands
 *  sharing a 2-char starter — see `legacy/StripeSimple.ts`). */
export function createStyleCommands(style: FontStyle): readonly Command[] {
  return [createCreoleForm(style), createLegacyForm(style), createLegacyEolForm(style)];
}
