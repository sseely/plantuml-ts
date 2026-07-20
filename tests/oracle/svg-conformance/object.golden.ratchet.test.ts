/**
 * Offline SVG-conformance RATCHET for object diagrams. G3/O0.
 *
 * Mirrors `class.golden.ratchet.test.ts` (svg-class, mission G2/N0)
 * exactly in procedure — see that file's doc comment for the full
 * rationale (offline, committed goldens; `DeterministicMeasurer` so both
 * sides measure text in the SAME system; a fixture ratchets in only once
 * and then never regresses). ONE difference, structural, not procedural:
 * object diagrams have no separate engine upstream — `ClassDiagramFactory`
 * registers the object/map commands alongside the class ones — so this
 * suite reuses `render-fixture-class.ts#renderFixtureClass` VERBATIM
 * (the SAME helper class's own ratchet uses), not a dedicated object
 * render helper. `oracle/goldens/svg-object/<slug>/` has no `<type>`
 * dimension either (mirrors svg-class, not svg-description's
 * `<type>/<slug>/`) — see that directory's own README.md.
 *
 * STARTS SEEDED (O0, unlike class's N0): the harness stand-up iteration
 * itself diagnosed and fixed a `headerRows()` centering/baseline/
 * textLength mechanism (`class-object-map-sizing.ts`, shared by object/
 * map/json) before writing this file, so O0 seeds 5 fixtures directly
 * rather than starting empty — see `oracle/goldens/svg-object/README.md`
 * "Current state" for the full mechanism citation. AC1/AC2/AC3 below still
 * degrade gracefully to a documented placeholder assertion when
 * `ratchet.json`/`parity-object.json` are empty (defensive, matching
 * every other ratchet suite's own precedent), even though that branch is
 * not exercised at O0.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DeterministicMeasurer } from '../../../src/core/measurer-deterministic.js';
import { compareSvg } from './compare.js';
import { renderFixtureClass } from './render-fixture-class.js';

interface RatchetFixture {
  slug: string;
  addedAt: string;
  source: string;
}

interface RatchetManifest {
  fixtures: RatchetFixture[];
}

interface ParityEntry {
  slug: string;
  dotEqual: boolean;
}

interface ParityReport {
  fixtures: ParityEntry[];
}

const GOLDENS_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../oracle/goldens/svg-object',
);

const manifest = JSON.parse(
  readFileSync(join(GOLDENS_ROOT, 'ratchet.json'), 'utf8'),
) as RatchetManifest;

// Source of DOT-EQUAL truth for eligibility (AC3) — object-scoped, mirrors
// class's own `parity-class.json` (see `render-fixture-class.ts`'s doc
// comment and `oracle/goldens/svg-object/README.md`'s "Add rule").
// Regenerate via `svg-parity-survey.ts --out ... object` before adding new
// slugs.
const parity = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'parity-object.json'),
    'utf8',
  ),
) as ParityReport;

function findParityEntry(slug: string): ParityEntry | undefined {
  return parity.fixtures.find((f) => f.slug === slug);
}

function fixtureDir(f: RatchetFixture): string {
  return join(GOLDENS_ROOT, f.slug);
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
  'svg-object conformance ratchet (AC1)',
  () => {
    for (const f of manifest.fixtures) {
      it(`object/${f.slug}: stays zero-diff against the pinned golden`, () => {
        const golden = readGolden(f);
        const markup = readSource(f);
        const ours = renderFixtureClass(markup, new DeterministicMeasurer());
        const { pass, diffs } = compareSvg(ours, golden, 'deterministic');
        expect(
          pass,
          `object/${f.slug}: conformance regression — first diff: ${firstDiffPath(diffs)}` +
            ` — ${JSON.stringify(diffs[0])}`,
        ).toBe(true);
        expect(diffs).toEqual([]);
      });
    }
  },
);

if (manifest.fixtures.length === 0) {
  it('has no pinned svg-object goldens yet (skip gracefully, not a failure)', () => {
    expect(manifest.fixtures).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// AC2 — tamper detection: an in-memory golden mutation must be caught, and
// the failure message must name the slug + first diff path.
// ---------------------------------------------------------------------------

describe.skipIf(manifest.fixtures.length === 0)(
  'svg-object conformance ratchet — tamper detection (AC2)',
  () => {
    it('a mutated golden (in-memory only) produces a failure naming slug + diff path', () => {
      const f = manifest.fixtures[0];
      expect(f, 'expected at least one seeded fixture to exercise tamper detection').toBeDefined();
      const target = f!;

      const golden = readGolden(target);
      const markup = readSource(target);
      const ours = renderFixtureClass(markup, new DeterministicMeasurer());

      // Confirm the untampered pair really is zero-diff first, so the
      // tampered-case failure below is attributable to the mutation alone.
      const clean = compareSvg(ours, golden, 'deterministic');
      expect(clean.pass, `object/${target.slug}: expected zero-diff baseline`).toBe(true);

      // Mutate a numeric attribute in-memory — never touches disk.
      const tampered = golden.replace(/rect x="(\d+)"/, (_m, x: string) => `rect x="${Number(x) + 500}"`);
      expect(tampered).not.toBe(golden);

      const { pass, diffs } = compareSvg(ours, tampered, 'deterministic');
      expect(pass).toBe(false);
      expect(diffs.length).toBeGreaterThan(0);

      const message =
        `object/${target.slug}: conformance regression — first diff: ${firstDiffPath(diffs)}` +
        ` — ${JSON.stringify(diffs[0])}`;
      expect(message).toContain(target.slug);
      expect(message).toContain(diffs[0]!.path);
    });
  },
);

if (manifest.fixtures.length === 0) {
  it('has no pinned svg-object golden yet to exercise tamper detection against (AC2, deferred)', () => {
    expect(manifest.fixtures).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// AC3 — DOT-EQUAL eligibility is enforced in the suite, not just documented.
// ---------------------------------------------------------------------------

describe.skipIf(manifest.fixtures.length === 0)(
  'svg-object conformance ratchet — eligibility (AC3)',
  () => {
    it('every manifest slug has a dotEqual=true parity-object.json entry', () => {
      for (const f of manifest.fixtures) {
        const entry = findParityEntry(f.slug);
        expect(entry, `object/${f.slug}: no parity-object.json entry found`).toBeDefined();
        expect(
          entry!.dotEqual,
          `object/${f.slug}: manifest entry is not DOT-EQUAL — ineligible for the ratchet`,
        ).toBe(true);
      }
    });
  },
);

if (manifest.fixtures.length === 0) {
  it('parity-object.json is an unsurveyed placeholder — no eligibility check to run yet (AC3, deferred)', () => {
    // See this file's doc comment + oracle/goldens/svg-object/README.md
    // "Add rule": regenerate via `svg-parity-survey.ts --out ... object`
    // once a real zero-diff candidate exists.
    expect(parity.fixtures).toHaveLength(0);
  });
}
