import { describe, it, expect } from 'vitest';
import { layoutUseCase } from '../../../src/diagrams/usecase/layout.js';
import type { UseCaseDiagramAST, UCNode, UCLink } from '../../../src/diagrams/usecase/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { measureLatex } from '../../../src/core/latex.js';

const measurer = new FormulaMeasurer();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actor(id: string, display = id): UCNode {
  return { id, display, kind: 'actor', children: [] };
}

function usecase(id: string, display = id): UCNode {
  return { id, display, kind: 'usecase', children: [] };
}

function solid(from: string, to: string, label?: string): UCLink {
  return { from, to, style: 'solid', ...(label !== undefined ? { label } : {}) };
}

function dashed(
  from: string,
  to: string,
  stereotype?: string,
  label?: string,
): UCLink {
  return {
    from,
    to,
    style: 'dashed',
    ...(stereotype !== undefined ? { stereotype } : {}),
    ...(label !== undefined ? { label } : {}),
  };
}

function container(
  id: string,
  kind: UCNode['kind'],
  children: UCNode[],
): UCNode {
  return { id, display: id, kind, children };
}

function makeAst(nodes: UCNode[], links: UCLink[]): UseCaseDiagramAST {
  return { nodes, links };
}

// ---------------------------------------------------------------------------
// AC 1 — 2 actors + 3 use cases: all geometry entries have positive coordinates
// ---------------------------------------------------------------------------

