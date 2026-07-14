/**
 * Reads one vendored bundle folder into a `BundleData.files` map.
 *
 * Only `.puml` files are included -- `StdlibStore.ts`'s `BundleData.files`
 * JSDoc: 'PUML file content, keyed lowercase with the `.puml` extension
 * stripped.' Non-`.puml` payloads (`README.md`, `_scripts_/*.sh`,
 * `all.json`, `.gitignore`) are vendored for provenance but are never
 * resolvable stdlib resources upstream (`Stdlib.java#getPumlResource` only
 * ever loads the PUML channel).
 *
 * Content is read as UTF-8 text and embedded VERBATIM (no transform --
 * `plans/si5b-stdlib/decisions.md` D1/D3): the round-trip sha256 proof in
 * `tests/unit/stdlib-packages.test.ts` re-encodes the runtime string back to
 * UTF-8 bytes and checks it against the vendored file's own bytes and the
 * committed manifest hash.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { walkFiles } from '../vendor-stdlib/walk.js';

const PUML_SUFFIX = '.puml';

/** `Stdlib.java`'s key transform: lowercase, then strip every `.puml`
 * occurrence (not just a trailing one -- Java's `String#replace` is a global
 * literal replace). Mirrors `resolvePumlResource`'s `cleaned` computation in
 * `src/core/tim/StdlibStore.ts` exactly, applied to the file's path relative
 * to its bundle root (the part after the bundle-name/first-slash split). */
export function derivePumlKey(relPath: string): string {
  return relPath.toLowerCase().split(PUML_SUFFIX).join('');
}

function isPumlFile(relPath: string): boolean {
  return relPath.toLowerCase().endsWith(PUML_SUFFIX);
}

/** Reads every `.puml` file under `assetsStdlibDir/assetFolder`, keyed per
 * {@link derivePumlKey}. Deterministic (sorted) file order, matching
 * `walkFiles`. */
export function readBundleFiles(assetsStdlibDir: string, assetFolder: string): Record<string, string> {
  const bundleRoot = join(assetsStdlibDir, assetFolder);
  const files: Record<string, string> = {};

  for (const { relPath, absPath } of walkFiles(bundleRoot)) {
    if (!isPumlFile(relPath)) {
      continue;
    }
    files[derivePumlKey(relPath)] = readFileSync(absPath, 'utf8');
  }

  return files;
}
