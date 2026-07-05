/**
 * Unified description diagram renderer tests.
 *
 * Migrates assertions from:
 *   tests/unit/component/renderer.test.ts  (renderer-only subset, re-expressed
 *     against DescriptionNodeGeo.symbol instead of ComponentNodeGeo.kind)
 *   tests/unit/usecase/renderer.test.ts    (renderer-only subset)
 *
 * New tests added:
 *   - D2 rect fallback (hexagon symbol → rect with label, no throw)
 *   - 4-point cubic bezier edge → contains 'C' command
 *   - multi-segment (7-point) bezier edge
 *   - leftover-point graceful fallback
 */

import { describe, it, expect } from 'vitest';
import { renderDescription } from '../../../src/diagrams/description/renderer.js';
import type {
  DescriptionGeometry,
  DescriptionEdgeGeo,
} from '../../../src/diagrams/description/layout.js';
import type { DescriptionNodeGeo } from '../../../src/diagrams/description/layout-helpers.js';
import { defaultTheme, darkTheme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry builder helpers
// ---------------------------------------------------------------------------

function makeDNode(overrides?: Partial<DescriptionNodeGeo>): DescriptionNodeGeo {
  return {
    id: 'n1',
    symbol: 'component',
    display: 'MyNode',
    x: 10,
    y: 10,
    width: 100,
    height: 40,
    children: [],
    ...overrides,
  };
}

function makeGeo(overrides?: Partial<DescriptionGeometry>): DescriptionGeometry {
  return {
    totalWidth: 200,
    totalHeight: 200,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

function makeEdge(overrides?: Partial<DescriptionEdgeGeo>): DescriptionEdgeGeo {
  return {
    id: 'e1',
    from: 'n1',
    to: 'n2',
    points: [{ x: 10, y: 50 }, { x: 150, y: 50 }],
    dashed: false,
    arrowHead: 'open',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SVG root
// (from component/renderer.test.ts + usecase/renderer.test.ts SVG root sections)
// ---------------------------------------------------------------------------

describe('renderDescription — SVG root', () => {
  it('empty geometry produces valid SVG starting with <svg', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('SVG includes width and height from geo.totalWidth / totalHeight', () => {
    const svg = renderDescription(makeGeo({ totalWidth: 300, totalHeight: 150 }), defaultTheme);
    expect(svg).toContain('width="300"');
    expect(svg).toContain('height="150"');
  });

  it('SVG includes background rect', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.background}"`);
  });

  it('closes the svg element', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain('</svg>');
  });
});

// ---------------------------------------------------------------------------
// Component node (from component/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — component node', () => {
  it('component node display text appears in SVG', () => {
    const node = makeDNode({ symbol: 'component', display: 'OrderService' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('OrderService');
  });

  it('component node renders a <rect>', () => {
    const node = makeDNode({ symbol: 'component' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
  });

  it('component node rect uses classBackground fill', () => {
    const node = makeDNode({ symbol: 'component' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(defaultTheme.colors.graph.classBackground);
  });

  it('component node label is text-anchor middle', () => {
    const node = makeDNode({ symbol: 'component', display: 'CenteredLabel' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('CenteredLabel');
    expect(svg).toContain('text-anchor="middle"');
  });
});

// ---------------------------------------------------------------------------
// Interface node (from component/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — interface node', () => {
  it('interface node renders an <ellipse>', () => {
    const node = makeDNode({ symbol: 'interface', display: 'IPayment' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('interface node display label appears in SVG', () => {
    const node = makeDNode({ symbol: 'interface', display: 'IPayment' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('IPayment');
  });

  it('interface ellipse has fill="none"', () => {
    const node = makeDNode({ symbol: 'interface' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('fill="none"');
  });
});

// ---------------------------------------------------------------------------
// Note node (EntityImageNote)
// ---------------------------------------------------------------------------

describe('renderDescription — note node', () => {
  it('note display text appears in SVG', () => {
    const node = makeDNode({ symbol: 'note', display: 'my note' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('my note');
  });

  it('note renders the folded-corner note-box path (not a plain <rect>)', () => {
    const node = makeDNode({ symbol: 'note' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<path');
  });

  it('multi-line note body renders one text element per line', () => {
    const node = makeDNode({ symbol: 'note', display: 'line one\nline two' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('line one');
    expect(svg).toContain('line two');
    expect(svg.match(/<text/g)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Package / folder container
// (adapted from component/renderer.test.ts — unified renderer uses rect+dashes)
// ---------------------------------------------------------------------------

describe('renderDescription — package container', () => {
  it('package container renders a labeled rect (unified renderer uses rect, not polygon)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'package', display: 'Services', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
  });

  it('package container has dashed border (stroke-dasharray="4 2")', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'package', display: 'Services', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('package display label appears in SVG', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'package', display: 'Services', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('Services');
  });

  it('package container label uses text-anchor start', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'package', display: 'Services', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('text-anchor="start"');
  });

  it('package container label is bold', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'package', display: 'Services', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('font-weight="bold"');
  });

  it('folder container renders a rect with dashed border', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'folder', display: 'Handlers', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('cloud container renders a rect with solid border (not dashed)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'cloud', display: 'AWS', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('child nodes inside a container are rendered', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'InnerComp' });
    const parent = makeDNode({ symbol: 'package', display: 'MyPackage', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [parent] }), defaultTheme);
    expect(svg).toContain('InnerComp');
    expect(svg).toContain('MyPackage');
  });
});

// ---------------------------------------------------------------------------
// Database node (from component/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — database node', () => {
  it('database node renders a cylinder shape (ellipse for top cap)', () => {
    const node = makeDNode({ symbol: 'database', display: 'PostgreSQL' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('database node display label appears in SVG', () => {
    const node = makeDNode({ symbol: 'database', display: 'PostgreSQL' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('PostgreSQL');
  });

  it('database node renders a bottom arc path element', () => {
    const node = makeDNode({ symbol: 'database', display: 'Cache' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(' A ');
  });
});

// ---------------------------------------------------------------------------
// Actor node (from usecase/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — actor node', () => {
  it('emits a <circle> element for the head', () => {
    const node = makeDNode({ symbol: 'actor', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<circle');
  });

  it('emits exactly 4 <line> elements (body, arms, left leg, right leg)', () => {
    const node = makeDNode({ symbol: 'actor', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect((svg.match(/<line/g) ?? []).length).toBe(4);
  });

  it('renders the actor label text', () => {
    const node = makeDNode({ symbol: 'actor', display: 'AdminUser', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('AdminUser');
  });

  it('uses actorStroke color for circle and lines', () => {
    const node = makeDNode({ symbol: 'actor', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(defaultTheme.colors.graph.actorStroke);
  });

  it('uses actorFill for head circle fill (default: none)', () => {
    const node = makeDNode({ symbol: 'actor', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.actorFill}"`);
  });
});

// ---------------------------------------------------------------------------
// Business actor node (from usecase/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — actor-business node', () => {
  it('emits a <circle> element for the head', () => {
    const node = makeDNode({ symbol: 'actor-business', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<circle');
  });

  it('emits exactly 5 <line> elements (body, arms, left leg, right leg, diagonal)', () => {
    const node = makeDNode({ symbol: 'actor-business', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect((svg.match(/<line/g) ?? []).length).toBe(5);
  });

  it('uses businessActorFill for head circle fill', () => {
    const customTheme = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, businessActorFill: '#FF0000' } },
    };
    const node = makeDNode({ symbol: 'actor-business', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), customTheme);
    expect(svg).toContain('fill="#FF0000"');
  });

  it('uses default businessActorFill', () => {
    const node = makeDNode({ symbol: 'actor-business', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.businessActorFill}"`);
  });

  it('diagonal line coordinates match upstream Java (angles PI/4 ± 21*PI/64, r=8)', () => {
    const node = makeDNode({ symbol: 'actor-business', x: 0, y: 0, width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    const cx = 25;
    const headCy = 8;
    const r = 8;
    const alpha = (21 * Math.PI) / 64;
    const angle1 = Math.PI / 4 + alpha;
    const angle2 = Math.PI / 4 - alpha;
    expect(svg).toContain(`x1="${cx + r * Math.cos(angle1)}"`);
    expect(svg).toContain(`y1="${headCy + r * Math.sin(angle1)}"`);
    expect(svg).toContain(`x2="${cx + r * Math.cos(angle2)}"`);
    expect(svg).toContain(`y2="${headCy + r * Math.sin(angle2)}"`);
  });

  it('renders the business actor label text', () => {
    const node = makeDNode({ symbol: 'actor-business', display: 'Manager', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('Manager');
  });
});

// ---------------------------------------------------------------------------
// UseCase node (from usecase/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — usecase node', () => {
  it('emits an <ellipse> element', () => {
    const node = makeDNode({ symbol: 'usecase', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('renders the usecase display label', () => {
    const node = makeDNode({ symbol: 'usecase', display: 'Login', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('Login');
  });

  it('uses theme border color for ellipse stroke', () => {
    const node = makeDNode({ symbol: 'usecase', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(defaultTheme.colors.border);
  });

  it('uses usecaseFill for ellipse fill', () => {
    const node = makeDNode({ symbol: 'usecase', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.usecaseFill}"`);
  });

  it('uses a custom usecaseFill when provided', () => {
    const customTheme = {
      ...defaultTheme,
      colors: { ...defaultTheme.colors, graph: { ...defaultTheme.colors.graph, usecaseFill: '#CCFFCC' } },
    };
    const node = makeDNode({ symbol: 'usecase', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), customTheme);
    expect(svg).toContain('fill="#CCFFCC"');
  });
});

// ---------------------------------------------------------------------------
// Business usecase node (from usecase/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — usecase-business node', () => {
  it('emits an <ellipse> element', () => {
    const node = makeDNode({ symbol: 'usecase-business', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<ellipse');
  });

  it('emits a diagonal <line> element across the ellipse interior', () => {
    const node = makeDNode({ symbol: 'usecase-business', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<line');
  });

  it('uses businessUsecaseFill for the ellipse fill', () => {
    const customTheme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: { ...defaultTheme.colors.graph, businessUsecaseFill: '#FFA500' },
      },
    };
    const node = makeDNode({ symbol: 'usecase-business', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), customTheme);
    expect(svg).toContain('fill="#FFA500"');
  });

  it('uses default businessUsecaseFill', () => {
    const node = makeDNode({ symbol: 'usecase-business', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.businessUsecaseFill}"`);
  });

  it('renders the business usecase label text', () => {
    const node = makeDNode({ symbol: 'usecase-business', display: 'Pay Invoice', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('Pay Invoice');
  });

  it('diagonal line endpoints lie within the ellipse bounding box', () => {
    const node = makeDNode({ symbol: 'usecase-business', x: 10, y: 10, width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    const linePattern =
      /<line[^/]*x1="([^"]+)"[^/]*y1="([^"]+)"[^/]*x2="([^"]+)"[^/]*y2="([^"]+)"/g;
    const matches = [...svg.matchAll(linePattern)];
    expect(matches.length).toBeGreaterThan(0);
    const withinBounds = matches.some((m) => {
      const x1 = parseFloat(m[1]!);
      const y1 = parseFloat(m[2]!);
      const x2 = parseFloat(m[3]!);
      const y2 = parseFloat(m[4]!);
      return x1 >= node.x && x1 <= node.x + node.width &&
             y1 >= node.y && y1 <= node.y + node.height &&
             x2 >= node.x && x2 <= node.x + node.width &&
             y2 >= node.y && y2 <= node.y + node.height;
    });
    expect(withinBounds).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Container node (from usecase/renderer.test.ts, rectangle kind)
// ---------------------------------------------------------------------------

describe('renderDescription — container node', () => {
  it('emits a <rect> for a rectangle container', () => {
    const node = makeDNode({ symbol: 'rectangle', display: 'System' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
  });

  it('renders the container label', () => {
    const node = makeDNode({ symbol: 'rectangle', display: 'System' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('System');
  });

  it('renders children inside a container', () => {
    const child = makeDNode({ id: 'c1', symbol: 'usecase', display: 'ChildUC', x: 160, y: 100, width: 120, height: 40 });
    const container = makeDNode({ symbol: 'rectangle', display: 'System', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('ChildUC');
  });

  it('uses solid stroke for rectangle container border', () => {
    const node = makeDNode({ symbol: 'rectangle', display: 'System' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('uses dashed stroke for package container border', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const node = makeDNode({ symbol: 'package', display: 'Pkg', children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('uses bold font for container label', () => {
    const node = makeDNode({ symbol: 'rectangle', display: 'System' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('font-weight="bold"');
  });
});

// ---------------------------------------------------------------------------
// D2 rect fallback — not-yet-drawn symbols
// ---------------------------------------------------------------------------

describe('renderDescription — D2 rect fallback', () => {
  it('hexagon symbol renders a rect with its label and does NOT throw', () => {
    const node = makeDNode({ symbol: 'hexagon', display: 'MyHex' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('MyHex');
  });

  it('person symbol renders a rect fallback', () => {
    const node = makeDNode({ symbol: 'person', display: 'Alice' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('Alice');
    expect(svg.trimStart()).toMatch(/^<svg/);
  });

  it('agent symbol renders a rect fallback without throwing', () => {
    const node = makeDNode({ symbol: 'agent', display: 'MyAgent' });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('MyAgent');
    expect(svg.trimStart()).toMatch(/^<svg/);
  });

  it('cloud leaf (no children) renders fallback rect', () => {
    const node = makeDNode({ symbol: 'cloud', display: 'AWS', children: [] });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('AWS');
    expect(svg.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// Edges — path format, dashed, arrowheads
// ---------------------------------------------------------------------------

describe('renderDescription — edges', () => {
  it('dashed edge has stroke-dasharray in SVG', () => {
    const edge = makeEdge({ dashed: true });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('solid edge path elements do NOT have stroke-dasharray', () => {
    const edge = makeEdge({ dashed: false });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    const pathMatches = svg.match(/<path[^/]*/g) ?? [];
    expect(pathMatches.some((p) => !p.includes('stroke-dasharray'))).toBe(true);
  });

  it('2-point edge produces L polyline (graceful fallback for < 4 points)', () => {
    const edge = makeEdge({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('M 0,0');
    expect(svg).toContain('L 100,0');
  });

  it('3-point edge produces polyline fallback (rest.length=2 < 3)', () => {
    const edge = makeEdge({
      points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }],
    });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('M 0,0');
    expect(svg).toContain('L 50,0');
    expect(svg).toContain('L 50,100');
  });

  it('4-point edge (1 bezier segment) emits a C cubic bezier command', () => {
    const edge = makeEdge({
      points: [
        { x: 0, y: 0 },   // start
        { x: 30, y: 10 }, // cp1
        { x: 70, y: 10 }, // cp2
        { x: 100, y: 0 }, // end
      ],
    });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('M 0,0');
    expect(svg).toContain('C 30,10 70,10 100,0');
  });

  it('7-point edge (2 bezier segments) emits two C commands', () => {
    const edge = makeEdge({
      points: [
        { x: 0,   y: 0 },
        { x: 20,  y: 10 },
        { x: 40,  y: 10 },
        { x: 60,  y: 0 },
        { x: 80,  y: -10 },
        { x: 90,  y: -10 },
        { x: 100, y: 0 },
      ],
    });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('M 0,0');
    const cCommands = (svg.match(/C /g) ?? []).length;
    expect(cCommands).toBeGreaterThanOrEqual(2);
  });

  it('edge with 8 points (2 bezier + 1 leftover) uses L for leftover point', () => {
    const edge = makeEdge({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 5 }, { x: 20, y: 5 }, { x: 30, y: 0 },
        { x: 40, y: 5 }, { x: 50, y: 5 }, { x: 60, y: 0 },
        { x: 80, y: 0 }, // leftover
      ],
    });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('M 0,0');
    expect(svg).toContain('L 80,0');
  });

  it('edge uses theme arrow color', () => {
    const svg = renderDescription(makeGeo({ edges: [makeEdge()] }), defaultTheme);
    expect(svg).toContain(`stroke="${defaultTheme.colors.arrow}"`);
  });

  it('edge with label renders label text', () => {
    const edge = makeEdge({ label: { text: 'uses', x: 80, y: 45 } });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('uses');
  });

  it('edge with zero points produces no extra path output but SVG remains valid', () => {
    const edge = makeEdge({ points: [] });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });

  it('edge with one point produces valid SVG', () => {
    const edge = makeEdge({ points: [{ x: 10, y: 10 }] });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// Edge arrowHead variants (from component/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — edge arrowHead variants', () => {
  it('arrowHead "none" produces an edge with no marker-end on path elements', () => {
    const edge = makeEdge({ arrowHead: 'none' });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    const pathMatches = svg.match(/<path[^/]*/g) ?? [];
    const edgePaths = pathMatches.filter((p) => p.includes('stroke'));
    expect(edgePaths.some((p) => p.includes('marker-end'))).toBe(false);
  });

  it('arrowHead "filled" produces a filled sync arrow marker', () => {
    const edge = makeEdge({ arrowHead: 'filled' });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('sync');
  });

  it('arrowHead "open" produces a dependency arrow marker', () => {
    const edge = makeEdge({ arrowHead: 'open' });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('dependency');
  });
});

// ---------------------------------------------------------------------------
// Edge stereotype (from usecase/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — edge stereotype', () => {
  it('emits «include» text for an edge with stereotype="include"', () => {
    const edge = makeEdge({ stereotype: 'include' });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('«include»');
  });

  it('emits «extend» text for an edge with stereotype="extend"', () => {
    const edge = makeEdge({ stereotype: 'extend' });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('«extend»');
  });

  it('<<include>> link renders a dashed connector with «include» label when combined', () => {
    const edge = makeEdge({ dashed: true, stereotype: 'include' });
    const svg = renderDescription(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('«include»');
  });
});

// ---------------------------------------------------------------------------
// Theme propagation (from component/renderer.test.ts integration section)
// ---------------------------------------------------------------------------

describe('renderDescription — theme propagation', () => {
  it('default vs dark theme use different background colors', () => {
    const node = makeDNode({ symbol: 'component', display: 'ServiceA' });
    const svgDefault = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    const svgDark = renderDescription(makeGeo({ nodes: [node] }), darkTheme);
    expect(svgDefault).toContain(defaultTheme.colors.background);
    expect(svgDark).toContain(darkTheme.colors.background);
    expect(svgDefault).not.toContain(darkTheme.colors.background);
  });
});

// ---------------------------------------------------------------------------
// LaTeX labels (from usecase/renderer.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — LaTeX labels', () => {
  it('usecase node with latex display emits <foreignObject and <math', () => {
    const node = makeDNode({ symbol: 'usecase', display: '<latex>\\epsilon_0</latex>', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<foreignObject');
    expect(svg).toContain('<math');
  });

  it('actor node with latex display emits <foreignObject', () => {
    const node = makeDNode({ symbol: 'actor', display: '<latex>x^2</latex>', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<foreignObject');
  });

  it('usecase node with plain display uses <text, not <foreignObject', () => {
    const node = makeDNode({ symbol: 'usecase', display: 'Login', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<text');
    expect(svg).not.toContain('<foreignObject');
  });

  it('actor-business node with latex display emits <foreignObject', () => {
    const node = makeDNode({ symbol: 'actor-business', display: '<latex>\\alpha</latex>', width: 50, height: 70 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<foreignObject');
  });

  it('usecase-business node with latex display emits <foreignObject', () => {
    const node = makeDNode({ symbol: 'usecase-business', display: '<latex>E=mc^2</latex>', width: 120, height: 40 });
    const svg = renderDescription(makeGeo({ nodes: [node] }), defaultTheme);
    expect(svg).toContain('<foreignObject');
  });
});
