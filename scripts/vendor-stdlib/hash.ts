/** sha256 file hashing — binary-safe (raw Buffer, no text decoding).
 *
 * Digests are prefixed 'sha256:' in the manifest. The prefix is
 * self-documenting AND breaks the bare-64-hex-chars pattern that secret
 * scanners match (a vendored logos/codeclimate.puml checksum was flagged as
 * a CodeClimate reporter ID, 2026-07-14 — vendor-named files adjacent to
 * 64-hex values are indistinguishable from leaked keys to a scanner). */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function sha256File(absPath: string): string {
  const bytes = readFileSync(absPath);
  return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}
