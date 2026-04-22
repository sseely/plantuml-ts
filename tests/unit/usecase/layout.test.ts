import { describe, it, expect } from 'vitest';
import { layoutUseCase } from '../../../src/diagrams/usecase/layout.js';
import type { UseCaseDiagramAST, UCNode, UCLink } from '../../../src/diagrams/usecase/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

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
  it('all UCNodeGeo entries have x, y, width, height > 0', async () => {
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
    const geo = await layoutUseCase(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(5);
    for (const node of geo.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it('produces 3 edges for 3 links', async () => {
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
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — <<include>> link: dashed=true, stereotype="include"
// ---------------------------------------------------------------------------

describe('layoutUseCase — dashed link with stereotype (AC 2)', () => {
  it('<<include>> link produces dashed=true and stereotype="include"', async () => {
    const ast = makeAst(
      [usecase('checkout', 'Checkout'), usecase('pay', 'Pay')],
      [dashed('checkout', 'pay', 'include')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);

    expect(geo.edges).toHaveLength(1);
    const edge = geo.edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('include');
  });

  it('solid link produces dashed=false', async () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Use')],
      [solid('u', 'uc')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.dashed).toBe(false);
  });

  it('dashed link without stereotype has no stereotype field', async () => {
    const ast = makeAst(
      [usecase('a', 'A'), usecase('b', 'B')],
      [dashed('a', 'b')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.stereotype).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC 3 — rectangle container with 2 use cases
// ---------------------------------------------------------------------------

describe('layoutUseCase — container nodes (AC 3)', () => {
  it('container node encompasses both children', async () => {
    const child1 = usecase('uc1', 'Order Item');
    const child2 = usecase('uc2', 'Track Order');
    const rect = container('shopping', 'rectangle', [child1, child2]);
    const ast = makeAst([rect], []);

    const geo = await layoutUseCase(ast, defaultTheme, measurer);

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

  it('container geometry has positive dimensions', async () => {
    const rect = container('box', 'rectangle', [
      usecase('u1', 'UseA'),
      usecase('u2', 'UseB'),
    ]);
    const geo = await layoutUseCase(makeAst([rect], []), defaultTheme, measurer);
    const c = geo.nodes[0]!;
    expect(c.width).toBeGreaterThan(0);
    expect(c.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — actor fixed size
// ---------------------------------------------------------------------------

describe('layoutUseCase — actor sizing (AC 4)', () => {
  it('actor UCNodeGeo has width=50 and height=70', async () => {
    const ast = makeAst([actor('u', 'User')], []);
    const geo = await layoutUseCase(ast, defaultTheme, measurer);

    const actorGeo = geo.nodes.find((n) => n.id === 'u')!;
    expect(actorGeo.width).toBe(50);
    expect(actorGeo.height).toBe(70);
  });

  it('multiple actors all have the same fixed size', async () => {
    const ast = makeAst(
      [actor('a1', 'Alice'), actor('a2', 'Bob'), actor('a3', 'Charlie')],
      [],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
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
  it('usecase with short display has width >= 120', async () => {
    const ast = makeAst([usecase('uc', 'Hi')], []);
    const geo = await layoutUseCase(ast, defaultTheme, measurer);

    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBeGreaterThanOrEqual(120);
  });

  it('usecase with long display has width > 120', async () => {
    const ast = makeAst(
      [usecase('uc', 'This is a very long use case display text')],
      [],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    const ucGeo = geo.nodes.find((n) => n.id === 'uc')!;
    expect(ucGeo.width).toBeGreaterThan(120);
  });
});

// ---------------------------------------------------------------------------
// AC 6 — empty AST
// ---------------------------------------------------------------------------

describe('layoutUseCase — empty AST (AC 6)', () => {
  it('resolves with empty arrays and totalWidth=0', async () => {
    const geo = await layoutUseCase(makeAst([], []), defaultTheme, measurer);
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
  it('edge preserves from and to from the link', async () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Do Something')],
      [solid('u', 'uc')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.from).toBe('u');
    expect(edge.to).toBe('uc');
  });

  it('edge id follows "edge-N" pattern', async () => {
    const ast = makeAst(
      [actor('a', 'A'), usecase('b', 'B'), usecase('c', 'C')],
      [solid('a', 'b'), solid('a', 'c')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.edges[0]!.id).toBe('edge-0');
    expect(geo.edges[1]!.id).toBe('edge-1');
  });
});

// ---------------------------------------------------------------------------
// Edge points
// ---------------------------------------------------------------------------

describe('layoutUseCase — edge points', () => {
  it('each edge has at least 2 points (start + end)', async () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.points.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Stereotype on node
// ---------------------------------------------------------------------------

describe('layoutUseCase — node stereotype', () => {
  it('node stereotype is preserved in UCNodeGeo', async () => {
    const node: UCNode = {
      id: 'sys',
      display: 'System',
      kind: 'rectangle',
      children: [],
      stereotype: 'system',
    };
    const geo = await layoutUseCase(makeAst([node], []), defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBe('system');
  });

  it('node without stereotype has no stereotype field', async () => {
    const ast = makeAst([actor('u', 'User')], []);
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.nodes[0]!.stereotype).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// totalWidth / totalHeight
// ---------------------------------------------------------------------------

describe('layoutUseCase — diagram dimensions', () => {
  it('totalWidth > 0 for non-empty diagram', async () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.totalWidth).toBeGreaterThan(0);
  });

  it('totalHeight > 0 for non-empty diagram', async () => {
    const ast = makeAst(
      [actor('u', 'User'), usecase('uc', 'Login')],
      [solid('u', 'uc')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Package container kind
// ---------------------------------------------------------------------------

describe('layoutUseCase — package container', () => {
  it('package container with children returns children in UCNodeGeo', async () => {
    const pkg = container('pkg', 'package', [
      usecase('uc1', 'Feature A'),
      usecase('uc2', 'Feature B'),
    ]);
    const geo = await layoutUseCase(makeAst([pkg], []), defaultTheme, measurer);
    const pkgGeo = geo.nodes[0]!;
    expect(pkgGeo.kind).toBe('package');
    expect(pkgGeo.children).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// <<extend>> stereotype
// ---------------------------------------------------------------------------

describe('layoutUseCase — extend stereotype', () => {
  it('<<extend>> link produces dashed=true and stereotype="extend"', async () => {
    const ast = makeAst(
      [usecase('base', 'Base Flow'), usecase('ext', 'Extended Flow')],
      [dashed('ext', 'base', 'extend')],
    );
    const geo = await layoutUseCase(ast, defaultTheme, measurer);
    const edge = geo.edges[0]!;
    expect(edge.dashed).toBe(true);
    expect(edge.stereotype).toBe('extend');
  });
});
