/** Deterministic JSON read/write for the root + per-bundle manifests. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const JSON_INDENT = 2;

export function writeJson(absPath: string, data: unknown): void {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(data, null, JSON_INDENT)}\n`, 'utf8');
}

export function readJson<T>(absPath: string): T {
  return JSON.parse(readFileSync(absPath, 'utf8')) as T;
}
