/**
 * SVG parity survey — differential comparison of plantuml-ts's rendered SVG
 * against the cached PlantUML jar SVG (`in.svg`) over the component/usecase
 * corpus (`test-results/dot-cache/`, populated by scripts/dot-sync-report.ts).
 *
 * A report, not a gate: divergences are expected data, especially pre-cutover
 * (the description renderer is still legacy as of this baseline — verdicts
 * are overwhelmingly `diverged`, which proves the instrument rather than
 * signaling a regression). The survey never crashes on a bad fixture: every
 * render is isolated in a spawned `jiti` subprocess with a wall-clock
 * timeout, mirroring ~/git/graphviz-ts's test/corpus/survey.ts (a hang
 * becomes `timeout`, a throw becomes `errored`). Verdict comparison logic
 * (`diffVerdict`, `isWellFormedSvg`) is ported near-verbatim from that
 * project's survey.ts.
 *
 * Each fixture's DOT-EQUAL status is also recorded (`dotEqual`), reusing the
 * same oracle DOT-parity helpers scripts/dot-sync-report.ts uses
 * (tests/oracle/svek-dot.ts), so later tasks can filter ratchet eligibility
 * without re-deriving it.
 *
 *   npx jiti scripts/svg-parity-survey.ts            survey the full corpus
 *   npx jiti scripts/svg-parity-survey.ts --render-one <dir>
 *     isolation-worker mode: renders ONE cached fixture dir and prints
 *     `{ svg, dotEqual, oracleBlind }` as JSON on stdout. Internal use only
 *     (spawned by the survey itself); not a supported public CLI mode.
 *
 * Node-only dev/test infra — never imported by src/index.ts.
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { renderSync } from '../src/index.js';
import { setLayoutInputObserver } from '../src/core/graph-layout.js';
import { WidthTableMeasurer } from '../src/core/measurer.js';
import type { DotInputGraph } from '../src/core/graph-layout.types.js';
import {
  parseSvekDot,
  dotInputToStructural,
  compareStructural,
} from '../tests/oracle/svek-dot.js';
import { compareSvg, type Diff } from '../tests/oracle/svg-conformance/compare.js';
import { normalizeSvg } from '../tests/oracle/svg-conformance/normalize.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(REPO, 'test-results', 'dot-cache');
const PARITY_OUT = join(REPO, 'tests', 'oracle', 'svg-conformance', 'parity.json');
const THIS_FILE = fileURLToPath(import.meta.url);
const DEFAULT_TYPES = ['component', 'usecase'];
const RENDER_TIMEOUT_MS = Number(process.env.SVG_PARITY_TIMEOUT_MS ?? 10_000);
const CONCURRENCY = Number(process.env.SVG_PARITY_CONCURRENCY ?? 6);
/** Lizard-safe (no regex literals in flagged positions): svek-<N>.dot dumps. */
const SVEK_DOT_RE = new RegExp('^svek-([0-9]+)\\.dot$');
/** Oracle-blind fixtures (`!pragma layout smetana|elk`): the jar only dumps
 *  svek DOT on the graphviz path, so DOT-parity has no oracle to compare
 *  against — mirrors scripts/dot-sync-report.ts's oracleBlind bucket. */
const PRAGMA_LAYOUT_RE = /!pragma\s+layout\s+/i;

// ---------------------------------------------------------------------------
// Public types — the interface contract consumed by the dashboard + T18/T19.
// ---------------------------------------------------------------------------

export type Verdict =
  | 'conformant'
  | 'structural-match'
  | 'diverged'
  | 'oracle-error'
  | 'errored'
  | 'timeout';

export interface FixtureRow {
  slug: string;
  type: string;
  verdict: Verdict;
  dotEqual: boolean;
  firstDiff?: string;
  maxDelta?: number;
  maxDeltaPath?: string;
  errMsg?: string;
  /** `!pragma layout smetana|elk` — DOT-parity has no oracle; dotEqual is a
   *  safe `false` rather than a real judgment. See PRAGMA_LAYOUT_RE. */
  oracleBlind?: boolean;
}

