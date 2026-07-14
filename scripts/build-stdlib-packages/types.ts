/**
 * Shared types for the stdlib package generator (scripts/build-stdlib-packages.ts,
 * mission SI5b batch-3, T8).
 *
 * A `PackageSpec` describes one of `packages/{stdlib,stdlib-aws,stdlib-tupadr3}`:
 * which generated module files it has, and which `BundleData` export(s) each
 * module file carries. `packages/stdlib-all` has no assets of its own (it only
 * re-exports the other three packages) so it is not described by a
 * `PackageSpec` -- see `emit-all-index.ts`.
 */

/** A generated module file that exports one real (asset-backed) `BundleData`. */
export interface ConcreteBundleExport {
  readonly kind: 'concrete';
  /** JS identifier the generated module binds this bundle to. */
  readonly exportName: string;
  /** `BundleData.name` -- matches the vendored folder's own case exactly. */
  readonly bundleName: string;
  /** Folder name under `assets/stdlib/` to read `.puml` files from. */
  readonly assetFolder: string;
}

/** A generated module file that exports an alias `BundleData` (`files: {}`,
 * `aliasOf` set) -- mirrors `Stdlib#retrieve`'s `link:` redirect. */
export interface AliasBundleExport {
  readonly kind: 'alias';
  readonly exportName: string;
  readonly bundleName: string;
  /** The target bundle's `BundleData.name` this alias redirects to. */
  readonly aliasOf: string;
}

export type BundleExport = ConcreteBundleExport | AliasBundleExport;

/** One `generated/<fileBaseName>.{js,d.ts}` pair. May carry more than one
 * export (the `bootstrap` module pairs the alias with its target so the
 * package keeps exactly the subpath count `plans/si5b-stdlib/batch-3/overview.md`
 * T8 enumerates). */
export interface GeneratedModule {
  readonly fileBaseName: string;
  readonly exports: readonly BundleExport[];
}

export interface PackageSpec {
  /** Directory name under `packages/`. */
  readonly packageDir: string;
  readonly modules: readonly GeneratedModule[];
}
