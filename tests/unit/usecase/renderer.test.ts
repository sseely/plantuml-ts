import { describe, it, expect } from 'vitest';
import { renderUseCase } from '../../../src/diagrams/usecase/renderer.js';
import { usecasePlugin } from '../../../src/diagrams/usecase/index.js';
import type { UseCaseGeometry, UCNodeGeo, UCEdgeGeo } from '../../../src/diagrams/usecase/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry helpers — construct manually so no ELK is involved
// ---------------------------------------------------------------------------

function makeGeo(overrides?: Partial<UseCaseGeometry>): UseCaseGeometry {
  return {
    totalWidth: 400,
    totalHeight: 300,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

function makeActorNode(overrides?: Partial<UCNodeGeo>): UCNodeGeo {
  return {
    id: 'user',
    kind: 'actor',
    display: 'User',
    x: 50,
    y: 20,
    width: 50,
    height: 70,
    children: [],
    ...overrides,
  };
}

function makeUseCaseNode(overrides?: Partial<UCNodeGeo>): UCNodeGeo {
  return {
    id: 'login',
    kind: 'usecase',
    display: 'Login',
    x: 150,
    y: 80,
    width: 120,
    height: 40,
    children: [],
    ...overrides,
  };
}

function makeContainerNode(overrides?: Partial<UCNodeGeo>): UCNodeGeo {
  return {
    id: 'system',
    kind: 'rectangle',
    display: 'System',
    x: 130,
    y: 60,
    width: 200,
    height: 160,
    children: [],
    ...overrides,
  };
}

function makeEdge(overrides?: Partial<UCEdgeGeo>): UCEdgeGeo {
  return {
    id: 'edge-0',
    from: 'user',
    to: 'login',
    points: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ],
    dashed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC7: minimal geometry → starts with <svg
// ---------------------------------------------------------------------------

describe('renderUseCase — SVG root', () => {
  it('returns a string starting with <svg for empty geometry', () => {
    const svg = renderUseCase(
      makeGeo({ totalWidth: 200, totalHeight: 200 }),
      defaultTheme,
    );
    expect(svg).toMatch(/^<svg /);
  });

  it('includes the correct width and height on the root element', () => {
    const svg = renderUseCase(
      makeGeo({ totalWidth: 500, totalHeight: 350 }),
      defaultTheme,
    );
    expect(svg).toContain('width="500"');
    expect(svg).toContain('height="350"');
  });

  it('closes the svg element', () => {
    const svg = renderUseCase(makeGeo(), defaultTheme);
    expect(svg).toContain('</svg>');
  });
});

// ---------------------------------------------------------------------------
// AC1: actor node → <circle> and ≥3 <line> elements
// ---------------------------------------------------------------------------

describe('renderUseCase — actor node', () => {
  it('emits a <circle> element for the head', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeActorNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('<circle');
  });

  it('emits at least 3 <line> elements (body, arms, legs)', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeActorNode()] }),
      defaultTheme,
    );
    const lineCount = (svg.match(/<line/g) ?? []).length;
    expect(lineCount).toBeGreaterThanOrEqual(3);
  });

  it('emits exactly 4 <line> elements for a single actor (body, arms, left leg, right leg)', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeActorNode()] }),
      defaultTheme,
    );
    const lineCount = (svg.match(/<line/g) ?? []).length;
    expect(lineCount).toBe(4);
  });

  it('renders the actor label text', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeActorNode({ display: 'AdminUser' })] }),
      defaultTheme,
    );
    expect(svg).toContain('AdminUser');
  });

  it('uses actorStroke color for circle and lines', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeActorNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(defaultTheme.colors.graph.actorStroke);
  });

  it('uses actorFill for head circle fill (default theme: none)', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeActorNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.actorFill}"`);
  });

  it('uses a custom actorFill when provided', () => {
    const customTheme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: { ...defaultTheme.colors.graph, actorFill: '#0000FF' },
      },
    };
    const svg = renderUseCase(makeGeo({ nodes: [makeActorNode()] }), customTheme);
    expect(svg).toContain('fill="#0000FF"');
  });
});

// ---------------------------------------------------------------------------
// Business actor node
// ---------------------------------------------------------------------------

