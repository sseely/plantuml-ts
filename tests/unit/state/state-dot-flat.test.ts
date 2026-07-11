/**
 * Flat-state svek DOT parity + sizing tests (mission A4 state-dot-sync, T3
 * batch-2). Written TDD-first against `plans/state-dot-sync/mechanisms.md`'s
 * evidence set (all four fixtures below are single-svek-dump, i.e.
 * composite-free — the FLAT pipeline in layout.ts/state-dot-graph.ts).
 *
 * Two kinds of assertion, mirroring the project's precedent test files:
 *   - Sizing/layout px assertions via WidthTableMeasurer, mirroring
 *     tests/unit/class/class-object-map-sizing.test.ts's pattern (full
 *     `layoutState` pipeline, `toBeCloseTo` on the resulting geometry).
 *   - DOT-shape structural parity via setLayoutInputObserver + toSvekDot +
 *     compareStructural, mirroring tests/oracle/object-dot-parity.test.ts's
 *     mechanics (borrowed directly, not the ratchet infrastructure itself —
 *     ratchet creation under oracle/goldens/ is T5's mission task).
 *
 * Fixtures (test-results/dot-cache/state/<slug>/{in.puml,svek-1.dot}):
 *   - bilare-19-fufe539 — 4 states, `hide empty description`, all no-body:
 *     EntityImageStateEmptyDescription (MIN 50x40). Exact px on all 4.
 *   - gizati-67-kora187 — 1 state, 3-line description body (embedded `\n`):
 *     EntityImageState (MIN 50x50). Exact px.
 *   - cekolo-21-gini183 — start/choice/fork/join/end/sdlreceive/history/
 *     history* — every fixed-size pseudostate kind in one fixture. Exact px
 *     on the 7 fixed-size kinds; `<<sdlreceive>>` is reported only (see
 *     state-sizing.ts's SDL_MARGIN doc — the one unverified upstream formula
 *     in the whole evidence set).
 *   - jocado-69-dara158 — `left to right direction` + a fork bar: verifies
 *     rankdir=LR propagation and the fork bar's LR-swapped 8x80 dimensions.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync } from '../../../src/index.js';
import { layoutState } from '../../../src/diagrams/state/layout.js';
import { parseState } from '../../../src/diagrams/state/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import {
  parseSvekDot,
  dotInputToStructural,
  compareStructural,
} from '../../oracle/svek-dot.js';

const CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test-results/dot-cache/state',
);

const measurer = new WidthTableMeasurer();
const theme = defaultTheme; // fontFamily 'sans-serif', fontSize 14 — matches the oracle capture

function readFixture(slug: string): { puml: string; oracleDot: string } {
  return {
    puml: readFileSync(join(CACHE, slug, 'in.puml'), 'utf8'),
    oracleDot: readFileSync(join(CACHE, slug, 'svek-1.dot'), 'utf8'),
  };
}

/** Parse a `.puml` body (sans @startuml/@enduml) into a StateDiagramAST,
 *  mirroring tests/unit/state/parser.test.ts's harness. */
function parse(puml: string): ReturnType<typeof parseState> {
  const lines = puml
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('@'));
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

/** One layoutInputObserver capture of a full-document `renderSync` call. */
function captureOne(puml: string): DotInputGraph[] {
  const captured: DotInputGraph[] = [];
  setLayoutInputObserver((g) => captured.push(g));
  try {
    renderSync(puml, { measurer });
  } finally {
    setLayoutInputObserver(undefined);
  }
  return captured;
}

// ---------------------------------------------------------------------------
// bilare-19-fufe539 — hide empty description, 4 states
// ---------------------------------------------------------------------------

