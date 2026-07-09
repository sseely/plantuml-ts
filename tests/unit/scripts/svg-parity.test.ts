/**
 * Unit tests for the SVG parity survey + dashboard's pure verdict/report
 * logic (T15). Only the pure, importable functions are exercised here — the
 * subprocess-isolation plumbing (`--render-one`, spawnCapture, the real
 * corpus walk) is exercised by the real survey run committed alongside this
 * task (tests/oracle/svg-conformance/parity.json + PARITY-SVG.md).
 */
import { describe, it, expect } from 'vitest';
import {
  isWellFormedSvg,
  diffVerdict,
  computeDotEqual,
} from '../../../scripts/svg-parity-survey.js';
import type { FixtureRow, ParityReport } from '../../../scripts/svg-parity-survey.js';
import {
  pct,
  tally,
  summarySection,
  familyTable,
  conformantSection,
  numericTable,
  msgTable,
  globMatch,
  matchesEntry,
  ledgerSection,
  loadLedger,
  buildMarkdown,
} from '../../../scripts/svg-parity-dashboard.js';
import { toSvekDot } from '../../../src/core/svek-dot-emit.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.types.js';

function svg(children: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><g>${children}</g></svg>`;
}
const ell = (cx: number, cy: number): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="5" ry="5"/>`;

// ---------------------------------------------------------------------------
// isWellFormedSvg
// ---------------------------------------------------------------------------

describe('isWellFormedSvg', () => {
  it('returns true for a well-formed SVG', () => {
    expect(isWellFormedSvg('<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>')).toBe(true);
  });

  it('returns false for mismatched open/close tags', () => {
    expect(isWellFormedSvg('<svg><g></svg>')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isWellFormedSvg('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// diffVerdict
// ---------------------------------------------------------------------------

describe('diffVerdict', () => {
  it('conformant on byte-identical SVG', () => {
    const same = svg(ell(10, 20));
    expect(diffVerdict(same, same)).toEqual({ verdict: 'conformant' });
  });

  it('structural-match when only numeric coords differ beyond tolerance', () => {
    const port = svg(ell(10, 20));
    const oracle = svg(ell(15, 20));
    const r = diffVerdict(port, oracle);
    expect(r.verdict).toBe('structural-match');
    expect(r.maxDelta).toBeCloseTo(5, 5);
    expect(r.maxDeltaPath).toContain('@cx');
  });

  it('records the worst numeric diff, first-encountered wins ties', () => {
    const port = svg(ell(10, 20) + ell(10, 20));
    const oracle = svg(ell(15, 20) + ell(15, 20));
    const r = diffVerdict(port, oracle);
    expect(r.verdict).toBe('structural-match');
    expect(r.maxDeltaPath).toContain('ellipse[1]');
    expect(r.maxDeltaPath).not.toContain('ellipse[2]');
  });

  it('diverged when element count differs', () => {
    const port = svg(ell(10, 20));
    const oracle = svg(ell(10, 20) + ell(100, 200));
    const r = diffVerdict(port, oracle);
    expect(r.verdict).toBe('diverged');
    expect(r.firstDiff).toContain('childCount');
  });

  it('diverged with <compare-threw> when the port SVG cannot be parsed', () => {
    const r = diffVerdict('<svg><g></svg>', svg(ell(10, 20)));
    expect(r.verdict).toBe('diverged');
    expect(r.firstDiff).toBe('<compare-threw>');
    expect(r.errMsg).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// computeDotEqual
// ---------------------------------------------------------------------------

describe('computeDotEqual', () => {
  const graph: DotInputGraph = { nodes: [{ id: 'A', width: 72, height: 36 }], edges: [] };

  it('true when both sides skip graphviz (degenerate diagrams)', () => {
    expect(computeDotEqual([], [], false)).toBe(true);
  });

  it('false when the oracle dumped DOT but we fed no candidate graph', () => {
    expect(computeDotEqual([toSvekDot(graph)], [], false)).toBe(false);
  });

  it('false on a graph-count mismatch', () => {
    expect(computeDotEqual([toSvekDot(graph), toSvekDot(graph)], [graph], false)).toBe(false);
  });

  it('false when oracleBlind, even if both sides trivially agree', () => {
    expect(computeDotEqual([], [], true)).toBe(false);
    expect(computeDotEqual([toSvekDot(graph)], [graph], true)).toBe(false);
  });

  it('true when the emitted DOT is structurally equal to the oracle DOT', () => {
    expect(computeDotEqual([toSvekDot(graph)], [graph], false)).toBe(true);
  });

  it('false when node shape diverges structurally', () => {
    const oracleDot = toSvekDot(graph);
    const differentGraph: DotInputGraph = {
      nodes: [{ id: 'A', width: 200, height: 36, shape: 'diamond' }],
      edges: [],
    };
    expect(computeDotEqual([oracleDot], [differentGraph], false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dashboard pure functions
// ---------------------------------------------------------------------------

describe('svg-parity-dashboard pure functions', () => {
  const sampleReport: ParityReport = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    fixtures: [
      { slug: 'a', type: 'component', verdict: 'conformant', dotEqual: true },
      {
        slug: 'b', type: 'component', verdict: 'diverged', dotEqual: false,
        firstDiff: 'svg/g[1]/ellipse[1][childCount]', maxDelta: 12.5,
      },
      {
        slug: 'c', type: 'usecase', verdict: 'structural-match', dotEqual: false,
        maxDelta: 3.2, maxDeltaPath: 'svg/g[1]/ellipse[1]/@cx',
      },
      { slug: 'd', type: 'usecase', verdict: 'errored', dotEqual: false, errMsg: 'boom' },
    ] satisfies FixtureRow[],
  };

  it('tally counts each verdict exactly once', () => {
    const counts = tally(sampleReport.fixtures);
    expect(counts.conformant).toBe(1);
    expect(counts.diverged).toBe(1);
    expect(counts['structural-match']).toBe(1);
    expect(counts.errored).toBe(1);
    expect(counts.timeout).toBe(0);
    expect(counts['oracle-error']).toBe(0);
  });

  it('pct formats a percentage; 0 denominator yields 0%', () => {
    expect(pct(1, 4)).toBe('25.0%');
    expect(pct(0, 0)).toBe('0%');
  });

  it('summarySection reports totals and the dot-equal ratchet count', () => {
    const out = summarySection(sampleReport);
    expect(out).toContain('**Surveyed:** 4');
    expect(out).toContain('**conformant:** 1 (25.0%)');
    expect(out).toContain('**dot-EQUAL (ratchet-eligible):** 1/4 (25.0%)');
  });

  it('familyTable emits one row per type with per-verdict + dot-equal counts', () => {
    const out = familyTable(sampleReport);
    expect(out).toContain('| component | 2 | 1 | 0 | 1 | 0 | 0 | 0 | 1 |');
    expect(out).toContain('| usecase | 2 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |');
  });

  it('conformantSection collapses slugs as `type/slug`', () => {
    expect(conformantSection(sampleReport)).toContain('`component/a`');
  });

  it('numericTable(diverged) sorts worst-first and shows firstDiff', () => {
    const rows = sampleReport.fixtures.filter((f) => f.verdict === 'diverged');
    const out = numericTable('diverged', rows, true);
    expect(out).toContain('| `b` | component | 12.50 | `svg/g[1]/ellipse[1][childCount]` |');
  });

  it('numericTable(structural-match) shows maxDeltaPath', () => {
    const rows = sampleReport.fixtures.filter((f) => f.verdict === 'structural-match');
    const out = numericTable('structural-match', rows, false);
    expect(out).toContain('| `c` | usecase | 3.20 | `svg/g[1]/ellipse[1]/@cx` |');
  });

  it('msgTable renders the errored message', () => {
    const rows = sampleReport.fixtures.filter((f) => f.verdict === 'errored');
    expect(msgTable('errored', rows)).toContain('| `d` | usecase | boom |');
  });

  it('globMatch supports a trailing wildcard', () => {
    expect(globMatch('foo-*', 'foo-bar')).toBe(true);
    expect(globMatch('foo-*', 'baz-bar')).toBe(false);
  });

  it('matchesEntry matches exact id and glob idPattern', () => {
    expect(matchesEntry({ match: { id: 'a' } }, 'a')).toBe(true);
    expect(matchesEntry({ match: { id: 'a' } }, 'b')).toBe(false);
    expect(matchesEntry({ match: { idPattern: 'a*' } }, 'abc')).toBe(true);
    expect(matchesEntry({ match: {} }, 'abc')).toBe(false);
  });

  it('loadLedger reads the real (currently empty) accepted-divergences registry', () => {
    expect(loadLedger()).toEqual([]);
  });

  it('ledgerSection renders an empty-ledger placeholder when no entries exist', () => {
    expect(ledgerSection(sampleReport)).toContain('(no accepted divergences recorded yet)');
  });

  it('buildMarkdown includes every required section header with correct counts', () => {
    const md = buildMarkdown(sampleReport);
    expect(md).toContain('# SVG parity dashboard (pre-cutover baseline)');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Per-family');
    expect(md).toContain('## conformant (1)');
    expect(md).toContain('## structural-match (1)');
    expect(md).toContain('## diverged (1)');
    expect(md).toContain('## errored (1)');
    expect(md).toContain('## timeout (0)');
    expect(md).toContain('## oracle-error (0)');
    expect(md).toContain("## Divergence ledger (accepted, won't-fix)");
  });
});