describe('layoutUseCase — basic actor+usecase diagram (AC 1)', () => {
  it('all UCNodeGeo entries have x, y, width, height > 0', () => {
    const ast = makeAst(
      [
        actor('user', 'User'),
        actor('admin', 'Admin'),
        usecase('login', 'Login'),
        usecase('logout', 'Logout'),
        usecase('manage', 'Manage Users'),
      ],
      [
        solid('user', 'login'),
        solid('user', 'logout'),
        solid('admin', 'manage'),
      ],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(5);
    for (const node of geo.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it('produces 3 edges for 3 links', () => {
    const ast = makeAst(
      [
        actor('user', 'User'),
        actor('admin', 'Admin'),
        usecase('login', 'Login'),
        usecase('logout', 'Logout'),
        usecase('manage', 'Manage Users'),
      ],
      [
        solid('user', 'login'),
        solid('user', 'logout'),
        solid('admin', 'manage'),
      ],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — <<include>> link: dashed=true, stereotype="include"
// ---------------------------------------------------------------------------

describe('layoutUseCase — dashed link with stereotype (AC 2)', () => {
  it('<<include>> link produces dashed=true and stereotype="include"', () => {
    const ast = makeAst(
      [usecase('checkout', 'Checkout'), usecase('pay', 'Pay')],
      [dashed('checkout', 'pay', 'include')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);

    expect(geo.edges).toHaveLength(1);
    const edge = geo.edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('include');
  });

  it('solid link produces dashed=false', () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Use')],
      [solid('u', 'uc')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.dashed).toBe(false);
  });

  it('dashed link without stereotype has no stereotype field', () => {
    const ast = makeAst(
      [usecase('a', 'A'), usecase('b', 'B')],
      [dashed('a', 'b')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.stereotype).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC 3 — rectangle container with 2 use cases
// ---------------------------------------------------------------------------

describe('layoutUseCase — container nodes (AC 3)', () => {
  it('container node encompasses both children', () => {
    const child1 = usecase('uc1', 'Order Item');
    const child2 = usecase('uc2', 'Track Order');
    const rect = container('shopping', 'rectangle', [child1, child2]);
    const ast = makeAst([rect], []);

    const geo = layoutUseCase(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    const containerGeo = geo.nodes[0]!;
    expect(containerGeo.id).toBe('shopping');
    expect(containerGeo.children).toHaveLength(2);

    // Each child must sit within the container bounds
    for (const child of containerGeo.children) {
      expect(child.x + child.width).toBeLessThanOrEqual(
        containerGeo.x + containerGeo.width + 1,
      );
      expect(child.y + child.height).toBeLessThanOrEqual(
        containerGeo.y + containerGeo.height + 1,
      );
    }
  });

  it('container geometry has positive dimensions', () => {
    const rect = container('box', 'rectangle', [
      usecase('u1', 'UseA'),
      usecase('u2', 'UseB'),
    ]);
    const geo = layoutUseCase(makeAst([rect], []), defaultTheme, measurer);
    const c = geo.nodes[0]!;
    expect(c.width).toBeGreaterThan(0);
    expect(c.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — actor fixed size
// ---------------------------------------------------------------------------

describe('layoutUseCase — actor sizing (AC 4)', () => {
  it('actor UCNodeGeo has width=50 and height=70', () => {
    const ast = makeAst([actor('u', 'User')], []);
    const geo = layoutUseCase(ast, defaultTheme, measurer);

    const actorGeo = geo.nodes.find((n) => n.id === 'u')!;
    expect(actorGeo.width).toBe(50);
    expect(actorGeo.height).toBe(70);
  });

  it('multiple actors all have the same fixed size', () => {
    const ast = makeAst(
      [actor('a1', 'Alice'), actor('a2', 'Bob'), actor('a3', 'Charlie')],
      [],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    for (const n of geo.nodes) {
      expect(n.width).toBe(50);
      expect(n.height).toBe(70);
    }
  });
});

// ---------------------------------------------------------------------------
// AC 5 — usecase minimum width
// ---------------------------------------------------------------------------

describe('layoutUseCase — usecase sizing (AC 5)', () => {
  it('usecase with short display has width >= 120', () => {
    const ast = makeAst([usecase('uc', 'Hi')], []);
    const geo = layoutUseCase(ast, defaultTheme, measurer);

    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBeGreaterThanOrEqual(120);
  });

  it('usecase with long display has width > 120', () => {
    const ast = makeAst(
      [usecase('uc', 'This is a very long use case display text')],
      [],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBeGreaterThan(120);
  });
});

// ---------------------------------------------------------------------------
// AC 6 — empty AST
// ---------------------------------------------------------------------------

describe('layoutUseCase — empty AST (AC 6)', () => {
  it('returns empty arrays and totalWidth=0', () => {
    const geo = layoutUseCase(makeAst([], []), defaultTheme, measurer);
    expect(geo.nodes).toHaveLength(0);
    expect(geo.edges).toHaveLength(0);
    expect(geo.totalWidth).toBe(0);
    expect(geo.totalHeight).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge from/to pass-through
// ---------------------------------------------------------------------------

describe('layoutUseCase — edge from/to', () => {
  it('edge preserves from and to from the link', () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Do Something')],
      [solid('u', 'uc')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.from).toBe('u');
    expect(edge.to).toBe('uc');
  });

  it('edge id follows "edge-N" pattern', () => {
    const ast = makeAst(
      [actor('a', 'A'), usecase('b', 'B'), usecase('c', 'C')],
      [solid('a', 'b'), solid('a', 'c')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.id).toBe('edge-0');
    expect(geo.edges[1]!.id).toBe('edge-1');
  });
});

// ---------------------------------------------------------------------------
// Edge points
// ---------------------------------------------------------------------------

describe('layoutUseCase — edge points', () => {
  it('each edge has at least 2 points (start + end)', () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.points.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Stereotype on node
// ---------------------------------------------------------------------------

describe('layoutUseCase — node stereotype', () => {
  it('node stereotype is preserved in UCNodeGeo', () => {
    const node: UCNode = {
      id: 'sys',
      display: 'System',
      kind: 'rectangle',
      children: [],
      stereotype: 'system',
    };
    const geo = layoutUseCase(makeAst([node], []), defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBe('system');
  });

  it('node without stereotype has no stereotype field', () => {
    const ast = makeAst([actor('u', 'User')], []);
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// totalWidth / totalHeight
// ---------------------------------------------------------------------------

describe('layoutUseCase — diagram dimensions', () => {
  it('totalWidth > 0 for non-empty diagram', () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight > 0 for non-empty diagram', () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Package container kind
// ---------------------------------------------------------------------------

describe('layoutUseCase — package container', () => {
  it('package container with children returns children in UCNodeGeo', () => {
    const pkg = container('pkg', 'package', [
      usecase('uc1', 'Feature A'),
      usecase('uc2', 'Feature B'),
    ]);
    const geo = layoutUseCase(makeAst([pkg], []), defaultTheme, measurer);
    const pkgGeo = geo.nodes[0]!;
    expect(pkgGeo.kind).toBe('package');
    expect(pkgGeo.children).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// <<extend>> stereotype
// ---------------------------------------------------------------------------

describe('layoutUseCase — extend stereotype', () => {
  it('<<extend>> link produces dashed=true and stereotype="extend"', () => {
    const ast = makeAst(
      [usecase('base', 'Base Flow'), usecase('ext', 'Extended Flow')],
      [dashed('ext', 'base', 'extend')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('extend');
  });
});

// ---------------------------------------------------------------------------
// AC 7 — sibling overlap correction
// ---------------------------------------------------------------------------

describe('layoutUseCase — actor outside container (AC 7)', () => {
  it('top-level actor is to the left of a sibling container', () => {
    const childUC = usecase('uc1', 'Login');
    const rect = container('sys', 'rectangle', [childUC]);
    const ast = makeAst(
      [actor('u', 'User'), rect],
      [solid('u', 'uc1')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const actorGeo = geo.nodes.find((n) => n.id === 'u')!;
    const containerGeo = geo.nodes.find((n) => n.id === 'sys')!;
    expect(actorGeo.x + actorGeo.width).toBeLessThan(containerGeo.x);
  });

  it('two top-level actors are both to the left of a sibling container', () => {
    const childUC1 = usecase('uc1', 'Browse Products');
    const childUC2 = usecase('uc2', 'Checkout');
    const childUC3 = usecase('uc3', 'Track Order');
    const rect = container('sys', 'rectangle', [childUC1, childUC2, childUC3]);
    const ast = makeAst(
      [actor('c', 'Customer'), actor('sa', 'Support Agent'), rect],
      [
        solid('c', 'uc1'),
        solid('c', 'uc2'),
        solid('sa', 'uc3'),
      ],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const containerGeo = geo.nodes.find((n) => n.id === 'sys')!;
    const customerGeo = geo.nodes.find((n) => n.id === 'c')!;
    const agentGeo = geo.nodes.find((n) => n.id === 'sa')!;
    expect(customerGeo.x + customerGeo.width).toBeLessThan(containerGeo.x);
    expect(agentGeo.x + agentGeo.width).toBeLessThan(containerGeo.x);
  });

  it('children remain inside container bounds after sibling-overlap correction', () => {
    const childUC = usecase('uc1', 'Login');
    const rect = container('sys', 'rectangle', [childUC]);
    const ast = makeAst(
      [actor('u', 'User'), rect],
      [solid('u', 'uc1')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const containerGeo = geo.nodes.find((n) => n.id === 'sys')!;
    for (const child of containerGeo.children) {
      expect(child.x).toBeGreaterThanOrEqual(containerGeo.x);
      expect(child.y).toBeGreaterThanOrEqual(containerGeo.y);
      expect(child.x + child.width).toBeLessThanOrEqual(
        containerGeo.x + containerGeo.width + 1,
      );
      expect(child.y + child.height).toBeLessThanOrEqual(
        containerGeo.y + containerGeo.height + 1,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Edge label
// ---------------------------------------------------------------------------

describe('layoutUseCase — edge label', () => {
  it('solid link with label has label geometry attached to the edge', () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc', 'uses')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.label).toBeDefined();
    expect(edge.label!.text).toBe('uses');
    expect(typeof edge.label!.x).toBe('number');
    expect(typeof edge.label!.y).toBe('number');
  });

  it('dashed link with label and stereotype produces both fields', () => {
    const ast = makeAst(
      [usecase('a', 'Order'), usecase('b', 'Pay')],
      [dashed('a', 'b', 'include', 'step')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('include');
    expect(edge.label).toBeDefined();
    expect(edge.label!.text).toBe('step');
  });
});

// ---------------------------------------------------------------------------
// Intra-container edges (both endpoints inside same container)
// ---------------------------------------------------------------------------

describe('layoutUseCase — intra-container edges', () => {
  it('edge between two use cases inside same container is included', () => {
    const uc1 = usecase('uc1', 'Checkout');
    const uc2 = usecase('uc2', 'Apply Discount');
    const rect = container('sys', 'rectangle', [uc1, uc2]);
    const ast = makeAst(
      [rect],
      [dashed('uc1', 'uc2', 'extend')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    // Edge between siblings inside the same container should be present
    expect(geo.edges).toHaveLength(1);
    const edge = geo.edges[0]!;
    expect(edge.from).toBe('uc1');
    expect(edge.to).toBe('uc2');
    expect(edge.points.length).toBeGreaterThanOrEqual(2);
  });

  it('intra-container edge endpoints have positive coordinates', () => {
    const uc1 = usecase('uc1', 'Browse');
    const uc2 = usecase('uc2', 'Filter');
    const rect = container('sys', 'rectangle', [uc1, uc2]);
    const ast = makeAst(
      [rect],
      [solid('uc1', 'uc2')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    for (const pt of edge.points) {
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.y).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Leaf node stereotype (actor / usecase with stereotype)
// ---------------------------------------------------------------------------

describe('layoutUseCase — leaf node stereotype', () => {
  it('usecase with stereotype preserves it in UCNodeGeo', () => {
    const node: UCNode = {
      id: 'uc',
      display: 'Pay',
      kind: 'usecase',
      children: [],
      stereotype: 'boundary',
    };
    const geo = layoutUseCase(makeAst([node], []), defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBe('boundary');
  });

  it('actor with stereotype preserves it in UCNodeGeo', () => {
    const node: UCNode = {
      id: 'a',
      display: 'Admin',
      kind: 'actor',
      children: [],
      stereotype: 'system',
    };
    const geo = layoutUseCase(makeAst([node], []), defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBe('system');
  });
});

// ---------------------------------------------------------------------------
// Nested container (container inside container)
// ---------------------------------------------------------------------------

describe('layoutUseCase — nested container', () => {
  it('container nested inside another container has children geos', () => {
    const inner = container('inner', 'package', [
      usecase('uc1', 'Do Something'),
    ]);
    const outer = container('outer', 'rectangle', [inner]);
    const geo = layoutUseCase(makeAst([outer], []), defaultTheme, measurer);

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
    const inner = container('inner', 'package', [
      usecase('uc1', 'Feature'),
    ]);
    const outer = container('outer', 'rectangle', [inner]);
    const geo = layoutUseCase(makeAst([outer], []), defaultTheme, measurer);

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
    const ast = makeAst(
      [actor('u', 'User'), outer],
      [solid('u', 'uc1')],
    );
    const geo = layoutUseCase(ast, defaultTheme, measurer);
    // The edge from the actor to the use case inside the nested container
    // must be present with the original from/to IDs.
    const edge = geo.edges.find((e) => e.from === 'u' && e.to === 'uc1');
    expect(edge).toBeDefined();
    expect(edge!.points.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Empty nested container (covers EMPTY_CONTAINER_WIDTH/HEIGHT fallback branches)
// ---------------------------------------------------------------------------

describe('layoutUseCase — empty nested container', () => {
  it('container nested inside another container with no children uses empty size', () => {
    const emptyInner = container('inner', 'package', []);
    const outer = container('outer', 'rectangle', [emptyInner]);
    const geo = layoutUseCase(makeAst([outer], []), defaultTheme, measurer);

    // Outer container is present
    expect(geo.nodes).toHaveLength(1);
    const outerGeo = geo.nodes[0]!;
    expect(outerGeo.id).toBe('outer');

    // The inner empty container should be represented as a child
    expect(outerGeo.children).toHaveLength(1);
    const innerGeo = outerGeo.children[0]!;
    expect(innerGeo.id).toBe('inner');
    expect(innerGeo.width).toBeGreaterThan(0);
    expect(innerGeo.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// LaTeX label sizing (T2)
// ---------------------------------------------------------------------------

describe('layoutUseCase — latex label sizing', () => {
  it('usecase with latex display gets dimensions from measureLatex', () => {
    const display = '<latex>\\frac{a}{b}</latex>';
    const node: UCNode = { id: 'uc', display, kind: 'usecase', children: [] };
    const geo = layoutUseCase(makeAst([node], []), defaultTheme, measurer);

    const expected = measureLatex(display);
    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBe(expected.width);
    expect(ucGeo.height).toBe(expected.height);
  });

  it('actor with latex display still uses fixed ACTOR_WIDTH/HEIGHT', () => {
    const display = '<latex>x^2</latex>';
    const node: UCNode = { id: 'a', display, kind: 'actor', children: [] };
    const geo = layoutUseCase(makeAst([node], []), defaultTheme, measurer);

    const actorGeo = geo.nodes.find((n) => n.id === 'a')!;
    expect(actorGeo.width).toBe(50);
    expect(actorGeo.height).toBe(70);
  });

  it('plain usecase display uses string measurer path (no regression)', () => {
    const display = 'Login';
    const node: UCNode = { id: 'uc', display, kind: 'usecase', children: [] };
    const geo = layoutUseCase(makeAst([node], []), defaultTheme, measurer);

    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    // Must not use latex sizing — width comes from string measurer
    expect(ucGeo.width).toBeGreaterThanOrEqual(120);
    // Height is the plain USECASE_HEIGHT constant
    expect(ucGeo.height).toBe(40);
  });

  it('diagram with one latex usecase and one plain usecase has all positive geometry', () => {
    const latexNode: UCNode = {
      id: 'latex-uc',
      display: '<latex>\\sum_{i=1}^{n} i</latex>',
      kind: 'usecase',
      children: [],
    };
    const plainNode: UCNode = {
      id: 'plain-uc',
      display: 'Check Out',
      kind: 'usecase',
      children: [],
    };
    const ast = makeAst([latexNode, plainNode], [solid('latex-uc', 'plain-uc')]);
    const geo = layoutUseCase(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(2);
    for (const n of geo.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.y).toBeGreaterThan(0);
      expect(n.width).toBeGreaterThan(0);
      expect(n.height).toBeGreaterThan(0);
    }
  });
});
