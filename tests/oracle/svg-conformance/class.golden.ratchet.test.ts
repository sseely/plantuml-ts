/**
 * Offline SVG-conformance RATCHET for the class diagram engine
 * (`src/diagrams/class/`). G2/N0.
 *
 * Mirrors `description.golden.ratchet.test.ts` (svg-description, mission
 * G1/T18) exactly in procedure — see that file's doc comment for the full
 * rationale (offline, committed goldens; `DeterministicMeasurer` so both
 * sides measure text in the SAME system; a fixture ratchets in only once
 * and then never regresses). Two differences from the description ratchet,
 * both structural, not procedural:
 *
 *   1. Class fixtures have no `<type>` dimension (component vs usecase) —
 *      `oracle/goldens/svg-class/<slug>/`, not `<type>/<slug>/`; the
 *      manifest/parity shapes here drop the `type` field accordingly.
 *   2. `renderFixtureClass` (`render-fixture-class.ts`) replaces
 *      `renderFixture` (`render-fixture.ts`) as the render helper — the
 *      class engine's own pipeline (`parseClass` -> `layoutClass` ->
 *      `renderClass`), not description's.
 *
 * STARTS EMPTY (N0): the N0 family scan found the corpus-wide "SVG root
 * shell" gap (missing `xmlns:xlink`/`version`/`zoomAndPan`/
 * `preserveAspectRatio`/`contentStyleType`/`background` root attrs + a
 * flat-children-vs-single-wrapping-`<g>` structural gap) blocks EVERY
 * fixture from zero-diff — see `plans/g2-class-svg/ledger.md` N0 and
 * `oracle/goldens/svg-class/README.md`. AC1/AC2/AC3 below all degrade
 * gracefully to a documented placeholder assertion when `ratchet.json`/
 * `parity-class.json` are empty, exactly as `description.golden.ratchet
 * .test.ts`'s AC1 already does for its own empty case — this is the SAME
 * pattern applied to all three describe blocks, since class starts at zero
 * on every axis (ratchet AND parity survey) where description started with
 * ratchet already seeded.
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
  '../../../oracle/goldens/svg-class',
);

const manifest = JSON.parse(
  readFileSync(join(GOLDENS_ROOT, 'ratchet.json'), 'utf8'),
) as RatchetManifest;

// Source of DOT-EQUAL truth for eligibility (AC3) — mirrors description's
// own `parity.json`, but class-scoped (see `render-fixture-class.ts`'s doc
// comment and `oracle/goldens/svg-class/README.md`'s "Add rule"). Currently
// an unsurveyed placeholder (`fixtures: []`) — no candidate needs it yet
// because AC1 has nothing pinned; regenerate via `svg-parity-survey.ts
// --out ... class` once N1's shell-mechanism fix produces a real
// zero-diff candidate.
const parity = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'parity-class.json'),
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
  'svg-class conformance ratchet (AC1)',
  () => {
    for (const f of manifest.fixtures) {
      it(`class/${f.slug}: stays zero-diff against the pinned golden`, () => {
        const golden = readGolden(f);
        const markup = readSource(f);
        const ours = renderFixtureClass(markup, new DeterministicMeasurer());
        const { pass, diffs } = compareSvg(ours, golden, 'deterministic');
        expect(
          pass,
          `class/${f.slug}: conformance regression — first diff: ${firstDiffPath(diffs)}` +
            ` — ${JSON.stringify(diffs[0])}`,
        ).toBe(true);
        expect(diffs).toEqual([]);
      });
    }
  },
);

if (manifest.fixtures.length === 0) {
  it('has no pinned svg-class goldens yet (skip gracefully, not a failure)', () => {
    expect(manifest.fixtures).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// AC2 — tamper detection: an in-memory golden mutation must be caught, and
// the failure message must name the slug + first diff path.
// ---------------------------------------------------------------------------

describe.skipIf(manifest.fixtures.length === 0)(
  'svg-class conformance ratchet — tamper detection (AC2)',
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
      expect(clean.pass, `class/${target.slug}: expected zero-diff baseline`).toBe(true);

      // Mutate a numeric attribute in-memory — never touches disk.
      const tampered = golden.replace(/rect x="(\d+)"/, (_m, x: string) => `rect x="${Number(x) + 500}"`);
      expect(tampered).not.toBe(golden);

      const { pass, diffs } = compareSvg(ours, tampered, 'deterministic');
      expect(pass).toBe(false);
      expect(diffs.length).toBeGreaterThan(0);

      const message =
        `class/${target.slug}: conformance regression — first diff: ${firstDiffPath(diffs)}` +
        ` — ${JSON.stringify(diffs[0])}`;
      expect(message).toContain(target.slug);
      expect(message).toContain(diffs[0]!.path);
    });
  },
);

if (manifest.fixtures.length === 0) {
  it('has no pinned svg-class golden yet to exercise tamper detection against (AC2, deferred)', () => {
    expect(manifest.fixtures).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// AC3 — DOT-EQUAL eligibility is enforced in the suite, not just documented.
// ---------------------------------------------------------------------------

describe.skipIf(manifest.fixtures.length === 0)(
  'svg-class conformance ratchet — eligibility (AC3)',
  () => {
    it('every manifest slug has a dotEqual=true parity-class.json entry', () => {
      for (const f of manifest.fixtures) {
        const entry = findParityEntry(f.slug);
        expect(entry, `class/${f.slug}: no parity-class.json entry found`).toBeDefined();
        expect(
          entry!.dotEqual,
          `class/${f.slug}: manifest entry is not DOT-EQUAL — ineligible for the ratchet`,
        ).toBe(true);
      }
    });
  },
);

if (manifest.fixtures.length === 0) {
  it('parity-class.json is an unsurveyed placeholder — no eligibility check to run yet (AC3, deferred)', () => {
    // See this file's doc comment + oracle/goldens/svg-class/README.md
    // "Add rule": regenerate via `svg-parity-survey.ts --out ... class`
    // once a real zero-diff candidate exists (N1+).
    expect(parity.fixtures).toHaveLength(0);
  });
}
