#!/usr/bin/env node
/**
 * SVG conformance census — dual-measurer mission deliverable.
 *
 * Renders every cached component/usecase fixture (`test-results/dot-cache/`,
 * captured from the jar under `-DPLANTUML_DETERMINISTIC_TEXT=true` — see
 * `oracle/patches/0002-oracle-deterministic-text.patch`) through the
 * description engine's LOW-LEVEL pipeline (`parseDescription` ->
 * `layoutDescription` -> `renderDescription`), injecting ONE measurer
 * instance into BOTH the layout and render stages, and compares the result
 * against the cached golden via `compareSvg(..., 'deterministic')`.
 *
 * Bypasses `renderSync`/`descriptionPlugin.render` deliberately: the public
 * `SyncPlugin#render(geo, theme)` contract has no measurer parameter (by
 * design — production always draws with `jarMeasurer`, see `renderer.ts`'s
 * own doc comment), so a script that wants BOTH stages measuring in the SAME
 * system must call the lower-level functions directly — the same bypass
 * pattern `scripts/dot-sync-report.ts` already established for oracle-DOT
 * emission.
 *
 * Two passes over the same corpus:
 *   - `deterministic`: measurer = `DeterministicMeasurer` (this task) — the
 *     actual conformance/ratchet metric. A real cohort should now reach
 *     zero-diff, since both sides measure text in the SAME system.
 *   - `jar`: measurer = `jarMeasurer` (production's own default) — proves
 *     production's own choice of measurer is unaffected by this task: the
 *     gap against the deterministic-mode golden should look like the
 *     existing, already-documented D12 apples-to-oranges gap (see
 *     `tests/integration/description.test.ts`'s E2E suite), not a NEW
 *     regression this task introduced.
 *
 * Theme resolution is inlined (not imported from `src/index.ts#buildTheme`,
 * which is a private, unexported function) rather than widening that
 * module's exports outside this task's declared write-set — mirrors its
 * exact 4-stage algorithm (see that function's own doc comment) using the
 * same already-exported building blocks.
 *
 * Usage: npx tsx scripts/svg-conformance-census.ts [component] [usecase]
 *   (defaults to both types)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBlockUmls } from '../src/core/BlockUmlBuilder.js';
import type { PreprocessorResult } from '../src/core/preprocessor.js';
import { resolveTheme, deepMergeTheme } from '../src/core/theme.js';
import { resolveSkinparam, parseStyleBlock } from '../src/core/skinparam.js';
import { applyStyleMap } from '../src/core/style-map-theme.js';
import type { Theme } from '../src/core/theme.js';
import type { StyleMap } from '../src/core/skinparam.js';
import type { StringMeasurer } from '../src/core/measurer.js';
import { jarMeasurer } from '../src/core/measurer-jar.js';
import { DeterministicMeasurer } from '../src/core/measurer-deterministic.js';
import { parseDescription } from '../src/diagrams/description/parser.js';
import { layoutDescription } from '../src/diagrams/description/layout.js';
import { renderDescription } from '../src/diagrams/description/renderer.js';
import { seedOf } from '../src/core/klimt/drawing/svg/svg-graphics-core.js';
import { compareSvg } from '../tests/oracle/svg-conformance/compare.js';
import { normalizeSvg } from '../tests/oracle/svg-conformance/normalize.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(REPO, 'test-results', 'dot-cache');
const DEFAULT_TYPES = ['component', 'usecase'];

// ---------------------------------------------------------------------------
// Theme resolution — mirrors src/index.ts#buildTheme (private, not exported).
// ---------------------------------------------------------------------------

function buildThemeForFixture(preprocessed: PreprocessorResult): Theme {
  const base = resolveTheme(preprocessed.theme ?? 'default');
  const withSkinparam = resolveSkinparam(preprocessed.skinparam, base).theme;

  const styleMap = preprocessed.styles
    .map(parseStyleBlock)
    .reduce<StyleMap>((acc, m) => {
      m.forEach((props, selector) => {
        const existing = acc.get(selector) ?? new Map<string, string>();
        props.forEach((v, k) => existing.set(k, v));
        acc.set(selector, existing);
      });
      return acc;
    }, new Map());

  const flatRoot = styleMap.get('') ?? new Map<string, string>();
  const withStyles = resolveSkinparam(flatRoot, withSkinparam).theme;
  return applyStyleMap(styleMap, withStyles);
}

// ---------------------------------------------------------------------------
// Fixture discovery (mirrors scripts/svg-parity-survey.ts#listFixtureDirs)
// ---------------------------------------------------------------------------

interface FixtureDir { slug: string; type: string; dir: string }

function listFixtureDirs(type: string): FixtureDir[] {
  const typeDir = join(CACHE_DIR, type);
  if (!existsSync(typeDir)) return [];
  const out: FixtureDir[] = [];
  for (const slug of readdirSync(typeDir)) {
    const dir = join(typeDir, slug);
    if (!statSync(dir).isDirectory()) continue;
    if (!existsSync(join(dir, '.done'))) continue;
    if (!existsSync(join(dir, 'in.puml')) || !existsSync(join(dir, 'in.svg'))) continue;
    out.push({ slug, type, dir });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

// ---------------------------------------------------------------------------
// Render one fixture through the low-level pipeline with a given measurer.
// ---------------------------------------------------------------------------

function renderFixture(markup: string, measurer: StringMeasurer): string {
  // Same stage order as `renderSync` (SI7): split on RAW lines, then preprocess
  // the first block's interior.
  const blocks = buildBlockUmls(markup);
  const first = blocks[0];
  if (first === undefined) throw new Error('no diagram block found');
  if (!first.ok) throw first.failure.cause;

  const preprocessed = first.preprocessed;
  const theme = buildThemeForFixture(preprocessed);
  const block = { ...first.source, rawStyles: preprocessed.styles };
  const ast = parseDescription(block);
  const seeded = { ...ast, seed: seedOf(['@startuml', ...block.lines, '@enduml'].join('\n')) };
  const geo = layoutDescription(seeded, theme, measurer);
  return renderDescription(geo, theme, measurer);
}

// ---------------------------------------------------------------------------
// Bucketing
// ---------------------------------------------------------------------------

type Bucket = '0' | '1-3' | '4-10' | '11-30' | '31+';

function bucketOf(diffCount: number): Bucket {
  if (diffCount === 0) return '0';
  if (diffCount <= 3) return '1-3';
  if (diffCount <= 10) return '4-10';
  if (diffCount <= 30) return '11-30';
  return '31+';
}

interface CensusResult {
  slug: string;
  type: string;
  diffCount: number | 'error';
}

function census(fixtures: readonly FixtureDir[], measurer: StringMeasurer): CensusResult[] {
  const results: CensusResult[] = [];
  for (const f of fixtures) {
    const markup = readFileSync(join(f.dir, 'in.puml'), 'utf-8');
    const jarSvg = readFileSync(join(f.dir, 'in.svg'), 'utf-8');
    try {
      if (!isWellFormed(jarSvg)) {
        results.push({ slug: f.slug, type: f.type, diffCount: 'error' });
        continue;
      }
      const oursSvg = renderFixture(markup, measurer);
      const { diffs } = compareSvg(oursSvg, jarSvg, 'deterministic');
      results.push({ slug: f.slug, type: f.type, diffCount: diffs.length });
    } catch {
      results.push({ slug: f.slug, type: f.type, diffCount: 'error' });
    }
  }
  return results;
}

function isWellFormed(svg: string): boolean {
  try {
    normalizeSvg(svg);
    return true;
  } catch {
    return false;
  }
}

function printReport(label: string, results: readonly CensusResult[]): void {
  const buckets: Record<Bucket | 'error', number> = { '0': 0, '1-3': 0, '4-10': 0, '11-30': 0, '31+': 0, error: 0 };
  const zeroDiff: string[] = [];
  for (const r of results) {
    if (r.diffCount === 'error') {
      buckets.error++;
      continue;
    }
    buckets[bucketOf(r.diffCount)]++;
    if (r.diffCount === 0) zeroDiff.push(`${r.type}/${r.slug}`);
  }
  console.log(`\n=== ${label} (${results.length} fixtures) ===`);
  console.log(`  0 diffs:     ${buckets['0']}`);
  console.log(`  1-3 diffs:   ${buckets['1-3']}`);
  console.log(`  4-10 diffs:  ${buckets['4-10']}`);
  console.log(`  11-30 diffs: ${buckets['11-30']}`);
  console.log(`  31+ diffs:   ${buckets['31+']}`);
  console.log(`  errors:      ${buckets.error}`);
  if (zeroDiff.length > 0) {
    console.log(`  zero-diff fixtures:`);
    for (const s of zeroDiff) console.log(`    - ${s}`);
  }
}

function main(): void {
  const types = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const requested = types.length > 0 ? types : DEFAULT_TYPES;
  const fixtures = requested.flatMap((t) => listFixtureDirs(t));
  console.log(`Loaded ${fixtures.length} fixtures across types: ${requested.join(', ')}`);

  const deterministicResults = census(fixtures, new DeterministicMeasurer());
  printReport('DeterministicMeasurer (ratchet metric)', deterministicResults);

  const jarResults = census(fixtures, jarMeasurer);
  printReport('jarMeasurer (production — should show the pre-existing D12 gap, not a regression)', jarResults);
}

main();
