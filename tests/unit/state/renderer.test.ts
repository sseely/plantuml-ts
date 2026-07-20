import { describe, it, expect } from 'vitest';
import { renderState } from '../../../src/diagrams/state/renderer.js';
import { assembleSvg } from '../../../src/index.js';
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

describe('renderState — minimal geometry', () => {
  it('result starts with <svg (AC #7)', () => {
    const geo = makeGeo();
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result.startsWith('<svg')).toBe(true);
  });

  it('embeds width and height from geometry in svg root (mission G4 S1: px-suffixed, CucaDiagram shell)', () => {
    const geo = makeGeo({ totalWidth: 400, totalHeight: 250 });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('width="400px"');
    expect(result).toContain('height="250px"');
  });

  it('embeds background via the root style attribute, not a full-canvas <rect> (mission G4 S1 mechanism 1: jar draws no background rect for state)', () => {
    const geo = makeGeo({ totalWidth: 300, totalHeight: 200 });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain(`background:${defaultTheme.colors.background};`);
    expect(result).not.toContain('<rect width="300" height="200"');
  });

  it('carries the CucaDiagram-family root shell (mission G4 S1 mechanism 1)', () => {
    const geo = makeGeo({ totalWidth: 300, totalHeight: 200 });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('data-diagram-type="STATE"');
    expect(result).toContain('zoomAndPan="magnify"');
  });
});

// ---------------------------------------------------------------------------
// Initial pseudostate (AC #1)
// ---------------------------------------------------------------------------

