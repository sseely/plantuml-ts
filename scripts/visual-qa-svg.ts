#!/usr/bin/env node
/**
 * SVG-vs-SVG visual QA for the description engine.
 *
 * For each fixture in tests/visual/data/<type>.json, renders the *canonical* SVG
 * with the local PlantUML jar (one JVM per type, batch mode) and our SVG via
 * plantuml-ts renderSync, then emits a side-by-side page per type at
 * test-results/visual-qa-svg/<type>.html. SVG-vs-SVG avoids PNG raster artifacts.
 *
 * Both SVGs are normalized first (comments + volatile data-* tracing attrs
 * stripped), mirroring graphviz-ts's own SVG normalization so the comparison is
 * structural, not incidental. NOTE: per project policy, SVG differences are only
 * meaningful when the DOT input matches — see scripts/visual-qa-dot.ts for the
 * authoritative DOT-input divergence pass.
 *
 * Usage:  npx tsx scripts/visual-qa-svg.ts [type ...]   (default: component usecase)
 * Jar:    PLANTUML_JAR env, else ~/git/plantuml/build/libs/plantuml-*.jar
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
import { FormulaMeasurer } from '../src/core/measurer.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(REPO, 'tests', 'visual', 'data');
const OUT = join(REPO, 'test-results', 'visual-qa-svg');
const DEFAULT_TYPES = ['component', 'usecase'];

interface Fixture {
  slug: string;
  markup: string;
}

interface RowData {
  slug: string;
  markup: string;
  canonical: string;
  ours: string;
  error: boolean;
  noCanonical: boolean;
}

// HTML kept in module-scope templates (placeholder tokens, no inline ${} in
// functions) to sidestep the Lizard brace-counter's template-literal misparse.
const PAGE_CSS =
  'body{font:13px/1.4 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#222}' +
  'header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:10px 16px;z-index:2}' +
  'h1{font-size:16px;margin:0 0 4px}.stats{color:#555}' +
  '.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 16px;border-bottom:1px solid #e3e5e8;align-items:start}' +
  '.row.bad{background:#fff4f4}.slug{grid-column:1/3;font-weight:600;display:flex;gap:10px;align-items:center}' +
  '.tag{font-weight:400;font-size:11px;padding:1px 6px;border-radius:3px;background:#eee;color:#555}.tag.err{background:#d33;color:#fff}' +
  '.panel{background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:8px;overflow:auto;max-height:520px}' +
  '.panel h3{margin:0 0 6px;font-size:11px;color:#888;text-transform:uppercase}.panel svg{max-width:100%;height:auto}' +
  'details{grid-column:1/3}details pre{background:#1e1e1e;color:#dcdcdc;padding:8px;border-radius:4px;overflow:auto;font:12px/1.4 Menlo,monospace}';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Strip comments and volatile tracing attrs so the comparison is structural. */
function normalizeSvg(svg: string): string {
  if (svg === '') return '';
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\sdata-(?:source-line|qualified-name|entity)="[^"]*"/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function resolveJar(): string {
  if (process.env.PLANTUML_JAR !== undefined) return process.env.PLANTUML_JAR;
  const libs = join(homedir(), 'git', 'plantuml', 'build', 'libs');
  const jar = existsSync(libs)
    ? readdirSync(libs).find((f) => /^plantuml-.*\.jar$/.test(f))
    : undefined;
  if (jar === undefined) {
    throw new Error('No PlantUML jar; set PLANTUML_JAR or build ~/git/plantuml.');
  }
  return join(libs, jar);
}

function freshDir(path: string): string {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
  return path;
}

function runJar(jar: string, pumlDir: string, svgDir: string): void {
  // PlantUML exits non-zero if any fixture errors but still writes valid SVGs.
  try {
    execFileSync('java', ['-jar', jar, '-tsvg', '-nometadata', '-o', svgDir, pumlDir], {
      stdio: ['ignore', 'ignore', 'inherit'],
      maxBuffer: 1 << 28,
    });
  } catch {
    /* partial batch — valid SVGs are on disk */
  }
}

