/**
 * Recognizing the error diagram (SI6).
 *
 * Before SI6 a failed render produced a homegrown red box whose text began
 * `PlantUML error:`, and ~60 tests asserted `not.toContain('PlantUML error')`
 * to mean "this fixture rendered". That box is gone — `renderSync` / `render`
 * now emit upstream's `PSystemError` diagram — so those assertions would have
 * silently become vacuous (a failing fixture no longer contains that string).
 * They assert through this helper instead, which recognizes what the real error
 * diagram actually contains.
 *
 * @see src/core/error/PSystemError.ts
 */

import { expect } from 'vitest';

/**
 * `PSystemError#header()` — the version banner, drawn above every error
 * diagram's source listing and nowhere else.
 */
export const ERROR_BANNER = 'plantuml-ts version';

/**
 * `PSystemWelcome` — what a source with no `@start…@end` block renders (the
 * jar does the same). Not an error diagram, but for a corpus fixture it means
 * the same thing: nothing was drawn.
 */
export const WELCOME_MARKER = 'Welcome to PlantUML!';

/** Assert that `svg` is a real diagram — neither an error diagram nor the
 *  Welcome screen. `label` names the fixture, for a readable failure. */
export function expectNoErrorDiagram(svg: string, label?: string): void {
  expect(svg, label).not.toContain(ERROR_BANNER);
  expect(svg, label).not.toContain(WELCOME_MARKER);
}

/** Assert that `svg` IS the error diagram, and that it reports `message`. */
export function expectErrorDiagram(svg: string, message?: string): void {
  expect(svg).toContain(ERROR_BANNER);
  if (message !== undefined) expect(svg).toContain(message);
}
