/**
 * A `StdlibStore` (`src/core/tim/StdlibStore.ts`) built directly from
 * `assets/stdlib/` — the SI5b T1 vendor pipeline's gitignored output.
 *
 * This deliberately covers EVERY vendored bundle, not just the audited
 * subset the four `@plantuml-ts/stdlib*` packages publish
 * (`plans/si5b-stdlib/decisions.md` D2 scopes publication, not measurement).
 * The DOT-sync harness (`scripts/dot-sync-report.ts`) and the oracle parity
 * suites need whatever bundle a fixture's `!include <bundle/thing>`
 * references — cloudogu, awslib/awslib14, bootstrap/bootstrap1.13.1,
 * tupadr3, … — so this reads `assets/stdlib/<bundle>/**\/*.puml` generically
 * instead of hardcoding the package list (`scripts/build-stdlib-packages/
 * package-specs.ts` is the publish-time allowlist; this is not that).
 *
 * Key transform mirrors `Stdlib.java#getPumlResource` exactly, the same as
 * `scripts/build-stdlib-packages/read-bundle.ts#derivePumlKey`: lowercase,
 * strip every `.puml` occurrence. Alias bundles (`link:` in the bundle
 * README's YAML front matter, e.g. `awslib` -> `awslib14`) are resolved the
 * same way `assets/stdlib.manifest.json`'s capture step read them
 * (`scripts/vendor-stdlib.ts`) — `BundleData.aliasOf`, no files of their own
 * (`StdlibStore.ts`'s `resolveBundle` ignores `files` once `aliasOf` is set).
 *
 * Node `fs` is fine here — this module lives under `scripts/` (and is
 * re-exported from `tests/helpers/stdlib-assets-store.ts`), never `src/`
 * (`plantuml-ts` must stay browser-safe — CLAUDE.md).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { derivePumlKey } from './build-stdlib-packages/read-bundle.js';
import { walkFiles } from './vendor-stdlib/walk.js';
import { stdlibStore, type BundleData, type StdlibStore } from '../src/core/tim/StdlibStore.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_ASSETS_STDLIB_DIR = join(REPO_ROOT, 'assets', 'stdlib');

/** Matches a `link: <target>` line inside a bundle README's YAML front
 * matter (the fenced block between the first two `---` lines). */
const LINK_LINE_RE = new RegExp('^link:\\s*(.+)$');

/** Extracts a bundle's `link:` YAML front-matter value, e.g. `'awslib14'`
 * for the `awslib` bundle's README. Returns `undefined` when the front
 * matter is absent, malformed, or carries no `link:` field. Pure — no fs. */
export function parseLinkAlias(readmeContent: string): string | undefined {
  const lines = readmeContent.split('\n');
  if (lines[0]?.trim() !== '---') return undefined;
  const closeIdx = lines.slice(1).findIndex((l) => l.trim() === '---');
  if (closeIdx === -1) return undefined;

  for (const line of lines.slice(1, closeIdx + 1)) {
    const match = LINK_LINE_RE.exec(line.trim());
    const value = match?.[1]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
}

function readLinkAlias(bundleDir: string): string | undefined {
  const readmePath = join(bundleDir, 'README.md');
  if (!existsSync(readmePath)) return undefined;
  return parseLinkAlias(readFileSync(readmePath, 'utf8'));
}

/** Reads one bundle folder into a {@link BundleData}. Alias bundles
 * (`link:` present) carry no files of their own — `StdlibStore.ts`'s
 * `resolveBundle` never reads them once `aliasOf` is set. */
function readBundle(assetsStdlibDir: string, name: string): BundleData {
  const bundleDir = join(assetsStdlibDir, name);
  const aliasOf = readLinkAlias(bundleDir);
  if (aliasOf !== undefined) return { name, aliasOf, files: {} };

  const files: Record<string, string> = {};
  for (const { relPath, absPath } of walkFiles(bundleDir)) {
    if (!relPath.toLowerCase().endsWith('.puml')) continue;
    files[derivePumlKey(relPath)] = readFileSync(absPath, 'utf8');
  }
  return { name, files };
}

function bundleDirNames(assetsStdlibDir: string): string[] {
  return readdirSync(assetsStdlibDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

const REMEDIATION =
  'Run `npx tsx scripts/vendor-stdlib.ts` first, then re-run this command.';

/** Builds a {@link StdlibStore} that resolves `<bundle/thing>` against
 * every bundle vendored under `assetsStdlibDir` (default `assets/stdlib/`).
 * Throws a remediation-bearing error if that directory is absent (fresh
 * checkout — `assets/stdlib/` is gitignored). Not memoized itself; see
 * {@link buildStdlibAssetsStore} for the process-wide cached singleton the
 * DOT-sync report and oracle harnesses share. */
export function readStdlibAssetsStore(assetsStdlibDir: string = DEFAULT_ASSETS_STDLIB_DIR): StdlibStore {
  if (!existsSync(assetsStdlibDir)) {
    throw new Error(`${assetsStdlibDir} does not exist (gitignored vendor output). ${REMEDIATION}`);
  }
  const bundles = bundleDirNames(assetsStdlibDir).map((name) => readBundle(assetsStdlibDir, name));
  return stdlibStore(...bundles);
}

let cached: StdlibStore | undefined;

/** Lazily builds (once per process) and caches a {@link StdlibStore} over
 * `assets/stdlib/` — the walk touches every `.puml` file across 34 bundles,
 * so callers that render many fixtures (the DOT-sync report, the oracle
 * parity ratchets) share this one instance rather than re-scanning per
 * fixture. */
export function buildStdlibAssetsStore(): StdlibStore {
  cached ??= readStdlibAssetsStore();
  return cached;
}
