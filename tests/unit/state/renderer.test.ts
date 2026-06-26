// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md
import { describe, it, expect } from 'vitest';
import { renderState } from '../../../src/diagrams/state/renderer.js';
import { statePlugin } from '../../../src/diagrams/state/index.js';
import type { StateGeometry, StateNodeGeo, TransitionGeo } from '../../../src/diagrams/state/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry factories — construct geometry manually, no ELK involved
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<StateNodeGeo> & Pick<StateNodeGeo, 'kind'>): StateNodeGeo {
  return {
    id: 'node1',
    display: 'NodeLabel',
    x: 10,
    y: 20,
    width: 80,
    height: 40,
    children: [],
    ...overrides,
  };
}

function makeGeo(overrides: Partial<StateGeometry> = {}): StateGeometry {
  return {
    totalWidth: 300,
    totalHeight: 200,
    states: [],
    transitions: [],
    ...overrides,
  };
}

function makeTransition(overrides: Partial<TransitionGeo> = {}): TransitionGeo {
  return {
    from: 'A',
    to: 'B',
    points: [{ x: 10, y: 20 }, { x: 10, y: 80 }, { x: 100, y: 80 }],
    ...overrides,
  };
}

/**
 * Return the SVG content after the closing </defs> tag.
 * svgRoot always emits a <defs> block first; markers inside it (including
 * the lost/found circle markers) must be excluded from shape-level counts.
 */
function contentAfterDefs(svg: string): string {
  const idx = svg.indexOf('</defs>');
  return idx === -1 ? svg : svg.slice(idx + '</defs>'.length);
}

// ---------------------------------------------------------------------------
// Minimal geometry (AC #7)
// ---------------------------------------------------------------------------

describe.skip('renderState — minimal geometry', () => {
  it('result starts with <svg (AC #7)', () => {
    const geo = makeGeo();
    const result = renderState(geo, defaultTheme);
    expect(result.startsWith('<svg')).toBe(true);
  });

  it('embeds width and height from geometry in svg root', () => {
    const geo = makeGeo({ totalWidth: 400, totalHeight: 250 });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('width="400"');
    expect(result).toContain('height="250"');
  });

  it('renders background rect covering full canvas', () => {
    const geo = makeGeo({ totalWidth: 300, totalHeight: 200 });
    const result = renderState(geo, defaultTheme);
    // Background rect has x=0 y=0 matching totalWidth/totalHeight
    expect(result).toContain('x="0"');
    expect(result).toContain('y="0"');
    expect(result).toContain(`fill="${defaultTheme.colors.background}"`);
  });
});

// ---------------------------------------------------------------------------
// Initial pseudostate (AC #1)
// ---------------------------------------------------------------------------