export interface ParityReport {
  generatedAt: string;
  fixtures: FixtureRow[];
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Pure verdict logic (ported near-verbatim from graphviz-ts's survey.ts,
// adapted to this project's field names).
// ---------------------------------------------------------------------------

/** True iff `svg` is well-formed enough for `normalizeSvg`/`compareSvg` to
 *  parse without throwing. Used to gate the ORACLE side: a malformed cached
 *  `in.svg` is a harness/oracle-cache fault, not a port divergence. */
export function isWellFormedSvg(svg: string): boolean {
  try {
    normalizeSvg(svg);
    return true;
  } catch {
    return false;
  }
}

/** Worst numeric diff (largest delta) and its path; first-encountered wins on
 *  ties (strict `>`) — a stable, document-order tie-break over the compareSvg
 *  walk order. `maxDeltaPath` is undefined only when there are no numeric diffs. */
function worstNumericDiff(diffs: Diff[]): { maxDelta: number; maxDeltaPath: string | undefined } {
  let maxDelta = 0;
  let maxDeltaPath: string | undefined;
  for (const d of diffs) {
    if (d.delta !== undefined && d.delta > maxDelta) {
      maxDelta = d.delta;
      maxDeltaPath = d.path;
    }
  }
  return { maxDelta, maxDeltaPath };
}

/** Classify a rendered pair: conformant / structural-match / diverged. */
export function diffVerdict(
  port: string,
  oracle: string,
): Pick<FixtureRow, 'verdict' | 'maxDelta' | 'firstDiff' | 'maxDeltaPath' | 'errMsg'> {
  let diffs: Diff[];
  try {
    const cmp = compareSvg(port, oracle, 'deterministic');
    if (cmp.pass) return { verdict: 'conformant' };
    diffs = cmp.diffs;
  } catch (e) {
    return { verdict: 'diverged', firstDiff: '<compare-threw>', errMsg: errText(e) };
  }
  const structural = diffs.find((d) => d.delta === undefined);
  const { maxDelta, maxDeltaPath } = worstNumericDiff(diffs);
  const pathField = maxDeltaPath !== undefined ? { maxDeltaPath } : {};
  if (structural) {
    return { verdict: 'diverged', maxDelta, firstDiff: structural.path, ...pathField };
  }
  return { verdict: 'structural-match', maxDelta, ...pathField };
}

/** DOT-level parity: mirrors scripts/dot-sync-report.ts's analyzeFixture. Both
 *  sides skipping graphviz (degenerate single-leaf/empty diagrams) IS
 *  agreement; a count mismatch or a structural check failure is not. */
export function computeDotEqual(
  dots: string[],
  inputs: DotInputGraph[],
  oracleBlind: boolean,
): boolean {
  if (oracleBlind) return false;
  if (dots.length === 0 && inputs.length === 0) return true;
  if (inputs.length === 0) return false;
  if (dots.length !== inputs.length) return false;
  return dots.every((dot, i) => {
    const diff = compareStructural(parseSvekDot(dot), dotInputToStructural(inputs[i]!));
    return diff.structurallyEqual;
  });
}

// ---------------------------------------------------------------------------
// Fixture discovery
// ---------------------------------------------------------------------------

interface FixtureDir {
  slug: string;
  dir: string;
}

/** Cached fixture dirs for one type: `.done` + `in.puml` + `in.svg` present
 *  (a partial/interrupted dot-sync-report.ts run is skipped, not crashed on). */
function listFixtureDirs(type: string): FixtureDir[] {
  const typeDir = join(CACHE_DIR, type);
  if (!existsSync(typeDir)) return [];
  const out: FixtureDir[] = [];
  for (const slug of readdirSync(typeDir)) {
    const dir = join(typeDir, slug);
    if (!statSync(dir).isDirectory()) continue;
    if (!existsSync(join(dir, '.done'))) continue;
    if (!existsSync(join(dir, 'in.puml')) || !existsSync(join(dir, 'in.svg'))) continue;
    out.push({ slug, dir });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

const svekIndex = (f: string): number => Number(SVEK_DOT_RE.exec(f)?.[1] ?? 0);

function readSvekDots(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => SVEK_DOT_RE.test(f))
    .sort((a, b) => svekIndex(a) - svekIndex(b))
    .map((f) => readFileSync(join(dir, f), 'utf-8'));
}

// ---------------------------------------------------------------------------
// Isolation worker (`--render-one <dir>`)
// ---------------------------------------------------------------------------

/** Renders ONE cached fixture and prints `{ svg, dotEqual, oracleBlind }` as
 *  JSON to stdout. Runs as a spawned subprocess (see surveyOneFixture) so a
 *  synchronous render that never returns cannot hang the survey — the parent
 *  kills this process on its wall-clock budget instead. A throw prints a
 *  `__RENDER_ERROR__` sentinel to stderr and exits nonzero. */
function renderOneMode(dir: string): void {
  const markup = readFileSync(join(dir, 'in.puml'), 'utf-8');
  const oracleBlind = PRAGMA_LAYOUT_RE.test(markup);
  const svekDots = readSvekDots(dir);
  const inputs: DotInputGraph[] = [];
  setLayoutInputObserver((g) => inputs.push(g));
  let svg: string;
  try {
    svg = renderSync(markup, { measurer: new WidthTableMeasurer() });
  } catch (err) {
    setLayoutInputObserver(undefined);
    process.stderr.write(`__RENDER_ERROR__${errText(err).split('\n')[0]}\n`);
    process.exit(1);
  }
  setLayoutInputObserver(undefined);
  const dotEqual = computeDotEqual(svekDots, inputs, oracleBlind);
  process.stdout.write(JSON.stringify({ svg, dotEqual, oracleBlind }));
}

// ---------------------------------------------------------------------------
// Subprocess plumbing (adapted from graphviz-ts's spawnCapture; simpler here
// since `jiti` runs the render directly — no grandchild process to group-kill).
// ---------------------------------------------------------------------------

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

function spawnCapture(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (e) => (stderr += e.message));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

/** Locate a runnable `jiti`: local node_modules/.bin, else `npx jiti`. */
function resolveJiti(): { cmd: string; pre: string[] } {
  const local = join(REPO, 'node_modules', '.bin', 'jiti');
  if (existsSync(local)) return { cmd: local, pre: [] };
  return { cmd: 'npx', pre: ['--no-install', 'jiti'] };
}

/** Extract the render-one sentinel error, else the first stderr line. */
function renderErrMsg(stderr: string): string {
  const marker = '__RENDER_ERROR__';
  for (const line of stderr.split('\n')) {
    if (line.startsWith(marker)) return line.slice(marker.length).trim();
  }
  const first = stderr.split('\n').find((l) => l.trim().length > 0);
  return first?.trim() ?? 'render-one failed with no stderr output';
}

// ---------------------------------------------------------------------------
// Survey
// ---------------------------------------------------------------------------

interface RenderOneOutput {
  svg: string;
  dotEqual: boolean;
  oracleBlind: boolean;
}

function parseRenderOneStdout(stdout: string): RenderOneOutput | undefined {
  try {
    const parsed = JSON.parse(stdout) as Partial<RenderOneOutput>;
    if (typeof parsed.svg !== 'string' || typeof parsed.dotEqual !== 'boolean') return undefined;
    return { svg: parsed.svg, dotEqual: parsed.dotEqual, oracleBlind: parsed.oracleBlind === true };
  } catch {
    return undefined;
  }
}

async function surveyOneFixture(
  type: string,
  f: FixtureDir,
  jiti: { cmd: string; pre: string[] },
): Promise<FixtureRow> {
  const oracleSvg = readFileSync(join(f.dir, 'in.svg'), 'utf-8');
  if (!isWellFormedSvg(oracleSvg)) {
    return {
      slug: f.slug, type, verdict: 'oracle-error', dotEqual: false,
      errMsg: `cached in.svg not well-formed XML: ${oracleSvg.length}B`,
    };
  }
  const args = [...jiti.pre, THIS_FILE, '--render-one', f.dir];
  const r = await spawnCapture(jiti.cmd, args, process.env, RENDER_TIMEOUT_MS);
  if (r.timedOut) return { slug: f.slug, type, verdict: 'timeout', dotEqual: false };
  const rendered = r.code === 0 ? parseRenderOneStdout(r.stdout) : undefined;
  if (rendered === undefined) {
    return {
      slug: f.slug, type, verdict: 'errored', dotEqual: false,
      errMsg: renderErrMsg(r.stderr),
    };
  }
  const verdict = diffVerdict(rendered.svg, oracleSvg);
  const blindField = rendered.oracleBlind ? { oracleBlind: true } : {};
  return { slug: f.slug, type, dotEqual: rendered.dotEqual, ...verdict, ...blindField };
}

/** Bounded worker pool: run `items` `concurrency`-at-a-time, preserving order. */
async function runPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!);
      if (++done % 25 === 0) process.stderr.write(`  ${done}/${items.length}\n`);
    }
  };
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

