/**
 * SVG parity dashboard — renders `tests/oracle/svg-conformance/PARITY-SVG.md`
 * from `parity.json` (scripts/svg-parity-survey.ts). Structural shape is a
 * near-verbatim port of ~/git/graphviz-ts's test/corpus/dashboard.ts, scoped
 * to what T15 asks for: totals, per-verdict counts, per-family tables, and a
 * divergence ledger joined from `oracle/accepted-divergences.json` (that
 * project's triage-bucket backlog machinery is out of scope here — it is a
 * DOT-corpus-specific concern this survey doesn't need).
 *
 * A report, not a gate — regenerate: `npm run svg:survey && npm run
 * svg:dashboard`. Node-only dev/test infra — never imported by src/index.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { FixtureRow, ParityReport, Verdict } from './svg-parity-survey.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARITY_IN = join(REPO, 'tests', 'oracle', 'svg-conformance', 'parity.json');
const LEDGER_IN = join(REPO, 'oracle', 'accepted-divergences.json');
const OUT = join(REPO, 'tests', 'oracle', 'svg-conformance', 'PARITY-SVG.md');

const VERDICTS: Verdict[] = [
  'conformant', 'structural-match', 'diverged', 'errored', 'timeout', 'oracle-error',
];
const TYPES = ['component', 'usecase'];

export interface LedgerEntry {
  match: { id?: string; idPattern?: string };
  class?: string;
  reason?: string;
  ref?: string;
}
interface LedgerFile { comment?: string; entries: LedgerEntry[] }

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

/** Escape a markdown table cell (pipes only — content is backticked). */
function cell(s: string | undefined): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function pct(n: number, d: number): string {
  return d === 0 ? '0%' : `${((100 * n) / d).toFixed(1)}%`;
}

export function tally(fixtures: readonly FixtureRow[]): Record<Verdict, number> {
  const counts = Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<Verdict, number>;
  for (const f of fixtures) counts[f.verdict]++;
  return counts;
}

// ---------------------------------------------------------------------------
// Summary + per-family sections
// ---------------------------------------------------------------------------

export function summarySection(report: ParityReport): string {
  const counts = tally(report.fixtures);
  const total = report.fixtures.length;
  const dotEqualCount = report.fixtures.filter((f) => f.dotEqual).length;
  const lines = [
    '## Summary',
    '',
    `- **Generated:** ${report.generatedAt}`,
    `- **Surveyed:** ${total}`,
    ...VERDICTS.map((v) => `- **${v}:** ${counts[v]} (${pct(counts[v], total)})`),
    `- **dot-EQUAL (ratchet-eligible):** ${dotEqualCount}/${total} (${pct(dotEqualCount, total)})`,
    '',
  ];
  return lines.join('\n');
}

function familyRow(report: ParityReport, type: string): string {
  const fixtures = report.fixtures.filter((f) => f.type === type);
  const counts = tally(fixtures);
  const dotEqualCount = fixtures.filter((f) => f.dotEqual).length;
  const cells = [type, String(fixtures.length), ...VERDICTS.map((v) => String(counts[v])), String(dotEqualCount)];
  return `| ${cells.join(' | ')} |`;
}

export function familyTable(report: ParityReport): string {
  const header = `| type | total | ${VERDICTS.join(' | ')} | dot-equal |`;
  const sep = `|---|---:|${VERDICTS.map(() => '---:').join('|')}|---:|`;
  const rows = TYPES.map((t) => familyRow(report, t));
  return ['## Per-family', '', header, sep, ...rows, ''].join('\n');
}

// ---------------------------------------------------------------------------
// Per-verdict sections
// ---------------------------------------------------------------------------

function collapsedSlugs(fixtures: readonly FixtureRow[]): string {
  return fixtures.length === 0 ? '_(none)_' : fixtures.map((f) => `\`${f.type}/${f.slug}\``).join(' ');
}

export function conformantSection(report: ParityReport): string {
  const rows = report.fixtures.filter((f) => f.verdict === 'conformant');
  return [`## conformant (${rows.length})`, '', collapsedSlugs(rows), ''].join('\n');
}

