#!/usr/bin/env node
/**
 * DOT-input divergence pass — the AUTHORITATIVE visual-QA comparison.
 *
 * Project policy: an SVG difference only matters when the DOT input we feed
 * graphviz matches what PlantUML feeds graphviz. This compares, per fixture, our
 * captured DotInputGraph (setLayoutInputObserver) against PlantUML's svek-*.dot
 * (dumped via -DPLANTUML_DUMP_DOT), structurally (node/edge/degree/cluster).
 *
 * Buckets:
 *   match        — DOT input structurally identical → any SVG diff is a real
 *                  render/graphviz-ts bug worth chasing.
 *   diverge      — DOT differs → our parser/layout produces a different graph;
 *                  SVG diff is expected, not investigated (per policy).
 *   count        — different number of graphs emitted.
 *   no-candidate — our engine fed graphviz nothing (render error / unsupported).
 *
 * Usage: npx tsx scripts/visual-qa-dot.ts [--limit N] [type ...]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';

import { renderSync } from '../src/index.js';
import { setLayoutInputObserver } from '../src/core/graph-layout.js';
import { FormulaMeasurer } from '../src/core/measurer.js';
import type { DotInputGraph } from '../src/core/graph-layout.js';
import { parseSvekDot, dotInputToStructural, compareStructural } from '../tests/oracle/svek-dot.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(REPO, 'tests', 'visual', 'data');
const WORK = join(tmpdir(), 'plantuml-vqdot');

interface Fixture { slug: string; markup: string }
type Bucket = 'match' | 'diverge' | 'count' | 'no-candidate';

function resolveJar(): string {
  if (process.env.PLANTUML_JAR !== undefined) return process.env.PLANTUML_JAR;
  const libs = join(homedir(), 'git', 'plantuml', 'build', 'libs');
  const jar = readdirSync(libs).find((f) => /^plantuml-.*\.jar$/.test(f));
  if (jar === undefined) throw new Error('No PlantUML jar; set PLANTUML_JAR.');
  return join(libs, jar);
}

/** PlantUML's svek-*.dot for one fixture, via -DPLANTUML_DUMP_DOT. */
function plantumlDots(jar: string, markup: string): string[] {
  const dir = join(WORK, 'one');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'in.puml'), markup, 'utf-8');
  try {
    execFileSync('java', ['-DPLANTUML_DUMP_DOT=' + dir, '-jar', jar, '-tsvg', '-o', dir, join(dir, 'in.puml')], {
      stdio: 'ignore',
      timeout: 25_000,
    });
  } catch {
    /* partial — read what landed */
  }
  return readdirSync(dir)
    .filter((f) => /^svek-\d+\.dot$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((f) => readFileSync(join(dir, f), 'utf-8'));
}

function ourInputs(markup: string): DotInputGraph[] {
  const inputs: DotInputGraph[] = [];
  setLayoutInputObserver((g) => inputs.push(g));
  try {
    renderSync(markup, { measurer: new FormulaMeasurer() });
  } catch {
    /* no candidate */
  } finally {
    setLayoutInputObserver(undefined);
  }
  return inputs;
}

function bucketFor(dots: string[], inputs: DotInputGraph[]): Bucket {
  if (inputs.length === 0) return 'no-candidate';
  if (dots.length !== inputs.length) return 'count';
  for (let i = 0; i < dots.length; i++) {
    const diff = compareStructural(parseSvekDot(dots[i]!), dotInputToStructural(inputs[i]!));
    if (!diff.structurallyEqual) return 'diverge';
  }
  return 'match';
}

function runType(jar: string, type: string, limit: number): void {
  const all = JSON.parse(readFileSync(join(DATA_DIR, type + '.json'), 'utf-8')) as Fixture[];
  const fixtures = limit > 0 ? all.slice(0, limit) : all;
  const tally: Record<Bucket, number> = { match: 0, diverge: 0, count: 0, 'no-candidate': 0 };
  const matched: string[] = [];
  for (const f of fixtures) {
    const b = bucketFor(plantumlDots(jar, f.markup), ourInputs(f.markup));
    tally[b]++;
    if (b === 'match') matched.push(f.slug);
  }
  console.log('\n[' + type + '] sampled ' + fixtures.length + '/' + all.length);
  console.log('  match (DOT identical): ' + tally.match);
  console.log('  diverge (DOT differs): ' + tally.diverge);
  console.log('  count (graph-count differs): ' + tally.count);
  console.log('  no-candidate (we feed nothing): ' + tally['no-candidate']);
  console.log('  → SVG-investigable (DOT match): ' + (matched.length > 0 ? matched.slice(0, 20).join(', ') : 'none'));
}

function main(): void {
  const jar = resolveJar();
  const argv = process.argv.slice(2);
  let limit = 50;
  const types: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') { limit = Number(argv[++i]); }
    else types.push(argv[i]!);
  }
  const runTypes = types.length > 0 ? types : ['component', 'usecase'];
  mkdirSync(WORK, { recursive: true });
  for (const t of runTypes) runType(jar, t, limit);
}

main();
