import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  parseFixtureArgs,
  selectDiverged,
  buildOverlayHtml,
  generateReport,
  runReports,
} from '../../../scripts/svg-overlay-report.js';
import type { ParityFile, FixtureRef } from '../../../scripts/svg-overlay-report.js';
import { renderSync } from '../../../src/index.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

/** A tiny, deterministic component-diagram fixture used across the
 *  integration-style tests — renderSync is a pure function of (markup,
 *  measurer), so re-rendering it twice with a fresh WidthTableMeasurer
 *  yields byte-identical SVG (verified ad hoc; see decision journal). */
const FIXTURE_MARKUP = '@startuml\n[Foo] --> [Bar]\n@enduml';

function render(): string {
  return renderSync(FIXTURE_MARKUP, { measurer: new WidthTableMeasurer() });
}

function seedCache(cacheDir: string, ref: FixtureRef, markup: string, jarSvg: string): void {
  const dir = join(cacheDir, ref.type, ref.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'in.puml'), markup, 'utf-8');
  writeFileSync(join(dir, 'in.svg'), jarSvg, 'utf-8');
}

describe('scripts/svg-overlay-report', () => {
  let workDir: string;
  let cacheDir: string;
  let outDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'svg-overlay-test-'));
    cacheDir = join(workDir, 'dot-cache');
    outDir = join(workDir, 'svg-overlay');
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  describe('parseFixtureArgs', () => {
    it('splits "<type>/<slug>" positional args into refs', () => {
      const refs = parseFixtureArgs(['component/foo-01', 'usecase/bar-99']);
      expect(refs).toEqual([
        { type: 'component', slug: 'foo-01' },
        { type: 'usecase', slug: 'bar-99' },
      ]);
    });

    it('throws a descriptive error for an arg with no "/"', () => {
      expect(() => parseFixtureArgs(['not-a-ref'])).toThrow(
        'Expected "<type>/<slug>", got "not-a-ref"',
      );
    });
  });

  describe('selectDiverged', () => {
    it('returns only the diverged rows as FixtureRefs', () => {
      const parity: ParityFile = {
        generatedAt: '2026-07-09T00:00:00Z',
        fixtures: [
          { slug: 'a', type: 'component', verdict: 'conformant', dotEqual: true },
          { slug: 'b', type: 'component', verdict: 'diverged', dotEqual: true },
          { slug: 'c', type: 'usecase', verdict: 'diverged', dotEqual: false },
          { slug: 'd', type: 'usecase', verdict: 'errored', dotEqual: false },
        ],
      };
      expect(selectDiverged(parity)).toEqual([
        { type: 'component', slug: 'b' },
        { type: 'usecase', slug: 'c' },
      ]);
    });

    it('returns an empty array when nothing diverged', () => {
      const parity: ParityFile = { generatedAt: 'x', fixtures: [] };
      expect(selectDiverged(parity)).toEqual([]);
    });
  });

  describe('buildOverlayHtml', () => {
    it('embeds both SVGs, the diff table, and toggle controls for a diverged fixture', () => {
      const html = buildOverlayHtml({
        type: 'component',
        slug: 'foo-01',
        oursSvg: '<svg id="ours-marker"><rect fill="red"/></svg>',
        jarSvg: '<svg id="jar-marker"><rect fill="blue"/></svg>',
        result: {
          pass: false,
          diffs: [
            { path: 'svg/g[1]/rect[1]/@fill', actual: 'red', expected: 'blue', tolerance: 0.01 },
            {
              path: 'svg/g[1]/rect[1]/@x',
              actual: '1',
              expected: '2',
              delta: 1,
              tolerance: 0.01,
            },
          ],
        },
      });

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('id="ours-marker"');
      expect(html).toContain('id="jar-marker"');
      expect(html).toContain('DIVERGED — 2 diff(s)');
      expect(html).toContain('svg/g[1]/rect[1]/@fill');
      expect(html).toContain('<td class="expected">blue</td>');
      expect(html).toContain('<td class="actual">red</td>');
      expect(html).toContain('<td class="delta">1.000000</td>');
      expect(html).toContain('id="btn-overlay"');
      expect(html).toContain('id="btn-side"');
      expect(html).toContain('id="opacity"');
      // Self-contained: no external network requests.
      expect(html).not.toMatch(/<link\s/);
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(html).not.toMatch(/https?:\/\//);
    });

    it('states conformance and shows zero diffs for a conformant fixture', () => {
      const html = buildOverlayHtml({
        type: 'class',
        slug: 'ok-01',
        oursSvg: '<svg id="ours-marker"/>',
        jarSvg: '<svg id="jar-marker"/>',
        result: { pass: true, diffs: [] },
      });

      expect(html).toContain('CONFORMANT — 0 diffs');
      expect(html).toContain('Conformant — 0 diffs.');
      expect(html).not.toContain('<table class="diff-table">');
    });
  });

  describe('generateReport (integration: real render + real cache dir)', () => {
    it('writes a standalone HTML report containing both SVGs and the diff table for a diverged fixture', () => {
      const ref: FixtureRef = { type: 'component', slug: 'diverges-01' };
      const oursSvg = render();
      // A deliberately different "jar" SVG (structurally identical shape,
      // one fill changed) so compareSvg reports at least one diff.
      const jarSvg = oursSvg.replace('fill="#F1F1F1"', 'fill="#ABCDEF"');
      seedCache(cacheDir, ref, FIXTURE_MARKUP, jarSvg);

      const outPath = generateReport(cacheDir, outDir, ref);

      expect(outPath).toBe(join(outDir, 'diverges-01.html'));
      expect(existsSync(outPath)).toBe(true);
      const html = readFileSync(outPath, 'utf-8');
      expect(html).toContain('DIVERGED');
      expect(html).toContain('<table class="diff-table">');
      expect(html).toContain('@fill');
      expect(html).toContain('ABCDEF');
    });

    it('reports conformance with zero diffs when ours matches the cached jar SVG', () => {
      const ref: FixtureRef = { type: 'component', slug: 'conforms-01' };
      const oursSvg = render();
      seedCache(cacheDir, ref, FIXTURE_MARKUP, oursSvg);

      const outPath = generateReport(cacheDir, outDir, ref);
      const html = readFileSync(outPath, 'utf-8');

      expect(html).toContain('CONFORMANT — 0 diffs');
      expect(html).toContain('Conformant — 0 diffs.');
      expect(html).not.toContain('<table class="diff-table">');
    });

    it('throws a descriptive error when the cache entry is missing', () => {
      const ref: FixtureRef = { type: 'component', slug: 'missing-01' };
      expect(() => generateReport(cacheDir, outDir, ref)).toThrow(
        /No cached fixture markup for component\/missing-01/,
      );
    });
  });

  describe('runReports / --from-parity flow', () => {
    it('writes one report per diverged fixture selected from a parsed parity.json', () => {
      const refA: FixtureRef = { type: 'component', slug: 'div-a' };
      const refB: FixtureRef = { type: 'usecase', slug: 'div-b' };
      const oursSvg = render();
      const jarSvg = oursSvg.replace('fill="#F1F1F1"', 'fill="#000001"');
      seedCache(cacheDir, refA, FIXTURE_MARKUP, jarSvg);
      seedCache(cacheDir, refB, FIXTURE_MARKUP, jarSvg);

      const parity: ParityFile = {
        generatedAt: '2026-07-09T00:00:00Z',
        fixtures: [
          { slug: 'div-a', type: 'component', verdict: 'diverged', dotEqual: true },
          { slug: 'div-b', type: 'usecase', verdict: 'diverged', dotEqual: true },
          { slug: 'ok-c', type: 'component', verdict: 'conformant', dotEqual: true },
        ],
      };

      const refs = selectDiverged(parity);
      const written = runReports(cacheDir, outDir, refs);

      expect(written).toHaveLength(2);
      expect(written).toEqual([
        join(outDir, 'div-a.html'),
        join(outDir, 'div-b.html'),
      ]);
      expect(existsSync(join(outDir, 'div-a.html'))).toBe(true);
      expect(existsSync(join(outDir, 'div-b.html'))).toBe(true);
    });

    it('logs and skips a ref with no cache entry instead of aborting the whole batch', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const good: FixtureRef = { type: 'component', slug: 'good-01' };
      const oursSvg = render();
      seedCache(cacheDir, good, FIXTURE_MARKUP, oursSvg);
      const missing: FixtureRef = { type: 'component', slug: 'nope-01' };

      const written = runReports(cacheDir, outDir, [missing, good]);

      expect(written).toEqual([join(outDir, 'good-01.html')]);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('component/nope-01'),
      );
      errorSpy.mockRestore();
    });
  });
});
