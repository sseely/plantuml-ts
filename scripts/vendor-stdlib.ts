#!/usr/bin/env node
/**
 * Vendor pipeline for the plantuml-stdlib bundles (mission SI5b, T1).
 *
 * Copies every child directory of ~/git/plantuml-stdlib/stdlib/ verbatim
 * (binary-safe, no transform — decisions.md D1/D3) into gitignored
 * assets/stdlib/, pinned to the source repo's current commit SHA, and
 * writes a committed sha256 manifest: assets/stdlib.manifest.json (root
 * index) + assets/manifests/<bundle>.json (per-bundle file/hash map — the
 * combined set is too large for one manifest file, see the module header
 * comment on RootManifest in vendor-stdlib/types.ts).
 *
 * All git access here is read-only (rev-parse HEAD, remote get-url) on
 * the SOURCE repo (~/git/plantuml-stdlib) only; this repo is never
 * mutated by this script.
 *
 * Usage:
 *   jiti scripts/vendor-stdlib.ts            capture (idempotent)
 *   jiti scripts/vendor-stdlib.ts --verify   re-hash assets vs manifest
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { captureBundle, listBundleDirs } from './vendor-stdlib/capture.js';
import { readJson, writeJson } from './vendor-stdlib/manifest-io.js';
import type {
  BundleIndexEntry,
  BundleManifest,
  RootManifest,
} from './vendor-stdlib/types.js';
import { verifyBundle } from './vendor-stdlib/verify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const SOURCE_REPO_DIR = join(homedir(), 'git', 'plantuml-stdlib');
const STDLIB_SOURCE_DIR = join(SOURCE_REPO_DIR, 'stdlib');
const ASSETS_STDLIB_DIR = join(REPO_ROOT, 'assets', 'stdlib');
const MANIFESTS_DIR = join(REPO_ROOT, 'assets', 'manifests');
const ROOT_MANIFEST_PATH = join(REPO_ROOT, 'assets', 'stdlib.manifest.json');
const GENERATED_BY = 'scripts/vendor-stdlib.ts';

function readSourceGitInfo(): { sourceSha: string; sourceRepo: string } {
  const sourceSha = execFileSync(
    'git',
    ['-C', SOURCE_REPO_DIR, 'rev-parse', 'HEAD'],
    { encoding: 'utf8' },
  ).trim();
  const remoteUrl = execFileSync(
    'git',
    ['-C', SOURCE_REPO_DIR, 'remote', 'get-url', 'origin'],
    { encoding: 'utf8' },
  ).trim();
  const sourceRepo = remoteUrl.replace(/\.git$/, '');
  return { sourceSha, sourceRepo };
}

function runCapture(): void {
  if (!existsSync(STDLIB_SOURCE_DIR)) {
    throw new Error(`stdlib source not found at ${STDLIB_SOURCE_DIR}`);
  }

  const { sourceSha, sourceRepo } = readSourceGitInfo();
  const bundleNames = listBundleDirs(STDLIB_SOURCE_DIR);
  const bundles: Record<string, BundleIndexEntry> = {};

  for (const name of bundleNames) {
    const srcDir = join(STDLIB_SOURCE_DIR, name);
    const { manifest, metadata } = captureBundle(name, srcDir, ASSETS_STDLIB_DIR);
    writeJson(join(MANIFESTS_DIR, `${name}.json`), manifest);
    bundles[name] = {
      ...metadata,
      fileCount: manifest.fileCount,
      manifestPath: `assets/manifests/${name}.json`,
    };
    console.log(`captured ${name}: ${manifest.fileCount} files`);
  }

  const rootManifest: RootManifest = {
    sourceRepo,
    sourceSha,
    generatedBy: GENERATED_BY,
    bundles,
  };
  writeJson(ROOT_MANIFEST_PATH, rootManifest);

  console.log(`\nwrote ${ROOT_MANIFEST_PATH}`);
  console.log(`bundles: ${bundleNames.length}, sourceSha: ${sourceSha}`);
}

function runVerify(): void {
  if (!existsSync(ROOT_MANIFEST_PATH)) {
    throw new Error(`manifest not found: ${ROOT_MANIFEST_PATH} (run capture first)`);
  }

  const rootManifest = readJson<RootManifest>(ROOT_MANIFEST_PATH);
  const bundleNames = Object.keys(rootManifest.bundles).sort();
  let totalFiles = 0;
  let totalMismatches = 0;

  for (const name of bundleNames) {
    const entry = rootManifest.bundles[name];
    if (!entry) {
      continue;
    }
    const bundleManifest = readJson<BundleManifest>(join(REPO_ROOT, entry.manifestPath));
    const mismatches = verifyBundle(name, bundleManifest, ASSETS_STDLIB_DIR);
    totalFiles += bundleManifest.fileCount;
    totalMismatches += mismatches.length;
    for (const mismatch of mismatches) {
      console.error(`MISMATCH ${mismatch.bundle}/${mismatch.file}: ${mismatch.reason}`);
    }
  }

  console.log(`\nverified ${totalFiles} files across ${bundleNames.length} bundles`);
  if (totalMismatches > 0) {
    console.error(`${totalMismatches} mismatch(es) found`);
    process.exitCode = 1;
    return;
  }
  console.log('all files verbatim (sha256 match)');
}

function main(): void {
  if (process.argv.includes('--verify')) {
    runVerify();
  } else {
    runCapture();
  }
}

try {
  main();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`error: ${message}`);
  process.exitCode = 1;
}
