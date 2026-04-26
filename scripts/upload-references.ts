#!/usr/bin/env node
/**
 * Upload captured reference PNGs to the R2 bucket plantuml-reference.
 * Files are served at https://plantuml-orig.knowvah.com/<type>/<slug>.png
 *
 * Usage:
 *   jiti scripts/upload-references.ts
 *   jiti scripts/upload-references.ts --type sequence
 *
 * Idempotent: tracks uploaded files in tests/visual/.r2-upload-manifest.json
 * by relative path + file size. Re-upload by deleting the manifest entry.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REF_DIR = join(REPO_ROOT, 'tests', 'visual', 'reference');
const MANIFEST_PATH = join(REPO_ROOT, 'tests', 'visual', '.r2-upload-manifest.json');
const BUCKET = 'plantuml-reference';

// ---------------------------------------------------------------------------
// Manifest (relative-path → file size, used for idempotency)
// ---------------------------------------------------------------------------

type Manifest = Record<string, number>;

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest;
  } catch {
    return {};
  }
}

function saveManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Upload one file via wrangler
// ---------------------------------------------------------------------------

function uploadFile(localPath: string, r2Key: string): boolean {
  const result = spawnSync(
    'npx',
    ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${r2Key}`, '--file', localPath, '--content-type', 'image/png', '--remote'],
    { stdio: 'inherit' },
  );
  return result.status === 0;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { filterType: string | null } {
  const args = process.argv.slice(2);
  const typeIdx = args.indexOf('--type');
  if (typeIdx !== -1 && typeIdx + 1 < args.length) {
    return { filterType: args[typeIdx + 1] ?? null };
  }
  return { filterType: null };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { filterType } = parseArgs();

  if (!existsSync(REF_DIR)) {
    console.error(`Reference directory not found: ${REF_DIR}`);
    console.error('Run npm run visual:capture first.');
    process.exitCode = 1;
    return;
  }

  const manifest = loadManifest();
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  const typeDirs = readdirSync(REF_DIR).filter((d) => {
    if (filterType !== null && d !== filterType) return false;
    return statSync(join(REF_DIR, d)).isDirectory();
  });

  for (const typeDir of typeDirs) {
    const typePath = join(REF_DIR, typeDir);
    const files = readdirSync(typePath).filter((f) => f.endsWith('.png'));
    console.log(`\n${typeDir}: ${files.length} file(s)`);

    for (const fname of files) {
      const localPath = join(typePath, fname);
      const relKey = relative(REF_DIR, localPath); // e.g. sequence/slug.png
      const r2Key = relKey.replace(/\\/g, '/');     // normalise on Windows
      const size = statSync(localPath).size;

      if (manifest[r2Key] === size) {
        process.stdout.write(`  skip ${fname}\n`);
        skipped++;
        continue;
      }

      process.stdout.write(`  uploading ${fname}... `);
      const ok = uploadFile(localPath, r2Key);
      if (ok) {
        manifest[r2Key] = size;
        saveManifest(manifest);
        process.stdout.write('ok\n');
        uploaded++;
      } else {
        errors++;
      }
    }
  }

  console.log(`\n--- summary ---`);
  console.log(`uploaded: ${uploaded}, skipped: ${skipped}, errors: ${errors}`);
}

main();
