/**
 * Unit tests for the unified description diagram layout engine.
 *
 * Migrated and merged from:
 *   tests/unit/component/layout.test.ts  (33 cases)
 *   tests/unit/usecase/layout.test.ts    (38 cases)
 *
 * Key changes from the old per-diagram suites:
 *   - `kind` property → `symbol` (same values, different field name)
 *   - `business-actor` → `actor-business`
 *   - `business-usecase` → `usecase-business`
 *   - DescriptiveNode / DescriptionDiagramAST replace the per-diagram types
 *   - Edges now always carry `from` and `to`; `arrowHead` is optional
 */

import { describe, it, expect } from 'vitest';
import { layoutDescription } from '../../../src/diagrams/description/layout.js';
import type {
  DescriptionDiagramAST,
  DescriptiveNode,
  DescriptiveLink,
} from '../../../src/diagrams/description/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer, FixedMeasurer } from '../../../src/core/measurer.js';
import type { StringMeasurer } from '../../../src/core/measurer.js';
import { measureLatex } from '../../../src/core/latex.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import { parseDescription } from '../../../src/diagrams/description/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

const measurer = new FormulaMeasurer();

// ---------------------------------------------------------------------------
// Node / link factory helpers
// ---------------------------------------------------------------------------

function node(
  id: string,
  symbol: DescriptiveNode['symbol'],
  display = id,
  children: DescriptiveNode[] = [],
  stereotype?: string,
): DescriptiveNode {
  const n: DescriptiveNode = { id, display, symbol, children };
  if (stereotype !== undefined) n.stereotype = stereotype;
  return n;
}

function comp(id: string, display = id): DescriptiveNode {
  return node(id, 'component', display);
}

function iface(id: string, display = id): DescriptiveNode {
  return node(id, 'interface', display);
}

function pkg(id: string, children: DescriptiveNode[], display = id): DescriptiveNode {
  return node(id, 'package', display, children);
}

function actor(id: string, display = id): DescriptiveNode {
  return node(id, 'actor', display);
}

function usecase(id: string, display = id): DescriptiveNode {
  return node(id, 'usecase', display);
}

function container(
  id: string,
  symbol: DescriptiveNode['symbol'],
  children: DescriptiveNode[],
): DescriptiveNode {
  return node(id, symbol, id, children);
}

// `length` defaults to 2 (upstream `-->`/`--`/`..`/`..>` are all length-2
// arrows) since most tests here don't exercise the nodesep/ranksep dzeta
// computation — only the dedicated "graph spacing" suite below cares about it.
function solid(from: string, to: string, label?: string, length = 2): DescriptiveLink {
  return {
    from,
    to,
    style: 'solid',
    length,
    ...(label !== undefined ? { label } : {}),
  };
}

function dashed(
  from: string,
  to: string,
  stereotype?: string,
  label?: string,
  length = 2,
): DescriptiveLink {
  return {
    from,
    to,
    style: 'dashed',
    length,
    ...(stereotype !== undefined ? { stereotype } : {}),
    ...(label !== undefined ? { label } : {}),
  };
}

function makeAst(
  nodes: DescriptiveNode[],
  links: DescriptiveLink[],
): DescriptionDiagramAST {
  return { nodes, links };
}

/** True when two axis-aligned rectangles overlap. */
function overlaps(
  aX: number, aY: number, aW: number, aH: number,
  bX: number, bY: number, bW: number, bH: number,
): boolean {
  return aX < bX + bW && aX + aW > bX && aY < bY + bH && aY + aH > bY;
}

/** Capture the DotInputGraph layoutDescription hands to layoutGraph(). */
function captureGraphInput(
  ast: DescriptionDiagramAST,
  m: StringMeasurer = measurer,
): DotInputGraph {
  let captured: DotInputGraph | undefined;
  setLayoutInputObserver((g) => { captured = g; });
  try {
    layoutDescription(ast, defaultTheme, m);
  } finally {
    setLayoutInputObserver(undefined);
  }
  if (captured === undefined) throw new Error('layout input was not captured');
  return captured;
}

// ===========================================================================
// ── FROM COMPONENT SUITE (33 cases) ─────────────────────────────────────────
// ===========================================================================

// ---------------------------------------------------------------------------
// Empty AST
// ---------------------------------------------------------------------------

