/** sha256 file hashing — binary-safe (raw Buffer, no text decoding). */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function sha256File(absPath: string): string {
  const bytes = readFileSync(absPath);
  return createHash('sha256').update(bytes).digest('hex');
}
