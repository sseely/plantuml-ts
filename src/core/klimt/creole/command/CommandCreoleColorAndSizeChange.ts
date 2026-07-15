/**
 * CommandCreoleColorAndSizeChange — `<font size=N color=X>text</font>` and
 * the EOL (no closing tag) form; `size=`/`color=` attrs may appear in
 * either order, and either may be omitted (but at least one must be
 * present — a bare `<font ...>` with neither is `CommandCreoleFontFamily
 * Change`'s territory, disambiguated by registration order below).
 *
 * Upstream: klimt/creole/command/CommandCreoleColorAndSizeChange.java, built
 * on its own LOCAL `fontPattern` constant (distinct from `Splitter
 * .fontPattern`) — `\<font(?:[%s]+size[%s]*=[%s]*[%g]?(\d+)[%g]?|[%s]+
 * color[%s]*=[%s]*[%g]?(#[0-9a-fA-F]{6}|\w+)[%g]?)+[%s]*\>`. Color
 * resolution via G1c's `HColorSet.ts#parseSimpleColor`.
 *
 * Attrs are extracted with TWO SEPARATE single-shot regexes against the
 * matched tag text, rather than upstream's single alternation-with-two-
 * capture-groups pattern (this task's own finding, reported): JavaScript
 * resets a capturing group to `undefined` whenever the LAST repetition of
 * its enclosing `(?:...)+ ` quantified group did not take that group's
 * branch (`/(?:a(\d)|b(\d))+/.exec('b1a2')` -> group 2 is `undefined`,
 * even though "b1" matched earlier) — unlike Java's `Matcher`, which upstream
 * relies on to retain both groups regardless of which alternative matched
 * LAST. Splitting into two independent lookups sidesteps that engine
 * difference entirely and is observably identical for every valid input.
 */
import type { FontConfiguration } from '../../shape/UText.js';
import type { Command, StripeBuilder } from './Command.js';
import { parseSimpleColor, toSvgHex } from '../../color/HColorSet.js';

interface ColorSizeMatch {
  readonly fullLength: number;
  readonly size?: number;
  readonly colorToken?: string;
  readonly inner: string;
}

// `%g` (Pattern2's quote-char class): straight, left-curly, right-curly
// quote. `%s`: whitespace or NBSP.
const QUOTE = '[\x22“”]?';
const WS = '[\\s\\u00A0]';
const ONE_ATTR_SOURCE = '(?:' + WS + '+size' + WS + '*=' + WS + '*' + QUOTE + '\\d+' + QUOTE + '|' + WS + '+color' + WS + '*=' + WS + '*' + QUOTE + '(?:#[0-9a-fA-F]{6}|\\w+)' + QUOTE + ')';
const FONT_TAG_SOURCE = '<font' + ONE_ATTR_SOURCE + '+' + WS + '*>';

const SIZE_ATTR_SOURCE = 'size' + WS + '*=' + WS + '*' + QUOTE + '(\\d+)' + QUOTE;
const COLOR_ATTR_SOURCE = 'color' + WS + '*=' + WS + '*' + QUOTE + '(#[0-9a-fA-F]{6}|\\w+)' + QUOTE;

function extractAttrs(tag: string): { size?: number; colorToken?: string } {
  const sizeM = new RegExp(SIZE_ATTR_SOURCE).exec(tag);
  const colorM = new RegExp(COLOR_ATTR_SOURCE).exec(tag);
  const size = sizeM === null ? undefined : Number(sizeM[1]);
  const colorToken = colorM === null ? undefined : colorM[1];
  if (size !== undefined && colorToken !== undefined) return { size, colorToken };
  if (size !== undefined) return { size };
  if (colorToken !== undefined) return { colorToken };
  return {};
}

function buildMatch(tag: string, inner: string): ColorSizeMatch {
  return { fullLength: tag.length + inner.length, inner, ...extractAttrs(tag) };
}

function matchBracketed(line: string, pos: number): ColorSizeMatch | null {
  const re = new RegExp('^(' + FONT_TAG_SOURCE + ')(.*?)</font>');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { ...buildMatch(m[1]!, m[2]!), fullLength: m[0].length };
}

function matchEol(line: string, pos: number): ColorSizeMatch | null {
  const re = new RegExp('^(' + FONT_TAG_SOURCE + ')(.*)$');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { ...buildMatch(m[1]!, m[2]!), fullLength: m[0].length };
}

function applyAndRecurse(match: ColorSizeMatch, stripe: StripeBuilder): void {
  const saved: FontConfiguration = stripe.getActualFontConfiguration();
  let next: FontConfiguration = saved;
  if (match.size !== undefined) next = { ...next, size: match.size };
  if (match.colorToken !== undefined) {
    const resolved = parseSimpleColor(match.colorToken);
    if (resolved !== undefined) next = { ...next, color: toSvgHex(resolved) };
  }
  stripe.setActualFontConfiguration(next);
  stripe.analyzeAndAddInline(match.inner);
  stripe.setActualFontConfiguration(saved);
}

function createForm(matcher: (line: string, pos: number) => ColorSizeMatch | null): Command {
  return {
    starters: ['<f'],
    matchingSize(line, pos) {
      const m = matcher(line, pos);
      return m === null ? 0 : m.fullLength;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matcher(line, pos);
      if (m === null) return 0;
      applyAndRecurse(m, stripe);
      return m.fullLength;
    },
  };
}

/** Upstream: `CommandCreoleColorAndSizeChange.create()`/`createEol()`. */
export function createColorAndSizeChangeCommands(): readonly Command[] {
  return [createForm(matchBracketed), createForm(matchEol)];
}
