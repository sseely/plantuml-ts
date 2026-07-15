/**
 * CommandCreoleColorChange — `<color:name-or-hex>text</color>` and the EOL
 * (no closing tag) form.
 *
 * Upstream: klimt/creole/command/CommandCreoleColorChange.java, built on
 * `Splitter.fontColorPattern` (`\<color[\s:]+(#[0-9a-fA-F]{1,6}|#?\w+)[%s]*\>`).
 * Color resolution goes through G1c's `HColorSet.ts#parseSimpleColor` (the
 * mission's "one resolver, no new tables" constraint) — mirrors upstream's
 * own try/catch-and-ignore semantics: an unresolvable token (`NoSuchColor
 * Exception` upstream) leaves the font configuration UNCHANGED (not a
 * fallback color), then still recurses into the captured inner text.
 */
import type { FontConfiguration } from '../../shape/UText.js';
import type { Command, StripeBuilder } from './Command.js';
import { parseSimpleColor, toSvgHex } from '../../color/HColorSet.js';

interface ColorMatch {
  readonly fullLength: number;
  readonly colorToken: string;
  readonly inner: string;
}

// `Splitter.fontColorPattern`, ported as a source string (never a regex
// literal — the `<`/`>` complexity-hook workaround).
const COLOR_TAG_SOURCE = '<color[\\s\\u00A0:]+(#[0-9a-fA-F]{1,6}|#?\\w+)[\\s\\u00A0]*>';

function matchColorBracketed(line: string, pos: number): ColorMatch | null {
  const re = new RegExp('^' + COLOR_TAG_SOURCE + '(.*?)</color>');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { fullLength: m[0].length, colorToken: m[1]!, inner: m[2]! };
}

function matchColorEol(line: string, pos: number): ColorMatch | null {
  const re = new RegExp('^' + COLOR_TAG_SOURCE + '(.*)$');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { fullLength: m[0].length, colorToken: m[1]!, inner: m[2]! };
}

function applyColorAndRecurse(colorToken: string, inner: string, stripe: StripeBuilder): void {
  const saved: FontConfiguration = stripe.getActualFontConfiguration();
  const resolved = parseSimpleColor(colorToken);
  if (resolved !== undefined) {
    stripe.setActualFontConfiguration({ ...saved, color: toSvgHex(resolved) });
  }
  stripe.analyzeAndAddInline(inner);
  stripe.setActualFontConfiguration(saved);
}

function createForm(matcher: (line: string, pos: number) => ColorMatch | null): Command {
  return {
    starters: ['<c'],
    matchingSize(line, pos) {
      const m = matcher(line, pos);
      return m === null ? 0 : m.fullLength;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matcher(line, pos);
      if (m === null) return 0;
      applyColorAndRecurse(m.colorToken, m.inner, stripe);
      return m.fullLength;
    },
  };
}

/** Upstream: `CommandCreoleColorChange.create()`/`createEol()`. */
export function createColorChangeCommands(): readonly Command[] {
  return [createForm(matchColorBracketed), createForm(matchColorEol)];
}
