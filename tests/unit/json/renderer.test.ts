import { describe, it, expect } from 'vitest';
import { renderJson } from '../../../src/diagrams/json/renderer.js';
import { defaultTheme } from '../../../src/core/theme.js';
import type { JsonGeometry, JsonNodeGeo, JsonEdgeGeo, JsonRowGeo } from '../../../src/diagrams/json/layout.js';
import type { Theme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry factories
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<JsonRowGeo> & Pick<JsonRowGeo, 'valueType'>): JsonRowGeo {
  const base: JsonRowGeo = {
    key: 'key',
    value: 'value',
    valueLines: ['value'],
    highlight: false,
    y: 4,
    height: 20,
    ...overrides,
  };
  // Auto-derive valueLines from value when not explicitly provided
  if (!('valueLines' in overrides)) {
    base.valueLines = [base.value];
  }
  return base;
}

function makeNode(overrides: Partial<JsonNodeGeo> = {}): JsonNodeGeo {
  return {
    id: 'n0',
    x: 10,
    y: 20,
    width: 200,
    height: 60,
    keyColWidth: 80,
    valueColWidth: 120,
    rows: [
      makeRow({ key: 'name', value: 'Alice', valueType: 'string', y: 4, height: 20 }),
    ],
    ...overrides,
  };
}

function makeGeo(overrides: Partial<JsonGeometry> = {}): JsonGeometry {
  return {
    nodes: [],
    edges: [],
    width: 400,
    height: 300,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<JsonEdgeGeo> = {}): JsonEdgeGeo {
  return {
    points: [{ x: 100, y: 50 }, { x: 200, y: 50 }],
    spline: false,
    ...overrides,
  };
}

/**
 * A theme whose graph.json is absent so ?? fallback defaults in the renderer
 * are exercised.  We build the graph object without the json key so
 * exactOptionalPropertyTypes is satisfied (omitting an optional key is legal;
 * assigning undefined to it is not).
 *
 * The destructuring extracts and discards 'json'; the rest spread produces
 * an object whose type satisfies Theme['colors']['graph'] since json is optional.
 */
function makeGraphWithoutJson(): Theme['colors']['graph'] {
  const { json: _unused, ...rest } = defaultTheme.colors.graph;
  void _unused;
  return rest;
}

const noJsonTheme: Theme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    graph: makeGraphWithoutJson(),
  },
};

/**
 * Strip the leading <defs>…</defs> block that svgRoot always emits so
 * assertions don't accidentally match attributes inside marker definitions.
 */
function contentAfterDefs(svg: string): string {
  const idx = svg.indexOf('</defs>');
  return idx === -1 ? svg : svg.slice(idx + '</defs>'.length);
}

// ---------------------------------------------------------------------------
// Acceptance criteria
// ---------------------------------------------------------------------------