describe('layoutDescription — empty AST', () => {
  const ast = makeAst([], []);

  it('returns geometry without error', () => {
    expect(layoutDescription(ast, defaultTheme, measurer)).toBeDefined();
  });

  it('returns empty node array', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).nodes).toEqual([]);
  });

  it('returns empty edge array', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).edges).toEqual([]);
  });

  it('returns totalWidth=0 and totalHeight=0', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.totalWidth).toBe(0);
    expect(geo.totalHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Three components and two links
// ---------------------------------------------------------------------------

describe('layoutDescription — 3 components and 2 links', () => {
  const ast = makeAst(
    [comp('A'), comp('B'), comp('C')],
    [solid('A', 'B'), solid('B', 'C')],
  );

  it('returns 3 nodes', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).nodes).toHaveLength(3);
  });

  it('all nodes have non-negative x and y', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    for (const n of geo.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('all nodes have width > 0', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    for (const n of geo.nodes) expect(n.width).toBeGreaterThan(0);
  });

  it('all nodes have height > 0', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    for (const n of geo.nodes) expect(n.height).toBeGreaterThan(0);
  });

  it('returns 2 edges', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).edges).toHaveLength(2);
  });

  it('totalWidth > 0', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight > 0', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).totalHeight).toBeGreaterThan(0);
  });

  it('node symbol and display are preserved', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const nodeA = geo.nodes.find((n) => n.id === 'A');
    expect(nodeA?.symbol).toBe('component');
    expect(nodeA?.display).toBe('A');
  });

  it('edge ids follow "edge-N" convention', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.id).toBe('edge-0');
    expect(geo.edges[1]?.id).toBe('edge-1');
  });
});

// ---------------------------------------------------------------------------
// Disconnected components do not overlap
// ---------------------------------------------------------------------------

