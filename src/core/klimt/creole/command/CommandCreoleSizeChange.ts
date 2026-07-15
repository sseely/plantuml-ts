/**
 * CommandCreoleSizeChange — `<size:N>text</size>` and `<size:N>text to end
 * of line` (no closing tag needed).
 *
 * Upstream: klimt/creole/command/CommandCreoleSizeChange.java. `create()`
 * ports the bracketed form (`pattern`, matches up to `</size>`); `createEol()`
 * ports the EOL form (`patternEol`, matches to end of line, no closing tag).
 * Both share `Splitter.fontSizePattern` (`\<size[\s:]+(\d+)[%s]*\>` — `%s`
 * is `[\s ]` per `Pattern2`'s constant table, ported inline below since
 * no other file needs that substitution yet).
 *
 * `matchingSize` returns the FULL match length (not upstream's own
 * inconsistent per-command choice of group — see L1's `CommandCreoleStyle
 * .ts` precedent) since this port's `searchCommand` only checks
 * non-zero-ness (`Command.ts`'s doc comment); using the full match avoids a
 * false "no match" on a zero-length inner capture (`<size:12></size>`).
 */
import type { FontConfiguration } from '../../shape/UText.js';
import type { Command, StripeBuilder } from './Command.js';

interface SizeMatch {
  readonly fullLength: number;
  readonly size: number;
  readonly inner: string;
}

// `Splitter.fontSizePattern`'s digit-capture group, ported as a source
// string (never a regex literal — the `<`/`>` complexity-hook workaround,
// see project rules).
const SIZE_TAG_SOURCE = '<size[\\s\\u00A0:]+(\\d+)[\\s\\u00A0]*>';

function matchSizeBracketed(line: string, pos: number): SizeMatch | null {
  const re = new RegExp('^' + SIZE_TAG_SOURCE + '(.*?)</size>');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { fullLength: m[0].length, size: Number(m[1]), inner: m[2]! };
}

function matchSizeEol(line: string, pos: number): SizeMatch | null {
  const re = new RegExp('^' + SIZE_TAG_SOURCE + '(.*)$');
  const m = re.exec(line.slice(pos));
  if (m === null) return null;
  return { fullLength: m[0].length, size: Number(m[1]), inner: m[2]! };
}

function applySizeAndRecurse(size: number, inner: string, stripe: StripeBuilder): void {
  const saved: FontConfiguration = stripe.getActualFontConfiguration();
  stripe.setActualFontConfiguration({ ...saved, size });
  stripe.analyzeAndAddInline(inner);
  stripe.setActualFontConfiguration(saved);
}

function createForm(matcher: (line: string, pos: number) => SizeMatch | null): Command {
  return {
    starters: ['<s'],
    matchingSize(line, pos) {
      const m = matcher(line, pos);
      return m === null ? 0 : m.fullLength;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = matcher(line, pos);
      if (m === null) return 0;
      applySizeAndRecurse(m.size, m.inner, stripe);
      return m.fullLength;
    },
  };
}

/** Upstream: `CommandCreoleSizeChange.create()`/`createEol()`, both returned
 *  together (this port's `CommandCreoleBuilder.ts` registers both, matching
 *  upstream's own ctor order). */
export function createSizeChangeCommands(): readonly Command[] {
  return [createForm(matchSizeBracketed), createForm(matchSizeEol)];
}
