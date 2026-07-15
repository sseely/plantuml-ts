/**
 * CommandCreoleBuilder — builds the `starter prefix -> Command[]` map
 * `StripeSimple#searchCommand` looks up against.
 *
 * Upstream: klimt/creole/legacy/CommandCreoleBuilder.java — two cached
 * singletons (`FULL`, `OTHER`), registering ~25 commands (style, size,
 * color, img, sprite, url, math, latex, ...) via a shared `addCommand`
 * that fans each `Command#starters()` entry out into the map.
 *
 * L1 scope (mission brief: "bold/italic/underline/wave/strikeout at
 * minimum ... the pattern architecture matters more than tag count"):
 * only `CommandCreoleStyle`'s five styles are registered
 * (BOLD/ITALIC/UNDERLINE/STRIKE/WAVE), in upstream's exact declaration
 * order (java :76-95, PLAIN and BACKCOLOR excluded — see below). L2 adds
 * size/color/font/back/code/url/img/sprite/math/latex commands to this
 * same map; this file's `addCommand`/`buildMap` shape does not need to
 * change to accommodate them, only the registration list below grows.
 *
 * Not ported (journaled, deferred to L2/never):
 * - `FontStyle.PLAIN` (`<plain>...</plain>`, `<plain>...` EOL): not in
 *   L1's "bold/italic/underline/wave/strikeout" set; its `AddStyle`
 *   application also has a "clear all styles" special case
 *   (`AddStyle.ts`'s doc comment) not yet ported.
 * - `FontStyle.BACKCOLOR` (`<back:color>...</back>`): explicitly out of
 *   scope (mission brief NOT-in-scope list).
 * - The `CreoleMode.FULL`-only exclusion of the creole-pure `__` underline
 *   command upstream's `OTHER` builder applies: this port has only ONE map
 *   (always FULL), since every L1 call site (`EntityImageDescriptionSupport
 *   .ts#buildTextBlock`, the sole creole entry point) always wants full
 *   creole — no caller ever threads a `CreoleMode.OTHER`-equivalent
 *   (`SIMPLE_LINE`/`NO_CREOLE`/`FULL_BUT_UNDERSCORE`) through. `CreoleMode`
 *   itself is therefore not ported as a type.
 */
import { FontStyle } from '../../shape/UText.js';
import type { Command } from '../command/Command.js';
import { createStyleCommands } from '../command/CommandCreoleStyle.js';
import { createSizeChangeCommands } from '../command/CommandCreoleSizeChange.js';
import { createColorChangeCommands } from '../command/CommandCreoleColorChange.js';
import { createColorAndSizeChangeCommands } from '../command/CommandCreoleColorAndSizeChange.js';
import { createFontFamilyChangeCommands } from '../command/CommandCreoleFontFamilyChange.js';
import { createLatexCommand } from '../command/CommandCreoleLatex.js';
import { createUrlCommand } from '../command/CommandCreoleUrl.js';

/** Upstream: `CommandCreoleBuilder#addCommand` — fans one Command's
 *  `starters()` out into the shared map, appending (never replacing) so
 *  multiple Commands sharing a 2-char prefix all remain candidates for
 *  `searchCommand`'s "first non-zero `matchingSize` wins" scan. */
function addCommand(map: Map<string, Command[]>, cmd: Command): void {
  for (const starter of cmd.starters) {
    const list = map.get(starter);
    if (list === undefined) map.set(starter, [cmd]);
    else list.push(cmd);
  }
}

/** Upstream: `CommandCreoleBuilder`'s ctor body, java :76-95 (BOLD, ITALIC,
 *  UNDERLINE, STRIKE, WAVE only — see module doc comment for the rest of
 *  the ctor's commands, all deferred). */
const L1_STYLES: readonly FontStyle[] = [
  FontStyle.BOLD,
  FontStyle.ITALIC,
  FontStyle.UNDERLINE,
  FontStyle.STRIKE,
  FontStyle.WAVE,
];

/** L2 additions (mission `plans/e2r-creole/`), registered in upstream's own
 *  `CommandCreoleBuilder` ctor order (java :98-117, minus the not-ported
 *  entries -- exposant/img-adjacent commands, see this file's module doc
 *  comment): size, color, font(size/color), then font(family) LAST among
 *  the `<f` starter's two claimants (`CommandCreoleColorAndSizeChange` must
 *  be tried first -- its pattern requires a `size=`/`color=` attr, so a
 *  bare `<font:Name>` correctly falls through to `CommandCreoleFontFamily
 *  Change` only when the stricter pattern fails to match). */
function buildCommandMap(): Map<string, Command[]> {
  const map = new Map<string, Command[]>();
  for (const style of L1_STYLES) {
    for (const cmd of createStyleCommands(style)) addCommand(map, cmd);
  }
  for (const cmd of createSizeChangeCommands()) addCommand(map, cmd);
  for (const cmd of createColorChangeCommands()) addCommand(map, cmd);
  for (const cmd of createColorAndSizeChangeCommands()) addCommand(map, cmd);
  addCommand(map, createLatexCommand());
  for (const cmd of createFontFamilyChangeCommands()) addCommand(map, cmd);
  addCommand(map, createUrlCommand());
  return map;
}

/** Upstream: `CommandCreoleBuilder.FULL` — built once, reused for every
 *  line (upstream caches per-mode singletons; this port has exactly one
 *  mode, so exactly one singleton). */
export const CREOLE_COMMANDS: ReadonlyMap<string, readonly Command[]> = buildCommandMap();
