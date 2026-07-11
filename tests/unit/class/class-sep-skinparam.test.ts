/**
 * skinparam nodesep/ranksep → class DOT graph attrs.
 *
 * Java semantics (SkinParam.java:847-856 getAsInt("nodesep"|"ranksep", 0) —
 * 0 means unset; DotStringFactory.java:117-133 — when the skinparam value is
 * nonzero it unconditionally REPLACES the min-clamped default (no max-clamp:
 * `skinparam nodesep 10` → nodesep=10/72in even though 10 < the 35px min).
 */

import { describe, it, expect } from 'vitest';
import { resolveSkinparam } from '../../../src/core/skinparam.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';

const measurer = new FormulaMeasurer();

const ast: ClassDiagramAST = {
  classifiers: [
    { id: 'A', display: 'A', kind: 'class', typeParams: [], members: [] },
    { id: 'B', display: 'B', kind: 'class', typeParams: [], members: [] },
  ],
  relationships: [{ from: 'A', to: 'B', type: 'extension' }],
  namespaces: [],
  directives: [],
  notes: [],
};

/** Run layoutClass with the given theme, returning the captured DotInputGraph. */
function captureDotGraph(theme: typeof defaultTheme): DotInputGraph {
  let captured: DotInputGraph | undefined;
  setLayoutInputObserver((g) => { captured = g; });
  try {
    layoutClass(ast, theme, measurer);
  } finally {
    setLayoutInputObserver(undefined);
  }
  expect(captured).toBeDefined();
  return captured!;
}

// ---------------------------------------------------------------------------
// resolveSkinparam — nodesep/ranksep parsing
// ---------------------------------------------------------------------------

describe('resolveSkinparam — nodesep/ranksep', () => {
  it('parses nodesep as a px integer onto Theme.nodeSep', () => {
    const { theme, unknown } = resolveSkinparam(new Map([['nodesep', '100']]), defaultTheme);
    expect(theme.nodeSep).toBe(100);
    expect(unknown).toEqual([]);
  });

  it('parses ranksep as a px integer onto Theme.rankSep', () => {
    const { theme, unknown } = resolveSkinparam(new Map([['ranksep', '100']]), defaultTheme);
    expect(theme.rankSep).toBe(100);
    expect(unknown).toEqual([]);
  });

  it('parses a value below the DOT engine default (10) verbatim', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodesep', '10'], ['ranksep', '10']]),
      defaultTheme,
    );
    expect(theme.nodeSep).toBe(10);
    expect(theme.rankSep).toBe(10);
  });

  it('treats nodesep 0 / ranksep 0 as unset (getAsInt default semantics)', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodesep', '0'], ['ranksep', '0']]),
      defaultTheme,
    );
    expect(theme.nodeSep).toBeUndefined();
    expect(theme.rankSep).toBeUndefined();
  });

  it('ignores a non-numeric nodesep/ranksep value', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodesep', 'auto'], ['ranksep', 'auto']]),
      defaultTheme,
    );
    expect(theme.nodeSep).toBeUndefined();
    expect(theme.rankSep).toBeUndefined();
  });

  it('leaves Theme.nodeSep/rankSep unset when the keys are absent', () => {
    const { theme } = resolveSkinparam(new Map([['fontsize', '12']]), defaultTheme);
    expect(theme.nodeSep).toBeUndefined();
    expect(theme.rankSep).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// class-dot-graph — theme.nodeSep/rankSep wired into the DOT input graph
// ---------------------------------------------------------------------------

describe('class DOT graph — nodesep/ranksep override (ADR-6)', () => {
  it('replaces the default nodesep/ranksep outright when set above the default', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodesep', '100'], ['ranksep', '100']]),
      defaultTheme,
    );
    const g = captureDotGraph(theme);
    expect(g.nodeSep).toBe(100);
    expect(g.rankSep).toBe(100);
  });

  it('replaces the default nodesep/ranksep outright when BELOW the default — no clamp', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodesep', '10'], ['ranksep', '10']]),
      defaultTheme,
    );
    const g = captureDotGraph(theme);
    // 35px/60px are the engine's min-clamped defaults; an explicit skinparam
    // value must win unconditionally, even below that floor.
    expect(g.nodeSep).toBe(10);
    expect(g.rankSep).toBe(10);
  });

  it('keeps the current byte-identical defaults (35/60) when unset', () => {
    const g = captureDotGraph(defaultTheme);
    expect(g.nodeSep).toBe(35);
    expect(g.rankSep).toBe(60);
  });

  it('treats a zero skinparam value as unset — falls back to the default', () => {
    const { theme } = resolveSkinparam(
      new Map([['nodesep', '0'], ['ranksep', '0']]),
      defaultTheme,
    );
    const g = captureDotGraph(theme);
    expect(g.nodeSep).toBe(35);
    expect(g.rankSep).toBe(60);
  });
});
