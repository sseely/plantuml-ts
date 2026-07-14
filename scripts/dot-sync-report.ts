#!/usr/bin/env node
/**
 * DOT-sync report — how close our DotInputGraph is to PlantUML's svek DOT across a fixture
 * corpus, filtered per-type to the PlantUML data-diagram-type it should render as (via cached
 * canonical SVGs). PlantUML's svek DOT is cached under test-results/dot-cache/<type>/<slug>/
 * (via -DPLANTUML_DUMP_DOT) so re-runs after a parser/layout change are fast.
 *
 * Modes:
 *   [--rebuild] [--type-tag TAG] [type ...]   Aggregate report (default: component usecase).
 *     Canonical SVGs are self-built via the oracle jar (batch mode) if missing for a type.
 *   --slug <slug> <type>   Drill-down: oracle svek DOT, our emitted svek DOT (toSvekDot), and
 *     the per-check StructuralDiff with underlying values for every failing check, one fixture.
 *   --probe-json-dot   One-shot probe: does -DPLANTUML_DUMP_DOT produce svek-*.dot for the
 *     json/dot corpora? Writes findings to plans/dot-oracle-sync/phase-5-json-dot/probe.md.
 *   --equal-list   Aggregate-report addendum: writes the sorted list of slugs classified
 *     "structurally EQUAL" per type to test-results/dot-sync-equal/<type>.txt (one per line) —
 *     a machine-readable feed for promoting fixtures into oracle/goldens/.
 *   --markdown   Writes docs/parity-report.md: one row per manifest type with comparable/equal/
 *     oracle-blind counts. Types with no dot-cache dump get a "not yet measured" row (never a
 *     failure). Reads only what is already cached — no oracle jar batch build (D1, see
 *     plans/docs-site/decisions.md).
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

import { renderSync } from '../src/index.js';
import { setLayoutInputObserver } from '../src/core/graph-layout.js';
import { WidthTableMeasurer } from '../src/core/measurer.js';
import { MapIncludeStore } from '../src/core/tim/IncludeStore.js';
import { withStdlib } from '../src/core/tim/StdlibStore.js';
import { buildStdlibAssetsStore } from './stdlib-assets-store.js';
import type { DotInputGraph } from '../src/core/graph-layout.js';
import {
  parseSvekDot,
  dotInputToStructural,
  compareStructural,
  type StructuralDiff,
} from '../tests/oracle/svek-dot.js';
import { CHECKS, drillDownGraph, stripLayoutPragma } from './dot-sync-drilldown.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
/** execFileSync stdout cap for jar batch runs (256 MiB). */
const MAX_JAR_BUFFER_BYTES = 2 ** 28;
/** Lizard-safe (no regex literals): matches svek-<N>.dot dump files. */
const SVEK_DOT_RE = new RegExp('^svek-([0-9]+)\\.dot$');
const DATA_DIR = join(REPO, 'tests', 'visual', 'data');
const CANON_DIR = join(REPO, 'test-results', 'visual-qa-svg', 'canonical');
const CANON_PUML_DIR = join(REPO, 'test-results', 'visual-qa-svg', 'puml');
const CACHE = join(REPO, 'test-results', 'dot-cache');
const PROBE_OUT = join(REPO, 'plans', 'dot-oracle-sync', 'phase-5-json-dot', 'probe.md');
const EQUAL_LIST_DIR = join(REPO, 'test-results', 'dot-sync-equal');

interface Fixture { slug: string; markup: string }

/** Expected PlantUML data-diagram-type per corpus bucket we know how to classify. Override with --type-tag. */
const EXPECTED_TAG: Record<string, string> = {
  component: 'DESCRIPTION',
  usecase: 'DESCRIPTION',
  class: 'CLASS',
  object: 'CLASS', // no separate object engine upstream (ClassDiagramFactory.java)
  state: 'STATE',
};