describe.skip('renderState — initial node', () => {
  it('contains a <circle> with fill matching border color (AC #1)', () => {
    const node = makeNode({ kind: 'initial', width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    const content = contentAfterDefs(result);
    expect(content).toContain('<circle');
    expect(content).toContain(`fill="${defaultTheme.colors.border}"`);
  });

  it('circle cx/cy is centred on the node bounding box', () => {
    const node = makeNode({ kind: 'initial', x: 50, y: 60, width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('cx="60"');
    expect(result).toContain('cy="70"');
  });
});

// ---------------------------------------------------------------------------
// Final pseudostate (AC #2)
// ---------------------------------------------------------------------------

describe.skip('renderState — final node', () => {
  it('contains exactly two <circle> elements in diagram content — bullseye (AC #2)', () => {
    const node = makeNode({ kind: 'final', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    // Count only circles in diagram content, not inside the <defs> markers
    const content = contentAfterDefs(result);
    const circleCount = (content.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(2);
  });

  it('outer circle has fill="none" and inner has border fill', () => {
    const node = makeNode({ kind: 'final', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="none"');
    expect(content).toContain(`fill="${defaultTheme.colors.border}"`);
  });

  it('outer circle uses stroke matching border color', () => {
    const node = makeNode({ kind: 'final', x: 0, y: 0, width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain(`stroke="${defaultTheme.colors.border}"`);
  });
});

// ---------------------------------------------------------------------------
// Fork / join pseudostate (AC #3)
// ---------------------------------------------------------------------------

describe.skip('renderState — fork node', () => {
  it('contains a <rect> with fill matching border color (AC #3)', () => {
    const node = makeNode({ kind: 'fork', width: 60, height: 8 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    // At least one rect with border fill (may also have the background rect)
    expect(result).toContain(`fill="${defaultTheme.colors.border}"`);
  });

  it('join renders the same thin filled bar', () => {
    const node = makeNode({ kind: 'join', width: 60, height: 8 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain(`fill="${defaultTheme.colors.border}"`);
  });
});

// ---------------------------------------------------------------------------
// Normal state (AC #8)
// ---------------------------------------------------------------------------

describe.skip('renderState — normal state', () => {
  it('SVG contains rounded rect with rx attribute (AC #8)', () => {
    const node = makeNode({ kind: 'normal', display: 'Active' });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('rx="8"');
  });

  it('SVG contains the display label text', () => {
    const node = makeNode({ kind: 'normal', display: 'Running' });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('Running');
  });

  it('text is centred horizontally inside the node', () => {
    const node = makeNode({ kind: 'normal', x: 0, y: 0, width: 100, height: 40, display: 'Idle' });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('text-anchor="middle"');
  });
});

// ---------------------------------------------------------------------------
// Choice / junction pseudostate
// ---------------------------------------------------------------------------

describe.skip('renderState — choice node', () => {
  it('contains a <polygon> (diamond) element', () => {
    const node = makeNode({ kind: 'choice', width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('<polygon');
  });

  it('junction also renders a diamond polygon', () => {
    const node = makeNode({ kind: 'junction', width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('<polygon');
  });
});

// ---------------------------------------------------------------------------
// History / deepHistory pseudostate
// ---------------------------------------------------------------------------

describe.skip('renderState — history node', () => {
  it('renders ellipse for history node', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('<ellipse');
  });

  it('history label is "H"', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('>H<');
  });

  it('deepHistory label is "H*"', () => {
    const node = makeNode({ kind: 'deepHistory', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('>H*<');
  });

  it('history ellipse has fill="none" — outline only', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="none"');
  });

  it('history ellipse has a stroke attribute', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain(`stroke="${defaultTheme.colors.border}"`);
  });

  it('deepHistory ellipse has fill="none" — outline only', () => {
    const node = makeNode({ kind: 'deepHistory', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="none"');
  });

  it('history text is centered (text-anchor=middle)', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('text-anchor="middle"');
  });

  it('deepHistory text is centered (text-anchor=middle)', () => {
    const node = makeNode({ kind: 'deepHistory', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('text-anchor="middle"');
  });

  it('diagram with no history nodes produces output identical to before (no regression)', () => {
    const node = makeNode({ kind: 'normal', display: 'Active' });
    const geo = makeGeo({ states: [node] });
    const result = renderState(geo, defaultTheme);
    // No history-related elements should appear
    expect(result).not.toContain('>H<');
    expect(result).not.toContain('>H*<');
    expect(result).not.toContain('<ellipse');
  });
});

// ---------------------------------------------------------------------------
// Composite state
// ---------------------------------------------------------------------------

describe.skip('renderState — composite state', () => {
  it('renders dashed outer rect for composite state', () => {
    const child = makeNode({ id: 'child', kind: 'normal', display: 'Child', x: 20, y: 50, width: 60, height: 30 });
    const parent = makeNode({
      id: 'parent',
      kind: 'normal',
      display: 'Parent',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      children: [child],
    });
    const geo = makeGeo({ states: [parent] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('stroke-dasharray="6,3"');
  });

  it('renders child nodes inside composite', () => {
    const child = makeNode({ id: 'child', kind: 'normal', display: 'Inner', x: 20, y: 50, width: 60, height: 30 });
    const parent = makeNode({
      id: 'parent',
      kind: 'normal',
      display: 'Outer',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      children: [child],
    });
    const geo = makeGeo({ states: [parent] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('Inner');
  });
});

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

describe.skip('renderState — transitions', () => {
  it('renders a <path> element for each transition', () => {
    const t = makeTransition();
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('<path');
  });

  it('transition path uses arrow marker', () => {
    const t = makeTransition();
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('marker-end="url(#arrow-dependency)"');
  });

  it('transition with label renders text element', () => {
    const t = makeTransition({ label: { text: 'trigger', x: 55, y: 80 } });
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('trigger');
  });

  it('transition with no points renders nothing for that transition', () => {
    const t = makeTransition({ points: [] });
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    // No <path> in diagram content for a transition with empty points
    const content = contentAfterDefs(result);
    expect(content).not.toContain('<path');
  });

  it('transition with exactly one point renders a path with just a move', () => {
    // Covers the points.length === 1 branch in buildPathD
    const t = makeTransition({ points: [{ x: 10, y: 20 }] });
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    // A single-point path should still produce a <path> with an M command
    expect(result).toContain('<path');
    expect(result).toContain('M 10,20');
  });

  it('transition with exactly two points uses cubic Bézier with two control points', () => {
    // Covers the points.length === 2 branch in buildPathD
    const t = makeTransition({ points: [{ x: 10, y: 10 }, { x: 90, y: 90 }] });
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('<path');
    expect(result).toContain('M 10,10');
    // The 2-point path produces a single cubic segment
    expect(result).toContain('C ');
  });

  it('path d attribute encodes cubic Bézier segments from points', () => {
    const t = makeTransition({
      points: [{ x: 5, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 90 }],
    });
    const geo = makeGeo({ transitions: [t] });
    const result = renderState(geo, defaultTheme);
    expect(result).toContain('M 5,10');
    expect(result).toContain('C '); // Catmull-Rom → cubic Bézier
    expect(result).not.toContain(' L ');
  });
});

// ---------------------------------------------------------------------------
// statePlugin.accepts (AC #4, #5, #6)
// ---------------------------------------------------------------------------

describe.skip('statePlugin.accepts', () => {
  it('returns true for [*] --> Active (AC #4)', () => {
    expect(statePlugin.accepts(['[*] --> Active'])).toBe(true);
  });

  it('returns false for sequence diagram line (AC #5)', () => {
    expect(statePlugin.accepts(['Alice -> Bob: hello'])).toBe(false);
  });

  it('returns true for "state Idle" (AC #6)', () => {
    expect(statePlugin.accepts(['state Idle'])).toBe(true);
  });

  it('returns true for fork stereotype', () => {
    expect(statePlugin.accepts(['state split <<fork>>'])).toBe(true);
  });

  it('returns true for [*] in final transition', () => {
    expect(statePlugin.accepts(['Active --> [*]'])).toBe(true);
  });

  it('returns false for class diagram line', () => {
    expect(statePlugin.accepts(['class Animal {'])).toBe(false);
  });

  it('only scans first 20 lines', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `line ${i}`);
    lines[21] = '[*] --> State';
    // Pattern is beyond index 19, so accepts should return false
    expect(statePlugin.accepts(lines)).toBe(false);
  });
});
