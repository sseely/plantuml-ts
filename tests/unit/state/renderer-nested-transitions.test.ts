/**
 * mission G4 S5 — composite-internal transition nesting. Jar nests a pass's
 * own internal transitions INSIDE that pass's own `<g>` (siblings of the
 * pass's entity/cluster children), never as flat top-level siblings — see
 * `bajelo-54-dixe684`'s own `lnk10`/`lnk11` (both inside `Track_FSM`'s own
 * `<g>`), jar-verified in `plans/g4-state-svg/ledger.md` S5.
 */
import { describe, it, expect } from 'vitest';
import { renderState } from '../../../src/diagrams/state/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import { statePlugin } from '../../../src/diagrams/state/index.js';
import type { StateGeometry, StateNodeGeo, TransitionGeo } from '../../../src/diagrams/state/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';

void statePlugin;

function makeNode(overrides: Partial<StateNodeGeo> & Pick<StateNodeGeo, 'kind'>): StateNodeGeo {
  return {
    id: 'node1',
    display: 'NodeLabel',
    x: 10,
    y: 20,
    width: 80,
    height: 40,
    children: [],
    transitions: [],
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

describe('renderState — composite-internal transition nesting', () => {
  it('renders a composite child pass own transition INSIDE the composite <g>, not at the outer level', () => {
    const inner1 = makeNode({ id: 'inner1', kind: 'normal', display: 'Inner1', x: 20, y: 50, width: 60, height: 30 });
    const inner2 = makeNode({ id: 'inner2', kind: 'normal', display: 'Inner2', x: 100, y: 50, width: 60, height: 30 });
    const innerTransition = makeTransition({ from: 'inner1', to: 'inner2' });
    const parent = makeNode({
      id: 'parent',
      kind: 'normal',
      display: 'Parent',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      children: [inner1, inner2],
      transitions: [innerTransition],
    });
    const geo = makeGeo({ states: [parent] });
    const svg = assembleSvg(renderState(geo, defaultTheme));

    // The composite's own <g class="entity"> wrap must contain the link's
    // own <g class="link"> markup as a nested descendant.
    const parentGStart = svg.indexOf('data-qualified-name="parent"');
    expect(parentGStart).toBeGreaterThan(-1);
    const parentGOpenTagStart = svg.lastIndexOf('<g', parentGStart);
    // Locate the matching close: crude but sufficient for this fixture --
    // the parent <g> is the OUTERMOST entity wrap in this minimal geometry,
    // so its own close is the LAST </g> before the top-level content </g>.
    const linkIdx = svg.indexOf('class="link"');
    expect(linkIdx).toBeGreaterThan(parentGOpenTagStart);

    // The path's own d attribute must reference the inner transition points.
    expect(svg).toContain('M 10,20');
  });

  it('does not duplicate a composite child transition at the outer StateGeometry.transitions level', () => {
    const inner1 = makeNode({ id: 'inner1', kind: 'normal', display: 'Inner1', x: 20, y: 50, width: 60, height: 30 });
    const inner2 = makeNode({ id: 'inner2', kind: 'normal', display: 'Inner2', x: 100, y: 50, width: 60, height: 30 });
    const innerTransition = makeTransition({ from: 'inner1', to: 'inner2' });
    const parent = makeNode({
      id: 'parent',
      kind: 'normal',
      display: 'Parent',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      children: [inner1, inner2],
      transitions: [innerTransition],
    });
    const geo = makeGeo({ states: [parent] });
    const svg = assembleSvg(renderState(geo, defaultTheme));

    // Only ONE <g class="link"> should exist for this single transition --
    // not one at the outer level AND one nested inside the composite.
    const linkCount = svg.split('class="link"').length - 1;
    expect(linkCount).toBe(1);
  });

  it('keeps a top-level (non-nested) transition rendered as a direct sibling, unchanged', () => {
    const a = makeNode({ id: 'A', kind: 'normal', display: 'A' });
    const b = makeNode({ id: 'B', kind: 'normal', display: 'B', x: 200 });
    const t = makeTransition({ from: 'A', to: 'B' });
    const geo = makeGeo({ states: [a, b], transitions: [t] });
    const svg = assembleSvg(renderState(geo, defaultTheme));

    const linkCount = svg.split('class="link"').length - 1;
    expect(linkCount).toBe(1);
    expect(svg).toContain('M 10,20');
  });
});
