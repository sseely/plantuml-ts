#!/usr/bin/env node
/**
 * DOT-sync report — how close our DotInputGraph is to PlantUML's svek DOT across
 * the genuine DESCRIPTION fixtures (component + usecase corpus buckets, filtered
 * to PlantUML data-diagram-type=DESCRIPTION via the cached canonical SVGs).
 *
 * Goal: drive "DOT in sync across the corpus". Reports the structural-equality
 * rate and, for the misses, which checks fail (node/edge/degree/cluster) and
 * whether we over- or under-produce, with representative fixtures per category.
 *
 * PlantUML's svek DOT is cached under test-results/dot-cache/<type>/<slug>/ (via
 * -DPLANTUML_DUMP_DOT) so re-runs after a parser/layout change are fast.
 *
 * Usage: npx tsx scripts/dot-sync-report.ts [--rebuild] [type ...]
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

import { renderSync } from '../src/index.js';
import { setLayoutInputObserver } from '../src/core/graph-layout.js';
import { FormulaMeasurer } from '../src/core/measurer.js';
import type { DotInputGraph } from '../src/core/graph-layout.js';
import {
  parseSvekDot,
  dotInputToStructural,
  compareStructural,
  type StructuralDiff,
} from '../tests/oracle/svek-dot.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(REPO, 'tests', 'visual', 'data');
const CANON_DIR = join(REPO, 'test-results', 'visual-qa-svg', 'canonical');
const CACHE = join(REPO, 'test-results', 'dot-cache');

interface Fixture { slug: string; markup: string }

function resolveJar(): string {
  if (process.env.PLANTUML_JAR !== undefined) return process.env.PLANTUML_JAR;
  const libs = join(homedir(), 'git', 'plantuml', 'build', 'libs');
  const jar = readdirSync(libs).find((f) => /^plantuml-.*\.jar$/.test(f));
  if (jar === undefined) throw new Error('No PlantUML jar; set PLANTUML_JAR.');
  return join(libs, jar);
}

/** Slugs the cached canonical SVG marks as a DESCRIPTION diagram. */
function descriptionSlugs(type: string): Set<string> {
  const dir = join(CANON_DIR, type);
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.svg')) continue;
    if (readFileSync(join(dir, f), 'utf-8').includes('data-diagram-type="DESCRIPTION"')) {
      out.add(f.replace(/\.svg$/, ''));
    }
  }
  return out;
}

function dotFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^svek-\d+\.dot$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
    .map((f) => readFileSync(join(dir, f), 'utf-8'));
}

