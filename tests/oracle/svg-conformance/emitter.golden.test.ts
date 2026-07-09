/**
 * emitter.golden.test.ts — T6: proves the klimt SVG emitter
 * (`UGraphicSvg` + drivers + `SvgGraphics`) conformant against real
 * PlantUML jar output.
 *
 * Each golden case under `oracle/goldens/svg-conformance/<case>/`
 * exports a `render(): string` that drives `UGraphicSvg` through a
 * hand-authored sequence reproducing a real jar SVG fragment/document
 * (see each case's own doc comment for provenance). `golden.svg` in the
 * same directory is the real jar bytes — NEVER regenerated from this
 * port's own emitter (see `class-boxes-and-link/case.ts` and sibling
 * doc comments for the "why" behind each draw-sequence decision).
 *
 * Per D4′/D5′ (mission brief): pass = zero diffs after normalization;
 * no ledger entries were added (this test file's write-set does not
 * include sign-off authority — see `oracle/accepted-divergences.json`).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compareSvg } from './compare.js';
import { render as renderClassBoxesAndLink } from '../../../oracle/goldens/svg-conformance/class-boxes-and-link/case.js';
import { render as renderGradientFill } from '../../../oracle/goldens/svg-conformance/gradient-fill/case.js';
import { render as renderDeltaShadow } from '../../../oracle/goldens/svg-conformance/delta-shadow/case.js';
import { render as renderDatabaseCylinderDashed } from '../../../oracle/goldens/svg-conformance/database-cylinder-dashed/case.js';

interface GoldenCase {
  readonly name: string;
  readonly render: () => string;
}

const CASES: readonly GoldenCase[] = [
  { name: 'class-boxes-and-link', render: renderClassBoxesAndLink },
  { name: 'gradient-fill', render: renderGradientFill },
  { name: 'delta-shadow', render: renderDeltaShadow },
  { name: 'database-cylinder-dashed', render: renderDatabaseCylinderDashed },
];

function goldenPath(caseName: string): string {
  return resolve(process.cwd(), `oracle/goldens/svg-conformance/${caseName}/golden.svg`);
}

function firstDiffPath(diffs: readonly { path: string }[]): string {
  return diffs.length > 0 ? diffs[0]!.path : '(none)';
}

describe('emitter.golden — conformance (AC1)', () => {
  for (const { name, render } of CASES) {
    test(`${name}: matches the jar golden with zero diffs`, () => {
      const golden = readFileSync(goldenPath(name), 'utf8');
      const actual = render();
      const { pass, diffs } = compareSvg(actual, golden, 'deterministic');
      expect(pass, `case "${name}" first diff: ${firstDiffPath(diffs)} — ${JSON.stringify(diffs[0])}`).toBe(true);
      expect(diffs).toEqual([]);
    });
  }
});

describe('emitter.golden — determinism (AC3)', () => {
  for (const { name, render } of CASES) {
    test(`${name}: two independent runs produce byte-identical output`, () => {
      expect(render()).toBe(render());
    });
  }
});

describe('emitter.golden — harness bites on a tampered golden (AC2)', () => {
  test('a mutated attribute value produces a failure naming the diff path', () => {
    const golden = readFileSync(goldenPath('class-boxes-and-link'), 'utf8');
    const actual = renderClassBoxesAndLink();
    const tampered = golden.replace('fill="#ADD1B2"', 'fill="#000001"');
    expect(tampered).not.toBe(golden);

    const { pass, diffs } = compareSvg(actual, tampered, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0]!.path).toMatch(/@fill$/);
    expect(diffs[0]!.expected).toBe('#000001');
  });

  test('a mutated numeric attribute beyond tolerance produces a delta diff', () => {
    const golden = readFileSync(goldenPath('delta-shadow'), 'utf8');
    const actual = renderDeltaShadow();
    const tampered = golden.replace('cx="22"', 'cx="99"');
    expect(tampered).not.toBe(golden);

    const { pass, diffs } = compareSvg(actual, tampered, 'deterministic');
    expect(pass).toBe(false);
    const cxDiff = diffs.find((d) => d.path.endsWith('@cx'));
    expect(cxDiff).toBeDefined();
    expect(cxDiff!.delta).toBeGreaterThan(0.01);
  });
});

describe('oracle/accepted-divergences.json — ledger bootstrap (AC4)', () => {
  test('is schema-valid JSON with zero entries', () => {
    const ledgerPath = resolve(process.cwd(), 'oracle/accepted-divergences.json');
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as { comment: string; entries: unknown[] };
    expect(typeof ledger.comment).toBe('string');
    expect(Array.isArray(ledger.entries)).toBe(true);
    expect(ledger.entries).toHaveLength(0);
  });
});