function resolveJar(): string {
  if (process.env.PLANTUML_JAR !== undefined) {
    console.error(`[dot-sync] oracle jar: ${process.env.PLANTUML_JAR}`);
    return process.env.PLANTUML_JAR;
  }
  const distJar = join(REPO, 'oracle', 'dist', 'plantuml-oracle.jar');
  if (existsSync(distJar)) {
    console.error(`[dot-sync] oracle jar: ${distJar}`);
    return distJar;
  }
  const libs = join(homedir(), 'git', 'plantuml', 'build', 'libs');
  const jar = existsSync(libs)
    ? readdirSync(libs).find((f) => /^plantuml-.*\.jar$/.test(f))
    : undefined;
  if (jar === undefined) throw new Error('No PlantUML jar; set PLANTUML_JAR.');
  const resolved = join(libs, jar);
  console.error(`[dot-sync] oracle jar: ${resolved}`);
  return resolved;
}

function loadFixtures(type: string): Fixture[] | undefined {
  const p = join(DATA_DIR, type + '.json');
  if (!existsSync(p)) return undefined;
  return JSON.parse(readFileSync(p, 'utf-8')) as Fixture[];
}

function findFixture(type: string, slug: string): Fixture {
  const fixtures = loadFixtures(type);
  if (fixtures === undefined) {
    throw new Error('No fixture manifest for "' + type + '" at tests/visual/data/' + type + '.json');
  }
  const f = fixtures.find((x) => x.slug === slug);
  if (f === undefined) throw new Error('Slug "' + slug + '" not found in ' + type + '.json');
  return f;
}

/** Slugs whose cached canonical SVG carries data-diagram-type="<tag>". */
function taggedSlugs(type: string, tag: string): Set<string> {
  const dir = join(CANON_DIR, type);
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.svg')) continue;
    if (readFileSync(join(dir, f), 'utf-8').includes('data-diagram-type="' + tag + '"')) {
      out.add(f.replace(/\.svg$/, ''));
    }
  }
  return out;
}

function freshDir(path: string): string {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
  return path;
}

/** Batch-renders canonical SVGs for a type via the oracle jar. */
function generateCanonical(jar: string, type: string, fixtures: Fixture[]): void {
  const pumlDir = freshDir(join(CANON_PUML_DIR, type));
  const svgDir = freshDir(join(CANON_DIR, type));
  for (const f of fixtures) writeFileSync(join(pumlDir, f.slug + '.puml'), stripLayoutPragma(f.markup), 'utf-8');
  try {
    execFileSync('java', ['-DPLANTUML_DETERMINISTIC_TEXT=true', '-jar', jar, '-tsvg', '-nometadata', '-o', svgDir, pumlDir], {
      stdio: ['ignore', 'ignore', 'inherit'],
      maxBuffer: MAX_JAR_BUFFER_BYTES,
    });
  } catch {
    /* partial batch — valid SVGs are on disk */
  }
}

/** Ensures test-results/visual-qa-svg/canonical/<type>/ is populated,
 *  building it via the oracle jar if missing. */
function ensureCanonical(jar: string, type: string, fixtures: Fixture[]): void {
  const dir = join(CANON_DIR, type);
  if (existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.svg'))) return;
  console.error('No canonical SVG cache for "' + type + '" — generating via oracle jar…');
  generateCanonical(jar, type, fixtures);
}

const svekDotIndex = (f: string): number => Number(SVEK_DOT_RE.exec(f)?.[1] ?? 0);

function dotFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => SVEK_DOT_RE.test(f))
    .sort((a, b) => svekDotIndex(a) - svekDotIndex(b))
    .map((f) => readFileSync(join(dir, f), 'utf-8'));
}

/** Cached PlantUML svek DOT for a fixture; dumps once via -DPLANTUML_DUMP_DOT. */
function plantumlDots(jar: string, type: string, f: Fixture, rebuild: boolean): string[] {
  const dir = join(CACHE, type, f.slug);
  const done = join(dir, '.done');
  if (!rebuild && existsSync(done)) return dotFiles(dir);
  mkdirSync(dir, { recursive: true });
  for (const old of readdirSync(dir)) {
    if (SVEK_DOT_RE.test(old)) writeFileSync(join(dir, old), '');
  }
  writeFileSync(join(dir, 'in.puml'), stripLayoutPragma(f.markup), 'utf-8');
  try {
    execFileSync(
      'java',
      ['-DPLANTUML_DETERMINISTIC_TEXT=true', '-DPLANTUML_DUMP_DOT=' + dir, '-jar', jar, '-tsvg', '-o', dir, join(dir, 'in.puml')],
      { stdio: 'ignore', timeout: 25_000 },
    );
  } catch {
    /* partial — read what landed */
  }
  writeFileSync(done, '');
  return dotFiles(dir);
}