/** Worst-first table for structural-match (maxDeltaPath) / diverged (firstDiff). */
export function numericTable(title: string, rows: readonly FixtureRow[], showFirstDiff: boolean): string {
  const sorted = [...rows].sort((a, b) => (b.maxDelta ?? 0) - (a.maxDelta ?? 0));
  const header = showFirstDiff
    ? '| slug | type | maxΔ | firstDiff |'
    : '| slug | type | maxΔ | maxDeltaPath |';
  const body = sorted.map((r) => {
    const last = showFirstDiff ? cell(r.firstDiff) : cell(r.maxDeltaPath);
    return `| \`${r.slug}\` | ${r.type} | ${(r.maxDelta ?? 0).toFixed(2)} | \`${last}\` |`;
  });
  return [`## ${title} (${rows.length})`, '', header, '|---|---|---:|---|', ...body, ''].join('\n');
}

export function msgTable(title: string, rows: readonly FixtureRow[]): string {
  const sorted = [...rows].sort((a, b) => `${a.type}/${a.slug}`.localeCompare(`${b.type}/${b.slug}`));
  const body = sorted.map((r) => `| \`${r.slug}\` | ${r.type} | ${cell(r.errMsg)} |`);
  return [`## ${title} (${rows.length})`, '', '| slug | type | message |', '|---|---|---|', ...body, ''].join('\n');
}

// ---------------------------------------------------------------------------
// Divergence ledger (oracle/accepted-divergences.json — may not exist yet)
// ---------------------------------------------------------------------------

export function loadLedger(): LedgerEntry[] {
  if (!existsSync(LEDGER_IN)) return [];
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_IN, 'utf-8')) as LedgerFile;
    return parsed.entries ?? [];
  } catch {
    return [];
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `*` matches any (possibly empty) run of characters. */
export function globMatch(pattern: string, s: string): boolean {
  const re = new RegExp(`^${pattern.split('*').map(escapeRe).join('.*')}$`);
  return re.test(s);
}

export function matchesEntry(entry: LedgerEntry, slug: string): boolean {
  if (entry.match.id !== undefined) return entry.match.id === slug;
  if (entry.match.idPattern !== undefined) return globMatch(entry.match.idPattern, slug);
  return false;
}

function ledgerRows(report: ParityReport, entries: readonly LedgerEntry[]): string[] {
  const rows: string[] = [];
  for (const f of report.fixtures) {
    for (const e of entries) {
      if (matchesEntry(e, f.slug)) {
        rows.push(`| \`${f.slug}\` | ${e.class ?? ''} | ${cell(e.reason)} | ${cell(e.ref)} |`);
      }
    }
  }
  return rows;
}

export function ledgerSection(report: ParityReport): string {
  const entries = loadLedger();
  const head = [
    "## Divergence ledger (accepted, won't-fix)",
    '',
    'Source: `oracle/accepted-divergences.json`.',
    '',
  ];
  if (entries.length === 0) return [...head, '_(no accepted divergences recorded yet)_', ''].join('\n');
  const rows = ledgerRows(report, entries);
  const body = rows.length > 0 ? rows : ['| _(none matched)_ | | | |'];
  return [...head, '| slug | class | reason | ref |', '|---|---|---|---|', ...body, ''].join('\n');
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function buildMarkdown(report: ParityReport): string {
  const byVerdict = (v: Verdict): FixtureRow[] => report.fixtures.filter((f) => f.verdict === v);
  const parts = [
    '<!-- GENERATED by scripts/svg-parity-dashboard.ts from parity.json — do not edit by hand. -->',
    '',
    '# SVG parity dashboard (pre-cutover baseline)',
    '',
    'Differential survey of plantuml-ts vs the cached PlantUML jar SVG output',
    'over the component/usecase corpus (`test-results/dot-cache/`). A report,',
    'not a gate. Regenerate: `npm run svg:survey && npm run svg:dashboard`.',
    '',
    'The description renderer is pre-cutover (legacy) as of this baseline, so',
    'verdicts are overwhelmingly `diverged` — that is EXPECTED and proves the',
    'instrument, not a regression.',
    '',
    summarySection(report),
    familyTable(report),
    conformantSection(report),
    numericTable('structural-match', byVerdict('structural-match'), false),
    numericTable('diverged', byVerdict('diverged'), true),
    msgTable('errored', byVerdict('errored')),
    msgTable('timeout', byVerdict('timeout')),
    msgTable('oracle-error', byVerdict('oracle-error')),
    ledgerSection(report),
  ];
  return `${parts.join('\n')}\n`;
}

function main(): void {
  const report = JSON.parse(readFileSync(PARITY_IN, 'utf-8')) as ParityReport;
  writeFileSync(OUT, buildMarkdown(report));
  process.stderr.write(`wrote PARITY-SVG.md (${report.fixtures.length} surveyed)\n`);
}

/* v8 ignore start -- CLI entry point; exercised via the real dashboard run. */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
/* v8 ignore stop */
