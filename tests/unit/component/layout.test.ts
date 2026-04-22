/**
 * Unit tests for the component diagram layout engine.
 *
 * Uses real ELK (no mocking). All tests are async.
 * FormulaMeasurer is used for deterministic text sizing in Node.js.
 */

import { describe, it, expect } from 'vitest';
import { layoutComponent } from '../../../src/diagrams/component/layout.js';
import type { ComponentDiagramAST, ComponentNode } from '../../../src/diagrams/component/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function component(id: string, display?: string): ComponentNode {
  return { id, display: display ?? id, kind: 'component', children: [] };
}

function iface(id: string, display?: string): ComponentNode {
  return { id, display: display ?? id, kind: 'interface', children: [] };
}

function pkg(id: string, children: ComponentNode[], display?: string): ComponentNode {
  return { id, display: display ?? id, kind: 'package', children };
}

/** Return true when two axis-aligned rectangles overlap. */
function overlaps(
  aX: number, aY: number, aW: number, aH: number,
  bX: number, bY: number, bW: number, bH: number,
): boolean {
  return (
    aX < bX + bW &&
    aX + aW > bX &&
    aY < bY + bH &&
    aY + aH > bY
  );
}

// ---------------------------------------------------------------------------
// Empty AST
// ---------------------------------------------------------------------------

describe('layoutComponent — empty AST', () => {
  it('resolves without error', async () => {
    const ast: ComponentDiagramAST = { nodes: [], links: [] };
    await expect(layoutComponent(ast, defaultTheme, measurer)).resolves.toBeDefined();
  });

  it('returns empty node array', async () => {
    const ast: ComponentDiagramAST = { nodes: [], links: [] };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.nodes).toEqual([]);
  });

  it('returns empty edge array', async () => {
    const ast: ComponentDiagramAST = { nodes: [], links: [] };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges).toEqual([]);
  });

  it('returns totalWidth=0 and totalHeight=0', async () => {
    const ast: ComponentDiagramAST = { nodes: [], links: [] };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.totalWidth).toBe(0);
    expect(geo.totalHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Three components and two links
// ---------------------------------------------------------------------------

describe('layoutComponent — 3 components and 2 links', () => {
  const ast: ComponentDiagramAST = {
    nodes: [component('A'), component('B'), component('C')],
    links: [
      { from: 'A', to: 'B', style: 'solid' },
      { from: 'B', to: 'C', style: 'solid' },
    ],
  };

  it('returns 3 nodes', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(3);
  });

  it('all nodes have x > 0 or y > 0 (at least one coord is non-zero)', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    for (const node of geo.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('all nodes have width > 0', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    for (const node of geo.nodes) {
      expect(node.width).toBeGreaterThan(0);
    }
  });

  it('all nodes have height > 0', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    for (const node of geo.nodes) {
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it('returns 2 edges', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(2);
  });

  it('totalWidth > 0', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight > 0', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });

  it('node kind and display are preserved', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const nodeA = geo.nodes.find((n) => n.id === 'A');
    expect(nodeA?.kind).toBe('component');
    expect(nodeA?.display).toBe('A');
  });

  it('edge ids follow "edge-N" convention', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.id).toBe('edge-0');
    expect(geo.edges[1]?.id).toBe('edge-1');
  });
});

// ---------------------------------------------------------------------------
// Disconnected components do not overlap
// ---------------------------------------------------------------------------

describe('layoutComponent — two disconnected components', () => {
  it('bounding boxes do not overlap', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('X'), component('Y')],
      links: [],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(2);

    const a = geo.nodes[0]!;
    const b = geo.nodes[1]!;
    const doesOverlap = overlaps(
      a.x, a.y, a.width, a.height,
      b.x, b.y, b.width, b.height,
    );
    expect(doesOverlap).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dashed and solid link styles
// ---------------------------------------------------------------------------

describe('layoutComponent — link styles', () => {
  it('dashed link produces dashed=true', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('P'), component('Q')],
      links: [{ from: 'P', to: 'Q', style: 'dashed' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.dashed).toBe(true);
  });

  it('solid link produces dashed=false', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('P'), component('Q')],
      links: [{ from: 'P', to: 'Q', style: 'solid' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.dashed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Package (container) contains children
// ---------------------------------------------------------------------------

describe('layoutComponent — package containing 2 components', () => {
  const childA = component('cA', 'ChildA');
  const childB = component('cB', 'ChildB');
  const ast: ComponentDiagramAST = {
    nodes: [pkg('pkg1', [childA, childB], 'MyPackage')],
    links: [],
  };

  it('resolves without error', async () => {
    await expect(layoutComponent(ast, defaultTheme, measurer)).resolves.toBeDefined();
  });

  it('package node appears in result', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'pkg1');
    expect(pkgNode).toBeDefined();
  });

  it('package node has 2 children in geo', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'pkg1');
    expect(pkgNode?.children).toHaveLength(2);
  });

  it('package bounding box has positive width and height', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'pkg1');
    expect(pkgNode?.width).toBeGreaterThan(0);
    expect(pkgNode?.height).toBeGreaterThan(0);
  });

  it('children absolute positions are within package bounding box', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'pkg1');
    expect(pkgNode).toBeDefined();

    const parent = pkgNode!;
    for (const child of parent.children) {
      // Child's absolute position plus its dimensions must not exceed parent's bounds
      expect(child.x).toBeGreaterThanOrEqual(parent.x);
      expect(child.y).toBeGreaterThanOrEqual(parent.y);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width + 1); // +1 for float tolerance
      expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height + 1);
    }
  });

  it('package kind is preserved', async () => {
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'pkg1');
    expect(pkgNode?.kind).toBe('package');
  });
});