/** Cached PlantUML svek DOT for a fixture; dumps once via -DPLANTUML_DUMP_DOT. */
function plantumlDots(jar: string, type: string, f: Fixture, rebuild: boolean): string[] {
  const dir = join(CACHE, type, f.slug);
  const done = join(dir, '.done');
  if (!rebuild && existsSync(done)) return dotFiles(dir);
  mkdirSync(dir, { recursive: true });
  for (const old of readdirSync(dir)) {
    if (/^svek-\d+\.dot$/.test(old)) writeFileSync(join(dir, old), '');
  }
  writeFileSync(join(dir, 'in.puml'), f.markup, 'utf-8');
  try {
    execFileSync(
      'java',
      ['-DPLANTUML_DUMP_DOT=' + dir, '-jar', jar, '-tsvg', '-o', dir, join(dir, 'in.puml')],
      { stdio: 'ignore', timeout: 25_000 },
    );
  } catch {
    /* partial — read what landed */
  }
  writeFileSync(done, '');
  return dotFiles(dir);
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

interface Agg {
  total: number;
  equal: number;
  noCandidate: number;
  countMismatch: number;
  fail: Record<string, number>;
  nodeOver: number;
  nodeUnder: number;
  edgeOver: number;
  edgeUnder: number;
  clusterOver: number;
  clusterUnder: number;
  examples: Record<string, string[]>;
}

const CHECKS = ['nodeCountOk', 'edgeCountOk', 'degreeOk', 'minlenOk', 'shapeOk', 'labelOk', 'clusterOk'] as const;

function newAgg(): Agg {
  return {
    total: 0, equal: 0, noCandidate: 0, countMismatch: 0,
    fail: Object.fromEntries(CHECKS.map((c) => [c, 0])),
    nodeOver: 0, nodeUnder: 0, edgeOver: 0, edgeUnder: 0, clusterOver: 0, clusterUnder: 0,
    examples: Object.fromEntries(CHECKS.map((c) => [c, []])),
  };
}

function recordDeltas(a: Agg, d: StructuralDiff): void {
  if (d.candidate.nodes > d.oracle.nodes) a.nodeOver++;
  else if (d.candidate.nodes < d.oracle.nodes) a.nodeUnder++;
  if (d.candidate.edges > d.oracle.edges) a.edgeOver++;
  else if (d.candidate.edges < d.oracle.edges) a.edgeUnder++;
  if (d.candidate.clusters > d.oracle.clusters) a.clusterOver++;
  else if (d.candidate.clusters < d.oracle.clusters) a.clusterUnder++;
}

function recordDiff(a: Agg, slug: string, diffs: StructuralDiff[]): void {
  for (const d of diffs) {
    for (const c of CHECKS) {
      if (!d[c]) {
        a.fail[c] = (a.fail[c] ?? 0) + 1;
        if (a.examples[c]!.length < 6) a.examples[c]!.push(slug);
      }
    }
    recordDeltas(a, d);
  }
}

function analyzeFixture(a: Agg, slug: string, dots: string[], inputs: DotInputGraph[]): void {
  a.total++;
  if (inputs.length === 0) { a.noCandidate++; return; }
  if (dots.length !== inputs.length) { a.countMismatch++; return; }
  const diffs = dots.map((dot, i) => compareStructural(parseSvekDot(dot), dotInputToStructural(inputs[i]!)));
  if (diffs.every((d) => d.structurallyEqual)) { a.equal++; return; }
  recordDiff(a, slug, diffs);
}

function report(type: string, a: Agg): void {
  const pct = (n: number): string => ((100 * n) / a.total).toFixed(0) + '%';
  console.log('\n===== ' + type + ' — ' + a.total + ' DESCRIPTION fixtures =====');
  console.log('  structurally EQUAL (DOT in sync): ' + a.equal + ' (' + pct(a.equal) + ')');
  console.log('  no-candidate (we feed nothing):   ' + a.noCandidate);
  console.log('  graph-count mismatch:             ' + a.countMismatch);
  console.log('  diverging-check failures (per fixture, among the rest):');
  for (const c of CHECKS) {
    if (a.fail[c]! > 0) console.log('    ' + c.padEnd(12) + ' fails: ' + a.fail[c] + '   e.g. ' + a.examples[c]!.slice(0, 4).join(', '));
  }
  console.log('  node count: over ' + a.nodeOver + ' / under ' + a.nodeUnder +
    ' | edges: over ' + a.edgeOver + ' / under ' + a.edgeUnder +
    ' | clusters: over ' + a.clusterOver + ' / under ' + a.clusterUnder);
}

function runType(jar: string, type: string, rebuild: boolean): void {
  const slugs = descriptionSlugs(type);
  const all = JSON.parse(readFileSync(join(DATA_DIR, type + '.json'), 'utf-8')) as Fixture[];
  const a = newAgg();
  let done = 0;
  for (const f of all) {
    if (!slugs.has(f.slug)) continue;
    analyzeFixture(a, f.slug, plantumlDots(jar, type, f, rebuild), ourInputs(f.markup));
    if (++done % 50 === 0) console.error('  ' + type + ': ' + done + '/' + slugs.size);
  }
  report(type, a);
}

function main(): void {
  const jar = resolveJar();
  const argv = process.argv.slice(2);
  const rebuild = argv.includes('--rebuild');
  const types = argv.filter((x) => x !== '--rebuild');
  mkdirSync(CACHE, { recursive: true });
  for (const t of types.length > 0 ? types : ['component', 'usecase']) runType(jar, t, rebuild);
}

main();