/** Types whose `!include <bundle/thing>` fixtures this report resolves
 *  through the assets-backed stdlib store (T9's 6 target fixtures are all
 *  component/usecase). class/object/state stay on the pre-T9 no-store
 *  behavior deliberately -- `class-dot-parity.test.ts`'s doc comment: a few
 *  pinned CLASS-tagged fixtures (`!include <tupadr3/...>` PLUS a
 *  jar-embedded `sprite NAME jar:...` our port can't resolve either way)
 *  are pinned EQUAL as a legitimate 0-vs-0 (both sides skip graphviz for a
 *  single-leaf diagram) specifically BECAUSE our side currently errors
 *  before layout; resolving the include surfaces a SEPARATE, out-of-scope
 *  single-leaf-detection divergence in the class engine
 *  (bidusa-22-jutu505, ruliki-78-biji661) that would move the FROZEN
 *  class/object/state denominators this mission must not touch. */
const STDLIB_WIRED_TYPES = new Set(['component', 'usecase']);

/** `!include <bundle/thing>` fixtures (D9 sprite-dims mechanisms, T9) need a
 *  stdlib store or they hit `StdlibNotBundledError` before layout ever
 *  runs -- an assets-backed store (`scripts/stdlib-assets-store.ts`) is
 *  wired into every render this report drives for `STDLIB_WIRED_TYPES`. */
