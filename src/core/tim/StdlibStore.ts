/**
 * The `<bundle/thing>` stdlib resolution seam.
 *
 * `IncludeExecutor#load` reaches `IncludeStore#getPumlResource` (the optional
 * method declared in `IncludeStore.ts`) only once a plain `get()` key lookup
 * has already missed for a `<bundle/thing>` target -- this module is what
 * builds that optional method faithfully, from the vendored bundle data the
 * SI5b `@plantuml-ts/stdlib*` packages carry.
 *
 * Mirrors `Stdlib.getPumlResource` (Stdlib.java:98-114) EXACTLY: lowercase the
 * full request, strip every `.puml` occurrence (Java's `String#replace`
 * removes ALL occurrences of the literal substring, not just a trailing one --
 * `"a.puml/b.puml".replace(".puml", "")` is `"a/b"`), split on the FIRST `/`
 * to get the bundle name, follow `link:` alias chains (`Stdlib#retrieve`,
 * Stdlib.java:166-179) to the bundle that actually holds the files, then look
 * up the remainder (which may still contain further `/`s, e.g. AWS's
 * `awslib14/Storage/SimpleStorageService`) as the file key.
 *
 * `<bundle>` alone (no `/` at all) resolves to nothing -- upstream returns
 * `null` before ever calling `retrieve` (Stdlib.java:101-102).
 *
 * PLANTUML-TS DIVERGENCE: `Stdlib#retrieve` (Stdlib.java:166-179) follows the
 * `link:` chain with no cycle guard -- a malformed manifest would infinite-loop
 * the JVM (`ConcurrentHashMap#computeIfAbsent` recursing into itself). This
 * port tracks visited bundle names and treats a cycle as a miss (`undefined`)
 * rather than hanging.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Stdlib.java#getPumlResource
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Stdlib.java#retrieve
 */

import type { IncludeStore } from './IncludeStore.js';

/**
 * One vendored stdlib bundle (a folder under `~/git/plantuml-stdlib/stdlib/`,
 * `plans/si5b-stdlib/decisions.md` D1/D2).
 *
 * `files` keys mirror the jar's PUML-channel map (Stdlib.java:150:
 * `map.put(name.toLowerCase(), data)`): lowercase, with the `.puml` extension
 * already stripped.
 */
export interface BundleData {
  /** Folder name, e.g. `'c4'`, `'awslib14'` -- matched case-insensitively. */
  readonly name: string;
  /**
   * `link:` redirect target read from the bundle README's metadata (Stdlib.java's
   * `info.get("link")`, Stdlib.java:181). When set, `files` is ignored and every
   * lookup for this bundle resolves through the aliased bundle instead --
   * `awslib` -> `awslib14`, `bootstrap` -> `bootstrap1.13.1`, `material*` -> its
   * target.
   */
  readonly aliasOf?: string | undefined;
  /** PUML file content, keyed lowercase with the `.puml` extension stripped. */
  readonly files: Readonly<Record<string, string>>;
}

/** The bundle-resolution API a caller supplies for the `<bundle/thing>` include form. */
export interface StdlibStore {
  /**
   * `fullname` is the de-bracketed stdlib path, e.g. `'C4/C4_Context.puml'` or
   * `'awslib/General/User'` (case, `.puml` extension, and slash count are all
   * exactly as written in the source -- this method normalizes them). Returns
   * the file's content, or `undefined` when the bundle (after alias
   * resolution) or the file within it is not present.
   *
   * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/Stdlib.java#getPumlResource
   */
  getPumlResource(fullname: string): string | undefined;
}

/** Build a {@link StdlibStore} from vendored bundles. @see Stdlib.java#getPumlResource */
export function stdlibStore(...bundles: readonly BundleData[]): StdlibStore {
  const byName = new Map<string, BundleData>();
  for (const bundle of bundles) byName.set(bundle.name.toLowerCase(), bundle);

  return {
    getPumlResource: (fullname: string): string | undefined => resolvePumlResource(byName, fullname),
  };
}

/**
 * Combines an ordinary {@link IncludeStore} with a {@link StdlibStore} into one
 * `IncludeStore`: `get`/`has` delegate to `base`, and the `<bundle/thing>`
 * fallback `IncludeExecutor` calls (`getPumlResource`) delegates to `stdlib`.
 * This is how a host hands `options.includeStore` both ordinary file content
 * and a vendored stdlib bundle set in a single value.
 */
export function withStdlib(base: IncludeStore, stdlib: StdlibStore): IncludeStore {
  return {
    get: (path: string): string | undefined => base.get(path),
    has: (path: string): boolean => base.has(path),
    getPumlResource: (fullname: string): string | undefined => stdlib.getPumlResource(fullname),
  };
}

/** @see Stdlib.java#getPumlResource (the lowercase/strip/split/alias/lookup pipeline) */
function resolvePumlResource(byName: ReadonlyMap<string, BundleData>, fullname: string): string | undefined {
  // Java: `fullname.toLowerCase().replace(".puml", "")` -- String#replace(CharSequence,
  // CharSequence) removes EVERY occurrence of the literal substring, not just a
  // trailing one; `.split('.puml').join('')` reproduces that exactly (`split` on
  // a plain string, not a regex, so the '.' is literal -- no RegExp.escape needed).
  const cleaned = fullname.toLowerCase().split('.puml').join('');
  const slash = cleaned.indexOf('/');
  if (slash === -1) return undefined;

  const bundle = resolveBundle(byName, cleaned.substring(0, slash));
  if (bundle === undefined) return undefined;

  return bundle.files[cleaned.substring(slash + 1)];
}

/** Follows `aliasOf` (`Stdlib#retrieve`'s `link:` redirect), guarding against cycles. */
function resolveBundle(byName: ReadonlyMap<string, BundleData>, name: string): BundleData | undefined {
  const visited = new Set<string>();
  let current = name;
  for (;;) {
    if (visited.has(current)) return undefined;
    visited.add(current);

    const bundle = byName.get(current);
    if (bundle === undefined) return undefined;
    if (bundle.aliasOf === undefined) return bundle;

    current = bundle.aliasOf.toLowerCase();
  }
}
