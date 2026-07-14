/**
 * --verify mode: re-hash the on-disk assets/stdlib/<bundle>/... payload
 * against the committed manifest. This is the verbatim audit gate (D3) —
 * any hash drift or missing file is a hard failure.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { sha256File } from './hash.js';
import type { BundleManifest } from './types.js';

export interface VerifyMismatch {
  bundle: string;
  file: string;
  reason: 'missing' | 'hash-mismatch';
}

/** Re-hash every file listed in `manifest` for one bundle; return every
 * mismatch found (empty array = bundle verified clean). */
export function verifyBundle(
  bundleName: string,
  manifest: BundleManifest,
  assetsStdlibDir: string,
): VerifyMismatch[] {
  const mismatches: VerifyMismatch[] = [];
  const bundleDir = join(assetsStdlibDir, bundleName);

  for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
    const absPath = join(bundleDir, relPath);
    if (!existsSync(absPath)) {
      mismatches.push({ bundle: bundleName, file: relPath, reason: 'missing' });
      continue;
    }
    if (sha256File(absPath) !== expectedHash) {
      mismatches.push({ bundle: bundleName, file: relPath, reason: 'hash-mismatch' });
    }
  }

  return mismatches;
}
