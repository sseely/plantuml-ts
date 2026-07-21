#!/usr/bin/env node
/**
 * Text-measurement calibration report — mission G5/C0.
 *
 * Founding evidence (`plans/g4-state-svg/ledger.md` §S13): this port's own
 * `StringMeasurer` was reported to measure `"EvNewValueSaved"` at 120.05px
 * vs the jar's real `textLength` of 111.475px (~7% over). This script
 * characterizes that gap corpus-wide instead of trusting the single S13
 * sample: it extracts every `<text textLength="...">` element (a string,
 * its resolved font attrs, and the jar's OWN measured width for it) from
 * every cached golden `in.svg` under `test-results/dot-cache/<type>/<slug>/`
 * (captured under `-DPLANTUML_DETERMINISTIC_TEXT=true` — see
 * `src/core/measurer-deterministic.ts`'s own doc comment), then measures the
 * SAME string at the SAME font attrs through each candidate `StringMeasurer`
 * this port ships, bucketing the % error by diagram type / font-size /
 * weight / style.
 *
 * Two independent questions this separates (deliberately, since conflating
 * them is what produced the "calibration gap" framing in the first place):
 *
 *   1. Is the MEASURER (the width-table lookup itself) calibrated correctly
 *      at a GIVEN font size? Answered by Part A below: for every sample,
 *      this script feeds each measurer the font-size the jar's own SVG
 *      reports for that exact text — if `WidthTableMeasurer` is correctly
 *      calibrated, its error at the CORRECT size should be ~0% corpus-wide.
 *   2. Does some call site FEED the measurer the WRONG font size for a
 *      given text role (e.g. an arrow/transition label measured at the
 *      body-text size instead of `FontParam.ARROW`'s 13pt)? That is a
 *      caller-side bug, not a measurer defect, and Part A's per-sample
 *      approach cannot detect it (the SVG already reports the CORRECT size
 *      the jar itself used) — Part B documents it separately as a static
 *      call-site audit, since it can only be found by reading the layout
 *      code that constructs each `FontSpec`, not by replaying oracle SVGs.
 *
 * `outOfScope` exclusions (see `collectSamples`): two fixture classes were
 * found, by direct investigation of this script's own first-run "worst
 * sample" output, to measure text through a DIFFERENT jar code path than
 * the svek/graphviz pipeline this port implements, so their divergence is
 * NOT a text-measurement calibration signal:
 *
 *   - `elk-layout`: any fixture whose `in.puml` contains `!pragma layout
 *     elk` routes through `CucaDiagramFileMakerElk.java`, an entirely
 *     separate upstream layout engine (see
 *     `elk/CucaDiagramFileMakerElk.java`) that applies its own text-fit
 *     scaling. Confirmed via `component/dirofi-81-cuga514` (the ONLY
 *     fixture, of 24 corpus occurrences of the single-glyph string "E" at
 *     font-size 14 normal weight, reporting `textLength=7.5879` instead of
 *     the other 23 occurrences' consistent `9.3625`) — that fixture's
 *     `in.puml` opens with `!pragma layout elk`; the other 23 do not.
 *   - `json-diagram`: `@startjson`/`@startyaml` fixtures render synthetic
 *     placeholder/summary text (`"{ ... }"`, title text under a JSON-
 *     specific layout) that the JSON engine's own sizing code measures
 *     through a different call path than component/class/object/state's
 *     shared svek pipeline (confirmed by the disproportionate error
 *     concentration in the `json` bucket, e.g. `"{ ... }"` at -33.37%).
 *
 * Usage: npx tsx scripts/measurer-calibration-report.ts [--top N]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WidthTableMeasurer, FormulaMeasurer } from '../src/core/measurer.js';
import type { FontSpec, StringMeasurer } from '../src/core/measurer.js';
import { jarMeasurer } from '../src/core/measurer-jar.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(REPO, 'test-results', 'dot-cache');
const TYPES = ['component', 'usecase', 'class', 'object', 'state', 'dot', 'json'] as const;

// ---------------------------------------------------------------------------
// Part A: oracle-SVG text-sample extraction
// ---------------------------------------------------------------------------

type OutOfScopeReason = 'elk-layout' | 'json-diagram';

interface TextSample {
  readonly type: string;
  readonly slug: string;
  readonly text: string;
  readonly family: string;
  readonly size: number;
  readonly weight: 'normal' | 'bold';
  readonly style: 'normal' | 'italic';
  readonly jarWidth: number;
  readonly outOfScope: OutOfScopeReason | undefined;
}

/** Decodes the small, closed set of XML entities the jar's SVG emitter
 *  produces for text content (`&amp;` decoded LAST — it must not re-decode
 *  entities introduced by the earlier replacements). */
