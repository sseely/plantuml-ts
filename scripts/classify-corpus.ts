#!/usr/bin/env node
/**
 * Scan the pdiff corpus and classify every fixture by diagram type,
 * producing per-type manifest JSON files under tests/visual/data/.
 *
 * Usage:
 *   jiti scripts/classify-corpus.ts
 *   jiti scripts/classify-corpus.ts --type sequence
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const PDIFF_DBHUM = join(process.env['HOME'] ?? '/root', 'git', 'pdiff', 'dbhum');
const PDIFF_INPUT = join(process.env['HOME'] ?? '/root', 'git', 'pdiff', 'input');
const OUT_DIR = join(REPO_ROOT, 'tests', 'visual', 'data');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FixtureEntry {
  slug: string;
  markup: string;
}

// ---------------------------------------------------------------------------
// @start keyword → diagram type map (for non-@startuml diagrams)
// ---------------------------------------------------------------------------

const START_KEYWORD_MAP: Record<string, string> = {
  startmindmap: 'mindmap',
  startgantt: 'gantt',
  startwbs: 'wbs',
  startjson: 'json',
  startyaml: 'yaml',
  startdot: 'dot',
  startsalt: 'salt',
  startebnf: 'ebnf',
  startditaa: 'ditaa',
  startchen: 'chen',
  startboard: 'board',
  startchronology: 'chronology',
  startpacket: 'packet',
  startwire: 'wire',
  startregex: 'regex',
  startgitgraph: 'gitgraph',
  startchart: 'chart',
};

// ---------------------------------------------------------------------------
// Type detection for @startuml diagrams
// Markers are checked in the exact priority order specified.
// ---------------------------------------------------------------------------

function detectStartumlType(bodyLines: readonly string[]): string {
  // Examine the first 30 non-empty body lines after the @startuml line.
  const sample = bodyLines
    .filter((l) => l.trim().length > 0)
    .slice(0, 30);

  const matches = (pattern: RegExp): boolean =>
    sample.some((l) => pattern.test(l));

  const contains = (substr: string): boolean =>
    sample.some((l) => l.includes(substr));

  // 1. Object
  if (matches(/^object\s/i) || matches(/^map\s/i)) return 'object';

  // 2. Class
  if (
    matches(/^class\s/i) ||
    matches(/^interface\s/i) ||
    matches(/^enum\s/i) ||
    matches(/^abstract\s/i) ||
    contains('<|--')
  ) {
    return 'class';
  }

  // 3. State
  if (matches(/^\[\*\]\s*-->/) || matches(/^state\s/i)) return 'state';

  // 4. Component
  if (
    matches(/^\[/) ||
    matches(/^component\s/i) ||
    matches(/^node\s/i)
  ) {
    return 'component';
  }

  // 5. Activity
  if (
    matches(/^:/) ||
    matches(/^start$/i) ||
    matches(/^if\s*\(/i) ||
    matches(/^fork$/i) ||
    matches(/^\|/)
  ) {
    return 'activity';
  }

  // 6. UseCase
  if (
    matches(/^actor\s/i) ||
    matches(/:.*:/) ||
    matches(/^\(.*\)$/) ||
    matches(/^usecase\s/i)
  ) {
    return 'usecase';
  }

  // 7. Timing
  if (
    matches(/^robust\s/i) ||
    matches(/^concise\s/i) ||
    matches(/^clock\s/i) ||
    matches(/^binary\s/i)
  ) {
    return 'timing';
  }

  // 8. Network
  if (contains('nwdiag {') || contains('network ')) return 'network';

  // 9. C4
  if (
    contains('!include <C4') ||
    contains('Person(') ||
    contains('System(') ||
    contains('Container(')
  ) {
    return 'c4';
  }

  // 10. Sequence
  if (
    matches(/->|-->>/) ||
    matches(/^participant\s/i) ||
    matches(/^actor\s/i)
  ) {
    return 'sequence';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Detect diagram type from full markup (including @start line)
// ---------------------------------------------------------------------------

function detectType(markup: string): string {
  const lines = markup.split('\n');
  const startLine = lines.find((l) => /^@start/i.test(l.trim()));
  if (!startLine) return 'unknown';

  const keyword = startLine.trim().toLowerCase().replace(/^@/, '').split(/\s/)[0] ?? '';

  if (keyword !== 'startuml') {
    return START_KEYWORD_MAP[keyword] ?? 'unknown';
  }

  // @startuml — extract body lines (everything between @startuml and @end*)
  const startIdx = lines.findIndex((l) => /^@startuml/i.test(l.trim()));
  const endIdx = lines.findIndex((l, i) => i > startIdx && /^@end/i.test(l.trim()));
  const bodyLines = lines.slice(
    startIdx + 1,
    endIdx === -1 ? undefined : endIdx,
  );

  return detectStartumlType(bodyLines);
}

// ---------------------------------------------------------------------------
// Extract all diagrams from a dbhum fixture file.
// Returns [{slug, markup}] — always exactly one diagram per dbhum file.
// ---------------------------------------------------------------------------

interface DbhumHeader {
  humhash: string;
}

function processDbhumFile(filePath: string): FixtureEntry | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(`WARN: cannot read ${filePath}: ${String(err)}`);
    return null;
  }

  // Parse JSON header (lines before the first @start line)
  const lines = raw.split('\n');
  const startIdx = lines.findIndex((l) => /^@start/i.test(l.trim()));

  if (startIdx === -1) {
    console.warn(`WARN: no @start line in ${filePath} — skipping`);
    return null;
  }

  const headerText = lines.slice(0, startIdx).join('\n').trim();
  let slug: string;
  try {
    const header = JSON.parse(headerText) as DbhumHeader;
    slug = header.humhash;
    if (!slug) throw new Error('missing humhash');
  } catch (err) {
    console.warn(`WARN: malformed JSON header in ${filePath}: ${String(err)} — skipping`);
    return null;
  }

  const markup = lines.slice(startIdx).join('\n').trimEnd();
  return { slug, markup };
}

// ---------------------------------------------------------------------------
// Extract all diagrams from an input fixture file.
// Returns [{slug, markup}] — potentially multiple diagrams per file.
// ---------------------------------------------------------------------------

function processInputFile(filePath: string): FixtureEntry[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(`WARN: cannot read ${filePath}: ${String(err)}`);
    return [];
  }

  const base = basename(filePath, extname(filePath));
  const entries: FixtureEntry[] = [];
  const lines = raw.split('\n');

  let i = 0;
  let diagramIndex = 0;

  while (i < lines.length) {
    // Advance to next @start line
    while (i < lines.length && !/^@start/i.test((lines[i] ?? '').trim())) {
      i++;
    }

    if (i >= lines.length) break;

    const startLineIdx = i;
    const startLine = (lines[i] ?? '').trim();

    // Determine matching @end keyword
    const endKeyword = startLine.toLowerCase().replace(/^@start/, '@end');

    // Advance past the @start line
    i++;

    // Find the matching @end line
    while (i < lines.length && !(lines[i] ?? '').trim().toLowerCase().startsWith(endKeyword)) {
      i++;
    }

    if (i >= lines.length) {
      console.warn(`WARN: unclosed diagram at index ${diagramIndex} in ${filePath} — skipping`);
      break;
    }

    // Include the @end line
    const endLineIdx = i;
    const markup = lines.slice(startLineIdx, endLineIdx + 1).join('\n').trimEnd();
    const slug = `${base}-${diagramIndex}`;
    entries.push({ slug, markup });

    diagramIndex++;
    i++; // advance past @end line
  }

  return entries;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { filterType: string | null } {
  const args = process.argv.slice(2);
  const typeIdx = args.indexOf('--type');
  if (typeIdx !== -1 && typeIdx + 1 < args.length) {
    return { filterType: args[typeIdx + 1] ?? null };
  }
  return { filterType: null };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { filterType } = parseArgs();

  if (filterType !== null) {
    console.log(`Processing only type: ${filterType}`);
  }

  // Accumulate entries per type
  const byType = new Map<string, FixtureEntry[]>();

  const addEntry = (entry: FixtureEntry): void => {
    const type = detectType(entry.markup);
    if (filterType !== null && type !== filterType) return;
    const list = byType.get(type);
    if (list) {
      list.push(entry);
    } else {
      byType.set(type, [entry]);
    }
  };

  // --- Scan dbhum ---
  let dbhumDirs: string[];
  try {
    dbhumDirs = readdirSync(PDIFF_DBHUM);
  } catch {
    console.warn(`WARN: cannot read dbhum dir ${PDIFF_DBHUM} — skipping`);
    dbhumDirs = [];
  }

  for (const subdir of dbhumDirs) {
    const subdirPath = join(PDIFF_DBHUM, subdir);
    let isDir = false;
    try {
      isDir = statSync(subdirPath).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;

    let files: string[];
    try {
      files = readdirSync(subdirPath);
    } catch (err) {
      console.warn(`WARN: cannot read ${subdirPath}: ${String(err)}`);
      continue;
    }

    for (const fname of files) {
      if (!fname.endsWith('.puml')) continue;
      const entry = processDbhumFile(join(subdirPath, fname));
      if (entry) addEntry(entry);
    }
  }

  // --- Scan input ---
  let inputFiles: string[];
  try {
    inputFiles = readdirSync(PDIFF_INPUT);
  } catch {
    console.warn(`WARN: cannot read input dir ${PDIFF_INPUT} — skipping`);
    inputFiles = [];
  }

  for (const fname of inputFiles) {
    if (!fname.endsWith('.puml')) continue;
    const entries = processInputFile(join(PDIFF_INPUT, fname));
    for (const entry of entries) addEntry(entry);
  }

  // --- Write manifests ---
  mkdirSync(OUT_DIR, { recursive: true });

  const sortedTypes = [...byType.keys()].sort();
  for (const type of sortedTypes) {
    const entries = byType.get(type) ?? [];
    const outPath = join(OUT_DIR, `${type}.json`);
    writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
  }

  // --- Summary ---
  console.log('');
  let total = 0;
  for (const type of sortedTypes) {
    const count = (byType.get(type) ?? []).length;
    console.log(`${type}: ${count} fixtures`);
    total += count;
  }
  console.log(`total: ${total} fixtures`);
  console.log(`output: ${OUT_DIR}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