describe('renderUseCase — business-actor node', () => {
  function makeBusinessActorNode(overrides?: Partial<UCNodeGeo>): UCNodeGeo {
    return makeActorNode({ kind: 'business-actor', ...overrides });
  }

  it('emits a <circle> element for the head', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessActorNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('<circle');
  });

  it('emits exactly 5 <line> elements (body, arms, left leg, right leg, diagonal)', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessActorNode()] }),
      defaultTheme,
    );
    const lineCount = (svg.match(/<line/g) ?? []).length;
    expect(lineCount).toBe(5);
  });

  it('uses businessActorFill for head circle fill', () => {
    const customTheme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: { ...defaultTheme.colors.graph, businessActorFill: '#FF0000' },
      },
    };
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessActorNode()] }),
      customTheme,
    );
    expect(svg).toContain('fill="#FF0000"');
  });

  it('uses default businessActorFill from default theme', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessActorNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(
      `fill="${defaultTheme.colors.graph.businessActorFill}"`,
    );
  });

  it('renders the business actor label text', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessActorNode({ display: 'Manager' })] }),
      defaultTheme,
    );
    expect(svg).toContain('Manager');
  });

  it('uses actorStroke color for all lines including diagonal', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessActorNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(defaultTheme.colors.graph.actorStroke);
  });

  it('diagonal line coordinates match upstream Java (angles PI/4 ± 21*PI/64, r=8)', () => {
    const node = makeBusinessActorNode({ x: 0, y: 0, width: 50, height: 70 });
    const svg = renderUseCase(makeGeo({ nodes: [node] }), defaultTheme);

    // Head center is at (cx, cy + 8) = (25, 8)
    const cx = 25;
    const headCy = 8;
    const r = 8;
    const alpha = (21 * Math.PI) / 64;
    const angle1 = Math.PI / 4 + alpha;
    const angle2 = Math.PI / 4 - alpha;
    const x1 = cx + r * Math.cos(angle1);
    const y1 = headCy + r * Math.sin(angle1);
    const x2 = cx + r * Math.cos(angle2);
    const y2 = headCy + r * Math.sin(angle2);

    // Check that the SVG contains a line element with these coordinates
    expect(svg).toContain(`x1="${x1}"`);
    expect(svg).toContain(`y1="${y1}"`);
    expect(svg).toContain(`x2="${x2}"`);
    expect(svg).toContain(`y2="${y2}"`);
  });
});

// ---------------------------------------------------------------------------
// AC2: usecase node → <ellipse>
// ---------------------------------------------------------------------------

describe('renderUseCase — usecase node', () => {
  it('emits an <ellipse> element for a usecase node', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeUseCaseNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('<ellipse');
  });

  it('renders the usecase display label', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeUseCaseNode({ display: 'Login' })] }),
      defaultTheme,
    );
    expect(svg).toContain('Login');
  });

  it('uses theme border color for ellipse stroke', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeUseCaseNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(defaultTheme.colors.border);
  });

  it('uses usecaseFill for ellipse fill', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeUseCaseNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(`fill="${defaultTheme.colors.graph.usecaseFill}"`);
  });

  it('uses a custom usecaseFill when provided', () => {
    const customTheme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: { ...defaultTheme.colors.graph, usecaseFill: '#CCFFCC' },
      },
    };
    const svg = renderUseCase(makeGeo({ nodes: [makeUseCaseNode()] }), customTheme);
    expect(svg).toContain('fill="#CCFFCC"');
  });
});

// ---------------------------------------------------------------------------
// Business usecase node
// ---------------------------------------------------------------------------