function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

const TEXT_ELEMENT_RE = new RegExp(String.raw`<text\s+([^>]*)>([^<]*)<\/text>`, 'g');
const ATTR_RE = new RegExp(String.raw`([\w-]+)="([^"]*)"`, 'g');

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(attrString)) !== null) attrs[m[1]!] = m[2]!;
  return attrs;
}

/** Builds one `TextSample` from a single `<text attrs>content</text>` match,
 *  or `undefined` if the element carries no usable measured-width oracle
 *  (empty text, or missing `textLength`/`font-size`). Split out of
 *  `parseTextSamples` to keep that loop's own CCN under the project cap. */
function buildTextSample(
  attrString: string,
  rawText: string,
  type: string,
  slug: string,
  outOfScope: OutOfScopeReason | undefined,
): TextSample | undefined {
  if (rawText.length === 0) return undefined;
  const attrs = parseAttrs(attrString);
  const textLengthStr = attrs['textLength'];
  const sizeStr = attrs['font-size'];
  if (textLengthStr === undefined || sizeStr === undefined) return undefined;
  const jarWidth = Number(textLengthStr);
  const size = Number(sizeStr);
  if (!Number.isFinite(jarWidth) || !Number.isFinite(size)) return undefined;
  return {
    type,
    slug,
    text: decodeXmlEntities(rawText),
    family: attrs['font-family'] ?? 'sans-serif',
    size,
    weight: attrs['font-weight'] === '700' ? 'bold' : 'normal',
    style: attrs['font-style'] === 'italic' ? 'italic' : 'normal',
    jarWidth,
    outOfScope,
  };
}

/** Every `<text>` element the jar emits WITH a `textLength` attribute is a
 *  measured string (`lengthAdjust="spacing"` companion attr) — the jar's own
 *  computed width for exactly that string at exactly that font. Elements
 *  without `textLength` (rare; not observed in the current corpus) carry no
 *  measured-width oracle and are skipped. */
function parseTextSamples(
  svg: string,
  type: string,
  slug: string,
  outOfScope: OutOfScopeReason | undefined,
): TextSample[] {
  const out: TextSample[] = [];
  TEXT_ELEMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEXT_ELEMENT_RE.exec(svg)) !== null) {
    const sample = buildTextSample(m[1]!, m[2]!, type, slug, outOfScope);
    if (sample !== undefined) out.push(sample);
  }
  return out;
}

function listFixtureDirs(type: string): { slug: string; dir: string }[] {
  const typeDir = join(CACHE_DIR, type);
  if (!existsSync(typeDir)) return [];
  const out: { slug: string; dir: string }[] = [];
  for (const slug of readdirSync(typeDir)) {
    const dir = join(typeDir, slug);
    if (existsSync(join(dir, 'in.svg'))) out.push({ slug, dir });
  }
  return out;
}

/** See the file header's `outOfScope` section. `json` diagrams are entirely
 *  out of scope by TYPE; component/usecase/class/object/state fixtures are
 *  out of scope only when their source explicitly requests the ELK layout
 *  engine (a different upstream code path than the svek/graphviz pipeline
 *  this port implements). */
function outOfScopeReason(type: string, pumlPath: string): OutOfScopeReason | undefined {
  if (type === 'json') return 'json-diagram';
  if (!existsSync(pumlPath)) return undefined;
  const puml = readFileSync(pumlPath, 'utf-8');
  return puml.includes('pragma layout elk') ? 'elk-layout' : undefined;
}