describe('renderJson — AC #1: string value color', () => {
  it('SVG contains the string value fill color for a string-typed row', () => {
    const geo = makeGeo({
      nodes: [makeNode()],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    // Default string value color from theme
    expect(body).toContain('fill="#3A6E96"');
  });
});

describe('renderJson — AC #2: highlight background', () => {
  it('SVG contains a rect with the highlightBackground color for a highlighted row', () => {
    const highlightedRow = makeRow({
      key: 'alert',
      value: 'yes',
      valueType: 'string',
      highlight: true,
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [highlightedRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    const hlColor = defaultTheme.colors.graph.json?.highlightBackground ?? '#FEFECE';
    expect(body).toContain(`fill="${hlColor}"`);
  });
});

describe('renderJson — AC #3: edge produces a path with d="M"', () => {
  it('SVG contains a <path with d="M for a 2-node connected graph', () => {
    const nodeA = makeNode({ id: 'n0', x: 0, y: 0 });
    const nodeB = makeNode({ id: 'n1', x: 300, y: 0 });
    const edge = makeEdge({
      points: [{ x: 200, y: 30 }, { x: 300, y: 30 }],
    });
    const geo = makeGeo({ nodes: [nodeA, nodeB], edges: [edge] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('<path');
    expect(body).toContain('d="M');
  });
});

describe('renderJson — AC #4: boolean true row shows ☑', () => {
  it('SVG text contains ☑ for a boolean true row', () => {
    const boolRow = makeRow({
      key: 'active',
      value: '☑ true',
      valueType: 'boolean',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [boolRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('☑');
  });
});

describe('renderJson — AC #5: null row shows ␀', () => {
  it('SVG text contains ␀ for a null-typed row', () => {
    const nullRow = makeRow({
      key: 'nothing',
      value: '␀',
      valueType: 'null',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [nullRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('␀');
  });
});

// ---------------------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------------------

describe('renderJson — structural', () => {
  it('empty geometry returns valid SVG without crashing', () => {
    const geo = makeGeo();
    const svg = renderJson(geo, defaultTheme);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('</svg>');
  });

  it('empty geometry returns svgRoot with 0 dimensions', () => {
    const geo = makeGeo({ nodes: [], edges: [], width: 0, height: 0 });
    const svg = renderJson(geo, defaultTheme);
    expect(svg).toContain('width="0"');
    expect(svg).toContain('height="0"');
  });

  it('each node produces a <g transform="translate( element', () => {
    const nodes = [
      makeNode({ id: 'n0', x: 10, y: 20 }),
      makeNode({ id: 'n1', x: 300, y: 50 }),
    ];
    const geo = makeGeo({ nodes });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('<g transform="translate(10, 20)">');
    expect(body).toContain('<g transform="translate(300, 50)">');
  });

  it('outer border rect has rx="10" (plantuml.skin default)', () => {
    const geo = makeGeo({ nodes: [makeNode()] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('rx="10"');
  });

  it('key column background uses headerBackground color', () => {
    const geo = makeGeo({ nodes: [makeNode()] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    const headerColor = defaultTheme.colors.graph.json?.headerBackground ?? '#F1F1F1';
    expect(body).toContain(`fill="${headerColor}"`);
  });

  it('row separator lines are emitted for rows with y > 0', () => {
    const rows: JsonRowGeo[] = [
      makeRow({ key: 'a', value: '1', valueType: 'number', y: 0, height: 20 }),
      makeRow({ key: 'b', value: '2', valueType: 'number', y: 20, height: 20 }),
      makeRow({ key: 'c', value: '3', valueType: 'number', y: 40, height: 20 }),
    ];
    const node = makeNode({ rows });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    // Row at y=20 and y=40 should emit separator lines
    expect(body).toContain('y1="20"');
    expect(body).toContain('y2="20"');
    expect(body).toContain('y1="40"');
    expect(body).toContain('y2="40"');
    // Row at y=0 should NOT emit a separator
    const lineCount = (body.match(/<line /g) ?? []).length;
    // 2 row separators + 1 vertical divider = 3 total lines
    expect(lineCount).toBe(3);
  });

  it('nested valueType row with empty value produces no value text element', () => {
    const nestedRow = makeRow({
      key: 'child',
      value: '',
      valueType: 'nested',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [nestedRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    // Only one text element (the key), no second text for empty value
    const textMatches = body.match(/<text /g) ?? [];
    expect(textMatches.length).toBe(1);
  });

  it('spline edge with 4+ points builds cubic Bézier path', () => {
    const edge = makeEdge({
      spline: true,
      points: [
        { x: 0,   y: 0  },
        { x: 50,  y: 0  },
        { x: 50,  y: 50 },
        { x: 100, y: 50 },
      ],
    });
    const geo = makeGeo({
      nodes: [makeNode({ id: 'n0' }), makeNode({ id: 'n1', x: 200, y: 0 })],
      edges: [edge],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('d="M 0 0 C 50 0 50 50 100 50"');
  });

  it('non-spline edge with 2 points builds stub+bezier path', () => {
    const edge = makeEdge({
      spline: false,
      points: [{ x: 10, y: 20 }, { x: 90, y: 60 }],
    });
    const geo = makeGeo({
      nodes: [makeNode({ id: 'n0' }), makeNode({ id: 'n1', x: 200, y: 0 })],
      edges: [edge],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('d="M -3 20 L 10 20 C 42 20 58 44 90 60"');
  });

  it('number value uses numberValue color', () => {
    const numRow = makeRow({
      key: 'count',
      value: '42',
      valueType: 'number',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [numRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    const numColor = defaultTheme.colors.graph.json?.numberValue ?? '#A67F52';
    expect(body).toContain(`fill="${numColor}"`);
  });

  it('null value uses nullValue color', () => {
    const nullRow = makeRow({
      key: 'nothing',
      value: '␀',
      valueType: 'null',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [nullRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    const nullColor = defaultTheme.colors.graph.json?.nullValue ?? '#767676';
    expect(body).toContain(`fill="${nullColor}"`);
  });

  it('boolean value uses booleanValue color', () => {
    const boolRow = makeRow({
      key: 'flag',
      value: '☑ true',
      valueType: 'boolean',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [boolRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    const boolColor = defaultTheme.colors.graph.json?.booleanValue ?? '#BE5D47';
    expect(body).toContain(`fill="${boolColor}"`);
  });

  it('SVG root has correct width and height from geometry', () => {
    const geo = makeGeo({ nodes: [makeNode()], width: 500, height: 350 });
    const svg = renderJson(geo, defaultTheme);
    expect(svg).toContain('width="500"');
    expect(svg).toContain('height="350"');
  });

  it('edge with zero points produces no path element', () => {
    const edge = makeEdge({ points: [] });
    const geo = makeGeo({
      nodes: [makeNode()],
      edges: [edge],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).not.toContain('<path');
  });
});

// ---------------------------------------------------------------------------
// Branch coverage
// ---------------------------------------------------------------------------

describe('renderJson — branch coverage', () => {
  it('single-point edge produces a degenerate M-only path', () => {
    const edge = makeEdge({ points: [{ x: 50, y: 30 }] });
    const geo = makeGeo({
      nodes: [makeNode()],
      edges: [edge],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('d="M 50 30"');
  });

  it('spline=true with only 2 points falls back to stub+bezier path', () => {
    const edge = makeEdge({
      spline: true,
      points: [{ x: 10, y: 10 }, { x: 90, y: 90 }],
    });
    const geo = makeGeo({
      nodes: [makeNode()],
      edges: [edge],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    expect(body).toContain('d="M -3 10 L 10 10 C 42 10 58 58 90 90"');
  });

  it('nested valueType with non-empty value uses keyText color (default branch)', () => {
    const nestedRow = makeRow({
      key: 'obj',
      value: '{...}',
      valueType: 'nested',
      y: 4,
      height: 20,
    });
    const node = makeNode({ rows: [nestedRow] });
    const geo = makeGeo({ nodes: [node] });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    const keyColor = defaultTheme.colors.graph.json?.keyText ?? '#181818';
    // Value text uses keyText color — the default branch of valueColor
    expect(body).toContain(`fill="${keyColor}"`);
  });

  it('spline edge with 7 points builds two cubic Bézier segments', () => {
    const edge = makeEdge({
      spline: true,
      points: [
        { x: 0,   y: 0  },
        { x: 10,  y: 0  },
        { x: 20,  y: 0  },
        { x: 30,  y: 0  },
        { x: 40,  y: 0  },
        { x: 50,  y: 0  },
        { x: 60,  y: 0  },
      ],
    });
    const geo = makeGeo({
      nodes: [makeNode({ id: 'n0' }), makeNode({ id: 'n1', x: 200, y: 0 })],
      edges: [edge],
    });
    const svg = renderJson(geo, defaultTheme);
    const body = contentAfterDefs(svg);
    // Should contain two C segments
    const cCount = (body.match(/ C /g) ?? []).length;
    expect(cCount).toBe(2);
  });

  it('renders all value types when theme has no json color overrides (uses ?? defaults)', () => {
    const rows: JsonRowGeo[] = [
      makeRow({ key: 'a', value: 'hello',   valueType: 'string',  y: 4,  height: 20 }),
      makeRow({ key: 'b', value: '42',      valueType: 'number',  y: 24, height: 20 }),
      makeRow({ key: 'c', value: '☑ true',  valueType: 'boolean', y: 44, height: 20 }),
      makeRow({ key: 'd', value: '␀',       valueType: 'null',    y: 64, height: 20, highlight: true }),
      makeRow({ key: 'e', value: '{...}',   valueType: 'nested',  y: 84, height: 20 }),
    ];
    const node = makeNode({ rows });
    const edge = makeEdge();
    const geo = makeGeo({ nodes: [node], edges: [edge] });
    const svg = renderJson(geo, noJsonTheme);
    const body = contentAfterDefs(svg);
    // Hard-coded fallback defaults
    expect(body).toContain('fill="#3A6E96"');   // string fallback
    expect(body).toContain('fill="#A67F52"');   // number fallback
    expect(body).toContain('fill="#BE5D47"');   // boolean fallback
    expect(body).toContain('fill="#767676"');   // null fallback
    expect(body).toContain('fill="#CCFF02"');   // highlightBackground fallback (plantuml.skin default)
    expect(body).toContain('fill="#FFFFFF"');   // background fallback
    expect(body).toContain('fill="#F1F1F1"');   // headerBackground fallback
    // Edge still renders with theme.colors.arrow fallback
    expect(body).toContain('<path');
    // Nested value with non-empty value uses keyText fallback '#181818'
    expect(body).toContain('fill="#181818"');
  });
});