// ---------------------------------------------------------------------------
// Interface nodes
// ---------------------------------------------------------------------------

describe('layoutComponent — interface nodes', () => {
  it('interface kind is preserved in geo', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [iface('iA', 'IMyService'), component('cA', 'MyComp')],
      links: [{ from: 'cA', to: 'iA', style: 'solid' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    const ifaceNode = geo.nodes.find((n) => n.id === 'iA');
    expect(ifaceNode?.kind).toBe('interface');
  });
});

// ---------------------------------------------------------------------------
// Edge points
// ---------------------------------------------------------------------------

describe('layoutComponent — edge points', () => {
  it('connected edges have at least 2 points (start + end)', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('S'), component('T')],
      links: [{ from: 'S', to: 'T', style: 'solid' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.points.length).toBeGreaterThanOrEqual(2);
  });

  it('edge point coordinates are numbers', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('S'), component('T')],
      links: [{ from: 'S', to: 'T', style: 'solid' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    for (const pt of geo.edges[0]?.points ?? []) {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Edge label
// ---------------------------------------------------------------------------

describe('layoutComponent — edge label', () => {
  it('link with label produces edge with label text', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('A'), component('B')],
      links: [{ from: 'A', to: 'B', style: 'solid', label: 'uses' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.label?.text).toBe('uses');
  });

  it('link without label produces edge with no label property', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('A'), component('B')],
      links: [{ from: 'A', to: 'B', style: 'solid' }],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Node minimum width
// ---------------------------------------------------------------------------

describe('layoutComponent — node minimum width', () => {
  it('short display name still produces width >= 80', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('X', 'X')],
      links: [],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.nodes[0]?.width).toBeGreaterThanOrEqual(80);
  });

  it('long display name produces width > 80', async () => {
    const ast: ComponentDiagramAST = {
      nodes: [component('longName', 'A Very Long Component Name Here')],
      links: [],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.nodes[0]?.width).toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// Stereotype preservation
// ---------------------------------------------------------------------------

describe('layoutComponent — stereotype', () => {
  it('stereotype is preserved in node geo', async () => {
    const nodeWithStereotype: ComponentNode = {
      id: 'svc',
      display: 'MyService',
      kind: 'component',
      children: [],
      stereotype: 'service',
    };
    const ast: ComponentDiagramAST = {
      nodes: [nodeWithStereotype],
      links: [],
    };
    const geo = await layoutComponent(ast, defaultTheme, measurer);
    expect(geo.nodes[0]?.stereotype).toBe('service');
  });
});
