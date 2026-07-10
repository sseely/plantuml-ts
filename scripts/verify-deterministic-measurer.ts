#!/usr/bin/env node
/**
 * Verifies `DeterministicMeasurer` (`src/core/measurer-deterministic.ts`,
 * a re-export of `WidthTableMeasurer`) against the REAL PlantUML jar's
 * `-DPLANTUML_DETERMINISTIC_TEXT=true` output — not just this repo's own
 * unit tests, which only prove internal self-consistency with the ported
 * width table, not fidelity to the actual jar.
 *
 * Not a re-extraction tool: the SANS_SERIF width table
 * (`measurer-width-table.data.ts`) was already ported and committed under
 * an earlier mission (ADR-001, "S1-impl") — re-transcribing the same
 * ~717-line Java `byte[][]` a second time would duplicate data for zero
 * benefit (this project's no-duplicate-logic principle). This script is
 * this task's OWN verification step: build a small component diagram,
 * render it through the real jar in deterministic mode, and diff every
 * `<text textLength="...">` attribute against `DeterministicMeasurer`'s
 * own computation for the identical string + font-size.
 *
 * Usage: npx tsx scripts/verify-deterministic-measurer.ts
 * Requires: java on PATH, and a PlantUML jar at --jar (default: the path
 * this project's other jar-oracle scripts use, see JAR_PATH below).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeterministicMeasurer } from '../src/core/measurer-deterministic.js';

const JAR_PATH =
  process.env['PLANTUML_JAR'] ??
  join(process.env['HOME'] ?? '', 'git/plantuml/build/libs/plantuml-1.2026.7beta3.jar');

/** One row: a string, its font size, and the component name PlantUML will
 *  wrap it in (kept distinct so every fixture round-trips independently). */
interface Case {
  readonly text: string;
  readonly size: number;
}

/** Covers: plain ASCII (the common case), a short/long word (interpolation
 *  sanity), an astral codepoint (getCharWidth's `cp >= 0xFFFF` fallback),
 *  and a codepoint in a block beyond the 255-entry table (the `blockIndex
 *  >= table.length` fallback) — the two branches this task's own
 *  measurer.ts fix corrected (see that file's doc comment). */
const CASES: readonly Case[] = [
  { text: 'Component', size: 14 },
  { text: 'comp1', size: 14 },
  { text: 'A', size: 14 },
  { text: '\u{1F600}', size: 14 }, // astral (emoji) — cp >= 0xFFFF fallback
  { text: 'Ａ', size: 14 }, // fullwidth 'A', U+FF21 — block 255 fallback
];

function buildPuml(cases: readonly Case[]): string {
  const lines = ['@startuml'];
  cases.forEach((c, i) => {
    // font size is fixed by the theme default (14) for every case here;
    // if a case ever needs a non-default size, this must grow a
    // per-component skinparam block.
    lines.push(`component "${c.text}" as E${i}`);
  });
  lines.push('@enduml');
  return lines.join('\n');
}

function renderDeterministic(puml: string): string {
  return execFileSync(
    'java',
    ['-DPLANTUML_DETERMINISTIC_TEXT=true', '-jar', JAR_PATH, '-tsvg', '-pipe'],
    { input: puml, maxBuffer: 2 ** 24, encoding: 'utf8' },
  );
}

/** Extracts every `<text ... textLength="N" ...>CONTENT</text>` pair from
 *  the jar's SVG, in document order (matches CASES order 1:1 since each
 *  component draws exactly one label). */
function extractTextLengths(svg: string): number[] {
  const re = /<text\b[^>]*\btextLength="([0-9.]+)"[^>]*>[^<]*<\/text>/g;
  const out: number[] = [];
  for (const m of svg.matchAll(re)) out.push(Number(m[1]));
  return out;
}

function main(): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'plantuml-ts-deterministic-verify-'));
  const pumlPath = join(tmpDir, 'verify.puml');
  writeFileSync(pumlPath, buildPuml(CASES));

  let svg: string;
  try {
    svg = renderDeterministic(buildPuml(CASES));
  } catch (err) {
    console.error(`Failed to run the jar (${JAR_PATH}). Is java on PATH and the jar present?`);
    console.error(err);
    process.exitCode = 1;
    return;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const jarWidths = extractTextLengths(svg);
  const measurer = new DeterministicMeasurer();
  let failures = 0;

  console.log('text'.padEnd(14), 'size'.padEnd(6), 'jar'.padEnd(12), 'ported'.padEnd(12), 'match');
  CASES.forEach((c, i) => {
    const jarWidth = jarWidths[i];
    const portedWidth = measurer.measure(c.text, { family: 'sans-serif', size: c.size }).width;
    const match = jarWidth !== undefined && Math.abs(jarWidth - portedWidth) < 1e-6;
    if (!match) failures++;
    console.log(
      JSON.stringify(c.text).padEnd(14),
      String(c.size).padEnd(6),
      String(jarWidth).padEnd(12),
      String(portedWidth).padEnd(12),
      match ? 'OK' : 'MISMATCH',
    );
  });

  if (failures > 0) {
    console.error(`\n${failures}/${CASES.length} case(s) diverge from the jar.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${CASES.length} cases match the jar exactly.`);
  }
}

main();
