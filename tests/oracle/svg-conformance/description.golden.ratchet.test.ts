/**
 * Offline SVG-conformance RATCHET for description-engine diagrams
 * (component + usecase, both routed through the unified description/
 * deployment engine — see `.claude/catalog.md`). T18.
 *
 * Unlike the census script (`scripts/svg-conformance-census.ts`, a
 * discovery tool), this is a real assertion: every fixture listed in
 * `oracle/goldens/svg-description/ratchet.json` is PINNED at zero-diff
 * (`compareSvg(ours, golden, 'deterministic').pass`) against its committed
 * `golden.svg`. Once a slug is pinned here, any regression in our
 * description-engine SVG emission for that fixture fails `npm test` — the
 * ratchet only tightens, it never silently loosens. Modeled on the DOT
 * ratchet precedent, `tests/oracle/description-parity.ratchet.test.ts`.
 *
 * Renders via `renderFixture` (`./render-fixture.js`), NOT `renderSync`:
 * production hardcodes `jarMeasurer` (AWT), which cannot reach zero-diff
 * against these deterministic-text-mode goldens no matter how faithful the
 * emission is (see `src/core/measurer-deterministic.ts`'s doc comment, D12).
 * `renderFixture` injects `DeterministicMeasurer` into both the layout and
 * render stages instead, matching the system the goldens were captured in.
 *
 * Fully offline: goldens are committed `in.puml` + `golden.svg` pairs under
 * `oracle/goldens/svg-description/<type>/<slug>/` (no `test-results/`
 * dependency at test time — that tree is gitignored and regenerable; see
 * `oracle/goldens/svg-description/README.md`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { compareSvg } from './compare.js';
import { renderFixture } from './render-fixture.js';

interface RatchetFixture {
  slug: string;
  type: string;
  addedAt: string;
  source: string;
}

interface RatchetManifest {
  fixtures: RatchetFixture[];
}

interface ParityEntry {
  slug: string;
  type: string;
  dotEqual: boolean;
}

interface ParityReport {
  fixtures: ParityEntry[];
}

const GOLDENS_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../oracle/goldens/svg-description',
);

const manifest = JSON.parse(
  readFileSync(join(GOLDENS_ROOT, 'ratchet.json'), 'utf8'),
) as RatchetManifest;

// Source of DOT-EQUAL truth for eligibility (AC3): the SVG-parity survey's
// own `dotEqual` field, captured by `scripts/svg-parity-survey.ts` and
// consumed by the census/dashboard tooling (T15/T17). This is the same
// artifact `oracle/goldens/svg-description/README.md`'s "Add rule" cites.
const parity = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'parity.json'),
    'utf8',
  ),
) as ParityReport;

function findParityEntry(slug: string, type: string): ParityEntry | undefined {
  return parity.fixtures.find((f) => f.slug === slug && f.type === type);
}

function fixtureDir(f: RatchetFixture): string {
  return join(GOLDENS_ROOT, f.type, f.slug);
}

function readGolden(f: RatchetFixture): string {
  return readFileSync(join(fixtureDir(f), 'golden.svg'), 'utf8');
}

function readSource(f: RatchetFixture): string {
  return readFileSync(join(fixtureDir(f), 'in.puml'), 'utf8');
}

function firstDiffPath(diffs: readonly { path: string }[]): string {
  return diffs.length > 0 ? diffs[0]!.path : '(none)';
}

// ---------------------------------------------------------------------------
// AC1 — every locked fixture stays conformant.
// ---------------------------------------------------------------------------

describe.skipIf(manifest.fixtures.length === 0)(
  'svg-description conformance ratchet (AC1)',
  () => {
    for (const f of manifest.fixtures) {
      it(`${f.type}/${f.slug}: stays zero-diff against the pinned golden`, () => {
        const golden = readGolden(f);
        const markup = readSource(f);
        const ours = renderFixture(markup, new DeterministicMeasurer());
        const { pass, diffs } = compareSvg(ours, golden, 'deterministic');
        expect(
          pass,
          `${f.type}/${f.slug}: conformance regression — first diff: ${firstDiffPath(diffs)}` +
            ` — ${JSON.stringify(diffs[0])}`,
        ).toBe(true);
        expect(diffs).toEqual([]);
      });
    }
  },
);

if (manifest.fixtures.length === 0) {
  it('has no pinned svg-description goldens yet (skip gracefully, not a failure)', () => {
    expect(manifest.fixtures).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// AC2 — tamper detection: an in-memory golden mutation must be caught, and
// the failure message must name the slug + first diff path.
// ---------------------------------------------------------------------------

describe('svg-description conformance ratchet — tamper detection (AC2)', () => {
  it('a mutated golden (in-memory only) produces a failure naming slug + diff path', () => {
    const f = manifest.fixtures[0];
    expect(f, 'expected at least one seeded fixture to exercise tamper detection').toBeDefined();
    const target = f!;

    const golden = readGolden(target);
    const markup = readSource(target);
    const ours = renderFixture(markup, new DeterministicMeasurer());

    // Confirm the untampered pair really is zero-diff first, so the
    // tampered-case failure below is attributable to the mutation alone.
    const clean = compareSvg(ours, golden, 'deterministic');
    expect(clean.pass, `${target.type}/${target.slug}: expected zero-diff baseline`).toBe(true);

    // Mutate a numeric attribute in-memory — never touches disk.
    const tampered = golden.replace(/rect x="(\d+)"/, (_m, x: string) => `rect x="${Number(x) + 500}"`);
    expect(tampered).not.toBe(golden);

    const { pass, diffs } = compareSvg(ours, tampered, 'deterministic');
    expect(pass).toBe(false);
    expect(diffs.length).toBeGreaterThan(0);

    // The failure message a maintainer sees must name the slug + first
    // diff path, exactly as the AC1 assertion above does.
    const message =
      `${target.type}/${target.slug}: conformance regression — first diff: ${firstDiffPath(diffs)}` +
      ` — ${JSON.stringify(diffs[0])}`;
    expect(message).toContain(target.slug);
    expect(message).toContain(diffs[0]!.path);
  });
});

// ---------------------------------------------------------------------------
// AC3 — DOT-EQUAL eligibility is enforced in the suite, not just documented.
// ---------------------------------------------------------------------------

describe('svg-description conformance ratchet — eligibility (AC3)', () => {
  it('every manifest slug has a dotEqual=true parity.json entry', () => {
    for (const f of manifest.fixtures) {
      const entry = findParityEntry(f.slug, f.type);
      expect(entry, `${f.type}/${f.slug}: no parity.json entry found`).toBeDefined();
      expect(
        entry!.dotEqual,
        `${f.type}/${f.slug}: manifest entry is not DOT-EQUAL — ineligible for the ratchet`,
      ).toBe(true);
    }
  });

  it('rejects adding a fixture whose DOT is not EQUAL', () => {
    // A real corpus slug known (via parity.json) to be dotEqual=false —
    // proves the eligibility check actually discriminates, rather than
    // vacuously passing because every parity.json entry happens to be true.
    const ineligible = { slug: 'bujige-52-gase998', type: 'component' };
    const entry = findParityEntry(ineligible.slug, ineligible.type);
    expect(entry, 'expected a known non-dotEqual fixture in parity.json').toBeDefined();
    expect(entry!.dotEqual).toBe(false);

    function assertEligible(candidate: ParityEntry | undefined): void {
      if (!candidate || !candidate.dotEqual) {
        throw new Error(
          `${ineligible.type}/${ineligible.slug} is not DOT-EQUAL — rejected by the ratchet gate`,
        );
      }
    }

    expect(() => assertEligible(entry)).toThrow(/not DOT-EQUAL/);
    expect(manifest.fixtures.some((f) => f.slug === ineligible.slug)).toBe(false);
  });
});
