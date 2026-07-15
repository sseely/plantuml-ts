/**
 * CommandCreoleFontFamilyChange — `<font:FamilyName>text</font>` / `<font
 * FamilyName>text</font>` and the EOL (no closing tag) form. Registered
 * AFTER `CommandCreoleColorAndSizeChange` (same `<f` starter — see
 * `CommandCreoleBuilder.ts`'s registration order): a `<font ...>` tag with
 * `size=`/`color=` attrs is claimed by that command first; this one only
 * ever sees a bare family-name form, matching upstream's own ctor order.
 *
 * Upstream: klimt/creole/command/CommandCreoleFontFamilyChange.java, built
 * on `Splitter.fontFamilyPattern` (`\<font[\s:]+([^>]+)/?\>`).
 */
import type { FontConfiguration } from '../../shape/UText.js';
import type { Command, StripeBuilder } from './Command.js';

interface FamilyMatch {
  readonly fullLength: number;
  readonly family: string;
  readonly inner: string;
}

// `Splitter.fontFamilyPattern`, ported as a source string.
const FONT_FAMILY_TAG_SOURCE = '<font[\\s\\u00A0:]+([^>]+)/?>';

function matchBracketed(line: string, pos: number): FamilyMatch | null {
  const re = new RegExp('^' + FONT_FAMILY_TAG_SOURCE + '(.*?)</font>');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { fullLength: m[0].length, family: m[1]!, inner: m[2]! };
}

function matchEol(line: string, pos: number): FamilyMatch | null {
  const re = new RegExp('^' + FONT_FAMILY_TAG_SOURCE + '(.*)$');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { fullLength: m[0].length, family: m[1]!, inner: m[2]! };
}

function applyAndRecurse(family: string, inner: string, stripe: StripeBuilder): void {
  const saved: FontConfiguration = stripe.getActualFontConfiguration();
  stripe.setActualFontConfiguration({ ...saved, family });
  stripe.analyzeAndAddInline(inner);
  stripe.setActualFontConfiguration(saved);
}

function createForm(matcher: (line: string, pos: number) => FamilyMatch | null): Command {
  return {
    starters: ['<f'],
    matchingSize(line, pos) {
      const m = matcher(line, pos);
      return m === null ? 0 : m.fullLength;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matcher(line, pos);
      if (m === null) return 0;
      applyAndRecurse(m.family, m.inner, stripe);
      return m.fullLength;
    },
  };
}

/** Upstream: `CommandCreoleFontFamilyChange.create()`/`createEol()`. */
export function createFontFamilyChangeCommands(): readonly Command[] {
  return [createForm(matchBracketed), createForm(matchEol)];
}
