#!/usr/bin/env node
/**
 * Fetch reference PNGs from plantuml.com for every fixture in the
 * per-type manifest files under tests/visual/data/.
 *
 * Usage:
 *   jiti scripts/capture-corpus.ts
 *   jiti scripts/capture-corpus.ts --type sequence
 *   jiti scripts/capture-corpus.ts --dry-run
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { plantumlUrl } from '../tests/visual/plantuml-encode.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DATA_DIR = join(REPO_ROOT, 'tests', 'visual', 'data');
const REF_DIR = join(REPO_ROOT, 'tests', 'visual', 'reference');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FixtureEntry {
  slug: string;
  markup: string;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  filterType: string | null;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const typeIdx = args.indexOf('--type');
  const filterType =
    typeIdx !== -1 && typeIdx + 1 < args.length
      ? (args[typeIdx + 1] ?? null)
      : null;

  const dryRun = args.includes('--dry-run');

  return { filterType, dryRun };
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fetch a single PNG from plantuml.com
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`HTTP ${status} ${statusText}`);
  }
}

async function fetchPng(markup: string): Promise<Buffer> {
  const url = plantumlUrl(markup, 'png');
  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Process one manifest file
// ---------------------------------------------------------------------------

interface TypeSummary {
  fetched: number;
  skipped: number;
  errors: number;
}

async function processManifest(
  type: string,
  entries: FixtureEntry[],
  dryRun: boolean,
): Promise<TypeSummary> {
  const outDir = join(REF_DIR, type);
  mkdirSync(outDir, { recursive: true });

  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    const outPath = join(outDir, `${entry.slug}.png`);

    // Skip if file exists and is non-empty
    if (existsSync(outPath) && statSync(outPath).size > 0) {
      console.log(`skip ${entry.slug}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`would fetch ${entry.slug}`);
      fetched++;
      continue;
    }

    // Fetch and write
    try {
      const png = await fetchPng(entry.markup);
      writeFileSync(outPath, png);
      console.log(`fetched ${entry.slug} (${png.length} bytes)`);
      fetched++;
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        console.log(`error ${entry.slug}: HTTP ${err.status} ${err.statusText}`);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`error ${entry.slug}: ${message}`);
      }
      errors++;
    }

    // Throttle after every fetch attempt (success or failure), not skips
    await sleep(3000);
  }

  return { fetched, skipped, errors };
}

// ---------------------------------------------------------------------------
// Collect manifest files for the requested type(s)
// ---------------------------------------------------------------------------

function collectManifestPaths(filterType: string | null): Array<{ type: string; path: string }> {
  let files: string[];
  try {
    files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`error: cannot read data directory ${DATA_DIR}`);
    return [];
  }

  return files
    .map((f) => ({ type: f.slice(0, -5), path: join(DATA_DIR, f) }))
    .filter(({ type }) => filterType === null || type === filterType);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { filterType, dryRun } = parseArgs();

  if (dryRun) {
    console.log('dry-run: no files will be written');
  }

  if (filterType !== null) {
    console.log(`type filter: ${filterType}`);
  }

  const manifests = collectManifestPaths(filterType);

  if (manifests.length === 0) {
    console.log('no manifest files found');
    return;
  }

  const summaries = new Map<string, TypeSummary>();

  for (const { type, path } of manifests) {
    let entries: FixtureEntry[];
    try {
      const raw = await readFile(path, 'utf-8');
      entries = JSON.parse(raw) as FixtureEntry[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`error reading ${path}: ${message}`);
      continue;
    }

    console.log(`\nprocessing ${type} (${entries.length} fixtures)`);
    const summary = await processManifest(type, entries, dryRun);
    summaries.set(type, summary);
  }

  // Print summary
  console.log('\n--- summary ---');
  for (const [type, { fetched, skipped, errors }] of summaries) {
    console.log(`${type}: ${fetched} fetched, ${skipped} skipped, ${errors} errors`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
