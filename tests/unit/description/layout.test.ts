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
import type { DotInputEdge } from '../../../src/core/graph-layout.js';
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
  stereotype?: readonly string[],
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

function circle(id: string, display = id): DescriptiveNode {
  return node(id, 'circle', display);
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
  it('short display name is sized to text + margin, not floored to 80', () => {
    // Oracle applies no 80px floor: the box width is text + symbol margin
    // (component adds margin 20 + UML2 icon 20). MinimumWidth style default is
    // 0 — verified against the deterministic oracle (rectangle "i" = 24px,
    // component "X" ≈ 49px). The prior >= 80 floor was a divergence.
    const ast = makeAst([comp('X', 'X')], []);
    const width = layoutDescription(ast, defaultTheme, measurer).nodes[0]?.width ?? 0;
    expect(width).toBeLessThan(80);
    expect(width).toBeGreaterThan(40); // margin(20) + icon(20), text-driven above that
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
    const ast = makeAst([node('svc', 'component', 'MyService', [], ['service'])], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toEqual(['service']);
  });

  // G1 I5b: every stereotype tag adds its OWN lineH to the box (one
  // guillemet line per tag, EntityImageDescription.java:200-201) -- width
  // is the WIDEST label, not their sum.
  it('multiple stereotype tags grow the box height by one line PER TAG (not just one)', () => {
    const oneTag = makeAst([node('a', 'component', 'X', [], ['t1'])], []);
    const threeTags = makeAst([node('b', 'component', 'X', [], ['t1', 't2', 't3'])], []);
    const oneH = layoutDescription(oneTag, defaultTheme, measurer).nodes[0]!.height;
    const threeH = layoutDescription(threeTags, defaultTheme, measurer).nodes[0]!.height;
    const lineH = defaultTheme.fontSize; // LINE_HEIGHT_FACTOR = 1.0
    expect(threeH).toBeCloseTo(oneH + 2 * lineH, 5);
  });

  it('all stereotype tags on a container title are preserved in node geo', () => {
    const child = node('c1', 'component', 'Inner');
    const container = node('pkg', 'node', 'Title', [child], ['x', 'y']);
    const ast = makeAst([container], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toEqual(['x', 'y']);
  });
});

// G1 I5b: EntityImageUseCase.java:96-109 (mergeTB(stereo, desc)) previously
// had NO wiring at all in this port -- a use-case entity's stereotype
// contributed zero footprint growth, single-tag or multi-tag alike.
describe('layoutDescription — stereotype on use-case ellipse (G1 I5b)', () => {
  it('a stereotyped use-case is taller than the SAME unstereotyped use-case', () => {
    const plain = makeAst([node('u1', 'usecase', 'Pay')], []);
    const stereotyped = makeAst([node('u2', 'usecase', 'Pay', [], ['boundary'])], []);
    const plainH = layoutDescription(plain, defaultTheme, measurer).nodes[0]!.height;
    const stereotypedH = layoutDescription(stereotyped, defaultTheme, measurer).nodes[0]!.height;
    expect(stereotypedH).toBeGreaterThan(plainH);
  });
});

// ---------------------------------------------------------------------------
// Inline color/style override passthrough (T19) — `DescriptiveNode.color`
// must survive into `DescriptionNodeGeo.color` on BOTH geo-construction
// paths: the single-leaf fast path (`degenerateSingleLeaf`, taken when
// there are zero links/containers and exactly one root node) and the
// general `buildGeoNode` path (everything else). Both are exercised
// separately below since they are two independent code sites.
// ---------------------------------------------------------------------------

describe('layoutDescription — color override passthrough (T19)', () => {
  it('single-node diagram (degenerate fast path) carries color through to geo', () => {
    const solo = node('c', 'usecase', 'c');
    solo.color = '#line.dashed';
    const ast = makeAst([solo], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.color).toBe('#line.dashed');
  });

  it('multi-node diagram (general buildGeoNode path) carries color through to geo', () => {
    const a = comp('A');
    a.color = '#orange;line:blue';
    const b = comp('B');
    const ast = makeAst([a, b], [solid('A', 'B')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'A')?.color).toBe('#orange;line:blue');
    expect(geo.nodes.find((n) => n.id === 'B')?.color).toBeUndefined();
  });

  it('a node with no color override has no color field in geo', () => {
    const ast = makeAst([comp('A')], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.color).toBeUndefined();
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
  it('actor geo is stickman + label: width=max(27,label), height=60+lineH', () => {
    // Upstream ActorStickMan (27×60) stacked above the label
    // (mergeLayoutT12B3). Height is stickman + one label line; width is the
    // wider of the stickman and the label. Verified exact vs the deterministic
    // oracle. (Was: a fixed 50×70 approximation.)
    const ast = makeAst([actor('u', 'User')], []);
    const actorGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'u')!;
    expect(actorGeo.width).toBeGreaterThanOrEqual(27); // ≥ stickman width
    expect(actorGeo.height).toBe(60 + defaultTheme.fontSize); // stickman + 1 label line
  });

  it('actor width tracks the label (wider label → wider box)', () => {
    const ast = makeAst([actor('a1', 'Al'), actor('a2', 'Charlie Longname')], []);
    const geos = layoutDescription(ast, defaultTheme, measurer).nodes;
    const short = geos.find((n) => n.id === 'a1')!;
    const long = geos.find((n) => n.id === 'a2')!;
    expect(long.width).toBeGreaterThan(short.width); // label-driven, not fixed
    expect(short.height).toBe(long.height); // height is fixed (single-line labels)
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
// Link removed by `remove <<stereotype>>` (Link.isRemoved,
// net/sourceforge/plantuml/abel/Link.java:492-498) -- dropped from the emitted
// DOT edge set independent of its endpoints staying present (contrast the
// existing removed-NODE filter a few lines up in layout.ts, which drops
// edges touching a removed ENTITY). description-dot-100 mission, I3
// (radiga-95-junu817 / zodare-91-rira454).
// ---------------------------------------------------------------------------

describe('layoutDescription — link.removed (remove <<stereotype>>, I3)', () => {
  it('a link marked removed is excluded from the emitted DOT edges', () => {
    const a = comp('ServA');
    const b = comp('ServB');
    const kept = solid('ServA', 'ServB', 'TypeB');
    const dropped: DescriptiveLink = { ...solid('ServA', 'ServB', 'TypeA'), removed: true };
    const ast = makeAst([a, b], [dropped, kept]);
    const graph = captureGraphInput(ast);
    expect(graph.edges).toHaveLength(1);
  });

  it('both endpoints survive even when their only differentiating link is removed', () => {
    const a = comp('ServA');
    const b = comp('ServB');
    const dropped: DescriptiveLink = { ...solid('ServA', 'ServB', 'TypeA'), removed: true };
    const ast = makeAst([a, b], [dropped]);
    const graph = captureGraphInput(ast);
    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['ServA', 'ServB']);
  });
});

// ---------------------------------------------------------------------------
// Removed nested entity + empty-container-as-leaf demotion (G1 I5g).
// `buildGeoNode`/`buildGeoTree` previously used the raw, removal-blind
// `isClusterNode` to decide leaf-vs-cluster rendering and never filtered a
// removed child out of the recursive `.children.map(...)` walk -- a
// container whose only child carried `removed: true` (parse-time
// CommandRemoveRestore marker) still rendered as a cluster wrapping the
// removed child's fallback (0,0-positioned) geometry, and a container that
// was ITSELF `removed: true` still rendered at all (both mirror
// GraphvizImageBuilder.printGroups java:411-421: `if (g.isRemoved())
// continue;` skips a removed group entirely; `if (dotData.isEmpty(g) &&
// g.getGroupType() == PACKAGE) g.muteToType(LeafType.EMPTY_PACKAGE)` demotes
// an emptied-but-not-removed one to a leaf).
// ---------------------------------------------------------------------------

describe('layoutDescription — removed nested entity / empty-container demotion (G1 I5g)', () => {
  it('a container demotes to a leaf once its only child is removed (sobobi-72-miri289)', () => {
    const removedChild: DescriptiveNode = { ...comp('A'), removed: true };
    const f1 = container('f1', 'frame', [removedChild]);
    const ast = makeAst([f1], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(1);
    const f1Geo = geo.nodes[0]!;
    expect(f1Geo.id).toBe('f1');
    expect(f1Geo.children).toHaveLength(0);
  });

  it('a directly-removed container is excluded from the geo tree entirely (gogosu-37-mipe918)', () => {
    const aSub = comp('a_sub');
    const a: DescriptiveNode = { ...container('a', 'component', [aSub]), removed: true };
    const bSub: DescriptiveNode = { ...comp('b_sub'), removed: true };
    const b = container('b', 'component', [bSub]);
    const ast = makeAst([a, b], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.map((n) => n.id)).toEqual(['b']);
    expect(geo.nodes[0]!.children).toHaveLength(0);
  });

  it('a removed leaf nested inside a non-empty container is dropped from its parent children (renita-52-jazi848)', () => {
    const removedA: DescriptiveNode = { ...comp('A'), removed: true };
    const c = comp('C');
    const f1 = container('f1', 'frame', [removedA, c]);
    const ast = makeAst([f1], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const f1Geo = geo.nodes.find((n) => n.id === 'f1')!;
    expect(f1Geo.children.map((n) => n.id)).toEqual(['C']);
  });

  it('a deeply-nested empty container demotes to a leaf while its still-populated ancestor stays a cluster (gezemu-34-kamu453)', () => {
    const removedD: DescriptiveNode = { ...comp('D'), removed: true };
    const l3 = container('l3', 'frame', [removedD]);
    const l2 = container('l2', 'frame', [l3]);
    const ast = makeAst([l2], []);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const l2Geo = geo.nodes.find((n) => n.id === 'l2')!;
    expect(l2Geo.children.map((n) => n.id)).toEqual(['l3']);
    const l3Geo = l2Geo.children[0]!;
    expect(l3Geo.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// `hide`/`show` entity-visibility (G1 I-hideshow) -- draw-time-only marker,
// NEVER filters the geo tree (contrast `removed` above): position/size are
// unaffected, jar-verified (SvekResult.java:82-91/Cluster.java:298-300).
// ---------------------------------------------------------------------------

describe('layoutDescription — hideShowRules -> DescriptionNodeGeo.hidden (G1 I-hideshow)', () => {
  it('a bare-id rule marks exactly that leaf hidden, positions untouched (ciboso-93-romi495)', () => {
    const comp1 = comp('comp1');
    const comp2 = comp('comp2');
    const ast: DescriptionDiagramAST = {
      ...makeAst([comp1, comp2], [solid('comp1', 'comp2')]),
      hideShowRules: [{ what: 'comp2', show: false }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const g1 = geo.nodes.find((n) => n.id === 'comp1')!;
    const g2 = geo.nodes.find((n) => n.id === 'comp2')!;
    expect(g1.hidden).toBeUndefined();
    expect(g2.hidden).toBe(true);
    // Full normal geometry -- NOT (0,0)/degenerate -- jar keeps the hidden
    // entity fully participating in the DOT graph.
    expect(g2.width).toBeGreaterThan(0);
    expect(g2.height).toBeGreaterThan(0);
  });

  it('hiding a CONTAINER propagates to every descendant, but leaves a sibling untouched (mavuxi-16-jafi782)', () => {
    const aSub = comp('a_sub');
    const a = container('a', 'component', [aSub]);
    const bSub = comp('b_sub');
    const b = container('b', 'component', [bSub]);
    const ast: DescriptionDiagramAST = {
      ...makeAst([a, b], []),
      hideShowRules: [{ what: 'a', show: false }, { what: 'b_sub', show: false }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const aGeo = geo.nodes.find((n) => n.id === 'a')!;
    const bGeo = geo.nodes.find((n) => n.id === 'b')!;
    expect(aGeo.hidden).toBe(true);
    expect(aGeo.children[0]!.hidden).toBe(true); // a_sub inherits from its hidden parent
    expect(bGeo.hidden).toBeUndefined(); // b itself was never targeted
    expect(bGeo.children[0]!.hidden).toBe(true); // b_sub targeted directly
  });

  it('`hide *` then `show $tag` un-hides only the tagged entities (tusugu-95-geju398)', () => {
    const c1: DescriptiveNode = { ...comp('comp1'), tags: ['tag1'] };
    const c2: DescriptiveNode = { ...comp('comp2'), tags: ['tag2'] };
    const c3 = comp('comp3');
    const ast: DescriptionDiagramAST = {
      ...makeAst([c1, c2, c3], []),
      hideShowRules: [
        { what: '*', show: false },
        { what: '$tag1', show: true },
      ],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'comp1')!.hidden).toBeUndefined();
    expect(geo.nodes.find((n) => n.id === 'comp2')!.hidden).toBe(true);
    expect(geo.nodes.find((n) => n.id === 'comp3')!.hidden).toBe(true);
  });

  it('an edge touching a hidden entity is itself marked hidden (Link#isHidden, ciboso-93-romi495)', () => {
    const comp1 = comp('comp1');
    const comp2 = comp('comp2');
    const ast: DescriptionDiagramAST = {
      ...makeAst([comp1, comp2], [solid('comp1', 'comp2')]),
      hideShowRules: [{ what: 'comp2', show: false }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(1);
    expect(geo.edges[0]!.hidden).toBe(true);
  });

  it('an edge between two VISIBLE entities is not marked hidden', () => {
    const comp1 = comp('comp1');
    const comp2 = comp('comp2');
    const ast = makeAst([comp1, comp2], [solid('comp1', 'comp2')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.hidden).toBeUndefined();
  });

  it('a hidden ancestor short-circuits a childs OWN explicit show rule (Entity#isHidden java:437-438 parent-first check)', () => {
    const child = comp('a_sub');
    const parent = container('a', 'component', [child]);
    const ast: DescriptionDiagramAST = {
      ...makeAst([parent], []),
      hideShowRules: [{ what: 'a', show: false }, { what: 'a_sub', show: true }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const aGeo = geo.nodes.find((n) => n.id === 'a')!;
    expect(aGeo.hidden).toBe(true);
    // The child's own `show a_sub` rule can never override an already-
    // hidden ancestor -- jar-verified structural impossibility.
    expect(aGeo.children[0]!.hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// `hide|show [<<label>>] stereotype` -- per-label visibility (G1 I-hideshow)
// ---------------------------------------------------------------------------

describe('layoutDescription — stereotypeVisibilityRules -> filtered geo.stereotype (G1 I-hideshow)', () => {
  it('`hide stereotype` (gender=all) drops every label from the geo tree', () => {
    const c = node('c', 'component', 'c', [], ['1']);
    const ast: DescriptionDiagramAST = {
      ...makeAst([c], []),
      stereotypeVisibilityRules: [{ show: false }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBeUndefined();
  });

  it('`hide stereotype` then a matching `show <<label>>` restores just that label (lufiba-62-dubi670)', () => {
    const aa = node('AA', 'component', 'AA', [], ['static lib']);
    const bb = node('BB', 'component', 'BB', [], ['shared lib']);
    const ast: DescriptionDiagramAST = {
      ...makeAst([aa, bb], []),
      stereotypeVisibilityRules: [{ show: false }, { pattern: 'shared lib', show: true }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes.find((n) => n.id === 'AA')!.stereotype).toBeUndefined();
    expect(geo.nodes.find((n) => n.id === 'BB')!.stereotype).toEqual(['shared lib']);
  });

  it('per-label `hide <<label>> stereotype` filters ONLY the matched label, keeping others (mopimi-10-jaco443, I5b mechanism D)', () => {
    const d = node('D', 'component', 'D', [], ['stereo1', 'stereo2', 'stereo3']);
    const ast: DescriptionDiagramAST = {
      ...makeAst([d], []),
      stereotypeVisibilityRules: [
        { pattern: 'stereo1', show: false },
        { pattern: 'stereo2', show: false },
      ],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toEqual(['stereo3']);
  });

  it('a node with no stereotype at all is unaffected by ANY rule (jecici-56-bimu826 shape)', () => {
    const c = comp('c');
    const ast: DescriptionDiagramAST = {
      ...makeAst([c], []),
      stereotypeVisibilityRules: [{ show: false }],
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBeUndefined();
  });

  it('filtering feeds sizing too: a fully-hidden stereotype block does not widen the box beyond the label (leaf-sizing consistency)', () => {
    const withRule = node('c', 'component', 'c', [], ['a-very-long-stereotype-name-indeed']);
    const bare = comp('c', 'c');
    const astHidden: DescriptionDiagramAST = {
      ...makeAst([withRule], []),
      stereotypeVisibilityRules: [{ show: false }],
    };
    const astBare = makeAst([bare], []);
    const hiddenGeo = layoutDescription(astHidden, defaultTheme, measurer);
    const bareGeo = layoutDescription(astBare, defaultTheme, measurer);
    expect(hiddenGeo.nodes[0]!.width).toBeCloseTo(bareGeo.nodes[0]!.width, 5);
    expect(hiddenGeo.nodes[0]!.height).toBeCloseTo(bareGeo.nodes[0]!.height, 5);
  });
});

// ---------------------------------------------------------------------------
// Node stereotype
// ---------------------------------------------------------------------------

describe('layoutDescription — node stereotype', () => {
  it('rectangle node stereotype is preserved', () => {
    const ast = makeAst([node('sys', 'rectangle', 'System', [], ['system'])], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toEqual(['system']);
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
    const ast = makeAst([node('uc', 'usecase', 'Pay', [], ['boundary'])], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toEqual(['boundary']);
  });

  it('actor with stereotype preserves it in node geo', () => {
    const ast = makeAst([node('a', 'actor', 'Admin', [], ['system'])], []);
    expect(layoutDescription(ast, defaultTheme, measurer).nodes[0]?.stereotype).toEqual(['system']);
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
// Port label position (G1 I5 write-set expansion — EntityImagePort
// .upPosition(), svek/image/EntityImagePort.java:76-80)
// ---------------------------------------------------------------------------

describe('layoutDescription — port label position (portLabelAbove)', () => {
  it("matches EntityImagePort.upPosition(): true iff a port's top edge sits above its parent cluster's vertical center", () => {
    const parent = container('parent', 'component', [
      node('p1', 'port', 'p1'),
      node('p2', 'port', 'p2'),
      node('p3', 'port', 'p3'),
    ]);
    const ast = makeAst(
      [comp('hub'), parent],
      [solid('hub', 'p1'), solid('hub', 'p2'), solid('hub', 'p3')],
    );
    const geo = layoutDescription(ast, defaultTheme, measurer);
    const parentGeo = geo.nodes.find((n) => n.id === 'parent')!;
    const centerY = parentGeo.y + parentGeo.height / 2;

    expect(parentGeo.children).toHaveLength(3);
    for (const child of parentGeo.children) {
      expect(child.portLabelAbove).toBe(child.y < centerY);
    }
  });

  it('a non-port child of the same container never gets portLabelAbove set', () => {
    const parent = container('parent', 'component', [
      node('p1', 'port', 'p1'),
      comp('leaf1'),
    ]);
    const geo = layoutDescription(makeAst([parent], []), defaultTheme, measurer);
    const parentGeo = geo.nodes.find((n) => n.id === 'parent')!;
    const leaf = parentGeo.children.find((c) => c.id === 'leaf1')!;
    expect(leaf.portLabelAbove).toBeUndefined();
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

  it('actor is sized by the stickman + label stack (latex label not special-cased)', () => {
    // Actor sizing is stickman (27×60) + label; unlike usecase it does not
    // special-case a LaTeX display (rare — ledgered). Height is stickman + one
    // label line regardless; width tracks the (literal) label extent.
    const ast = makeAst([node('a', 'actor', '<latex>x^2</latex>')], []);
    const actorGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'a')!;
    expect(actorGeo.width).toBeGreaterThanOrEqual(27);
    expect(actorGeo.height).toBe(60 + defaultTheme.fontSize);
  });

  it('plain usecase is sized by the containing-ellipse formula (TextBlockInEllipse)', () => {
    // Ellipse: alpha=clamp(textH/textW,0.2,0.8); width=√(W²+(H/alpha)²)+6,
    // height=alpha·width... +6. Text-driven, not a fixed height — verified
    // exact against the deterministic oracle. For "Login" the ellipse is wider
    // than tall and both dims are positive and below the old fixed 40px height.
    const ast = makeAst([node('uc', 'usecase', 'Login')], []);
    const ucGeo = layoutDescription(ast, defaultTheme, measurer).nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.height).toBeGreaterThan(0);
    expect(ucGeo.height).toBeLessThan(40); // no longer the fixed USECASE_HEIGHT
    expect(ucGeo.width).toBeGreaterThan(ucGeo.height); // "Login" is wider than tall
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

// ---------------------------------------------------------------------------
// Group-anchor point nodes — Cluster.getSpecialPointId / Bibliotekon
// .getNodeUid (mission dot-oracle-sync, phase 2 iteration 5)
// ---------------------------------------------------------------------------

describe('layoutDescription — group-anchor point nodes (DotInputGraph)', () => {
  it('edge whose target is a non-empty container adds a shape:point anchor node', () => {
    const ast = makeAst(
      [actor('u', 'User'), container('sys', 'rectangle', [usecase('uc1', 'Login')])],
      [solid('u', 'sys')],
    );
    const input = captureGraphInput(ast);
    const anchor = input.nodes.find((n) => n.shape === 'point');
    expect(anchor).toBeDefined();
    expect(input.edges).toHaveLength(1);
    expect(input.edges[0]!.to).toBe(anchor!.id);
  });

  it('edge whose source is a non-empty container adds a shape:point anchor node', () => {
    const ast = makeAst(
      [container('sys', 'rectangle', [usecase('uc1', 'Login')]), actor('u', 'User')],
      [solid('sys', 'u')],
    );
    const input = captureGraphInput(ast);
    const anchor = input.nodes.find((n) => n.shape === 'point');
    expect(anchor).toBeDefined();
    expect(input.edges[0]!.from).toBe(anchor!.id);
  });

  it('the anchor node is a direct member of the target container\'s cluster', () => {
    const ast = makeAst(
      [actor('u', 'User'), container('sys', 'rectangle', [usecase('uc1', 'Login')])],
      [solid('u', 'sys')],
    );
    const input = captureGraphInput(ast);
    const anchor = input.nodes.find((n) => n.shape === 'point')!;
    const cluster = input.clusters!.find((c) => c.nodeIds.includes('uc1'))!;
    expect(cluster.nodeIds).toContain(anchor.id);
  });

  it('two edges to the same group share ONE anchor node, not one per edge', () => {
    const ast = makeAst(
      [
        actor('u1', 'User1'),
        actor('u2', 'User2'),
        container('sys', 'rectangle', [usecase('uc1', 'Login')]),
      ],
      [solid('u1', 'sys'), solid('u2', 'sys')],
    );
    const input = captureGraphInput(ast);
    const anchorNodes = input.nodes.filter((n) => n.shape === 'point');
    expect(anchorNodes).toHaveLength(1);
    expect(input.edges).toHaveLength(2);
    expect(input.edges[0]!.to).toBe(anchorNodes[0]!.id);
    expect(input.edges[1]!.to).toBe(anchorNodes[0]!.id);
  });

  it('edge to an empty container does NOT create an anchor point (plain leaf)', () => {
    const ast = makeAst(
      [comp('A'), container('empty', 'rectangle', [])],
      [solid('A', 'empty')],
    );
    const input = captureGraphInput(ast);
    expect(input.nodes.some((n) => n.shape === 'point')).toBe(false);
    expect(input.edges[0]!.to).toBe('empty');
  });

  it('two different groups referenced by edges each get their own anchor node', () => {
    const ast = makeAst(
      [
        actor('u', 'User'),
        container('sys1', 'rectangle', [usecase('uc1', 'Login')]),
        container('sys2', 'rectangle', [usecase('uc2', 'Logout')]),
      ],
      [solid('u', 'sys1'), solid('u', 'sys2')],
    );
    const input = captureGraphInput(ast);
    const anchorIds = new Set(input.nodes.filter((n) => n.shape === 'point').map((n) => n.id));
    expect(anchorIds.size).toBe(2);
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

describe('layoutDescription -- notes as svek leaf entities', () => {
  it('component + floating note = 2 nodes, 0 edges, NOT degenerate', () => {
    // basetu-75-xevi153: `component dummy` + `note as tott / toto / end note`.
    const ast = makeAst([comp('dummy'), node('tott', 'note', 'toto')], []);
    let captured = 0;
    setLayoutInputObserver(() => { captured++; });
    try {
      const geo = layoutDescription(ast, defaultTheme, measurer);
      expect(geo.nodes).toHaveLength(2);
      expect(geo.edges).toHaveLength(0);
    } finally {
      setLayoutInputObserver(undefined);
    }
    // Two leaves -> the degenerate no-graphviz shortcut does NOT apply.
    expect(captured).toBe(1);
  });

  it('a note leaf defaults to the rect DOT shape (no shape override)', () => {
    const ast = makeAst([comp('a'), node('n', 'note', 'text')], []);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'n')!.shape).toBeUndefined();
  });

  it('note-on-entity RIGHT/LEFT attachment (length 1) yields minLen 0', () => {
    const ast = makeAst(
      [comp('a'), node('n', 'note', 'text')],
      [{ from: 'a', to: 'n', style: 'dashed', length: 1, arrowHead: 'none' }],
    );
    const input = captureGraphInput(ast);
    expect(input.edges[0]!.attributes?.minLen).toBe(0);
  });

  it('note-on-entity TOP/BOTTOM attachment (length 2) yields minLen 1', () => {
    const ast = makeAst(
      [comp('a'), node('n', 'note', 'text')],
      [{ from: 'a', to: 'n', style: 'dashed', length: 2, arrowHead: 'none' }],
    );
    const input = captureGraphInput(ast);
    expect(input.edges[0]!.attributes?.minLen).toBe(1);
  });
});

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

// ===========================================================================
// -- SVEK SHAPE MAP + SHIELD/PLAINTEXT — EntityImageDescription/SvekNode
//    ShapeType (mission dot-oracle-sync, phase 2 iteration 6). See
//    plans/dot-oracle-sync/phase-2-description/shape-mechanism.md.
// ===========================================================================

describe('layoutDescription -- Svek shape map (USymbol -> DotInputNode.shape)', () => {
  it('usecase / usecase-business nodes get shape "ellipse"', () => {
    const ast = makeAst([usecase('uc1', 'Login'), node('uc2', 'usecase-business', 'Buy')], []);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'uc1')!.shape).toBe('ellipse');
    expect(input.nodes.find((n) => n.id === 'uc2')!.shape).toBe('ellipse');
  });

  it('hexagon nodes get shape "hexagon"', () => {
    const ast = makeAst([node('h1', 'hexagon', 'Decision')], []);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'h1')!.shape).toBe('hexagon');
  });

  it('actor nodes stay plain rect (hideText is NEVER true for actor, only for interface)', () => {
    // Corrects the mission brief's seed fact #2: EntityImageDescription sets
    // `hideText = symbol == USymbols.INTERFACE` only -- USymbolActor matches
    // none of the shapeType switch's branches and falls to plain RECTANGLE
    // with hideText=false. Even a length-1 link (which would suppress an
    // interface's shield) has no effect here since actor is never shielded
    // in the first place. Verified against oracle drill-down bivira-53-boja685.
    const ast = makeAst([actor('u', 'User'), comp('B')], [solid('u', 'B', undefined, 1)]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'u')!.shape).toBeUndefined();
  });

  it('plain component/rectangle/container-as-leaf nodes stay the rect default', () => {
    const ast = makeAst([comp('A'), container('empty', 'rectangle', [])], [solid('A', 'empty')]);
    const input = captureGraphInput(ast);
    for (const n of input.nodes) expect(n.shape).toBeUndefined();
  });
});

describe('layoutDescription -- interface shield/plaintext (EntityImageDescription.getShield)', () => {
  it('an interface with no links is shielded -> shape "plaintext"', () => {
    // Two interfaces: a lone leaf would take the degenerate no-graphviz
    // shortcut (GraphvizImageBuilder.buildImage:211-222) and emit no DOT.
    const ast = makeAst([iface('I'), iface('J')], []);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBe('plaintext');
  });

  it('single leaf, no links, no groups -> degenerate: no graph fed to layout', () => {
    const ast = makeAst([iface('I')], []);
    let captured = 0;
    setLayoutInputObserver(() => { captured++; });
    try {
      const geo = layoutDescription(ast, defaultTheme, measurer);
      expect(geo.nodes).toHaveLength(1);
      expect(geo.nodes[0]!.width).toBeGreaterThan(0);
    } finally {
      setLayoutInputObserver(undefined);
    }
    expect(captured).toBe(0);
  });

  it('a non-hidden length-1 link touching the interface suppresses the shield -> rect', () => {
    // hasSomeHorizontalLinkVisible: length===1 && !hidden.
    const ast = makeAst([comp('A'), iface('I')], [solid('A', 'I', undefined, 1)]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBeUndefined();
  });

  it('a length-2 link touching the interface does NOT suppress the shield -> plaintext', () => {
    const ast = makeAst([comp('A'), iface('I')], [solid('A', 'I', undefined, 2)]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBe('plaintext');
  });

  it('a hidden length-1 link (no double decor) does NOT suppress the shield -> plaintext', () => {
    // hasSomeHorizontalLinkVisible requires !hidden; hasSomeHorizontalLinkDoubleDecorated
    // requires decor on both ends -- neither fires here.
    const link: DescriptiveLink = { from: 'A', to: 'I', style: 'solid', length: 1, hidden: true };
    const ast = makeAst([comp('A'), iface('I')], [link]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBe('plaintext');
  });

  it('a hidden length-1 link with decor on BOTH ends suppresses the shield -> rect', () => {
    // hasSomeHorizontalLinkDoubleDecorated: length===1 && tailDecor && headDecor,
    // no `!hidden` guard -- fires even though the link is hidden.
    const link: DescriptiveLink = {
      from: 'A', to: 'I', style: 'solid', length: 1, hidden: true,
      tailDecor: '<|', headDecor: '|>',
    };
    const ast = makeAst([comp('A'), iface('I')], [link]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBeUndefined();
  });

  it('two links to the same other entity suppress the shield (isThereADoubleLink) -> rect', () => {
    const ast = makeAst(
      [comp('A'), iface('I')],
      [solid('A', 'I', undefined, 2), solid('A', 'I', 'second', 2)],
    );
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBeUndefined();
  });

  it('a shielded interface\'s edge is emitted with the ":h" port (Bibliotekon.getNodeUid)', () => {
    const ast = makeAst([comp('A'), iface('I')], [solid('A', 'I', undefined, 2)]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'I')!.shape).toBe('plaintext');
    expect(input.edges).toHaveLength(1);
    expect(input.edges[0]!.to).toBe('I'); // shape carried on the node, not the edge
  });
});

// `Entity.java#getUSymbol` (abel/Entity.java:415-416): `if (getLeafType() ==
// LeafType.CIRCLE) return USymbols.INTERFACE;` -- a bare `circle X` element
// ALWAYS resolves to the INTERFACE USymbol (overriding the local `usymbol =
// null` CommandCreateElementFull sets for validation only), so it shares
// EntityImageDescription's hideText/shield mechanism byte-for-byte with the
// `interface`/`()X` keyword -- verified against the oracle (kizobu-64-rozo458,
// tacixe-99-gesi489: a lone `circle` leaf renders shape=plaintext, not rect).
describe('layoutDescription -- circle resolves to INTERFACE (Entity.getUSymbol override)', () => {
  it('a circle with no links is shielded -> shape "plaintext", same as interface', () => {
    const ast = makeAst([circle('C'), circle('D')], []);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'C')!.shape).toBe('plaintext');
  });

  it('a non-hidden length-1 link touching the circle suppresses the shield -> rect', () => {
    const ast = makeAst([comp('A'), circle('C')], [solid('A', 'C', undefined, 1)]);
    const input = captureGraphInput(ast);
    expect(input.nodes.find((n) => n.id === 'C')!.shape).toBeUndefined();
  });
});

// ===========================================================================
// ── MAIN EDGE LABEL — SvekEdge emits a label table whenever the link has
//    post-colon text; Labels.java keeps <<stereotype>> inside the label,
//    so a stereotype-only link still HAS a label in svek DOT
// ===========================================================================

describe('layoutDescription — main edge label pass-through', () => {
  it('labeled link sets label + measured labelWidth/labelHeight', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B', 'use', 1)]);
    const input = captureGraphInput(ast);
    const a = input.edges[0]!.attributes!;
    expect(a.label).toBe('use');
    expect(a.labelWidth).toBeGreaterThan(0);
    expect(a.labelHeight).toBeGreaterThan(0);
  });

  it('stereotype-only link still carries a label (guillemets)', () => {
    const link: DescriptiveLink = {
      from: 'A', to: 'B', style: 'dashed', arrowHead: 'open', length: 2,
      stereotype: 'include', stereotypeIsLinkLabel: true,
    };
    const ast = makeAst([comp('A'), comp('B')], [link]);
    const input = captureGraphInput(ast);
    const a = input.edges[0]!.attributes!;
    expect(a.label).toBe('«include»');
    expect(a.labelWidth).toBeGreaterThan(0);
  });

  // G1 I5e -- a PRE-colon (non-link-label) stereotype must NOT inflate the
  // DOT `label`/`labelWidth`/`labelHeight` attributes -- those feed
  // nodesep/ranksep (computeGraphSpacing), which the DOT-parity gate checks
  // with STRICT numeric equality (unlike node/label width, a tolerant
  // metric). `stereotypeIsLinkLabel` absent means the pre-colon/auto-
  // create-endpoint case (`Link.setStereotype` in upstream, but `Labels
  // .java` never reads it -- see `DescriptiveLink.stereotypeIsLinkLabel`'s
  // doc comment).
  it('a pre-colon stereotype contributes NO label attribute when the link has no other label', () => {
    const link: DescriptiveLink = {
      from: 'A', to: 'B', style: 'solid', arrowHead: 'none', length: 2,
      stereotype: 'v1.0',
    };
    const ast = makeAst([comp('A'), comp('B')], [link]);
    const input = captureGraphInput(ast);
    const a = input.edges[0]!.attributes!;
    expect(a.label).toBeUndefined();
    expect(a.labelWidth).toBeUndefined();
  });

  it('a pre-colon stereotype alongside a real post-colon label contributes ONLY the label text, not the stereotype', () => {
    const withStereo: DescriptiveLink = {
      from: 'A', to: 'B', style: 'solid', arrowHead: 'none', length: 2,
      stereotype: 'v1.0', label: 'plain text',
    };
    const withoutStereo: DescriptiveLink = {
      from: 'A', to: 'B', style: 'solid', arrowHead: 'none', length: 2,
      label: 'plain text',
    };
    const inputWith = captureGraphInput(makeAst([comp('A'), comp('B')], [withStereo]));
    const inputWithout = captureGraphInput(makeAst([comp('A'), comp('B')], [withoutStereo]));
    const aWith = inputWith.edges[0]!.attributes!;
    const aWithout = inputWithout.edges[0]!.attributes!;
    expect(aWith.label).toBe('plain text');
    expect(aWith.label).toBe(aWithout.label);
    expect(aWith.labelWidth).toBe(aWithout.labelWidth);
  });

  it('unlabeled link has no label attribute', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B', undefined, 2)]);
    const input = captureGraphInput(ast);
    expect(input.edges[0]!.attributes!.label).toBeUndefined();
  });
});

// ===========================================================================
// ── MAGMA STANDALONE CHAINING — applySingleStrategy (net/atmp/CucaDiagram
//    .java) via Magma/SquareMaker: >=3 unlinked leaves per group get square-
//    grid invisible links (leftRight len1/minlen0, topDown len2/minlen1)
// ===========================================================================

describe('layoutDescription — magma standalone chaining', () => {
  const invisEdges = (input: DotInputGraph): DotInputEdge[] =>
    input.edges.filter((e) => e.attributes?.invis === true);

  it('6 unlinked leaves → 5 invisible edges in a 3-wide grid (betidu oracle)', () => {
    const ast = makeAst(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => comp(id)),
      [],
    );
    const input = captureGraphInput(ast);
    const invis = invisEdges(input);
    expect(invis.map((e) => [e.from, e.to, e.attributes?.minLen])).toEqual([
      ['A', 'B', 0],
      ['B', 'C', 0],
      ['A', 'D', 1],
      ['D', 'E', 0],
      ['E', 'F', 0],
    ]);
  });

  it('fewer than 3 standalones → no invisible edges', () => {
    const ast = makeAst([comp('A'), comp('B')], []);
    expect(invisEdges(captureGraphInput(ast))).toEqual([]);
  });

  it('linked leaves are not standalone (only the unlinked 3 chain)', () => {
    const ast = makeAst(
      ['A', 'B', 'C', 'D', 'E'].map((id) => comp(id)),
      [solid('A', 'B', undefined, 2)],
    );
    const input = captureGraphInput(ast);
    const invis = invisEdges(input);
    // branch = ceil(sqrt(3)) = 2: row [C,D], then E starts row 2 under C.
    expect(invis.map((e) => [e.from, e.to, e.attributes?.minLen])).toEqual([
      ['C', 'D', 0],
      ['C', 'E', 1],
    ]);
  });

  it('4 standalones use branch 2 (perfect square)', () => {
    const ast = makeAst(['A', 'B', 'C', 'D'].map((id) => comp(id)), []);
    const invis = invisEdges(captureGraphInput(ast));
    expect(invis.map((e) => [e.from, e.to, e.attributes?.minLen])).toEqual([
      ['A', 'B', 0],
      ['A', 'C', 1],
      ['C', 'D', 0],
    ]);
  });
});

// ===========================================================================
// ── fixCircleLabelOverlapping — disables shield suppression (b)
//    (EntityImageDescription.getShield); dujodu-23 keeps a shielded
//    interface despite a horizontal visible link
// ===========================================================================

describe('layoutDescription — fixCircleLabelOverlapping shield', () => {
  const theme = { ...defaultTheme, fixCircleLabelOverlapping: true };
  it('interface with a horizontal visible link stays plaintext when set', () => {
    const ast = makeAst(
      [iface('I'), comp('A')],
      [{ from: 'I', to: 'A', style: 'solid', arrowHead: 'none', length: 1 }],
    );
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try { layoutDescription(ast, theme, measurer); } finally { setLayoutInputObserver(undefined); }
    expect(captured!.nodes.find((n) => n.id === 'I')!.shape).toBe('plaintext');
  });

  it('without the skinparam the same link suppresses the shield (rect)', () => {
    const ast = makeAst(
      [iface('I'), comp('A')],
      [{ from: 'I', to: 'A', style: 'solid', arrowHead: 'none', length: 1 }],
    );
    let captured: DotInputGraph | undefined;
    setLayoutInputObserver((g) => { captured = g; });
    try { layoutDescription(ast, defaultTheme, measurer); } finally { setLayoutInputObserver(undefined); }
    expect(captured!.nodes.find((n) => n.id === 'I')!.shape).toBeUndefined();
  });
});

// ===========================================================================
// ── `scale ...` DIRECTIVE PASSTHROUGH (mission G1 I-scale) ─────────────────
//    `ast.scale` is copied straight through to `geo.scale` by
//    `layoutDescription` -- no layout math reads it (scale is an
//    SVG-emission-time-only concern, resolved by `renderDescription`).
//    See `ast.ts`'s `scale` doc comment and `scale-command.ts`'s module doc.
// ===========================================================================

describe('layoutDescription — scale directive passthrough', () => {
  it('copies ast.scale onto geo.scale for the normal (non-degenerate) path', () => {
    const ast: DescriptionDiagramAST = {
      ...makeAst([comp('A'), comp('B')], [solid('A', 'B')]),
      scale: { kind: 'simple', factor: 2 },
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.scale).toEqual({ kind: 'simple', factor: 2 });
  });

  it('copies ast.scale onto geo.scale for the degenerate single-leaf path', () => {
    const ast: DescriptionDiagramAST = {
      ...makeAst([comp('A')], []),
      scale: { kind: 'width', target: 300 },
    };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.scale).toEqual({ kind: 'width', target: 300 });
  });

  it('copies ast.scale onto geo.scale for the empty-AST path', () => {
    const ast: DescriptionDiagramAST = { ...makeAst([], []), scale: { kind: 'simple', factor: 3 } };
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.scale).toEqual({ kind: 'simple', factor: 3 });
  });

  it('leaves geo.scale undefined when ast.scale is absent', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B')]);
    const geo = layoutDescription(ast, defaultTheme, measurer);
    expect(geo.scale).toBeUndefined();
  });

  it('does not perturb node/edge geometry (scale is render-time only)', () => {
    const ast = makeAst([comp('A'), comp('B')], [solid('A', 'B')]);
    const scaledAst: DescriptionDiagramAST = { ...ast, scale: { kind: 'simple', factor: 2 } };
    const unscaled = layoutDescription(ast, defaultTheme, measurer);
    const scaled = layoutDescription(scaledAst, defaultTheme, measurer);
    expect(scaled.nodes).toEqual(unscaled.nodes);
    expect(scaled.edges).toEqual(unscaled.edges);
    expect(scaled.totalWidth).toBe(unscaled.totalWidth);
    expect(scaled.totalHeight).toBe(unscaled.totalHeight);
  });

  it('a real `scale 2` .puml directive threads through parseDescription end-to-end', () => {
    const ast = parseLine('scale 2');
    expect(ast.scale).toEqual({ kind: 'simple', factor: 2 });
  });
});
