/** Recursive, deterministic (sorted) file walker for a bundle directory. */

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface WalkedFile {
  /** POSIX-style path relative to the walked root (forward slashes). */
  relPath: string;
  absPath: string;
}

function toPosixRelPath(root: string, absPath: string): string {
  return relative(root, absPath).split(sep).join('/');
}

/** List every regular file under `root`, sorted by relative path so
 * manifest emission is deterministic (idempotent, meaningful diffs). */
export function walkFiles(root: string): WalkedFile[] {
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const files: WalkedFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const absPath = join(entry.parentPath, entry.name);
    files.push({ relPath: toPosixRelPath(root, absPath), absPath });
  }

  files.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return files;
}
