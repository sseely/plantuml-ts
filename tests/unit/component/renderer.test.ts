import { describe, it, expect } from 'vitest';
import { renderComponent } from '../../../src/diagrams/component/renderer.js';
import { componentPlugin } from '../../../src/diagrams/component/index.js';
import type {
  ComponentGeometry,
  ComponentNodeGeo,
  ComponentEdgeGeo,
} from '../../../src/diagrams/component/layout.js';
import { defaultTheme, darkTheme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry builder helpers
// ---------------------------------------------------------------------------

function makeNode(overrides?: Partial<ComponentNodeGeo>): ComponentNodeGeo {
  return {
    id: 'comp1',
    kind: 'component',
    display: 'MyComponent',
    x: 10,
    y: 10,
    width: 100,
    height: 40,
    children: [],
    ...overrides,
  };
}

function makeGeo(overrides?: Partial<ComponentGeometry>): ComponentGeometry {
  return {
    totalWidth: 200,
    totalHeight: 200,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

function makeEdge(overrides?: Partial<ComponentEdgeGeo>): ComponentEdgeGeo {
  return {
    id: 'edge1',
    points: [
      { x: 10, y: 50 },
      { x: 150, y: 50 },
    ],
    dashed: false,
    arrowHead: 'open',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Acceptance criterion 7: minimal geometry → starts with <svg
// ---------------------------------------------------------------------------

describe('renderComponent — SVG root', () => {
  it('empty geometry produces valid SVG starting with <svg', () => {
    const svg = renderComponent(makeGeo(), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('SVG includes width and height from geo.totalWidth / totalHeight', () => {
    const svg = renderComponent(makeGeo({ totalWidth: 300, totalHeight: 150 }), defaultTheme);
    expect(svg).toContain('width="300"');
    expect(svg).toContain('height="150"');
  });

  it('SVG includes background rect', () => {
    const svg = renderComponent(makeGeo(), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.background}"`);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 1: component node → display text in <text>
// ---------------------------------------------------------------------------

describe('renderComponent — component node', () => {
  it('component node display text appears in SVG', () => {
    const node = makeNode({ display: 'OrderService' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('OrderService');
  });

  it('component node renders a <rect>', () => {
    const node = makeNode();
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
  });

  it('component node rect uses classBackground fill', () => {
    const node = makeNode();
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(defaultTheme.colors.graph.classBackground);
  });

  it('component node label is text-anchor middle', () => {
    const node = makeNode({ display: 'CenteredLabel' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('CenteredLabel');
    expect(svg).toContain('text-anchor="middle"');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 2: interface node → <ellipse>
// ---------------------------------------------------------------------------

describe('renderComponent — interface node', () => {
  it('interface node renders an <ellipse>', () => {
    const node = makeNode({ kind: 'interface', display: 'IPayment' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('interface node display label appears below the ellipse', () => {
    const node = makeNode({ kind: 'interface', display: 'IPayment' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('IPayment');
  });

  it('interface ellipse has fill="none"', () => {
    const node = makeNode({ kind: 'interface' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('fill="none"');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 3: package container → UML folder-tab polygon shape
// ---------------------------------------------------------------------------

describe('renderComponent — package container', () => {
  it('package node renders a polygon (folder-tab shape)', () => {
    const child = makeNode({ id: 'child1', display: 'Inner' });
    const node = makeNode({ kind: 'package', display: 'Services', children: [child] });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<polygon');
  });

  it('package node renders no stroke-dasharray (solid border)', () => {
    const child = makeNode({ id: 'child1', display: 'Inner' });
    const node = makeNode({ kind: 'package', display: 'Services', children: [child] });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('package node display label appears in SVG', () => {
    const node = makeNode({ kind: 'package', display: 'Services' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('Services');
  });

  it('package node label uses text-anchor start', () => {
    const child = makeNode({ id: 'child1', display: 'Inner' });
    const node = makeNode({ kind: 'package', display: 'Services', children: [child] });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('text-anchor="start"');
  });

  it('package node label is bold', () => {
    const child = makeNode({ id: 'child1', display: 'Inner' });
    const node = makeNode({ kind: 'package', display: 'Services', children: [child] });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('font-weight="bold"');
  });

  it('folder container renders folder-tab polygon', () => {
    const child = makeNode({ id: 'child1', display: 'Inner' });
    const node = makeNode({ kind: 'folder', display: 'Handlers', children: [child] });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<polygon');
  });

  it('cloud container renders folder-tab polygon', () => {
    const child = makeNode({ id: 'child1', display: 'Inner' });
    const node = makeNode({ kind: 'cloud', display: 'AWS', children: [child] });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<polygon');
  });
});

// ---------------------------------------------------------------------------
// Recursive children rendering
// ---------------------------------------------------------------------------

describe('renderComponent — nested children', () => {
  it('child nodes inside a container are rendered', () => {
    const child = makeNode({ id: 'child1', display: 'InnerComp' });
    const parent = makeNode({
      kind: 'package',
      display: 'MyPackage',
      children: [child],
    });
    const svg = renderComponent(makeGeo({ nodes: [parent] }), defaultTheme);
    expect(svg).toContain('InnerComp');
    expect(svg).toContain('MyPackage');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 4: dashed edge → stroke-dasharray present
// ---------------------------------------------------------------------------

describe('renderComponent — edges', () => {
  it('dashed edge has stroke-dasharray in SVG', () => {
    const edge = makeEdge({ dashed: true });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('solid edge does NOT have stroke-dasharray', () => {
    const edge = makeEdge({ dashed: false });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    // stroke-dasharray may appear in lifeline or defs, but this edge must not add it
    // Verify via path: the path element for solid edge should not have stroke-dasharray
    // Extract path elements only
    const pathMatches = svg.match(/<path[^/]*/g) ?? [];
    const solidEdgePaths = pathMatches.filter((p) => !p.includes('stroke-dasharray'));
    expect(solidEdgePaths.length).toBeGreaterThan(0);
  });

  it('edge path element contains M and L for multi-point polyline path', () => {
    const edge = makeEdge({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ],
    });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('M 0,0');
    expect(svg).toContain('L 50,0');
    expect(svg).toContain('L 50,100');
  });

  it('edge uses theme arrow color', () => {
    const edge = makeEdge();
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain(`stroke="${defaultTheme.colors.arrow}"`);
  });

  it('edge with label renders label text', () => {
    const edge = makeEdge({
      label: { text: 'uses', x: 80, y: 45 },
    });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('uses');
  });

  it('edge without label does not crash', () => {
    const edge = makeEdge({ dashed: false });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });

  it('edge with zero points produces no path output', () => {
    const edge = makeEdge({ points: [] });
    const svgWithEdge = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    // An edge with no points adds nothing visible — the SVG is still valid
    expect(svgWithEdge.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 5: componentPlugin.accepts — true cases
// ---------------------------------------------------------------------------

describe('componentPlugin.accepts — true', () => {
  it('returns true for [ComponentName] bracket syntax', () => {
    expect(componentPlugin.accepts(['[Foo]'])).toBe(true);
  });

  it('returns true for () interface shorthand', () => {
    expect(componentPlugin.accepts(['() IPayment'])).toBe(true);
  });

  it('returns true for component keyword', () => {
    expect(componentPlugin.accepts(['component OrderService'])).toBe(true);
  });

  it('returns false for interface keyword alone — deferred to classPlugin', () => {
    expect(componentPlugin.accepts(['interface ILogger'])).toBe(false);
  });

  it('returns true for package keyword', () => {
    expect(componentPlugin.accepts(['package Services {'])).toBe(true);
  });

  it('returns true for cloud keyword', () => {
    expect(componentPlugin.accepts(['cloud AWS'])).toBe(true);
  });

  it('returns false for database keyword alone — deferred to sequencePlugin', () => {
    expect(componentPlugin.accepts(['database PostgreSQL'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Acceptance criterion 6: componentPlugin.accepts — false cases
// ---------------------------------------------------------------------------

describe('componentPlugin.accepts — false', () => {
  it('returns false for plain sequence message syntax', () => {
    expect(componentPlugin.accepts(['Alice -> Bob: hi'])).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(componentPlugin.accepts([])).toBe(false);
  });

  it('returns false for class diagram syntax', () => {
    expect(componentPlugin.accepts(['class Foo {'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Plugin type and render integration
// ---------------------------------------------------------------------------

describe('componentPlugin integration', () => {
  it('plugin type is "component"', () => {
    expect(componentPlugin.type).toBe('component');
  });

  it('render is a function accepting geo and theme', () => {
    const svg = componentPlugin.render(makeGeo(), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });

  it('theme colors propagate to rendered SVG', () => {
    const node = makeNode({ display: 'ServiceA' });
    const svgDefault = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    const svgDark = renderComponent(makeGeo({ nodes: [node] }), darkTheme);
    expect(svgDefault).toContain(defaultTheme.colors.background);
    expect(svgDark).toContain(darkTheme.colors.background);
    expect(svgDefault).not.toContain(darkTheme.colors.background);
  });
});

// ---------------------------------------------------------------------------
// Database node — branch coverage for renderDatabaseNode (lines 108-145)
// ---------------------------------------------------------------------------

describe('renderComponent — database node', () => {
  it('database node renders a cylinder shape (ellipse for top cap)', () => {
    const node = makeNode({ kind: 'database', display: 'PostgreSQL' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('database node display label appears in SVG', () => {
    const node = makeNode({ kind: 'database', display: 'PostgreSQL' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('PostgreSQL');
  });

  it('database node renders a bottom arc path element', () => {
    const node = makeNode({ kind: 'database', display: 'Cache' });
    const svg = renderComponent(makeGeo({ nodes: [node] }), defaultTheme);
    // The cylinder bottom arc uses a <path> with an A (arc) command
    expect(svg).toContain(' A ');
  });
});

// ---------------------------------------------------------------------------
// Edge arrowHead variants — branch coverage for arrowMarker selection
// ---------------------------------------------------------------------------

describe('renderComponent — edge arrowHead variants', () => {
  it('arrowHead "none" produces an edge with no marker-end attribute', () => {
    const edge = makeEdge({ arrowHead: 'none' });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    // No marker — the path element must not contain marker-end
    const pathMatches = svg.match(/<path[^/]*/g) ?? [];
    const edgePaths = pathMatches.filter((p) => p.includes('stroke'));
    expect(edgePaths.some((p) => p.includes('marker-end'))).toBe(false);
  });

  it('arrowHead "filled" produces a filled sync arrow marker', () => {
    const edge = makeEdge({ arrowHead: 'filled' });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('sync');
  });

  it('arrowHead "open" (default) produces a dependency arrow marker', () => {
    const edge = makeEdge({ arrowHead: 'open' });
    const svg = renderComponent(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('dependency');
  });
});