describe('renderState — initial node', () => {
  // mission G4 S2 (mechanism 5): jar draws initial as an <ellipse>, never
  // <circle> -- and its default fill/stroke is CircleStart.java's own
  // #222222, independent of theme.colors.border (renderer-pseudostate.ts's
  // own PSEUDO_ANCHOR_COLOR doc comment, jar-verified gefefe-91-xoge233).
  it('contains an <ellipse> with the CircleStart default fill (AC #1)', () => {
    const node = makeNode({ kind: 'initial', width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    const content = contentAfterDefs(result);
    expect(content).toContain('<ellipse');
    expect(content).toContain('fill="#222222"');
  });

  it('circle cx/cy is centred on the node bounding box', () => {
    const node = makeNode({ kind: 'initial', x: 50, y: 60, width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('cx="60"');
    expect(result).toContain('cy="70"');
  });
});

// ---------------------------------------------------------------------------
// Final pseudostate (AC #2)
// ---------------------------------------------------------------------------

describe('renderState — final node', () => {
  // mission G4 S2: jar draws final as two <ellipse> elements (CircleEnd.java),
  // never <circle> -- jar-verified bajelo-54-dixe684.
  it('contains exactly two <ellipse> elements in diagram content — bullseye (AC #2)', () => {
    const node = makeNode({ kind: 'final', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    // Count only ellipses in diagram content, not inside the <defs> markers
    const content = contentAfterDefs(result);
    const ellipseCount = (content.match(/<ellipse/g) ?? []).length;
    expect(ellipseCount).toBe(2);
  });

  it('outer ellipse has fill="none" and inner has the CircleEnd default fill', () => {
    const node = makeNode({ kind: 'final', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="none"');
    expect(content).toContain('fill="#222222"');
  });

  it('outer ellipse uses the CircleEnd default stroke (#222222, independent of theme.colors.border)', () => {
    const node = makeNode({ kind: 'final', x: 0, y: 0, width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('stroke="#222222"');
  });
});

// ---------------------------------------------------------------------------
// Fork / join pseudostate (AC #3)
// ---------------------------------------------------------------------------

describe('renderState — fork node', () => {
  // mission G4 S2: jar's EntityImageSynchroBar default fill is #555555,
  // independent of theme.colors.border -- jar-verified cekolo-21-gini183.
  it('contains a <rect> with the EntityImageSynchroBar default fill (AC #3)', () => {
    const node = makeNode({ kind: 'fork', width: 60, height: 8 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    // At least one rect with the bar's default fill (may also have the
    // background rect)
    expect(result).toContain('fill="#555555"');
  });

  it('join renders the same thin filled bar', () => {
    const node = makeNode({ kind: 'join', width: 60, height: 8 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('fill="#555555"');
  });
});

// ---------------------------------------------------------------------------
// Normal state (AC #8)
// ---------------------------------------------------------------------------

describe('renderState — normal state', () => {
  // mission G4 S2: jar's leaf-state box rx/ry is 12.5 (EntityImageState.java),
  // not 8 -- jar-verified jocela-05-niba392/votoki-67-gufa610.
  it('SVG contains rounded rect with rx attribute (AC #8)', () => {
    const node = makeNode({ kind: 'normal', display: 'Active' });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('rx="12.5"');
  });

  it('SVG contains the display label text', () => {
    const node = makeNode({ kind: 'normal', display: 'Running' });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('Running');
  });

  it('text is centred horizontally inside the node', () => {
    const node = makeNode({ kind: 'normal', x: 0, y: 0, width: 100, height: 40, display: 'Idle' });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('text-anchor="middle"');
  });
});

// ---------------------------------------------------------------------------
// Choice pseudostate
// ---------------------------------------------------------------------------

describe('renderState — choice node', () => {
  it('contains a <polygon> (diamond) element', () => {
    const node = makeNode({ kind: 'choice', width: 20, height: 20 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('<polygon');
  });
});

// ---------------------------------------------------------------------------
// History / deepHistory pseudostate
// ---------------------------------------------------------------------------

describe('renderState — history node', () => {
  it('renders ellipse for history node', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('<ellipse');
  });

  it('history label is "H"', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('>H<');
  });

  it('deepHistory label is "H*"', () => {
    const node = makeNode({ kind: 'deepHistory', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('>H*<');
  });

  // mission G4 S2: jar's history/deepHistory ellipse shares the SAME
  // fill/border/stroke-width as a plain leaf box (#F1F1F1/border/0.5), NOT
  // an unfilled outline -- jar-verified cekolo-21-gini183 (`state-render-
  // colors.ts`'s own module doc comment explains why).
  it('history ellipse has the plain leaf-box default fill (#F1F1F1)', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="#F1F1F1"');
  });

  it('history ellipse has a stroke attribute', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain(`stroke="${defaultTheme.colors.border}"`);
  });

  it('deepHistory ellipse has the plain leaf-box default fill (#F1F1F1)', () => {
    const node = makeNode({ kind: 'deepHistory', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    const content = contentAfterDefs(result);
    expect(content).toContain('fill="#F1F1F1"');
  });

  it('history text is centered (text-anchor=middle)', () => {
    const node = makeNode({ kind: 'history', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('text-anchor="middle"');
  });

  it('deepHistory text is centered (text-anchor=middle)', () => {
    const node = makeNode({ kind: 'deepHistory', width: 24, height: 24 });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('text-anchor="middle"');
  });

  it('diagram with no history nodes produces output identical to before (no regression)', () => {
    const node = makeNode({ kind: 'normal', display: 'Active' });
    const geo = makeGeo({ states: [node] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    // No history-related elements should appear
    expect(result).not.toContain('>H<');
    expect(result).not.toContain('>H*<');
    expect(result).not.toContain('<ellipse');
  });
});

// ---------------------------------------------------------------------------
// Composite state
// ---------------------------------------------------------------------------

describe('renderState — composite state', () => {
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
    const result = assembleSvg(renderState(geo, defaultTheme));
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
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('Inner');
  });
});

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

describe('renderState — transitions', () => {
  it('renders a <path> element for each transition', () => {
    const t = makeTransition();
    const geo = makeGeo({ transitions: [t] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('<path');
  });

  it('transition path uses an inline arrowhead polygon, not a marker ref (mission G4 S1 mechanism 3)', () => {
    const t = makeTransition();
    const geo = makeGeo({ transitions: [t] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).not.toContain('marker-end');
    expect(result).toContain('<polygon');
  });

  it('transition with label renders text element', () => {
    const t = makeTransition({ label: { text: 'trigger', x: 55, y: 80 } });
    const geo = makeGeo({ transitions: [t] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('trigger');
  });

  it('transition with no points renders nothing for that transition', () => {
    const t = makeTransition({ points: [] });
    const geo = makeGeo({ transitions: [t] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    // No <path> in diagram content for a transition with empty points
    const content = contentAfterDefs(result);
    expect(content).not.toContain('<path');
  });

  it('transition with exactly one point renders a path with just a move', () => {
    // Covers the points.length === 1 branch in buildPathD
    const t = makeTransition({ points: [{ x: 10, y: 20 }] });
    const geo = makeGeo({ transitions: [t] });
    const result = assembleSvg(renderState(geo, defaultTheme));
    // A single-point path should still produce a <path> with an M command
    expect(result).toContain('<path');
    expect(result).toContain('M 10,20');
  });

  it('transition with exactly two points uses cubic Bézier with two control points', () => {
    // Covers the points.length === 2 branch in buildPathD
    const t = makeTransition({ points: [{ x: 10, y: 10 }, { x: 90, y: 90 }] });
    const geo = makeGeo({ transitions: [t] });
    const result = assembleSvg(renderState(geo, defaultTheme));
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
    const result = assembleSvg(renderState(geo, defaultTheme));
    expect(result).toContain('M 5,10');
    expect(result).toContain('C '); // Catmull-Rom → cubic Bézier
    expect(result).not.toContain(' L ');
  });
});

// ---------------------------------------------------------------------------
// statePlugin.accepts (AC #4, #5, #6)
// ---------------------------------------------------------------------------

describe('statePlugin.accepts', () => {
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
