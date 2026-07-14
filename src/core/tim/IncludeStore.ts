/**
 * The sync include seam.
 *
 * Upstream resolves `!include` / `!includesub` / `!includedef` / `!import`
 * DURING interpretation, through a `PathSystem` that does blocking file I/O
 * (`TContext#executeInclude` -> `InputFile#getReader`). This port cannot: `src/`
 * must stay browser-safe and `renderSync` must stay synchronous (CLAUDE.md).
 *
 * So the I/O is split in two, and this is the boundary:
 *
 *   - ASYNC, outside the interpreter: `include-resolver.ts#prefetchIncludes`
 *     walks the source transitively and fetches every include target it can see
 *     into an `IncludeStore`.
 *   - SYNC, inside the interpreter: `TContext` reads content back out of that
 *     store, exactly where upstream would have hit the filesystem.
 *
 * A host may also hand-build a store (that is how `renderSync` gets includes at
 * all, and how a caller supplies stdlib bundles for the `<bundle/thing>` form --
 * see {@link StdlibNotBundledError} and `StdlibStore.ts`).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeInclude
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/PathSystem.java
 */

/**
 * A pre-populated, synchronous path -> content map.
 *
 * Keys are the include target EXACTLY as written in the directive, after TIM
 * variable/function substitution and after any `!suffix` is stripped -- e.g.
 * `common.puml`, `https://example.com/a.puml`, `<C4/C4_Context.puml>`.
 */
export interface IncludeStore {
  /** Content for `path`, or `undefined` when the store cannot serve it. */
  get(path: string): string | undefined;
  has(path: string): boolean;
  /**
   * The `<bundle/thing>` stdlib resolution seam (SI5b, `StdlibStore.ts`).
   * Optional because most `IncludeStore`s (`MapIncludeStore`, the store
   * `prefetchIncludes` builds) carry no vendored stdlib bundles at all --
   * `IncludeExecutor` resolves the `<bundle/thing>` form the OLD way first (an
   * exact-key `get()` hit, e.g. a host keying `'<c4/c4.puml>'` directly), and
   * consults this only on that miss, right before it would otherwise throw
   * `StdlibNotBundledError`. `fullname` is the de-bracketed path
   * (`stdlibPathOf`'s result), e.g. `'C4/C4_Context.puml'`. Build one with
   * `stdlibStore()` and combine it with an ordinary store via `withStdlib()`
   * (both in `StdlibStore.ts`).
   *
   * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Stdlib.java#getPumlResource
   */
  getPumlResource?(fullname: string): string | undefined;
}

/** A `<bundle/path>` reference (PlantUML's bundled-stdlib form), or `undefined`. */
export function stdlibPathOf(what: string): string | undefined {
  if (what.startsWith('<') && what.endsWith('>') && what.length > 2) return what.substring(1, what.length - 1);

  return undefined;
}

/** `c4` from `<c4/C4_Context.puml>` -- the bundle a host would have to supply. */
export function stdlibBundleOf(stdlibPath: string): string {
  const idx = stdlibPath.indexOf('/');
  return idx === -1 ? stdlibPath : stdlibPath.substring(0, idx);
}

/** Map-backed {@link IncludeStore}; what `prefetchIncludes` fills and a host hand-builds. */
export class MapIncludeStore implements IncludeStore {
  private readonly entries = new Map<string, string>();

  constructor(initial?: Iterable<readonly [string, string]> | Readonly<Record<string, string>>) {
    if (initial === undefined) return;

    const pairs = Symbol.iterator in Object(initial)
      ? (initial as Iterable<readonly [string, string]>)
      : Object.entries(initial as Readonly<Record<string, string>>);
    for (const [path, content] of pairs) this.entries.set(path, content);
  }

  /**
   * Exact key first; then, for the `<bundle/thing>` form, the de-bracketed
   * spelling. Both are accepted so a host can key its bundles either way --
   * `{'<c4/c4.puml>': ...}` or `{'c4/c4.puml': ...}` -- without having to know
   * which spelling the diagram used.
   */
  get(path: string): string | undefined {
    const exact = this.entries.get(path);
    if (exact !== undefined) return exact;

    const stdlib = stdlibPathOf(path);
    if (stdlib !== undefined) return this.entries.get(stdlib);

    return undefined;
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  set(path: string, content: string): void {
    this.entries.set(path, content);
  }

  get size(): number {
    return this.entries.size;
  }

  keys(): readonly string[] {
    return [...this.entries.keys()];
  }
}

/** The default store: resolves nothing. `renderSync` with no `includeStore` uses this. */
export const EMPTY_INCLUDE_STORE: IncludeStore = new MapIncludeStore();

/**
 * Base class for every unresolvable-include failure.
 *
 * It exists so `TContext#executeOneLineSafe` can let these through: that method
 * wraps any non-`EaterException` into `EaterException('Fatal parsing error')`
 * (upstream does the same for `RuntimeException`), which would erase the one
 * thing the seam promises -- an error that NAMES the path or bundle the caller
 * has to supply.
 */
export abstract class IncludeError extends Error {
  /** The include target that could not be resolved. */
  readonly path: string;

  protected constructor(message: string, path: string, name: string) {
    super(message);
    this.name = name;
    this.path = path;
  }
}

/**
 * A cache miss: the interpreter reached an include the {@link IncludeStore}
 * cannot serve. Upstream would have opened the file here.
 */
export class IncludeNotFoundError extends IncludeError {
  constructor(path: string, directive = '!include') {
    super(
      `Cannot resolve ${directive} '${path}': it is not in the IncludeStore.\n` +
        `Includes are resolved synchronously from a pre-populated store. Either call render() ` +
        `(which prefetches includes for you), or pass options.includeStore with an entry for '${path}'.`,
      path,
      'IncludeNotFoundError',
    );
  }
}

/**
 * `!include <bundle/thing>` -- PlantUML's bundled-stdlib form -- with no bundle
 * supplied.
 *
 * plantuml-ts vendors NO stdlib asset (a licensing question the maintainer owns;
 * mission SI5b). Before this seam existed, `include-resolver.ts` SILENTLY DROPPED
 * these lines, so every macro the bundle defines stayed unexpanded and the
 * diagram quietly rendered wrong. Failing loudly, and naming the bundle a host
 * must supply, is the point of this error.
 */
export class StdlibNotBundledError extends IncludeError {
  /** The bundle a host would have to supply -- `aws` from `<aws/common>`. */
  readonly bundle: string;

  constructor(what: string, stdlibPath: string) {
    const bundle = stdlibBundleOf(stdlibPath);
    super(
      `Cannot resolve !include ${what}: plantuml-ts bundles no PlantUML stdlib, ` +
        `so the '${bundle}' bundle is not available.\n` +
        `Supply it through the include seam: pass options.includeStore with an entry keyed ` +
        `'${what}' (or '${stdlibPath}') whose value is the content of that stdlib file.`,
      stdlibPath,
      'StdlibNotBundledError',
    );
    this.bundle = bundle;
  }
}
