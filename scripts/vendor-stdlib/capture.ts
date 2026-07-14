/**
 * Verbatim capture of one plantuml-stdlib bundle directory: byte-for-byte
 * copy (fs.copyFileSync — no read/rewrite, no newline or encoding
 * normalization) plus a per-file sha256 manifest and README frontmatter
 * metadata. D3 (decisions.md): copy + hash, never a transform.
 */

import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { extractBundleMetadata, parseFrontmatter } from './frontmatter.js';
import { sha256File } from './hash.js';
import type { BundleFrontmatter, BundleManifest } from './types.js';
import { walkFiles } from './walk.js';

const README_FILENAME = 'README.md';

/** List every child directory of the stdlib source root, sorted, skipping
 * dotfiles/dirs (agent tooling artifacts, not bundles). */
export function listBundleDirs(stdlibRoot: string): string[] {
  return readdirSync(stdlibRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

function readBundleMetadata(srcDir: string): BundleFrontmatter {
  const readmePath = join(srcDir, README_FILENAME);
  try {
    const text = readFileSync(readmePath, 'utf8');
    return extractBundleMetadata(parseFrontmatter(text));
  } catch {
    return {};
  }
}

export interface CaptureResult {
  manifest: BundleManifest;
  metadata: BundleFrontmatter;
}

/** Copy every file of one bundle into destRoot/<name>/... verbatim and
 * build its sha256 manifest (hashed from the copied, on-disk bytes). */
export function captureBundle(
  name: string,
  srcDir: string,
  destRoot: string,
): CaptureResult {
  const destDir = join(destRoot, name);
  const files = walkFiles(srcDir);
  const hashes: Record<string, string> = {};

  for (const file of files) {
    const destPath = join(destDir, file.relPath);
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(file.absPath, destPath);
    hashes[file.relPath] = sha256File(destPath);
  }

  return {
    manifest: { fileCount: files.length, files: hashes },
    metadata: readBundleMetadata(srcDir),
  };
}