describe('renderUseCase — business-usecase node', () => {
  function makeBusinessUseCaseNode(overrides?: Partial<UCNodeGeo>): UCNodeGeo {
    return makeUseCaseNode({ kind: 'business-usecase', ...overrides });
  }

  it('emits an <ellipse> element', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessUseCaseNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('<ellipse');
  });

  it('emits a diagonal <line> element across the ellipse interior', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessUseCaseNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('<line');
  });

  it('uses businessUsecaseFill for the ellipse fill', () => {
    const customTheme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          businessUsecaseFill: '#FFA500',
        },
      },
    };
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessUseCaseNode()] }),
      customTheme,
    );
    expect(svg).toContain('fill="#FFA500"');
  });

  it('uses default businessUsecaseFill from default theme', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessUseCaseNode()] }),
      defaultTheme,
    );
    expect(svg).toContain(
      `fill="${defaultTheme.colors.graph.businessUsecaseFill}"`,
    );
  });

  it('renders the business usecase label text', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeBusinessUseCaseNode({ display: 'Pay Invoice' })] }),
      defaultTheme,
    );
    expect(svg).toContain('Pay Invoice');
  });

  it('diagonal line endpoints lie within the ellipse bounding box', () => {
    const node = makeBusinessUseCaseNode({
      x: 10,
      y: 10,
      width: 120,
      height: 40,
    });
    const svg = renderUseCase(makeGeo({ nodes: [node] }), defaultTheme);

    // Extract all line x1/y1/x2/y2 from the SVG
    const linePattern =
      /<line[^/]*x1="([^"]+)"[^/]*y1="([^"]+)"[^/]*x2="([^"]+)"[^/]*y2="([^"]+)"/g;
    const matches = [...svg.matchAll(linePattern)];
    expect(matches.length).toBeGreaterThan(0);

    // At least one line should have all coordinates within the ellipse bounding box
    const withinBounds = matches.some((m) => {
      const x1 = parseFloat(m[1]!);
      const y1 = parseFloat(m[2]!);
      const x2 = parseFloat(m[3]!);
      const y2 = parseFloat(m[4]!);
      return (
        x1 >= node.x &&
        x1 <= node.x + node.width &&
        y1 >= node.y &&
        y1 <= node.y + node.height &&
        x2 >= node.x &&
        x2 <= node.x + node.width &&
        y2 >= node.y &&
        y2 <= node.y + node.height
      );
    });
    expect(withinBounds).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Container nodes
// ---------------------------------------------------------------------------

describe('renderUseCase — container node', () => {
  it('emits a <rect> for a rectangle container', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeContainerNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('<rect');
  });

  it('renders the container label', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeContainerNode({ display: 'System' })] }),
      defaultTheme,
    );
    expect(svg).toContain('System');
  });

  it('renders children inside a container', () => {
    const child = makeUseCaseNode({
      id: 'child-uc',
      display: 'ChildUC',
      x: 160,
      y: 100,
    });
    const container = makeContainerNode({ children: [child] });
    const svg = renderUseCase(makeGeo({ nodes: [container] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('ChildUC');
  });

  it('uses solid stroke for rectangle container border', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeContainerNode()] }),
      defaultTheme,
    );
    // rectangle kind → solid border (no stroke-dasharray)
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('uses dashed stroke for package container border', () => {
    const packageNode = makeContainerNode({ kind: 'package' });
    const svg = renderUseCase(makeGeo({ nodes: [packageNode] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('uses bold font for container label', () => {
    const svg = renderUseCase(
      makeGeo({ nodes: [makeContainerNode()] }),
      defaultTheme,
    );
    expect(svg).toContain('font-weight="bold"');
  });
});

// ---------------------------------------------------------------------------
// AC3: edge with stereotype → «include» text
// ---------------------------------------------------------------------------

describe('renderUseCase — edge stereotype', () => {
  it('emits «include» text for an edge with stereotype="include"', () => {
    const edge = makeEdge({ stereotype: 'include' });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('«include»');
  });

  it('emits «extend» text for an edge with stereotype="extend"', () => {
    const edge = makeEdge({ stereotype: 'extend' });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('«extend»');
  });
});

// ---------------------------------------------------------------------------
// AC4: dashed edge → stroke-dasharray
// ---------------------------------------------------------------------------

describe('renderUseCase — edge dashed', () => {
  it('includes stroke-dasharray on a dashed edge path', () => {
    const edge = makeEdge({ dashed: true });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('stroke-dasharray="5 5"');
  });

  it('does not include stroke-dasharray on a solid edge path', () => {
    const edge = makeEdge({ dashed: false });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    // stroke-dasharray only ever appears in defs (marker patterns) or edges
    // The solid path element itself must not have stroke-dasharray
    const pathMatch = svg.match(/<path[^/]*/g) ?? [];
    const solidPath = pathMatch.find((p) => !p.includes('stroke-dasharray'));
    expect(solidPath).toBeDefined();
  });

  it('emits the edge path element for a solid edge', () => {
    const edge = makeEdge({ dashed: false });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('<path');
  });
});

// ---------------------------------------------------------------------------
// Edge label
// ---------------------------------------------------------------------------

describe('renderUseCase — edge label', () => {
  it('renders edge label text when label is present', () => {
    const edge = makeEdge({
      label: { text: 'my label', x: 150, y: 95 },
    });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('my label');
  });
});

// ---------------------------------------------------------------------------
// AC5, AC6, AC8: usecasePlugin.accepts()
// ---------------------------------------------------------------------------

describe('usecasePlugin.accepts()', () => {
  it('returns false for "actor User" alone — actor keyword deferred to sequencePlugin', () => {
    expect(usecasePlugin.accepts(['actor User'])).toBe(false);
  });

  it('returns true for ":Admin:" colon shorthand', () => {
    expect(usecasePlugin.accepts([':Admin:'])).toBe(true);
  });

  it('returns true for "usecase Login"', () => {
    expect(usecasePlugin.accepts(['usecase Login'])).toBe(true);
  });

  it('returns true for "(Login)" parens shorthand — AC8', () => {
    expect(usecasePlugin.accepts(['(Login)'])).toBe(true);
  });

  it('returns true for "rectangle System"', () => {
    expect(usecasePlugin.accepts(['rectangle System {'])).toBe(true);
  });

  it('returns false for "Alice -> Bob: msg" — AC6', () => {
    expect(usecasePlugin.accepts(['Alice -> Bob: msg'])).toBe(false);
  });

  it('returns false for an empty line array', () => {
    expect(usecasePlugin.accepts([])).toBe(false);
  });

  it('returns false for unrelated diagram syntax', () => {
    expect(
      usecasePlugin.accepts(['class Foo {', '  + bar(): void', '}']),
    ).toBe(false);
  });

  it('scans only the first 20 lines', () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      i === 22 ? 'usecase LateDiagram' : `line ${i}`,
    );
    // usecase appears at index 22 (beyond first 20) — should return false
    expect(usecasePlugin.accepts(lines)).toBe(false);
  });

  it('detects usecase keyword on line 19 (within first 20)', () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      i === 19 ? 'usecase EarlyEnough' : `irrelevant ${i}`,
    );
    expect(usecasePlugin.accepts(lines)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Plugin type
// ---------------------------------------------------------------------------

describe('usecasePlugin — metadata', () => {
  it('has type "usecase"', () => {
    expect(usecasePlugin.type).toBe('usecase');
  });
});

// ---------------------------------------------------------------------------
// Edge path geometry — branch coverage for buildEdgePath and edgeMidpoint
// ---------------------------------------------------------------------------

describe('renderUseCase — edge path variants', () => {
  it('zero-point edge produces valid SVG with no path element for the edge', () => {
    const edge = makeEdge({ points: [] });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toMatch(/^<svg /);
  });

  it('one-point edge produces valid SVG (degenerate M-only path)', () => {
    const edge = makeEdge({ points: [{ x: 10, y: 10 }] });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toMatch(/^<svg /);
  });

  it('three-point edge uses smooth polyline (Q bezier segments)', () => {
    const edge = makeEdge({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ],
    });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    // Smooth polyline produces Q commands for interior waypoints
    expect(svg).toContain('Q ');
  });

  it('three-point edge with label renders the label text', () => {
    const edge = makeEdge({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 },
      ],
      label: { text: 'mid-label', x: 0, y: 0 },
    });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('mid-label');
  });

  it('one-point edge with label still renders the label', () => {
    const edge = makeEdge({
      points: [{ x: 10, y: 20 }],
      label: { text: 'solo-label', x: 10, y: 20 },
    });
    const svg = renderUseCase(makeGeo({ edges: [edge] }), defaultTheme);
    expect(svg).toContain('solo-label');
  });
});
