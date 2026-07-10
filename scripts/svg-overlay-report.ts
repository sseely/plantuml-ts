#!/usr/bin/env node
/**
 * SVG overlay triage report — the successor to the raster-diff visual QA
 * workflow. For a given fixture, renders ours, loads the jar's cached
 * `in.svg` (written by the dot-cache warm-up, see scripts/dot-sync-report.ts
 * and scripts/svg-parity-survey.ts), runs the SVG-conformance harness's
 * `compareSvg`, and writes a single self-contained HTML file — both SVGs
 * inline, an overlay toggle (opacity slider) and a side-by-side toggle, and
 * a diff table — for human triage. SVG-harness driven: no pixels, no
 * playwright, no external requests from the generated HTML.
 *
 * Modes:
 *   <type>/<slug> [...more]   Render a report per fixture given on the CLI.
 *   --from-parity             Read tests/oracle/svg-conformance/parity.json
 *     (T15's survey output) and render a report for every `diverged` row.
 *
 * Fixture source: test-results/dot-cache/<type>/<slug>/{in.puml,in.svg}
 * (in.puml = source markup, in.svg = the oracle jar's rendered SVG),
 * matching the cache layout scripts/dot-sync-report.ts already reads.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { renderSync } from '../src/index.js';
import { WidthTableMeasurer } from '../src/core/measurer.js';
import { compareSvg } from '../tests/oracle/svg-conformance/compare.js';
import type { Diff } from '../tests/oracle/svg-conformance/compare.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(REPO, 'test-results', 'dot-cache');
const OUT_DIR = join(REPO, 'test-results', 'svg-overlay');
const PARITY_PATH = join(REPO, 'tests', 'oracle', 'svg-conformance', 'parity.json');
/** Lizard-safe (regex contains no <>{}|): tolerance class the harness uses. */
const TOLERANCE_CLASS = 'deterministic';

// ---------------------------------------------------------------------------
// Fixture refs
// ---------------------------------------------------------------------------

export interface FixtureRef {
  type: string;
  slug: string;
}

/** Parses "<type>/<slug>" CLI positional args into refs. Pure. */
export function parseFixtureArgs(args: string[]): FixtureRef[] {
  return args.map((arg) => {
    const sep = arg.indexOf('/');
    if (sep === -1) {
      throw new Error(`Expected "<type>/<slug>", got "${arg}"`);
    }
    return { type: arg.slice(0, sep), slug: arg.slice(sep + 1) };
  });
}

// ---------------------------------------------------------------------------
// parity.json (T15 interface contract)
// ---------------------------------------------------------------------------

export interface ParityFixture {
  slug: string;
  type: string;
  verdict: string;
  dotEqual: boolean;
  firstDiff?: string;
  maxDelta?: number;
}

export interface ParityFile {
  generatedAt: string;
  fixtures: ParityFixture[];
}

/** Selects every `diverged` row from a parsed parity.json. Pure. */
export function selectDiverged(parity: ParityFile): FixtureRef[] {
  return parity.fixtures
    .filter((f) => f.verdict === 'diverged')
    .map((f) => ({ type: f.type, slug: f.slug }));
}

// ---------------------------------------------------------------------------
// Cache reading
// ---------------------------------------------------------------------------

function cacheFixtureDir(cacheDir: string, ref: FixtureRef): string {
  return join(cacheDir, ref.type, ref.slug);
}

