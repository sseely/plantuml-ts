/**
 * The version banner the error diagram prints above the source listing.
 *
 * Upstream reads `CompilationInfo` (a build-time-filtered resource) and, when
 * the build did not stamp a timestamp, prints `[Unknown compile time]` — which
 * is exactly what the reference jar emits (`PlantUML version $version$ /
 * $git.commit.id$ [Unknown compile time]`: an unfiltered dev build).
 *
 * This port keeps the same line shape but sources every field from a
 * module-level constant. `src/` must run in a browser and render
 * reproducibly, so there is no `Date.now()`, no `process.env`, and no ambient
 * build state to read here (CLAUDE.md, Architecture Notes). A release build
 * that wants a real commit id substitutes {@link COMMIT} at bundle time.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/version/Version.java
 */

/** plantuml-ts's own version — kept in step with `package.json#version`. */
export const VERSION = '0.1.0';

/** Build-stamped at release; the placeholder is what a dev build reports. */
export const COMMIT = 'unknown';

/**
 * Upstream prints a UTC timestamp when the build stamped one, and this literal
 * otherwise. This port never stamps one (no ambient build state in `src/`).
 * @see ~/git/plantuml/.../version/Version.java#compileTimeString
 */
export const COMPILE_TIME_STRING = 'Unknown compile time';

/** @see ~/git/plantuml/.../version/Version.java#versionString */
export function versionString(): string {
  return VERSION;
}

/** @see ~/git/plantuml/.../version/Version.java#fullDescription */
export function fullDescription(): string {
  return `plantuml-ts version ${versionString()} / ${COMMIT} [${COMPILE_TIME_STRING}]`;
}