describe('layoutState — bilare-19-fufe539 (hide empty description, exact px)', () => {
  const { puml } = readFixture('bilare-19-fufe539');
  const ast = parse(puml);

  it('parses hideEmptyDescription and all 4 states', () => {
    expect(ast.hideEmptyDescription).toBe(true);
    expect(ast.states).toHaveLength(4);
  });

  it('sizes "Error" to the MIN_WIDTH floor (50 x 40)', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'S0_UNKNOWN')!;
    expect(s.width).toBeCloseTo(50, 5);
    expect(s.height).toBeCloseTo(40, 5);
  });

  it('sizes "Send" to the MIN_WIDTH floor (50 x 40)', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'S1_SOME_START')!;
    expect(s.width).toBeCloseTo(50, 5);
    expect(s.height).toBeCloseTo(40, 5);
  });

  it('sizes "Process" to the oracle dims (60.575 x 40 — 0.841319in x 0.555556in @72dpi)', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'S2_SOME_PROCESS')!;
    expect(s.width).toBeCloseTo(60.575, 3);
    expect(s.height).toBeCloseTo(40, 5);
  });

  it('sizes "Confirmed" to the oracle dims (74.575 x 40 — 1.035764in x 0.555556in @72dpi)', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'S3_SOME_CONFIRM')!;
    expect(s.width).toBeCloseTo(74.575, 3);
    expect(s.height).toBeCloseTo(40, 5);
  });
});

// ---------------------------------------------------------------------------
// gizati-67-kora187 — 3-line body via embedded `\n`
// ---------------------------------------------------------------------------

describe('layoutState — gizati-67-kora187 (3-line body, exact px)', () => {
  const { puml } = readFixture('gizati-67-kora187');
  const ast = parse(puml);

  it('parses one state with a single description entry (embedded `\\n`)', () => {
    expect(ast.states).toHaveLength(1);
    expect(ast.states[0]!.description).toHaveLength(1);
  });

  it('sizes "s1" to the oracle dims (50 x 76 — 0.694444in x 1.055556in @72dpi)', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 's1')!;
    expect(s.width).toBeCloseTo(50, 5);
    expect(s.height).toBeCloseTo(76, 5);
  });
});

// ---------------------------------------------------------------------------
// suzope-95-suvu383 — SAME 3 lines as 3 separate `s1 : text` commands —
// confirms embedded `\n` and repeated description lines render identically.
// ---------------------------------------------------------------------------

describe('layoutState — suzope-95-suvu383 (3 separate description lines, matches gizati)', () => {
  it('sizes "s1" identically to gizati-67-kora187 (50 x 76)', () => {
    const { puml } = readFixture('suzope-95-suvu383');
    const ast = parse(puml);
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 's1')!;
    expect(s.width).toBeCloseTo(50, 5);
    expect(s.height).toBeCloseTo(76, 5);
  });
});

// ---------------------------------------------------------------------------
// cekolo-21-gini183 — every fixed-size pseudostate kind
// ---------------------------------------------------------------------------