describe('layoutDescription — two disconnected box nodes', () => {
  it('bounding boxes do not overlap', () => {
    const ast = makeAst([comp('X'), comp('Y')], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(2);
    const a = geo.nodes[0]!;
    const b = geo.nodes[1]!;
    expect(overlaps(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dashed and solid link styles
// ---------------------------------------------------------------------------

describe('layoutDescription — link styles', () => {
  it('dashed link produces dashed=true', () => {
    const ast = makeAst([comp('P'), comp('Q')], [dashed('P', 'Q')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.dashed).toBe(true);
  });

  it('solid link produces dashed=false', () => {
    const ast = makeAst([comp('P'), comp('Q')], [solid('P', 'Q')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.dashed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Package (container) contains children
// ---------------------------------------------------------------------------

describe('layoutDescription — package containing 2 components', () => {
  const ast = makeAst([pkg('pkg1', [comp('cA', 'ChildA'), comp('cB', 'ChildB')], 'MyPackage')], []);

  it('returns geometry without error', () => {
    expect(layoutDescription(ast, defaultTheme, measurer)).toBeDefined();
  });

  it('package node appears in result', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'pkg1')).toBeDefined();
  });

  it('package node has 2 children in geo', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'pkg1')?.children).toHaveLength(2);
  });

  it('package bounding box has positive width and height', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const p = geo.nodes.find((n) => n.id === 'pkg1')!;
    expect(p.width).toBeGreaterThan(0);
    expect(p.height).toBeGreaterThan(0);
  });

  it('children absolute positions are within package bounding box', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const parent = geo.nodes.find((n) => n.id === 'pkg1')!;
    for (const child of parent.children) {
      expect(child.x).toBeGreaterThanOrEqual(parent.x);
      expect(child.y).toBeGreaterThanOrEqual(parent.y);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width + 1);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height + 1);
    }
  });

  it('package symbol is preserved', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'pkg1')?.symbol).toBe('package');
  });
});

// ---------------------------------------------------------------------------
// Interface node
// ---------------------------------------------------------------------------

describe('layoutDescription — interface node', () => {
  it('interface symbol is preserved in geo', () => {
    const ast = makeAst(
      [iface('iA', 'IMyService'), comp('cA', 'MyComp')],
      [solid('cA', 'iA')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'iA')?.symbol).toBe('interface');
  });
});

// ---------------------------------------------------------------------------
// Edge points
// ---------------------------------------------------------------------------

describe('layoutDescription — edge points', () => {
  it('connected edges have at least 2 points', () => {
    const ast = makeAst([comp('S'), comp('T')], [solid('S', 'T')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.points.length)
      .toBeGreaterThanOrEqual(2);
  });

  it('edge point coordinates are numbers', () => {
    const ast = makeAst([comp('S'), comp('T')], [solid('S', 'T')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    for (const pt of geo.edges[0]?.points ?? []) {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Edge label
// ---------------------------------------------------------------------------

describe('layoutDescription — edge label', () => {
  it('link with label produces edge with label text', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B', 'uses')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.label?.text).toBe('uses');
  });

  it('link without label produces edge with no label property', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.label).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Box node minimum width
// ---------------------------------------------------------------------------

describe('layoutDescription — box node minimum width', () => {
  it('short display name still produces width >= 80', () => {
    const ast = makeAst([comp('X', 'X')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.width)
      .toBeGreaterThanOrEqual(80);
  });

  it('long display name produces width > 80', () => {
    const ast = makeAst([comp('longName', 'A Very Long Component Name Here')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.width)
      .toBeGreaterThan(80);
  });
});

// ---------------------------------------------------------------------------
// Stereotype preservation
// ---------------------------------------------------------------------------

describe('layoutDescription — stereotype on box node', () => {
  it('stereotype is preserved in node geo', () => {
    const ast = makeAst([node('svc', 'component', 'MyService', [], 'service')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toBe('service');
  });
});

// ---------------------------------------------------------------------------
// Coordinate normalisation
// ---------------------------------------------------------------------------

describe('layoutDescription — coordinate normalisation', () => {
  it('package container has non-negative x and y', () => {
    const ast = makeAst([pkg('p', [comp('A'), comp('B')], 'MyPkg')], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'p')!;
    expect(pkgNode.x).toBeGreaterThanOrEqual(0);
    expect(pkgNode.y).toBeGreaterThanOrEqual(0);
  });

  it('totalWidth and totalHeight include container extents', () => {
    const ast = makeAst([pkg('p', [comp('A')], 'MyPkg')], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const pkgNode = geo.nodes.find((n) => n.id === 'p')!;
    expect(geo.totalWidth).toBeGreaterThanOrEqual(pkgNode.x + pkgNode.width);
    expect(geo.totalHeight).toBeGreaterThanOrEqual(pkgNode.y + pkgNode.height);
  });

  it('canonical component diagram: all top-level nodes have non-negative coords', () => {
    const ast = makeAst(
      [
        pkg('Frontend', [comp('Browser', 'Web Browser'), comp('Mobile', 'Mobile App')], 'Frontend'),
        pkg('Backend', [comp('API', 'API Gateway'), comp('Auth', 'Auth Service'), comp('Data', 'Data Service')], 'Backend'),
        node('DB', 'database', 'PostgreSQL'),
      ],
      [
        solid('Browser', 'API'), solid('Mobile', 'API'),
        solid('API', 'Auth'), solid('API', 'Data'), solid('Data', 'DB'),
      ],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    for (const n of geo.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
    }
  });
});

// ===========================================================================
// ── FROM USECASE SUITE (38 cases) ────────────────────────────────────────────
// ===========================================================================

// ---------------------------------------------------------------------------
// AC 1 — basic actor + usecase diagram
// ---------------------------------------------------------------------------

describe('layoutDescription — basic actor+usecase diagram (AC 1)', () => {
  const ast = makeAst(
    [actor('user', 'User'), actor('admin', 'Admin'),
     usecase('login', 'Login'), usecase('logout', 'Logout'), usecase('manage', 'Manage Users')],
    [solid('user', 'login'), solid('user', 'logout'), solid('admin', 'manage')],
  );

  it('all node geos have positive x, y, width, height', () => {
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(5);
    for (const n of geo.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.y).toBeGreaterThan(0);
      expect(n.width).toBeGreaterThan(0);
      expect(n.height).toBeGreaterThan(0);
    }
  });

  it('produces 3 edges for 3 links', () => {
    expect(layoutDescription(ast, defaultTheme, measurer).edges).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — dashed link with stereotype (<<include>>)
// ---------------------------------------------------------------------------

describe('layoutDescription — dashed link with stereotype (AC 2)', () => {
  it('<<include>> link produces dashed=true and stereotype="include"', () => {
    const ast = makeAst([usecase('c', 'Checkout'), usecase('p', 'Pay')], [dashed('c', 'p', 'include')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.dashed).toBe(true);
    expect(geo.edges[0]?.stereotype).toBe('include');
  });

  it('dashed link without stereotype has no stereotype field', () => {
    const ast = makeAst([usecase('a', 'A'), usecase('b', 'B')], [dashed('a', 'b')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.stereotype).toBeUndefined();
  });

  it('solid link produces dashed=false', () => {
    const ast = makeAst([actor('u', 'User'), usecase('uc', 'Use')], [solid('u', 'uc')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.dashed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — rectangle container with use cases
// ---------------------------------------------------------------------------

describe('layoutDescription — container nodes (AC 3)', () => {
  it('container node encompasses both children', () => {
    const ast = makeAst([container('shopping', 'rectangle', [usecase('uc1', 'Order'), usecase('uc2', 'Track')])], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const c = geo.nodes[0]!;
    expect(c.children).toHaveLength(2);
    for (const child of c.children) {
      expect(child.x + child.width).toBeLessThanOrEqual(c.x + c.width + 1);
      expect(child.y + child.height).toBeLessThanOrEqual(c.y + c.height + 1);
    }
  });

  it('container geometry has positive dimensions', () => {
    const ast = makeAst([container('box', 'rectangle', [usecase('u1', 'UseA'), usecase('u2', 'UseB')])], []);
    const c = layoutDescription(ast, defaultTheme, measurer).nodes[0]!;
    expect(c.width).toBeGreaterThan(0);
    expect(c.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — actor fixed size
// ---------------------------------------------------------------------------

describe('layoutDescription — actor sizing (AC 4)', () => {
  it('actor geo has width=50 and height=70', () => {
    const ast = makeAst([actor('u', 'User')], []);
    const actorGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'u')!;
    expect(actorGeo.width).toBe(50);
    expect(actorGeo.height).toBe(70);
  });

  it('multiple actors all have fixed size 50×70', () => {
    const ast = makeAst([actor('a1', 'Alice'), actor('a2', 'Bob'), actor('a3', 'Charlie')], []);
    for (const n of layoutDescription(ast, defaultTheme, measurer).nodes) {
      expect(n.width).toBe(50);
      expect(n.height).toBe(70);
    }
  });
});

// ---------------------------------------------------------------------------
// AC 5 — usecase ellipse sizing
// ---------------------------------------------------------------------------

describe('layoutDescription — usecase sizing (AC 5)', () => {
  it('usecase with short display has width >= height (ellipse not degenerate)', () => {
    const ast = makeAst([usecase('uc', 'Hi')], []);
    const ucGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBeGreaterThanOrEqual(ucGeo.height);
  });

  it('usecase with long display has width > 120', () => {
    const ast = makeAst([usecase('uc', 'This is a very long use case display text')], []);
    const ucGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBeGreaterThan(120);
  });
});

// ---------------------------------------------------------------------------
// Edge from/to and id (usecase-specific checks)
// ---------------------------------------------------------------------------

describe('layoutDescription — edge from/to', () => {
  it('edge preserves from and to from the link', () => {
    const ast = makeAst([actor('u', 'User'), usecase('uc', 'Do Something')], [solid('u', 'uc')]);
    const edge = layoutDescription(ast, defaultTheme, measurer).edges[0]!;
    expect(edge.from).toBe('u');
    expect(edge.to).toBe('uc');
  });

  it('edge id follows "edge-N" pattern', () => {
    const ast = makeAst([actor('a', 'A'), usecase('b', 'B'), usecase('c', 'C')], [solid('a', 'b'), solid('a', 'c')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges[0]?.id).toBe('edge-0');
    expect(geo.edges[1]?.id).toBe('edge-1');
  });
});

// ---------------------------------------------------------------------------
// Node stereotype
// ---------------------------------------------------------------------------

describe('layoutDescription — node stereotype', () => {
  it('rectangle node stereotype is preserved', () => {
    const ast = makeAst([node('sys', 'rectangle', 'System', [], 'system')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toBe('system');
  });

  it('node without stereotype has no stereotype field', () => {
    const ast = makeAst([actor('u', 'User')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Diagram dimensions
// ---------------------------------------------------------------------------

describe('layoutDescription — diagram dimensions', () => {
  it('totalWidth > 0 for non-empty diagram', () => {
    const ast = makeAst([actor('u', 'User'), usecase('uc', 'Login')], [solid('u', 'uc')]);
    expect(layoutDescription(ast, defaultTheme, measurer).totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight > 0 for non-empty diagram', () => {
    const ast = makeAst([actor('u', 'User'), usecase('uc', 'Login')], [solid('u', 'uc')]);
    expect(layoutDescription(ast, defaultTheme, measurer).totalHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Package container with use-case children
// ---------------------------------------------------------------------------

describe('layoutDescription — package container (use-case children)', () => {
  it('package container with children returns children in node geo', () => {
    const ast = makeAst(
      [container('pkg', 'package', [usecase('uc1', 'Feature A'), usecase('uc2', 'Feature B')])],
      [],
    );
    const pkgGeo = layoutDescription(ast, defaultTheme, measurer).nodes[0]!;
    expect(pkgGeo.symbol).toBe('package');
    expect(pkgGeo.children).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// <<extend>> stereotype
// ---------------------------------------------------------------------------

describe('layoutDescription — extend stereotype', () => {
  it('<<extend>> link produces dashed=true and stereotype="extend"', () => {
    const ast = makeAst(
      [usecase('base', 'Base Flow'), usecase('ext', 'Extended Flow')],
      [dashed('ext', 'base', 'extend')],
    );
    const edge = layoutDescription(ast, defaultTheme, measurer).edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('extend');
  });
});

// ---------------------------------------------------------------------------
// AC 7 — actor outside container
// ---------------------------------------------------------------------------

describe('layoutDescription — actor outside container (AC 7)', () => {
  it('top-level actor and sibling container are laid out without overlap', () => {
    const ast = makeAst(
      [actor('u', 'User'), container('sys', 'rectangle', [usecase('uc1', 'Login')])],
      [solid('u', 'uc1')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const actorGeo = geo.nodes.find((n) => n.id === 'u')!;
    const containerGeo = geo.nodes.find((n) => n.id === 'sys')!;
    // Default rankdir is TB (upstream default; no explicit `left to right
    // direction`), so the actor (rank 0, connects into the container) is
    // placed above the container rather than to its left.
    expect(
      overlaps(
        actorGeo.x, actorGeo.y, actorGeo.width, actorGeo.height,
        containerGeo.x, containerGeo.y, containerGeo.width, containerGeo.height,
      ),
    ).toBe(false);
    expect(actorGeo.y + actorGeo.height).toBeLessThanOrEqual(containerGeo.y);
  });

  it('two top-level actors are both above a sibling container (TB default)', () => {
    const ast = makeAst(
      [
        actor('c', 'Customer'), actor('sa', 'Support Agent'),
        container('sys', 'rectangle', [usecase('uc1', 'Browse'), usecase('uc2', 'Checkout'), usecase('uc3', 'Track')]),
      ],
      [solid('c', 'uc1'), solid('c', 'uc2'), solid('sa', 'uc3')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const containerGeo = geo.nodes.find((n) => n.id === 'sys')!;
    const customerGeo = geo.nodes.find((n) => n.id === 'c')!;
    const agentGeo = geo.nodes.find((n) => n.id === 'sa')!;
    expect(customerGeo.y + customerGeo.height).toBeLessThanOrEqual(containerGeo.y);
    expect(agentGeo.y + agentGeo.height).toBeLessThanOrEqual(containerGeo.y);
  });

  it('children remain inside container bounds after positioning', () => {
    const ast = makeAst(
      [actor('u', 'User'), container('sys', 'rectangle', [usecase('uc1', 'Login')])],
      [solid('u', 'uc1')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const containerGeo = geo.nodes.find((n) => n.id === 'sys')!;
    for (const child of containerGeo.children) {
      expect(child.x).toBeGreaterThanOrEqual(containerGeo.x);
      expect(child.y).toBeGreaterThanOrEqual(containerGeo.y);
      expect(child.x + child.width).toBeLessThanOrEqual(containerGeo.x + containerGeo.width + 1);
      expect(child.y + child.height).toBeLessThanOrEqual(containerGeo.y + containerGeo.height + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge label (usecase variant)
// ---------------------------------------------------------------------------

describe('layoutDescription — edge label (usecase variant)', () => {
  it('solid link with label has label geometry attached', () => {
    const ast = makeAst([actor('u', 'User'), usecase('uc', 'Login')], [solid('u', 'uc', 'uses')]);
    const edge = layoutDescription(ast, defaultTheme, measurer).edges[0]!;
    expect(edge.label).toBeDefined();
    expect(edge.label!.text).toBe('uses');
    expect(typeof edge.label!.x).toBe('number');
    expect(typeof edge.label!.y).toBe('number');
  });

  it('dashed link with label and stereotype produces both fields', () => {
    const ast = makeAst([usecase('a', 'Order'), usecase('b', 'Pay')], [dashed('a', 'b', 'include', 'step')]);
    const edge = layoutDescription(ast, defaultTheme, measurer).edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('include');
    expect(edge.label?.text).toBe('step');
  });
});

// ---------------------------------------------------------------------------
// Intra-container edges
// ---------------------------------------------------------------------------

describe('layoutDescription — intra-container edges', () => {
  it('edge between two nodes inside same container is included', () => {
    const ast = makeAst(
      [container('sys', 'rectangle', [usecase('uc1', 'Checkout'), usecase('uc2', 'Apply Discount')])],
      [dashed('uc1', 'uc2', 'extend')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(1);
    const edge = geo.edges[0]!;
    expect(edge.from).toBe('uc1');
    expect(edge.to).toBe('uc2');
    expect(edge.points.length).toBeGreaterThanOrEqual(2);
  });

  it('intra-container edge endpoints have positive coordinates', () => {
    const ast = makeAst(
      [container('sys', 'rectangle', [usecase('uc1', 'Browse'), usecase('uc2', 'Filter')])],
      [solid('uc1', 'uc2')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    for (const pt of geo.edges[0]?.points ?? []) {
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.y).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Leaf node stereotype (actor / usecase with stereotype)
// ---------------------------------------------------------------------------

describe('layoutDescription — leaf node stereotype', () => {
  it('usecase with stereotype preserves it in node geo', () => {
    const ast = makeAst([node('uc', 'usecase', 'Pay', [], 'boundary')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toBe('boundary');
  });

  it('actor with stereotype preserves it in node geo', () => {
    const ast = makeAst([node('a', 'actor', 'Admin', [], 'system')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// Nested containers
// ---------------------------------------------------------------------------

describe('layoutDescription — nested containers', () => {
  it('container nested inside another container has children geos', () => {
    const inner = container('inner', 'package', [usecase('uc1', 'Do Something')]);
    const outer = container('outer', 'rectangle', [inner]);
    const geo = layoutDescription(makeAst([outer], []), defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    const outerGeo = geo.nodes[0]!;
    expect(outerGeo.id).toBe('outer');
    expect(outerGeo.children).toHaveLength(1);

    const innerGeo = outerGeo.children[0]!;
    expect(innerGeo.id).toBe('inner');
    expect(innerGeo.children).toHaveLength(1);
    expect(innerGeo.children[0]!.id).toBe('uc1');
  });

  it('all nodes in nested container have positive coordinates', () => {
    const inner = container('inner', 'package', [usecase('uc1', 'Feature')]);
    const outer = container('outer', 'rectangle', [inner]);
    const geo = layoutDescription(makeAst([outer], []), defaultTheme, measurer);

    const outerGeo = geo.nodes[0]!;
    const innerGeo = outerGeo.children[0]!;
    const ucGeo = innerGeo.children[0]!;

    expect(outerGeo.x).toBeGreaterThan(0);
    expect(outerGeo.y).toBeGreaterThan(0);
    expect(innerGeo.x).toBeGreaterThan(0);
    expect(innerGeo.y).toBeGreaterThan(0);
    expect(ucGeo.x).toBeGreaterThan(0);
    expect(ucGeo.y).toBeGreaterThan(0);
  });

  it('edge from actor to use case inside nested container is included', () => {
    const inner = container('inner', 'package', [usecase('uc1', 'Feature')]);
    const outer = container('outer', 'rectangle', [inner]);
    const ast = makeAst([actor('u', 'User'), outer], [solid('u', 'uc1')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const edge = geo.edges.find((e) => e.from === 'u' && e.to === 'uc1');
    expect(edge).toBeDefined();
    expect(edge!.points.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Empty nested container
// ---------------------------------------------------------------------------

describe('layoutDescription — empty nested container', () => {
  it('empty container nested inside another container uses EMPTY_CONTAINER size', () => {
    const emptyInner = container('inner', 'package', []);
    const outer = container('outer', 'rectangle', [emptyInner]);
    const geo = layoutDescription(makeAst([outer], []), defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    const outerGeo = geo.nodes[0]!;
    expect(outerGeo.children).toHaveLength(1);

    const innerGeo = outerGeo.children[0]!;
    expect(innerGeo.id).toBe('inner');
    expect(innerGeo.width).toBeGreaterThan(0);
    expect(innerGeo.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// LaTeX label sizing
// ---------------------------------------------------------------------------

describe('layoutDescription — latex label sizing', () => {
  it('usecase with latex display gets dimensions from measureLatex', () => {
    const display = '<latex>\\frac{a}{b}</latex>';
    const ast = makeAst([node('uc', 'usecase', display)], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const expected = measureLatex(display);
    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBe(expected.width);
    expect(ucGeo.height).toBe(expected.height);
  });

  it('actor with latex display still uses fixed ACTOR_WIDTH/HEIGHT', () => {
    const ast = makeAst([node('a', 'actor', '<latex>x^2</latex>')], []);
    const actorGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'a')!;
    expect(actorGeo.width).toBe(50);
    expect(actorGeo.height).toBe(70);
  });

  it('plain usecase display uses string measurer (height = USECASE_HEIGHT)', () => {
    const ast = makeAst([node('uc', 'usecase', 'Login')], []);
    const ucGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.height).toBe(40);
  });

  it('diagram with latex usecase and plain usecase has all positive geometry', () => {
    const ast = makeAst(
      [
        node('latex-uc', 'usecase', '<latex>\\sum_{i=1}^{n} i</latex>'),
        node('plain-uc', 'usecase', 'Check Out'),
      ],
      [solid('latex-uc', 'plain-uc')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(2);
    for (const n of geo.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.y).toBeGreaterThan(0);
      expect(n.width).toBeGreaterThan(0);
      expect(n.height).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// ── UNIFIED FEATURES (arrowHead pass-through) ────────────────────────────────
// ===========================================================================

describe('layoutDescription — arrowHead pass-through', () => {
  it('link with arrowHead="filled" produces arrowHead="filled" in edge geo', () => {
    const ast: DescriptionDiagramAST = {
      nodes: [comp('A'), comp('B')],
      links: [{ from: 'A', to: 'B', style: 'solid', arrowHead: 'filled', length: 1 }],
    };
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.arrowHead).toBe('filled');
  });

  it('link without arrowHead produces no arrowHead field in edge geo', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B')]);
    expect(layoutDescription(ast, defaultTheme, measurer).edges[0]?.arrowHead).toBeUndefined();
  });
});

// ===========================================================================
// ── SINGLE-PASS CLUSTER LAYOUT (T5 rebuild) ─────────────────────────────────
// ===========================================================================

// ---------------------------------------------------------------------------
// Spline quality — edges must be real graphviz splines (>2 points)
// ---------------------------------------------------------------------------

describe('layoutDescription — spline edge points', () => {
  it('edge between two leaf nodes produces a multi-point spline (>2 points)', () => {
    const ast = makeAst([comp('S'), comp('T')], [solid('S', 'T')]);
    const edge = layoutDescription(ast, defaultTheme, measurer).edges[0]!;
    expect(edge.points.length).toBeGreaterThan(2);
  });

  it('cross-container edge between leaf nodes in different clusters has >2 points', () => {
    const ast = makeAst(
      [
        pkg('P1', [comp('A')], 'Left'),
        pkg('P2', [comp('B')], 'Right'),
      ],
      [solid('A', 'B')],
    );
    const edge = layoutDescription(ast, defaultTheme, measurer).edges[0]!;
    expect(edge.points.length).toBeGreaterThan(2);
  });
});

// ---------------------------------------------------------------------------
// Container-endpoint edges — anchor resolution and bbox clipping
// ---------------------------------------------------------------------------

describe('layoutDescription — container endpoint edges', () => {
  it('link whose target is a container id is included with correct from/to', () => {
    const ast = makeAst(
      [actor('u', 'User'), container('sys', 'rectangle', [usecase('uc1', 'Login')])],
      [solid('u', 'sys')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(1);
    const edge = geo.edges[0]!;
    expect(edge.from).toBe('u');
    expect(edge.to).toBe('sys');
    expect(edge.points.length).toBeGreaterThanOrEqual(2);
  });

  it('edge to container endpoint is clipped at the container boundary', () => {
    const ast = makeAst(
      [actor('u', 'User'), container('sys', 'rectangle', [usecase('uc1', 'Login')])],
      [solid('u', 'sys')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    const sys = geo.nodes.find((n) => n.id === 'sys')!;
    const lastPt = edge.points[edge.points.length - 1]!;
    // After clipping the trailing spline points, the last point must not sit
    // in the strict interior of the container's bbox (1 px tolerance).
    const inInterior =
      lastPt.x > sys.x + 1 &&
      lastPt.x < sys.x + sys.width - 1 &&
      lastPt.y > sys.y + 1 &&
      lastPt.y < sys.y + sys.height - 1;
    expect(inInterior).toBe(false);
  });

  it('link whose source is a container id is included with correct from/to', () => {
    const ast = makeAst(
      [container('sys', 'rectangle', [usecase('uc1', 'Login')]), actor('u', 'User')],
      [solid('sys', 'u')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(1);
    const edge = geo.edges[0]!;
    expect(edge.from).toBe('sys');
    expect(edge.to).toBe('u');
  });

  it('link to empty container (no descendants) is skipped gracefully', () => {
    const ast = makeAst(
      [comp('A'), container('empty', 'rectangle', [])],
      [solid('A', 'empty')],
    );
    // 'empty' has no children, so it's a leaf; the edge should be included
    // (empty container becomes a DotInputNode, so endpoint is valid)
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(1);
  });
});

// ===========================================================================
// ── GRAPH SPACING (rankdir / nodesep / ranksep) — DotStringFactory.java +
//    SvekEdge.java dzeta (mission dot-oracle-sync, phase 2 iteration 1)
// ===========================================================================

describe('layoutDescription — graph spacing (rankdir/nodesep/ranksep)', () => {
  it('default input has no rankDir and nodeSep=35/rankSep=60 (Svek min floors)', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B')]);
    const input = captureGraphInput(ast);
    expect(input.rankDir).toBeUndefined();
    expect(input.nodeSep).toBe(35);
    expect(input.rankSep).toBe(60);
  });

  it('`left to right direction` (ast.rankdir="LR") sets rankDir="LR"', () => {
    const ast: DescriptionDiagramAST = { nodes: [comp('A'), comp('B')], links: [], rankdir: 'LR' };
    const input = captureGraphInput(ast);
    expect(input.rankDir).toBe('LR');
  });

  it('a length-1 link with a wide label pushes nodeSep to (labelWidth + 12) / 10', () => {
    const fixed = new FixedMeasurer(10, 20);
    const label = 'x'.repeat(40); // width = 400 with charWidth=10
    const fontSpec = { family: defaultTheme.fontFamily, size: defaultTheme.fontSize };
    const labelWidth = fixed.measure(label, fontSpec).width;
    const ast: DescriptionDiagramAST = {
      nodes: [comp('A'), comp('B')],
      links: [{ from: 'A', to: 'B', style: 'solid', arrowHead: 'open', length: 1, label }],
    };
    const input = captureGraphInput(ast, fixed);
    // decorDzeta = 2 (tail NONE) + 10 (head 'open' ARROW) = 12
    const expectedNodeSep = (labelWidth + 12) / 10;
    expect(expectedNodeSep).toBeGreaterThan(35); // sanity: label is wide enough to clear the floor
    expect(input.nodeSep).toBeCloseTo(expectedNodeSep, 6);
    expect(input.rankSep).toBe(60); // a horizontal (length-1) edge does not affect ranksep
  });

  it('a length-2 labeled link raises rankSep (label height), not nodeSep', () => {
    const fixed = new FixedMeasurer(10, 600);
    const label = 'step';
    const fontSpec = { family: defaultTheme.fontFamily, size: defaultTheme.fontSize };
    const labelHeight = fixed.measure(label, fontSpec).height;
    const ast: DescriptionDiagramAST = {
      nodes: [comp('A'), comp('B')],
      links: [{ from: 'A', to: 'B', style: 'solid', arrowHead: 'open', length: 2, label }],
    };
    const input = captureGraphInput(ast, fixed);
    const expectedRankSep = (labelHeight + 12) / 10;
    expect(expectedRankSep).toBeGreaterThan(60); // sanity: label is tall enough to clear the floor
    expect(input.rankSep).toBeCloseTo(expectedRankSep, 6);
    expect(input.nodeSep).toBe(35); // a non-horizontal (length>1) edge does not affect nodesep
  });

  it('self-loop link contributes decor-only dzeta (wide label ignored)', () => {
    const fixed = new FixedMeasurer(10, 20);
    const bigLabel = 'x'.repeat(80); // width 800 — would clear the 35 floor if it counted
    const selfLoopAst: DescriptionDiagramAST = {
      nodes: [comp('A')],
      links: [{ from: 'A', to: 'A', style: 'solid', arrowHead: 'open', length: 1, label: bigLabel }],
    };
    const nonSelfLoopAst: DescriptionDiagramAST = {
      nodes: [comp('A'), comp('B')],
      links: [{ from: 'A', to: 'B', style: 'solid', arrowHead: 'open', length: 1, label: bigLabel }],
    };
    const selfLoopInput = captureGraphInput(selfLoopAst, fixed);
    const nonSelfLoopInput = captureGraphInput(nonSelfLoopAst, fixed);
    // decorDzeta = 2 + 10 = 12; /10 = 1.2 — floored to 35 when the label is excluded.
    expect(selfLoopInput.nodeSep).toBe(35);
    // Same label, non-self-loop: the label now contributes and clears the floor.
    expect(nonSelfLoopInput.nodeSep).toBeGreaterThan(35);
  });
});

// ===========================================================================
// ── EDGE MINLEN — SvekEdge.java:417-427 (useRankSame hardwired false):
//    every svek edge emits minlen = link length - 1
// ===========================================================================

describe('layoutDescription — edge minlen (= link length - 1)', () => {
  it('length-1 arrow (`a -> b`) yields minLen 0 (same rank)', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B', undefined, 1)]);
    const input = captureGraphInput(ast);
    expect(input.edges).toHaveLength(1);
    expect(input.edges[0]!.attributes?.minLen).toBe(0);
  });

  it('length-2 arrow (`a --> b`) yields minLen 1', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B', undefined, 2)]);
    const input = captureGraphInput(ast);
    expect(input.edges[0]!.attributes?.minLen).toBe(1);
  });

  it('dashed length-2 arrow (`a ..> b`) yields minLen 1', () => {
    const ast = makeAst([comp('A'), comp('B')], [dashed('A', 'B', undefined, undefined, 2)]);
    const input = captureGraphInput(ast);
    expect(input.edges[0]!.attributes?.minLen).toBe(1);
  });
});

// ===========================================================================
// ── LINK-GRAMMAR WIRING — CommandLinkElement.java port (P2/i4):
//    tail/head qualifier labels, hidden→invis, direction-hint minlen, and
//    parser auto-created endpoints reaching the DotInputGraph.
// ===========================================================================

function parseLine(line: string): DescriptionDiagramAST {
  const source: UmlSource = { lines: [line], type: 'description' };
  return parseDescription(source);
}

describe('layoutDescription — link-grammar wiring', () => {
  it('firstLabel/secondLabel measure into tail/head label dimensions', () => {
    const link: DescriptiveLink = {
      from: 'A', to: 'B', style: 'solid', length: 2,
      firstLabel: '1', secondLabel: '0..*',
    };
    const ast = makeAst([comp('A'), comp('B')], [link]);
    const input = captureGraphInput(ast);
    const attrs = input.edges[0]!.attributes;
    expect(attrs?.tailLabelWidth).toBeGreaterThan(0);
    expect(attrs?.tailLabelHeight).toBeGreaterThan(0);
    expect(attrs?.headLabelWidth).toBeGreaterThan(0);
    expect(attrs?.headLabelHeight).toBeGreaterThan(0);
  });

  it('hidden link sets invis=true on the DotInputEdge (still emitted)', () => {
    const link: DescriptiveLink = { from: 'A', to: 'B', style: 'solid', length: 2, hidden: true };
    const ast = makeAst([comp('A'), comp('B')], [link]);
    const input = captureGraphInput(ast);
    expect(input.edges).toHaveLength(1);
    expect(input.edges[0]!.attributes?.invis).toBe(true);
  });

  it('`a -r-> b` (direction hint, no explicit length) yields minLen 0', () => {
    const ast = parseLine('a -r-> b');
    const input = captureGraphInput(ast);
    expect(input.edges).toHaveLength(1);
    expect(input.edges[0]!.attributes?.minLen).toBe(0);
  });

  it('parser auto-created endpoints (`A --> B`, no declarations) reach DotInputGraph nodes', () => {
    const ast = parseLine('A --> B');
    const input = captureGraphInput(ast);
    expect(input.nodes.map((n) => n.id).sort()).toEqual(['A', 'B']);
    expect(input.edges).toHaveLength(1);
  });
});