function readCachedMarkup(cacheDir: string, ref: FixtureRef): string {
  const path = join(cacheFixtureDir(cacheDir, ref), 'in.puml');
  if (!existsSync(path)) {
    throw new Error(`No cached fixture markup for ${ref.type}/${ref.slug} at ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

function readCachedJarSvg(cacheDir: string, ref: FixtureRef): string {
  const path = join(cacheFixtureDir(cacheDir, ref), 'in.svg');
  if (!existsSync(path)) {
    throw new Error(`No cached jar SVG for ${ref.type}/${ref.slug} at ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

// ---------------------------------------------------------------------------
// HTML generation (pure — no filesystem, no render)
// ---------------------------------------------------------------------------

/** Lizard-safe (regex contains <>): built from a string, not a literal. */
const HTML_ESCAPE_RE = new RegExp('[&<>"\']', 'g');
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_RE, (c) => HTML_ESCAPES[c] ?? c);
}

function diffRow(d: Diff): string {
  const delta = d.delta === undefined ? '' : d.delta.toFixed(6);
  return (
    '<tr>' +
    `<td class="path">${escapeHtml(d.path)}</td>` +
    `<td class="expected">${escapeHtml(d.expected)}</td>` +
    `<td class="actual">${escapeHtml(d.actual)}</td>` +
    `<td class="delta">${escapeHtml(delta)}</td>` +
    '</tr>'
  );
}

function diffTable(diffs: Diff[]): string {
  if (diffs.length === 0) {
    return '<p class="no-diffs">Conformant — 0 diffs.</p>';
  }
  const rows = diffs.map(diffRow).join('\n');
  return (
    '<table class="diff-table">' +
    '<thead><tr><th>path</th><th>expected</th><th>actual</th><th>delta</th></tr></thead>' +
    `<tbody>${rows}</tbody>` +
    '</table>'
  );
}

const OVERLAY_STYLE = `
  :root { color-scheme: light; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 1.5rem; }
  h1 { font-size: 1.1rem; }
  .verdict { font-weight: bold; padding: 0.25rem 0.5rem; display: inline-block; border-radius: 4px; }
  .verdict.pass { background: #d4edda; color: #155724; }
  .verdict.fail { background: #f8d7da; color: #721c24; }
  .controls { margin: 0.75rem 0; display: flex; gap: 1rem; align-items: center; }
  #stage.mode-overlay { position: relative; border: 1px solid #ccc; min-height: 100px; }
  #stage.mode-overlay .layer { position: absolute; top: 0; left: 0; }
  #stage.mode-side { display: flex; gap: 1rem; }
  #stage.mode-side .layer { position: static; border: 1px solid #ccc; flex: 1; overflow: auto; }
  .ours-layer svg { filter: hue-rotate(190deg) saturate(4); }
  table.diff-table { border-collapse: collapse; margin-top: 1rem; width: 100%; }
  table.diff-table th, table.diff-table td { border: 1px solid #ccc; padding: 0.25rem 0.5rem; font-size: 0.85rem; text-align: left; }
  table.diff-table th { background: #f0f0f0; }
  .no-diffs { color: #155724; font-weight: bold; }
`;

const OVERLAY_SCRIPT = `
  var stage = document.getElementById('stage');
  var opacityInput = document.getElementById('opacity');
  var oursLayer = document.getElementById('ours-layer');
  document.getElementById('btn-overlay').addEventListener('click', function () {
    stage.className = 'mode-overlay';
  });
  document.getElementById('btn-side').addEventListener('click', function () {
    stage.className = 'mode-side';
  });
  opacityInput.addEventListener('input', function () {
    oursLayer.style.opacity = opacityInput.value;
  });
`;

export interface OverlayReportParams {
  type: string;
  slug: string;
  oursSvg: string;
  jarSvg: string;
  result: { pass: boolean; diffs: Diff[] };
}

function verdictInfo(result: { pass: boolean; diffs: Diff[] }): { cls: string; text: string } {
  if (result.pass) return { cls: 'pass', text: 'CONFORMANT — 0 diffs' };
  return { cls: 'fail', text: `DIVERGED — ${result.diffs.length} diff(s)` };
}

function buildHeader(type: string, slug: string, result: { pass: boolean; diffs: Diff[] }): string {
  const v = verdictInfo(result);
  return `<header>
  <h1>${escapeHtml(type)}/${escapeHtml(slug)}</h1>
  <p class="verdict ${v.cls}">${escapeHtml(v.text)}</p>
  <div class="controls">
    <button id="btn-overlay" type="button">Overlay</button>
    <button id="btn-side" type="button">Side-by-side</button>
    <label>Ours opacity <input type="range" id="opacity" min="0" max="1" step="0.01" value="0.5"></label>
  </div>
</header>`;
}

function buildStage(oursSvg: string, jarSvg: string): string {
  return `<main id="stage" class="mode-overlay">
  <div class="layer jar-layer">${jarSvg}</div>
  <div class="layer ours-layer" id="ours-layer" style="opacity:0.5">${oursSvg}</div>
</main>`;
}

/** Assembles the self-contained overlay-report HTML. Pure. */
export function buildOverlayHtml(params: OverlayReportParams): string {
  const { type, slug, oursSvg, jarSvg, result } = params;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SVG overlay: ${escapeHtml(type)}/${escapeHtml(slug)}</title>
<style>${OVERLAY_STYLE}</style>
</head>
<body>
${buildHeader(type, slug, result)}
${buildStage(oursSvg, jarSvg)}
<section>
  <h2>Diffs</h2>
  ${diffTable(result.diffs)}
</section>
<script>${OVERLAY_SCRIPT}</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Orchestration (imperative shell — filesystem + render)
// ---------------------------------------------------------------------------

function writeReport(outDir: string, slug: string, html: string): string {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, slug + '.html');
  writeFileSync(outPath, html, 'utf-8');
  return outPath;
}

/** Renders + compares + writes one fixture's overlay report. */
export function generateReport(cacheDir: string, outDir: string, ref: FixtureRef): string {
  const markup = readCachedMarkup(cacheDir, ref);
  const jarSvg = readCachedJarSvg(cacheDir, ref);
  const oursSvg = renderSync(markup, { measurer: new WidthTableMeasurer() });
  const result = compareSvg(oursSvg, jarSvg, TOLERANCE_CLASS);
  const html = buildOverlayHtml({ type: ref.type, slug: ref.slug, oursSvg, jarSvg, result });
  return writeReport(outDir, ref.slug, html);
}

/** Generates reports for every ref, skipping (and logging) failures so one
 *  missing cache entry does not abort the rest of a --from-parity batch. */
export function runReports(cacheDir: string, outDir: string, refs: FixtureRef[]): string[] {
  const written: string[] = [];
  for (const ref of refs) {
    try {
      written.push(generateReport(cacheDir, outDir, ref));
    } catch (err) {
      console.error(`svg-overlay-report: ${ref.type}/${ref.slug}: ${String(err)}`);
    }
  }
  return written;
}

function loadParity(parityPath: string): ParityFile {
  if (!existsSync(parityPath)) {
    throw new Error(
      `No parity.json at ${parityPath} — run npm run svg:survey first (scripts/svg-parity-survey.ts).`,
    );
  }
  return JSON.parse(readFileSync(parityPath, 'utf-8')) as ParityFile;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function resolveRefs(argv: string[]): FixtureRef[] {
  const fromParity = argv.includes('--from-parity');
  const positional = argv.filter((a) => a !== '--from-parity');
  return fromParity ? selectDiverged(loadParity(PARITY_PATH)) : parseFixtureArgs(positional);
}

function main(): void {
  const refs = resolveRefs(process.argv.slice(2));
  if (refs.length === 0) {
    console.error('Usage: svg-overlay-report.ts <type>/<slug> [...more] | --from-parity');
    process.exitCode = 1;
    return;
  }
  const written = runReports(CACHE_DIR, OUT_DIR, refs);
  for (const path of written) console.log('Wrote ' + path);
  if (written.length === 0) process.exitCode = 1;
}

/* v8 ignore start — CLI entry point, exercised by running the script, not
 * by importing it (see tests/unit/scripts/svg-overlay.test.ts). */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
/* v8 ignore stop */