function collectSamples(): TextSample[] {
  const out: TextSample[] = [];
  for (const type of TYPES) {
    for (const { slug, dir } of listFixtureDirs(type)) {
      const svg = readFileSync(join(dir, 'in.svg'), 'utf-8');
      const reason = outOfScopeReason(type, join(dir, 'in.puml'));
      out.push(...parseTextSamples(svg, type, slug, reason));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Part A: per-measurer bucketed comparison
// ---------------------------------------------------------------------------

interface MeasurerEntry {
  readonly name: string;
  readonly measurer: StringMeasurer;
}

const MEASURERS: readonly MeasurerEntry[] = [
  { name: 'WidthTableMeasurer (ratchet/conformance path)', measurer: new WidthTableMeasurer() },
  { name: 'jarMeasurer (production default, D12 AWT table)', measurer: jarMeasurer },
  { name: 'FormulaMeasurer (StringBounderFixed approximation)', measurer: new FormulaMeasurer() },
];

interface SampleResult {
  readonly sample: TextSample;
  readonly measured: number;
  readonly pctError: number;
}

function pctError(measured: number, jarWidth: number): number {
  if (jarWidth === 0) return measured === 0 ? 0 : 100;
  return ((measured - jarWidth) / jarWidth) * 100;
}

interface BucketStat {
  readonly key: string;
  count: number;
  sumAbsPct: number;
  maxAbsPct: number;
  worst?: SampleResult;
}

function bucketKey(s: TextSample): string {
  return `${s.type} | size=${s.size} | weight=${s.weight} | style=${s.style}`;
}

function evaluateMeasurer(measurer: StringMeasurer, samples: readonly TextSample[]): SampleResult[] {
  return samples.map((sample) => {
    const font: FontSpec = { family: sample.family, size: sample.size, weight: sample.weight, style: sample.style };
    const measured = measurer.measure(sample.text, font).width;
    return { sample, measured, pctError: pctError(measured, sample.jarWidth) };
  });
}

/** `b.worst` must be set on the FIRST sample seen for a bucket even if that
 *  sample's error is exactly 0 -- initializing `maxAbsPct` to `-1` (rather
 *  than `0`) makes the first `>` comparison always true, so a bucket whose
 *  every sample matches exactly still reports a representative sample
 *  instead of leaving `worst` undefined. */
function updateBucket(buckets: Map<string, BucketStat>, r: SampleResult): void {
  const key = bucketKey(r.sample);
  let b = buckets.get(key);
  if (b === undefined) {
    b = { key, count: 0, sumAbsPct: 0, maxAbsPct: -1 };
    buckets.set(key, b);
  }
  b.count++;
  b.sumAbsPct += Math.abs(r.pctError);
  if (Math.abs(r.pctError) > b.maxAbsPct) {
    b.maxAbsPct = Math.abs(r.pctError);
    b.worst = r;
  }
}

function bucketize(results: readonly SampleResult[]): BucketStat[] {
  const buckets = new Map<string, BucketStat>();
  for (const r of results) updateBucket(buckets, r);
  return [...buckets.values()].sort((a, b) => b.sumAbsPct / b.count - a.sumAbsPct / a.count);
}

function printBucketTable(buckets: readonly BucketStat[]): void {
  console.log('bucket | count | mean|err|% | max|err|% | worst sample');
  for (const b of buckets) {
    const mean = b.sumAbsPct / b.count;
    const w = b.worst!;
    console.log(
      `${b.key} | ${b.count} | ${mean.toFixed(3)} | ${b.maxAbsPct.toFixed(3)} | ` +
        `${w.sample.type}/${w.sample.slug} "${w.sample.text}" measured=${w.measured.toFixed(4)} ` +
        `jar=${w.sample.jarWidth.toFixed(4)} err=${w.pctError.toFixed(2)}%`,
    );
  }
}

function printTop(results: readonly SampleResult[], n: number): void {
  const top = [...results].sort((a, b) => Math.abs(b.pctError) - Math.abs(a.pctError)).slice(0, n);
  for (const r of top) {
    console.log(
      `  ${r.sample.type}/${r.sample.slug} family="${r.sample.family}" size=${r.sample.size} ` +
        `weight=${r.sample.weight} style=${r.sample.style} text="${r.sample.text}" ` +
        `measured=${r.measured.toFixed(4)} jar=${r.sample.jarWidth.toFixed(4)} err=${r.pctError.toFixed(2)}%`,
    );
  }
}

// ---------------------------------------------------------------------------
// Part B: call-site font-size audit (static, source-derived)
// ---------------------------------------------------------------------------
//
// Cannot be derived from the oracle SVGs (they report the jar's OWN correct
// font size for each string, not what THIS PORT'S call site would have
// chosen) -- these rows were derived by reading each listed call site
// directly and comparing its FontSpec construction against upstream's
// `FontParam` enum (`klimt/font/FontParam.java`), which defines
// `ARROW(13, normal)` as the default size for arrow/transition/relationship
// labels -- distinct from the body/entity-name default (`theme.fontSize`,
// 14, matching e.g. `FontParam.STATE(14, normal)` /
// `FontParam.COMPONENT(14, normal)`).

interface CallSiteAudit {
  readonly diagramType: string;
  readonly role: string;
  readonly file: string;
  readonly expectedSize: number;
  readonly actualSize: number | 'correct';
  readonly note: string;
}

const CALL_SITE_AUDIT: readonly CallSiteAudit[] = [
  {
    diagramType: 'state',
    role: 'transition/edge label (top-level graph)',
    file: 'src/diagrams/state/state-dot-graph.ts:179',
    expectedSize: 13,
    actualSize: 14,
    note: 'font = { family: theme.fontFamily, size: theme.fontSize } -- theme.fontSize defaults to 14 (theme.ts:842), the FontParam.STATE default, not FontParam.ARROW (13).',
  },
  {
    diagramType: 'state',
    role: 'transition/edge label (composite cluster, materializeCluster path)',
    file: 'src/diagrams/state/state-composite-pass.ts:244',
    expectedSize: 13,
    actualSize: 14,
    note: 'same theme.fontSize construction as state-dot-graph.ts:179.',
  },
  {
    diagramType: 'state',
    role: 'transition/edge label (composite cluster, materializeAutonom path)',
    file: 'src/diagrams/state/state-composite-pass.ts:326',
    expectedSize: 13,
    actualSize: 14,
    note: 'same theme.fontSize construction as state-dot-graph.ts:179 -- this is the S13 EvNewValueSaved call site (Configuring composite, internal transitions).',
  },
  {
    diagramType: 'state',
    role: 'composite cluster TITLE (measureClusterTitle) -- NOT an edge label',
    file: 'src/diagrams/state/state-composite-cluster.ts:36',
    expectedSize: 14,
    actualSize: 'correct',
    note: 'font = { family: ctx.theme.fontFamily, size: ctx.theme.fontSize }, consumed by measureClusterTitle for the composite\'s OWN header/title text (matches SvekResult\'s title TABLE, class-dot-graph.ts\'s namespace-title precedent) -- this is body/entity-name text (FontParam.STATE default, 14), not an arrow label. Initially flagged for verification in an earlier pass of this audit; confirmed correct by reading the call site\'s only caller.',
  },
  {
    diagramType: 'component/usecase (description engine)',
    role: 'edge/link label, LAYOUT-time sizing fed to graphviz (buildLinkEdgeAttributes)',
    file: 'src/diagrams/description/layout.ts:735',
    expectedSize: 13,
    actualSize: 14,
    note: 'fontSpec = { family: theme.fontFamily, size: theme.fontSize }, threaded into buildLinkEdgeAttributes for DOT edge-attribute sizing. The RENDER-time sibling (src/diagrams/description/renderer-edge.ts:21, ARROW_LABEL_FONT_SIZE = 13) was ALREADY fixed for this exact defect (that file\'s own comment: "G1 I2 finding: a prior theme.fontSize - 2 delta ... diverges from the jar the moment theme.fontSize differs from 14") -- this is the SAME bug class, same diagram engine, LAYOUT side only, left unfixed.',
  },
  {
    diagramType: 'class',
    role: 'relationship label (association/dependency text)',
    file: 'src/diagrams/class/class-dot-graph.ts:298',
    expectedSize: 13,
    actualSize: 14,
    note: 'labelFont = { family: theme.fontFamily, size: theme.fontSize }, fed into buildDotEdges -> edgeLabelAttrs. Documented as a KNOWN, deliberately-unfixed mismatch in class-layout-helpers.ts:96-100 ("pre-existing, separate, NOT-fixed-this-iteration mismatch ... left untouched to avoid ANY risk to the frozen DOT gate").',
  },
  {
    diagramType: 'class',
    role: 'cardinality / multiplicity label (taillabel/headlabel)',
    file: 'src/diagrams/class/class-layout-helpers.ts:102 (CARDINALITY_FONT_SIZE)',
    expectedSize: 13,
    actualSize: 'correct',
    note: 'CARDINALITY_FONT_SIZE = 13, jar-verified against every sampled font-size="13" multiplicity glyph -- this call site is ALREADY correct; proves the fix is a known, applied pattern elsewhere in the SAME file, not a novel one.',
  },
];

function printCallSiteAudit(): void {
  console.log(
    'This table cannot be derived from oracle SVGs (see file header) -- it is a static\n' +
      'source-code audit against upstream FontParam.ARROW(13, normal)\n' +
      '(~/git/plantuml/.../klimt/font/FontParam.java:54).\n',
  );
  for (const row of CALL_SITE_AUDIT) {
    const status =
      row.actualSize === 'correct' ? 'CORRECT' : `MISMATCH (uses ${row.actualSize}, expected ${row.expectedSize})`;
    console.log(`[${row.diagramType}] ${row.role}`);
    console.log(`  ${row.file}`);
    console.log(`  ${status}`);
    console.log(`  ${row.note}`);
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseTopN(argv: readonly string[]): number {
  const idx = argv.indexOf('--top');
  if (idx === -1) return 20;
  const n = Number(argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function printMeasurerSection(
  name: string,
  measurer: StringMeasurer,
  samples: readonly TextSample[],
  topN: number,
): void {
  console.log(`--- ${name} ---`);
  const results = evaluateMeasurer(measurer, samples);
  const buckets = bucketize(results);
  printBucketTable(buckets);
  console.log(`\nTop ${topN} worst individual samples (${name}):`);
  printTop(results, topN);
  console.log();
}

function printScopeSummary(samples: readonly TextSample[], inScope: readonly TextSample[]): void {
  const outOfScopeCounts = new Map<OutOfScopeReason, number>();
  for (const s of samples) {
    if (s.outOfScope === undefined) continue;
    outOfScopeCounts.set(s.outOfScope, (outOfScopeCounts.get(s.outOfScope) ?? 0) + 1);
  }
  console.log(`Total <text textLength> samples across corpus: ${samples.length}`);
  for (const [reason, count] of outOfScopeCounts) {
    console.log(`  out of scope (${reason}): ${count}`);
  }
  const otherFont = inScope.length - inScope.filter((s) => s.family === 'sans-serif').length;
  console.log(`  in-scope, font-family="sans-serif" (calibration buckets below): ${inScope.length - otherFont}`);
  console.log(
    `  in-scope, other font-family (skinparam-overridden fonts; both WidthTableMeasurer and\n` +
      `    jarMeasurer are documented single-font tables, so these are EXPECTED to diverge and\n` +
      `    are excluded from the calibration buckets below): ${otherFont}\n`,
  );
}

function main(): void {
  const topN = parseTopN(process.argv.slice(2));
  const samples = collectSamples();
  const inScope = samples.filter((s) => s.outOfScope === undefined);
  const sansSerif = inScope.filter((s) => s.family === 'sans-serif');

  console.log('=== Part A: measurer calibration (oracle SVG text samples) ===\n');
  printScopeSummary(samples, inScope);

  for (const { name, measurer } of MEASURERS) printMeasurerSection(name, measurer, sansSerif, topN);

  console.log('=== Part B: call-site font-size audit (static) ===\n');
  printCallSiteAudit();
}

main();