function tally(rows: FixtureRow[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    conformant: 0, 'structural-match': 0, diverged: 0, errored: 0, timeout: 0, 'oracle-error': 0,
  };
  for (const r of rows) counts[r.verdict]++;
  return counts;
}

/**
 * N0 (G2): `--out <path>` and bare positional type args, both additive and
 * both defaulting to the pre-existing behavior (`DEFAULT_TYPES` ->
 * `PARITY_OUT`) -- a plain `npm run svg:survey` invocation is byte-identical
 * to before this change. Lets a future class-scoped survey run write its
 * own `parity-class.json` (`--out tests/oracle/svg-conformance/parity-
 * class.json class`) without ever touching the shared component/usecase
 * `parity.json` this mission's write-set must not regenerate.
 */
function parseSurveyArgs(argv: string[]): { types: string[]; out: string } {
  const outIdx = argv.indexOf('--out');
  const out = outIdx !== -1 ? argv[outIdx + 1] : undefined;
  const positional = argv.filter((a, i) => a !== '--out' && i !== outIdx + 1 && !a.startsWith('--'));
  return { types: positional.length > 0 ? positional : DEFAULT_TYPES, out: out ?? PARITY_OUT };
}

async function main(): Promise<void> {
  const { types, out } = parseSurveyArgs(process.argv.slice(2));
  const jiti = resolveJiti();
  const rows: FixtureRow[] = [];
  for (const type of types) {
    const fixtures = listFixtureDirs(type);
    process.stderr.write(`surveying ${fixtures.length} ${type} fixtures (concurrency ${CONCURRENCY})\n`);
    const results = await runPool(fixtures, (f) => surveyOneFixture(type, f, jiti), CONCURRENCY);
    rows.push(...results);
  }
  const report: ParityReport = { generatedAt: new Date().toISOString(), fixtures: rows };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(`wrote ${out} — ${JSON.stringify(tally(rows))}\n`);
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

function runRenderOneCli(argv: string[]): void {
  const idx = argv.indexOf('--render-one');
  const dir = argv[idx + 1];
  if (dir === undefined) {
    process.stderr.write('usage: --render-one <dir>\n');
    process.exit(2);
  }
  try {
    renderOneMode(dir);
  } catch (e) {
    process.stderr.write(`__RENDER_ERROR__${errText(e)}\n`);
    process.exit(1);
  }
}

/* v8 ignore start -- CLI entry point; exercised via the real survey run, not
 * the unit-test suite (matches the profile of this project's other script
 * CLI blocks, e.g. tests/oracle/svg-conformance/compare.ts). */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--render-one')) {
    runRenderOneCli(process.argv);
  } else {
    main().catch((e) => {
      process.stderr.write(`harness fault: ${errText(e)}\n`);
      process.exit(2);
    });
  }
}
/* v8 ignore stop */
