#!/usr/bin/env node
/**
 * Build an oracle corpus from real PlantUML bug-report fixtures.
 *
 * Samples ~/git/pdiff/dbhum (thousands of real user submissions), tags each by
 * plantuml-ts's OWN dispatcher type (the filename buckets in tests/corpus are
 * unreliable), runs the oracle, and keeps every fixture that emits svek-*.dot —
 * i.e. the graphviz-backed diagrams DOT parity applies to. Output lands in the
 * gitignored oracle/corpus-cache/<type>/<humhash>/ (regenerable; not committed).
 * scripts/oracle-gap.ts then reports the gap over this cache.
 *
 * Usage:  npx tsx scripts/oracle-corpus.ts [sampleSize]   (default 100)
 */
import { execFileSync } from 'node:child_process';
import {
  readdirSync,
  readFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  existsSync,
} from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import '../src/index.js'; // side effect: registers all diagram plugins
import { preprocess } from '../src/core/preprocessor.js';
import { extractBlocks } from '../src/core/block-extractor.js';
import { registry } from '../src/core/dispatcher.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const JAR = join(REPO, 'oracle', 'dist', 'plantuml-oracle.jar');
const DBHUM = join(process.env.HOME ?? '', 'git', 'pdiff', 'dbhum');
const CACHE = join(REPO, 'oracle', 'corpus-cache');

function allFixtures(): string[] {
  return readdirSync(DBHUM, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.puml'))
    .map((p) => join(DBHUM, p))
    .sort();
}

/** Deterministic stride sample — reproducible, spread across the corpus. */
function sample(all: string[], n: number): string[] {
  if (n >= all.length) return all;
  const stride = all.length / n;
  const picks: string[] = [];
  for (let i = 0; i < n; i++) picks.push(all[Math.floor(i * stride)]!);
  return picks;
}

/** plantuml-ts's own diagram type for a fixture, or 'none'/'unknown'. */
function detectType(puml: string): string {
  const blocks = extractBlocks(preprocess(puml).lines);
  if (blocks.length === 0) return 'none';
  return registry.resolve(blocks[0]!).type;
}

function svekCount(dir: string): number {
  return readdirSync(dir).filter((f) => /^svek-\d+\.dot$/.test(f)).length;
}

/** Run the oracle on one fixture; return the number of svek-*.dot it emitted. */
function runOracle(pumlPath: string, outDir: string): number {
  try {
    execFileSync(
      'java',
      ['-DPLANTUML_DUMP_DOT=' + outDir, '-jar', JAR, '-tsvg', '-o', outDir, pumlPath],
      { stdio: 'ignore', timeout: 20_000 },
    );
  } catch {
    /* oracle failed on this fixture — treat as no DOT */
  }
  return svekCount(outDir);
}

/** Capture one fixture into the cache; return its type if it emitted DOT. */
function capture(srcPath: string): string | null {
  const puml = readFileSync(srcPath, 'utf8');
  const type = detectType(puml);
  const id = basename(srcPath, '.puml');
  const dir = join(CACHE, type, id);
  mkdirSync(dir, { recursive: true });
  cpSync(srcPath, join(dir, 'input.puml'));
  if (runOracle(join(dir, 'input.puml'), dir) === 0) {
    rmSync(dir, { recursive: true, force: true });
    return null;
  }
  return type;
}

function main(): void {
  if (!existsSync(JAR)) throw new Error(`oracle jar missing: ${JAR}`);
  if (!existsSync(DBHUM)) throw new Error(`pdiff corpus missing: ${DBHUM}`);
  const n = Number(process.argv[2] ?? '100');

  rmSync(CACHE, { recursive: true, force: true });
  mkdirSync(CACHE, { recursive: true });

  const picks = sample(allFixtures(), n);
  const byType = new Map<string, number>();
  let kept = 0;
  for (const f of picks) {
    const type = capture(f);
    if (type === null) continue;
    kept++;
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }

  const dist = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t}=${c}`)
    .join(' ');
  // eslint-disable-next-line no-console
  console.log(
    `sampled ${picks.length}, kept ${kept} graphviz-backed (svek DOT) into ` +
      `oracle/corpus-cache\n  by plantuml-ts type: ${dist}`,
  );
}

main();