function ourInputs(type: string, markup: string): DotInputGraph[] {
  const inputs: DotInputGraph[] = [];
  setLayoutInputObserver((g) => inputs.push(g));
  try {
    renderSync(markup, {
      measurer: new WidthTableMeasurer(),
      ...(STDLIB_WIRED_TYPES.has(type)
        ? { includeStore: withStdlib(new MapIncludeStore(), buildStdlibAssetsStore()) }
        : {}),
    });
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
  /** `!pragma layout elk` — the oracle jar dumps DOT only on the
   *  graphviz path, so these fixtures have no oracle to compare against.
   *  Excluded from the comparable total. */
  oracleBlind: number;
  fail: Record<string, number>;
  nodeOver: number;
  nodeUnder: number;
  edgeOver: number;
  edgeUnder: number;
  clusterOver: number;
  clusterUnder: number;
  examples: Record<string, string[]>;
  /** Slugs classified "structurally EQUAL", in encounter order. Populated
   *  regardless of --equal-list so callers can inspect the report result
   *  directly; only written to disk when that flag is passed. */
  equalSlugs: string[];
}

function newAgg(): Agg {
  return {
    total: 0, equal: 0, noCandidate: 0, countMismatch: 0, oracleBlind: 0,
    fail: Object.fromEntries(CHECKS.map((c) => [c, 0])),
    nodeOver: 0, nodeUnder: 0, edgeOver: 0, edgeUnder: 0, clusterOver: 0, clusterUnder: 0,
    examples: Object.fromEntries(CHECKS.map((c) => [c, []])),
    equalSlugs: [],
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
  // Both sides skip graphviz (degenerate single-leaf / empty diagrams):
  // GraphvizImageBuilder.buildImage:211-222 — that IS DOT-count agreement.
  if (dots.length === 0 && inputs.length === 0) { a.equal++; a.equalSlugs.push(slug); return; }
  if (inputs.length === 0) { a.noCandidate++; return; }
  if (dots.length !== inputs.length) { a.countMismatch++; return; }
  const diffs = dots.map((dot, i) => compareStructural(parseSvekDot(dot), dotInputToStructural(inputs[i]!)));
  if (diffs.every((d) => d.structurallyEqual)) { a.equal++; a.equalSlugs.push(slug); return; }
  recordDiff(a, slug, diffs);
}

function report(type: string, tag: string, a: Agg): void {
  const pct = (n: number): string => ((100 * n) / a.total).toFixed(0) + '%';
  console.log('\n===== ' + type + ' — ' + a.total + ' ' + tag + ' fixtures =====');
  console.log('  structurally EQUAL (DOT in sync): ' + a.equal + ' (' + pct(a.equal) + ')');
  console.log('  no-candidate (we feed nothing):   ' + a.noCandidate);
  console.log('  oracle-blind (pragma layout):     ' + a.oracleBlind);
  console.log('  graph-count mismatch:             ' + a.countMismatch);
  console.log('  diverging-check failures (per fixture, among the rest):');
  for (const c of CHECKS) {
    if (a.fail[c]! > 0) console.log('    ' + c.padEnd(12) + ' fails: ' + a.fail[c] + '   e.g. ' + a.examples[c]!.slice(0, 4).join(', '));
  }
  console.log('  node count: over ' + a.nodeOver + ' / under ' + a.nodeUnder +
    ' | edges: over ' + a.edgeOver + ' / under ' + a.edgeUnder +
    ' | clusters: over ' + a.clusterOver + ' / under ' + a.clusterUnder);
}

/** Writes the sorted EQUAL slug list for a type to
 *  test-results/dot-sync-equal/<type>.txt (one slug per line). */
function writeEqualList(type: string, a: Agg): void {
  mkdirSync(EQUAL_LIST_DIR, { recursive: true });
  const out = join(EQUAL_LIST_DIR, type + '.txt');
  const sorted = [...a.equalSlugs].sort();
  writeFileSync(out, sorted.join('\n') + (sorted.length > 0 ? '\n' : ''), 'utf-8');
  console.error('[dot-sync] wrote ' + sorted.length + ' EQUAL slugs to ' + out);
}

/** Core aggregation shared by the console report and --markdown: classifies `fixtures` to `tag`
 *  via cached canonical SVGs, diffs each non-oracle-blind fixture's cached DOT against ours. */
function buildAgg(jar: string, type: string, fixtures: Fixture[], tag: string, rebuild: boolean): Agg {
  const slugs = taggedSlugs(type, tag);
  const a = newAgg();
  let done = 0;
  for (const f of fixtures) {
    if (!slugs.has(f.slug)) continue;
    if (/!pragma\s+layout\s+elk/i.test(f.markup)) { a.oracleBlind++; continue; }
    analyzeFixture(a, f.slug, plantumlDots(jar, type, f, rebuild), ourInputs(type, f.markup));
    if (++done % 50 === 0) console.error('  ' + type + ': ' + done + '/' + slugs.size);
  }
  return a;
}

function runType(jar: string, type: string, rebuild: boolean, tagOverride: string | undefined, equalList: boolean): void {
  const fixtures = loadFixtures(type);
  if (fixtures === undefined) {
    console.error(
      'No fixture manifest for "' + type + '" at tests/visual/data/' + type + '.json. ' +
      'Run npm run visual:classify first, then re-run this report.',
    );
    return;
  }
  const tag = tagOverride ?? EXPECTED_TAG[type];
  if (tag === undefined) {
    console.error('No known expected data-diagram-type for "' + type + '"; pass --type-tag <TAG>.');
    return;
  }
  ensureCanonical(jar, type, fixtures);
  const a = buildAgg(jar, type, fixtures, tag, rebuild);
  report(type, tag, a);
  if (equalList) writeEqualList(type, a);
}

// --markdown -------------------------------------------------------------------

const PARITY_REPORT_OUT = join(REPO, 'docs', 'parity-report.md');
interface TypeRow { type: string; comparable: number; equal: number; pct: string; oracleBlind: number; note: string }
const NOT_MEASURED = (type: string, note: string): TypeRow => ({ type, comparable: 0, equal: 0, pct: '—', oracleBlind: 0, note });

/** All diagram types with a fixture manifest, sorted for a stable report. */
function manifestTypes(): string[] {
  return readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
}

/** One report row for `type`. Unlike ensureCanonical, never invokes the oracle jar's batch build — reads only what is cached. */
function markdownRowForType(jar: string, type: string): TypeRow {
  const cacheDir = join(CACHE, type);
  if (!existsSync(cacheDir) || readdirSync(cacheDir).length === 0) return NOT_MEASURED(type, 'not yet measured');
  const fixtures = loadFixtures(type);
  if (fixtures === undefined) return NOT_MEASURED(type, 'not yet measured');
  const tag = EXPECTED_TAG[type];
  const canonDir = join(CANON_DIR, type);
  const hasCanon = tag !== undefined && existsSync(canonDir) && readdirSync(canonDir).some((f) => f.endsWith('.svg'));
  if (!hasCanon) return NOT_MEASURED(type, 'oracle dumps cached but no data-diagram-type classification available — run with --type-tag to classify');
  const a = buildAgg(jar, type, fixtures, tag!, false);
  const pct = a.total > 0 ? ((100 * a.equal) / a.total).toFixed(0) + '%' : '—';
  return { type, comparable: a.total, equal: a.equal, pct, oracleBlind: a.oracleBlind, note: '—' };
}

const MARKDOWN_LEGEND = [
  '- **comparable** — fixtures classified to this type (cached canonical SVG `data-diagram-type`) whose PlantUML svek DOT was diffable against ours. Excludes **oracle-blind**.',
  '- **equal** — of the comparable fixtures, how many are structurally EQUAL per every check in `tests/oracle/svek-dot.ts`.',
  '- **oracle-blind** — `!pragma layout elk` fixtures (smetana/vizjs are graphviz under other names and are captured normally, per DIVERGENCES.md); PlantUML only dumps svek DOT on the graphviz path, so there is no oracle DOT to diff for elk. Excluded from **comparable**.',
  '- **not yet measured** — no cached oracle DOT dump under `test-results/dot-cache/<type>/` yet (or no classification configured); not a failure, just unmeasured.',
];

function runMarkdown(jar: string): void {
  const rows = manifestTypes().map((t) => markdownRowForType(jar, t));
  const table = rows.map((r) => `| ${r.type} | ${r.comparable} | ${r.equal} | ${r.pct} | ${r.oracleBlind} | ${r.note} |`);
  const lines: string[] = [
    '<!-- GENERATED by `npx tsx scripts/dot-sync-report.ts --markdown` — do not edit by hand. -->', '',
    '# DOT parity report', '',
    'Generated by `npx tsx scripts/dot-sync-report.ts --markdown` on ' + new Date().toISOString().slice(0, 10) + '.', '',
    '## Parity by diagram type', '',
    '| type | comparable | equal | pct | oracle-blind | note |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...table, '',
    '## Legend', '',
    ...MARKDOWN_LEGEND, '',
  ];
  mkdirSync(dirname(PARITY_REPORT_OUT), { recursive: true });
  writeFileSync(PARITY_REPORT_OUT, lines.join('\n') + '\n', 'utf-8');
  console.log('Wrote ' + PARITY_REPORT_OUT);
}

// --slug drill-down ----------------------------------------------------------

function drillDownSlug(jar: string, type: string, slug: string, rebuild: boolean): void {
  const f = findFixture(type, slug);
  const oracleDots = plantumlDots(jar, type, f, rebuild);
  const inputs = ourInputs(type, f.markup);
  console.log('=== slug: ' + slug + ' (' + type + ') ===');
  console.log('oracle graphs: ' + oracleDots.length + '  candidate graphs: ' + inputs.length);
  const n = Math.max(oracleDots.length, inputs.length);
  for (let i = 0; i < n; i++) drillDownGraph(i, oracleDots[i], inputs[i]);
}

// --probe-json-dot ------------------------------------------------------------

interface ProbeResult { anyDots: boolean; evidence: string[] }

function probeType(jar: string, type: string): ProbeResult | undefined {
  const fixtures = loadFixtures(type);
  if (fixtures === undefined) return undefined;
  const sample = [...fixtures].sort((a, b) => a.slug.localeCompare(b.slug)).slice(0, 5);
  const evidence: string[] = [];
  let anyDots = false;
  for (const f of sample) {
    const dots = plantumlDots(jar, type, f, false);
    evidence.push(f.slug + ': ' + dots.length + ' svek-*.dot file(s)');
    if (dots.length > 0) anyDots = true;
  }
  return { anyDots, evidence };
}

function jsonImplication(anyDots: boolean): string {
  if (anyDots) {
    return 'svek-*.dot appeared for at least one json fixture, contradicting the phase-5 assumption that @startjson routes through SmetanaForJson directly — worth investigating whether this is loopable via the standard svek oracle after all.';
  }
  return 'No svek-*.dot appeared for any sampled json fixture, consistent with the phase-5 expectation that @startjson uses SmetanaForJson directly rather than routing through svek DOT. Per the overview this means json (and transitively yaml/hcl) is not loopable via the existing svek StructuralDiff oracle and needs a maintainer decision: treat as out of scope for this mission, or define a new Smetana-input oracle. Do not invent one without sign-off — this is a STOP condition.';
}

function dotImplication(anyDots: boolean): string {
  if (anyDots) {
    return 'svek-*.dot appeared for at least one dot fixture, contradicting the phase-5 assumption that @startdot feeds the fixture\'s own DOT straight to graphviz — worth confirming before assuming the fixture body itself is the oracle.';
  }
  return 'No svek-*.dot appeared for any sampled dot fixture, consistent with the phase-5 expectation that @startdot passes the fixture\'s own DOT body verbatim to graphviz with no svek intermediate. Per the overview, the oracle for this type is the fixture\'s own DOT text, and parity should be defined as "does the seam\'s DotInputGraph preserve the input graph" — a new comparison, not the svek StructuralDiff. That needs a short design note and maintainer sign-off (STOP condition) before looping.';
}

function probeSection(type: string, result: ProbeResult | undefined, implication: (anyDots: boolean) => string): string[] {
  const lines: string[] = ['## ' + type, ''];
  if (result === undefined) {
    lines.push('Verdict: no fixture manifest — tests/visual/data/' + type + '.json does not exist.', '', 'Evidence: none (no fixtures could be sampled).', '');
    return lines;
  }
  lines.push('Verdict: svek dump path ' + (result.anyDots ? 'EXISTS' : 'DOES NOT EXIST') + ' for ' + type +
    ' (' + (result.anyDots ? 'at least one' : 'none of the') + ' sampled fixtures produced svek-*.dot).', '', 'Evidence:');
  for (const e of result.evidence) lines.push('- ' + e);
  lines.push('', 'Implication: ' + implication(result.anyDots), '');
  return lines;
}

function runProbeJsonDot(jar: string): void {
  const jsonResult = probeType(jar, 'json');
  const dotResult = probeType(jar, 'dot');
  const lines: string[] = [
    '# Phase 5 probe — json/dot svek DOT dump',
    '',
    'Generated by npx tsx scripts/dot-sync-report.ts --probe-json-dot.',
    '',
    ...probeSection('json', jsonResult, jsonImplication),
    ...probeSection('dot', dotResult, dotImplication),
  ];
  mkdirSync(dirname(PROBE_OUT), { recursive: true });
  writeFileSync(PROBE_OUT, lines.join('\n') + '\n', 'utf-8');
  console.log('Wrote ' + PROBE_OUT);
  console.log('json: ' + (jsonResult === undefined ? 'no manifest' : jsonResult.anyDots ? 'svek dump EXISTS' : 'svek dump DOES NOT EXIST'));
  console.log('dot:  ' + (dotResult === undefined ? 'no manifest' : dotResult.anyDots ? 'svek dump EXISTS' : 'svek dump DOES NOT EXIST'));
}

// CLI -------------------------------------------------------------------------

interface Options {
  rebuild: boolean;
  slug: string | undefined;
  typeTag: string | undefined;
  probeJsonDot: boolean;
  equalList: boolean;
  markdown: boolean;
  types: string[];
}

function parseArgs(argv: string[]): Options {
  let slug: string | undefined;
  let typeTag: string | undefined;
  let rebuild = false;
  let probeJsonDot = false;
  let equalList = false;
  let markdown = false;
  const types: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--rebuild') rebuild = true;
    else if (a === '--slug') slug = argv[++i];
    else if (a === '--type-tag') typeTag = argv[++i];
    else if (a === '--probe-json-dot') probeJsonDot = true;
    else if (a === '--equal-list') equalList = true;
    else if (a === '--markdown') markdown = true;
    else types.push(a);
  }
  return { rebuild, slug, typeTag, probeJsonDot, equalList, markdown, types };
}

function main(): void {
  const jar = resolveJar();
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(CACHE, { recursive: true });

  if (opts.probeJsonDot) { runProbeJsonDot(jar); return; }
  if (opts.markdown) { runMarkdown(jar); return; }
  if (opts.slug !== undefined) {
    const type = opts.types[0];
    if (type === undefined) throw new Error('--slug requires a type argument, e.g. --slug <slug> <type>');
    drillDownSlug(jar, type, opts.slug, opts.rebuild);
    return;
  }
  const types = opts.types.length > 0 ? opts.types : ['component', 'usecase'];
  for (const t of types) runType(jar, t, opts.rebuild, opts.typeTag, opts.equalList);
}

main();
