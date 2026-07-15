/**
 * AddStyle — applies one `FontStyle` flag to a `FontConfiguration`.
 *
 * Upstream: klimt/creole/command/AddStyle.java (`style`+`extendedColor` ctor
 * fields, `apply(FontConfiguration): FontConfiguration` = `initial.add
 * (style)` plus an optional `changeExtendedColor`). Ported: the `add(style)`
 * half only — L1's styles (BOLD/ITALIC/UNDERLINE/STRIKE/WAVE) never carry an
 * extended color in this iteration (the `<u:color>`/`<w:color>`/`<s:color>`
 * colon-suffixed forms are explicitly L2 scope, mission brief NOT-in-scope
 * list's `<u:>` entry) — `CommandCreoleStyle.ts`'s activation patterns never
 * capture one, so there is nothing for an `extendedColor` param to carry
 * yet. `FontStyle.PLAIN`'s "clear all styles first" branch
 * (`FontConfiguration.add`, java) is not ported either — PLAIN itself is
 * out of L1's "bold/italic/underline/wave/strikeout" set (see
 * `legacy/CommandCreoleBuilder.ts`'s doc comment).
 *
 * `FontConfiguration.styles` is an immutable `ReadonlySet` (`UText.ts`) —
 * `addFontStyle` returns a NEW `FontConfiguration` with the style unioned
 * in, never mutates the input (this project's testability rule: pure
 * functions over in-place mutation).
 */
import type { FontConfiguration, FontStyle } from '../../shape/UText.js';

export function addFontStyle(font: FontConfiguration, style: FontStyle): FontConfiguration {
  if (font.styles.has(style)) return font;
  return { ...font, styles: new Set(font.styles).add(style) };
}
