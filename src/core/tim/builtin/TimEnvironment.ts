/**
 * The injected non-determinism / ambient-I/O seam for TIM builtins.
 *
 * Several upstream builtins reach directly for the filesystem, the OS
 * environment, the system clock, or `java.util.Random` --
 * `Now`/`DateFunction` (`System.currentTimeMillis()`), `RandomFunction`
 * (`new Random()`), `Getenv` (`System.getenv`/`System.getProperty`),
 * `FileExists`/`LoadJson` (`SFile`/`SURL`), `Dirpath`/`Filedate`/`Filename`/
 * `FilenameNoExtension` (`Defines#getEnvironmentValue`, itself populated
 * from the render invocation), and `GetStdlib`/`GetAllStdlib`/`GetAllTheme`/
 * `GetCurrentTheme` (`Stdlib`/`ThemeUtils` folder scans).
 *
 * `src/` must run in a browser and render reproducibly (CLAUDE.md: no
 * `fs`/`process.env`/`Date.now()`/`Math.random()` in rendering paths). Every
 * builtin that needs one of the above receives a `TimEnvironment` via
 * constructor injection instead of reaching for the ambient global; the
 * default implementation ({@link createDefaultTimEnvironment}) returns
 * inert, deterministic values so a diagram that never calls these builtins
 * is unaffected, and one that does gets a stable, testable answer instead
 * of silently touching the host filesystem/clock.
 *
 * Batch 4 (`TContext` construction) wires a real implementation through --
 * e.g. a Node CLI host can back `loadTextResource` with `fs.readFileSync`
 * outside `src/`, or a browser host can back it with a pre-fetched map,
 * without any builtin changing.
 */

import type { JsonValue } from '../expression/Token.js';

/** Faithful analog of `System.currentTimeMillis()` -- injected, never read live. */
export interface TimClock {
  nowMillis(): number;
}

/**
 * Faithful analog of `java.util.Random#nextInt(int)`: a uniform random
 * integer in `[0, bound)`. Injected so `%random(...)` is reproducible under
 * test and never touches `Math.random()`.
 */
export interface TimRandomSource {
  nextInt(bound: number): number;
}

/**
 * One stdlib folder's resolved metadata, mirroring the fields
 * `GetStdlib`/`GetAllStdlib` read off `net.sourceforge.plantuml.preproc.Stdlib`.
 */
export interface StdlibFolderMetadata {
  readonly version: string;
  readonly source: string;
  /** README.md key/value pairs, keys already lower-cased (matching upstream's `.toLowerCase()` on read). */
  readonly entries: ReadonlyMap<string, string>;
}

/**
 * The full injected-seam surface for TIM builtins. Every member has an
 * inert default in {@link createDefaultTimEnvironment} -- a diagram that
 * never calls a seam-backed builtin is completely unaffected by this type
 * existing.
 */
export interface TimEnvironment {
  readonly clock: TimClock;
  readonly random: TimRandomSource;

  /**
   * `Defines#getEnvironmentValue` equivalents for `%dirpath`/`%filedate`/
   * `%filename`/`%filename_no_extension` -- values computed once per render
   * invocation (source file path, its mtime, ...), not ambient global state,
   * but still external input this library must not source from `fs`/`path`
   * itself.
   */
  getEnvironmentValue(name: 'dirpath' | 'filedate' | 'filename' | 'filenameNoExtension'): string | undefined;

  /** `%getenv` -- OS/process environment access. Browser default: always `undefined`. */
  getenv(name: string): string | undefined;

  /** `%file_exists` -- filesystem probe. Browser default: always `false`. */
  fileExists(path: string): boolean;

  /**
   * `%load_json`'s file/URL data-source loader. `path` is either a
   * filesystem path or an `http(s)://` URL, matching upstream's
   * `LoadJson#loadJsonData` dispatch. `charset` mirrors the builtin's
   * optional third argument (upstream default `"UTF-8"`); host
   * implementations that only support one encoding may ignore it. Returns
   * the raw decoded text, or `undefined` if the resource cannot be read
   * (matching upstream's `null` "no data, use caller's default" contract).
   */
  loadTextResource(path: string, charset: string): string | undefined;

  /** Folder names for `%get_all_stdlib()` / `%get_stdlib()` (no folder arg). */
  listStdlibFolderNames(): readonly string[];

  /** Metadata for one stdlib folder, or `undefined` if `folderName` is unknown. */
  getStdlibMetadata(folderName: string): StdlibFolderMetadata | undefined;

  /**
   * `%load_json`'s `<name>` / `>name>` bracket-syntax stdlib JSON resource
   * lookup (`Stdlib#getJsonResource`). `undefined` if unresolvable.
   */
  getStdlibJsonResource(name: string): JsonValue | undefined;

  /** Theme names for `%get_all_theme()`. */
  listThemeNames(): readonly string[];

  /** `%get_current_theme()` metadata (an upstream `JsonObject`; here plain `JsonValue`). */
  getCurrentThemeMetadata(): JsonValue;

  /** `%version` -- this build's version string. Not sourced from `package.json` at runtime (browser-safe). */
  getVersionString(): string;
}

/**
 * Inert, fully deterministic default: no filesystem, no environment, no
 * live clock, no randomness. Every seam-backed builtin still returns a
 * well-typed, upstream-shaped value (an empty string, `false`, `[]`, `{}`,
 * or a stable `0`) rather than throwing -- matching upstream's own
 * graceful-degradation branches (e.g. `Dirpath`/`Filename` returning `""`
 * when `Defines#getEnvironmentValue` yields `null`).
 */
export function createDefaultTimEnvironment(): TimEnvironment {
  return {
    clock: { nowMillis: () => 0 },
    random: { nextInt: () => 0 },
    getEnvironmentValue: () => undefined,
    getenv: () => undefined,
    fileExists: () => false,
    loadTextResource: () => undefined,
    listStdlibFolderNames: () => [],
    getStdlibMetadata: () => undefined,
    getStdlibJsonResource: () => undefined,
    listThemeNames: () => [],
    getCurrentThemeMetadata: () => ({}),
    getVersionString: () => 'unknown',
  };
}
