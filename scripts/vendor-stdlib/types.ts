/**
 * Shared types for the stdlib vendor pipeline (scripts/vendor-stdlib.ts).
 *
 * Field set mirrors mission SI5b batch-1/overview.md T1: sourceRepo,
 * sourceSha, generatedBy at the root; per-bundle license/link/version/
 * source (all optional, sourced from each bundle README.md frontmatter),
 * fileCount, and a per-file sha256 map.
 */

/** Metadata parsed from a bundle's README.md frontmatter block. */
export interface BundleFrontmatter {
  license?: string;
  link?: string;
  version?: string;
  source?: string;
}

/**
 * Per-bundle manifest, written to assets/manifests/<bundle>.json.
 * Split out of the root manifest because the combined file/hash set for
 * all ~34.6k vendored files would exceed the ~2MB single-file budget.
 */
export interface BundleManifest {
  fileCount: number;
  /** relative POSIX path (within the bundle) -> sha256 hex digest */
  files: Record<string, string>;
}

/** One entry under RootManifest.bundles — metadata plus a pointer to the
 * bundle's own file/hash manifest. */
export interface BundleIndexEntry extends BundleFrontmatter {
  fileCount: number;
  /** repo-relative path to the bundle's BundleManifest JSON file */
  manifestPath: string;
}

/** assets/stdlib.manifest.json — the committed root index. */
export interface RootManifest {
  sourceRepo: string;
  sourceSha: string;
  generatedBy: string;
  bundles: Record<string, BundleIndexEntry>;
}