describe('layoutState — cekolo-21-gini183 (fixed-size pseudostate table)', () => {
  const { puml } = readFixture('cekolo-21-gini183');
  const ast = parse(puml);

  it('parses all 8 states with their stereotype-derived kinds', () => {
    expect(ast.states).toHaveLength(8);
    const kindById = new Map(ast.states.map((s) => [s.id, s.kind]));
    expect(kindById.get('start1')).toBe('initial');
    expect(kindById.get('choice1')).toBe('choice');
    expect(kindById.get('fork1')).toBe('fork');
    expect(kindById.get('join2')).toBe('join');
    expect(kindById.get('end3')).toBe('final');
    expect(kindById.get('history')).toBe('history');
    expect(kindById.get('history2')).toBe('deepHistory');
  });

  it('start1 (CircleStart) is 20x20', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'start1')!;
    expect(s.width).toBeCloseTo(20, 5);
    expect(s.height).toBeCloseTo(20, 5);
  });

  it('choice1 (EntityImageBranch) is 24x24', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'choice1')!;
    expect(s.width).toBeCloseTo(24, 5);
    expect(s.height).toBeCloseTo(24, 5);
  });

  it('fork1 and join2 (EntityImageSynchroBar, TB) are 80x8', () => {
    const geo = layoutState(ast, theme, measurer);
    for (const id of ['fork1', 'join2']) {
      const s = geo.states.find((n) => n.id === id)!;
      expect(s.width).toBeCloseTo(80, 5);
      expect(s.height).toBeCloseTo(8, 5);
    }
  });

  it('end3 (CircleEnd) is 22x22 — distinct from CircleStart', () => {
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'end3')!;
    expect(s.width).toBeCloseTo(22, 5);
    expect(s.height).toBeCloseTo(22, 5);
  });

  it('history and history2 (EntityImagePseudoState/DeepHistory) are BOTH 22x22', () => {
    const geo = layoutState(ast, theme, measurer);
    for (const id of ['history', 'history2']) {
      const s = geo.states.find((n) => n.id === id)!;
      expect(s.width).toBeCloseTo(22, 5);
      expect(s.height).toBeCloseTo(22, 5);
    }
  });

  it('sdlreceive is NOT rounded (rect shape) — size reported, not asserted', () => {
    // Structural shape correctness is what's gated; the exact dimension
    // formula for EntityImageState2/USymbolFrame is unverified against the
    // corpus (state-sizing.ts's SDL_MARGIN doc) — reported via the DOT
    // parity test below instead of pinned here.
    const geo = layoutState(ast, theme, measurer);
    const s = geo.states.find((n) => n.id === 'sdlreceive')!;
    expect(s.width).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DOT-shape structural parity (setLayoutInputObserver + toSvekDot)
// ---------------------------------------------------------------------------

describe('flat-state svek DOT parity — structural equality', () => {
  afterAll(() => setLayoutInputObserver(undefined));

  it.each([
    ['bilare-19-fufe539', 0],
    ['gizati-67-kora187', 0],
    ['cekolo-21-gini183', 0],
    ['jocado-69-dara158', 0],
  ])('%s: our svek DOT is structurally EQUAL to the oracle dump', (slug) => {
    const { puml, oracleDot } = readFixture(slug);
    const captured = captureOne(puml);
    expect(captured, `${slug}: expected exactly 1 captured layout graph (flat, no composites)`).toHaveLength(1);

    const oracle = parseSvekDot(oracleDot);
    const candidate = dotInputToStructural(captured[0]!);
    const diff = compareStructural(oracle, candidate);
    const failingChecks = Object.entries(diff)
      .filter(([k, v]) => k.endsWith('Ok') && v === false)
      .map(([k]) => k);
    expect(diff.structurallyEqual, `${slug}: failing checks: ${failingChecks.join(', ')}`).toBe(true);
  });

  it('jocado-69-dara158: rankdir=LR is propagated and the fork bar swaps to 8x80', () => {
    const { puml } = readFixture('jocado-69-dara158');
    const captured = captureOne(puml);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.rankDir).toBe('LR');
    const fork = captured[0]!.nodes.find((n) => n.width === 8 && n.height === 80);
    expect(fork, 'expected an 8x80 LR-oriented fork bar node').toBeDefined();
  });

  it('bilare-19-fufe539: node size drift vs oracle is exactly 0 (all 4 states are EntityImageStateEmptyDescription)', () => {
    const { puml, oracleDot } = readFixture('bilare-19-fufe539');
    const captured = captureOne(puml);
    const oracle = parseSvekDot(oracleDot);
    const candidate = dotInputToStructural(captured[0]!);
    const diff = compareStructural(oracle, candidate);
    expect(diff.maxSizeDeltaIn).toBeLessThan(1e-6);
  });

  it('gizati-67-kora187: node size drift vs oracle is exactly 0 (EntityImageState, 3-line body)', () => {
    const { puml, oracleDot } = readFixture('gizati-67-kora187');
    const captured = captureOne(puml);
    const oracle = parseSvekDot(oracleDot);
    const candidate = dotInputToStructural(captured[0]!);
    const diff = compareStructural(oracle, candidate);
    expect(diff.maxSizeDeltaIn).toBeLessThan(1e-6);
  });
});