function renderCanonical(jar: string, type: string, fixtures: Fixture[]): Map<string, string> {
  const pumlDir = freshDir(join(OUT, 'puml', type));
  const svgDir = freshDir(join(OUT, 'canonical', type));
  for (const f of fixtures) writeFileSync(join(pumlDir, f.slug + '.puml'), f.markup, 'utf-8');
  runJar(jar, pumlDir, svgDir);
  const out = new Map<string, string>();
  for (const f of fixtures) {
    const p = join(svgDir, f.slug + '.svg');
    out.set(f.slug, existsSync(p) ? readFileSync(p, 'utf-8') : '');
  }
  return out;
}

function ourSvg(markup: string): { svg: string; error: boolean } {
  try {
    const svg = renderSync(markup, { measurer: new FormulaMeasurer() });
    return { svg, error: svg.includes('PlantUML error') || !svg.includes('<svg') };
  } catch (err) {
    return { svg: '<pre>render threw: ' + esc((err as Error).message) + '</pre>', error: true };
  }
}

function rowHtml(r: RowData): string {
  const tags =
    (r.error ? '<span class="tag err">our render error</span>' : '') +
    (r.noCanonical ? '<span class="tag err">no canonical</span>' : '');
  const canon = r.canonical === '' ? '<em>none</em>' : r.canonical;
  return (
    '<div class="row' + (r.error ? ' bad' : '') + '">' +
    '<div class="slug">' + esc(r.slug) + ' ' + tags + '</div>' +
    '<details><summary>markup</summary><pre>' + esc(r.markup) + '</pre></details>' +
    '<div class="panel"><h3>canonical</h3>' + canon + '</div>' +
    '<div class="panel"><h3>ours</h3>' + r.ours + '</div></div>'
  );
}

function pageHtml(type: string, rows: string, stats: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>Visual QA — ' + type + '</title>' +
    '<style>' + PAGE_CSS + '</style></head><body>' +
    '<header><h1>SVG visual QA — ' + type + '</h1><div class="stats">' + stats + '</div>' +
    '<div class="stats">Left: canonical (PlantUML jar). Right: plantuml-ts. Both comment-normalized. ' +
    'Per policy, SVG diffs matter only when DOT input matches (see visual-qa-dot.ts).</div></header>' +
    rows + '</body></html>'
  );
}

function buildType(jar: string, type: string): string {
  const fixtures = JSON.parse(readFileSync(join(DATA_DIR, type + '.json'), 'utf-8')) as Fixture[];
  console.log(type + ': ' + fixtures.length + ' fixtures — rendering canonical…');
  const canonical = renderCanonical(jar, type, fixtures);
  let errors = 0;
  let noCanon = 0;
  const rows: string[] = [];
  for (const f of fixtures) {
    const canon = normalizeSvg(canonical.get(f.slug) ?? '');
    const { svg, error } = ourSvg(f.markup);
    if (error) errors++;
    if (canon === '') noCanon++;
    rows.push(
      rowHtml({
        slug: f.slug,
        markup: f.markup,
        canonical: canon,
        ours: error ? svg : normalizeSvg(svg),
        error,
        noCanonical: canon === '',
      }),
    );
  }
  const stats =
    fixtures.length + ' fixtures &bull; our render errors: ' + errors + ' &bull; canonical missing: ' + noCanon;
  writeFileSync(join(OUT, type + '.html'), pageHtml(type, rows.join('\n'), stats), 'utf-8');
  console.log('  ' + stats);
  return '<li><a href="./' + type + '.html">' + type + '</a> — ' + stats + '</li>';
}

function main(): void {
  const jar = resolveJar();
  const args = process.argv.slice(2);
  const types = args.length > 0 ? args : DEFAULT_TYPES;
  mkdirSync(OUT, { recursive: true });
  const links: string[] = [];
  for (const type of types) {
    if (!existsSync(join(DATA_DIR, type + '.json'))) {
      console.error('skip ' + type + ': no data file');
      continue;
    }
    links.push(buildType(jar, type));
  }
  writeFileSync(
    join(OUT, 'index.html'),
    '<!doctype html><meta charset="utf-8"><title>Visual QA (SVG)</title><h1>SVG visual QA</h1><ul>' +
      links.join('') + '</ul>',
    'utf-8',
  );
  console.log('\nOpen ' + join(OUT, 'index.html'));
}

main();
