import { describe, it, expect } from 'vitest';
import { renderDot } from '../../../src/diagrams/dot/renderer.js';
import { parseDot } from '../../../src/diagrams/dot/parser.js';
import { layoutDot } from '../../../src/diagrams/dot/layout.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { renderSync } from '../../../src/index.js';

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

function buildGeo(source: string) {
  const ast = parseDot(source);
  return { ast, geo: layoutDot(ast, measurer, theme) };
}

describe('renderDot — node shapes', () => {
  it('AC1: box node renders a <rect> element (beyond the background rect)', () => {
    const { geo } = buildGeo(`digraph { a [shape=box] }`);
    const svg = renderDot(geo, theme);
    // svgRoot always adds one background <rect>; a box node adds a second
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(2);
  });

  it('AC2: bare node renders an <ellipse> element (default shape)', () => {
    const { geo } = buildGeo(`digraph { a }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('<ellipse');
  });

  it('AC3: diamond node renders a <polygon> element', () => {
    const { geo } = buildGeo(`digraph { a [shape=diamond] }`);
    const svg = renderDot(geo, theme);
    // <polygon> appears for the diamond shape (arrowhead markers use it too)
    expect(svg).toContain('<polygon');
    // Verify the node label is present
    expect(svg).toContain('>a<');
  });

  it('AC4: plaintext node renders text only — no node <rect> or <ellipse>', () => {
    const { geo } = buildGeo(`digraph { a [shape=plaintext label="plain"] }`);
    const svg = renderDot(geo, theme);
    // svgRoot always adds exactly one background <rect>; no node shape rect
    // So the total rect count should be exactly 1 (the background)
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBe(1); // only the svgRoot background rect
    expect(svg).not.toContain('<ellipse');
    // text content must be present
    expect(svg).toContain('plain');
  });

  it('circle node renders an <ellipse> element (same path as ellipse)', () => {
    const { geo } = buildGeo(`digraph { a [shape=circle] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('<ellipse');
  });
});

describe('renderDot — edge directionality', () => {
  it('AC5: directed edge in digraph contains marker-end', () => {
    const { geo } = buildGeo(`digraph { a -> b }`);
    const svg = renderDot(geo, theme);
    // SVG path element uses the kebab-case attribute `marker-end`
    expect(svg).toContain('marker-end');
    // should reference the sync arrow marker
    expect(svg).toContain('arrow-sync');
  });

  it('AC6: undirected edge in graph does NOT contain marker-end', () => {
    const { geo } = buildGeo(`graph { a -- b }`);
    const svg = renderDot(geo, theme);
    expect(svg).not.toContain('marker-end');
  });
});

describe('renderDot — title', () => {
  it('AC7: diagram with title renders title text in SVG', () => {
    const { geo } = buildGeo(`@startdot\ntitle My Graph Title\ndigraph { a -> b }\n@enddot`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('My Graph Title');
  });

  it('AC8: diagram without title does not render title text', () => {
    const { geo } = buildGeo(`digraph { a -> b }`);
    const svg = renderDot(geo, theme);
    // geo.title is null, so no title element should be rendered
    expect(geo.title).toBeNull();
    // The SVG should still be valid
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
  });
});

describe('renderDot — edge labels', () => {
  it('AC9: edge with label renders label text in SVG', () => {
    const { geo } = buildGeo(`digraph { a -> b [label="connects"] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('connects');
  });

  it('edge without label renders without extra label text', () => {
    const { geo } = buildGeo(`digraph { a -> b }`);
    const svg = renderDot(geo, theme);
    // Only node labels 'a' and 'b' should appear
    expect(svg).toContain('>a<');
    expect(svg).toContain('>b<');
  });

  it('multiple labeled edges from same node place sibling labels correctly', () => {
    // a -> b and a -> c both have labels — their label nodes share rank 1,
    // exercising the sibling-label guard in centerVirtualNodes.
    const { geo } = buildGeo(
      `digraph { a -> b [label="x"]; a -> c [label="y"] }`,
    );
    const svg = renderDot(geo, theme);
    expect(svg).toContain('>x<');
    expect(svg).toContain('>y<');
  });
});

describe('renderDot — SVG structure', () => {
  it('renders a valid SVG root with width and height attributes', () => {
    const { geo } = buildGeo(`digraph { a }`);
    const svg = renderDot(geo, theme);
    expect(svg).toMatch(/^<svg\s/);
    expect(svg).toContain('</svg>');
    // width/height may be fractional (FormulaMeasurer returns floats)
    expect(svg).toMatch(/width="[\d.]+"/);
    expect(svg).toMatch(/height="[\d.]+"/);
  });

  it('title presence increases SVG height by TITLE_HEIGHT (30)', () => {
    const source = `digraph { a }`;
    const sourceWithTitle = `@startdot\ntitle Test\ndigraph { a }\n@enddot`;
    const geoNoTitle = layoutDot(parseDot(source), measurer, theme);
    const geoWithTitle = layoutDot(parseDot(sourceWithTitle), measurer, theme);
    const svgNoTitle = renderDot(geoNoTitle, theme);
    const svgWithTitle = renderDot(geoWithTitle, theme);

    const heightNoTitle = Number(/height="([\d.]+)"/.exec(svgNoTitle)?.[1]);
    const heightWithTitle = Number(/height="([\d.]+)"/.exec(svgWithTitle)?.[1]);
    // Title adds 30px to the SVG height
    expect(heightWithTitle).toBe(heightNoTitle + 30);
  });
});

describe('renderDot — corpus fixtures via renderSync', () => {
  it('AC10: digraph toto renders valid SVG', () => {
    const source = `@startdot\ndigraph toto { azerty; }\n@enddot`;
    const svg = renderSync(source);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('PlantUML error');
  });

  it('AC11: undirected graph with chain renders valid SVG', () => {
    const source = `@startdot\ngraph graphname { a -- b -- c; b -- d; }\n@enddot`;
    const svg = renderSync(source);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('PlantUML error');
  });

  it('AC12: dense undirected K4 graph renders all four nodes', () => {
    const source = [
      '@startdot',
      'graph triangle {',
      '  a -- b',
      '  b -- c',
      '  c -- a',
      '  d -- b',
      '  a -- d',
      '  d -- c',
      '}',
      '@enddot',
    ].join('\n');
    const svg = renderSync(source);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('PlantUML error');
    // All four nodes must be present
    expect(svg).toContain('>a<');
    expect(svg).toContain('>b<');
    expect(svg).toContain('>c<');
    expect(svg).toContain('>d<');
  });

  it('AC13: state-machine with back-edges renders all edges and nodes', () => {
    const source = [
      '@startdot',
      'digraph stateMachine {',
      '  graph [rankdir=LR]',
      '  idle -> running [label=start]',
      '  running -> idle [label=stop]',
      '  running -> error [label=fail]',
      '  error -> idle [label=reset]',
      '}',
      '@enddot',
    ].join('\n');
    const svg = renderSync(source);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('</svg>');
    expect(svg).not.toContain('PlantUML error');
    // All nodes must be present
    expect(svg).toContain('>idle<');
    expect(svg).toContain('>running<');
    expect(svg).toContain('>error<');
    // All edge labels must be present
    expect(svg).toContain('>start<');
    expect(svg).toContain('>stop<');
    expect(svg).toContain('>fail<');
    expect(svg).toContain('>reset<');
  });
});

describe('renderDot — dir attribute', () => {
  it('dir=both renders marker-start and marker-end', () => {
    const { geo } = buildGeo(`digraph { a -> b [dir=both] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('marker-start');
  });

  it('dir=back renders marker-start but not marker-end', () => {
    const { geo } = buildGeo(`digraph { a -> b [dir=back] }`);
    const svg = renderDot(geo, theme);
    expect(svg).not.toContain('marker-end');
    expect(svg).toContain('marker-start');
  });

  it('dir=none renders neither marker-start nor marker-end', () => {
    const { geo } = buildGeo(`digraph { a -> b [dir=none] }`);
    const svg = renderDot(geo, theme);
    expect(svg).not.toContain('marker-end');
    expect(svg).not.toContain('marker-start');
  });

  it('dir=forward renders marker-end but not marker-start', () => {
    const { geo } = buildGeo(`digraph { a -> b [dir=forward] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('marker-end');
    expect(svg).not.toContain('marker-start');
  });
});

describe('renderDot — edge style', () => {
  it('style=dashed renders stroke-dasharray on the edge path', () => {
    const { geo } = buildGeo(`digraph { a -> b [style=dashed] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('style=dotted renders stroke-dasharray on the edge path', () => {
    const { geo } = buildGeo(`digraph { a -> b [style=dotted] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('style=bold renders a thicker stroke-width on the edge path', () => {
    const { geo } = buildGeo(`digraph { a -> b [style=bold] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('stroke-width="3"');
  });

  it('default edge has no stroke-dasharray', () => {
    const { geo } = buildGeo(`digraph { a -> b }`);
    const svg = renderDot(geo, theme);
    expect(svg).not.toContain('stroke-dasharray');
  });
});

describe('renderDot — cluster subgraphs', () => {
  it('cluster with two nodes renders a bounding rect around them', () => {
    const source = [
      'digraph {',
      '  subgraph cluster_0 {',
      '    a; b',
      '  }',
      '}',
    ].join('\n');
    const { geo } = buildGeo(source);
    expect(geo.clusters).toHaveLength(1);
    // svgRoot adds one background rect, cluster adds another
    const svg = renderDot(geo, theme);
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(2);
  });

  it('cluster rect appears before node elements in SVG output', () => {
    const source = [
      'digraph {',
      '  subgraph cluster_0 {',
      '    a; b',
      '  }',
      '}',
    ].join('\n');
    const { geo } = buildGeo(source);
    const svg = renderDot(geo, theme);
    // The cluster rect (stroke="#000000") must appear before any <ellipse> (node)
    const clusterIdx = svg.indexOf('stroke="#000000"');
    const ellipseIdx = svg.indexOf('<ellipse');
    expect(clusterIdx).toBeGreaterThanOrEqual(0);
    expect(ellipseIdx).toBeGreaterThan(clusterIdx);
  });

  it('cluster with label renders the label text', () => {
    const source = [
      'digraph {',
      '  subgraph cluster_0 {',
      '    label="Group A"',
      '    a; b',
      '  }',
      '}',
    ].join('\n');
    const { geo } = buildGeo(source);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('Group A');
  });

  it('cluster without label renders no extra text', () => {
    const source = [
      'digraph {',
      '  subgraph cluster_0 {',
      '    a',
      '  }',
      '}',
    ].join('\n');
    const { geo } = buildGeo(source);
    expect(geo.clusters[0]?.label).toBeNull();
  });

  it('two independent clusters render two bounding rects (plus background)', () => {
    const source = [
      'digraph {',
      '  subgraph cluster_0 { a; b }',
      '  subgraph cluster_1 { c; d }',
      '}',
    ].join('\n');
    const { geo } = buildGeo(source);
    expect(geo.clusters).toHaveLength(2);
    const svg = renderDot(geo, theme);
    // background + 2 cluster rects = at least 3
    const rectCount = (svg.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(3);
  });

  it('unquoted label=Value does not create a phantom node', () => {
    // label=Backend is a graph attribute assignment (DOT: graphattrdefs = atom '=' atom),
    // NOT a node declaration. The parser must not create a node with id "label=Backend".
    const source = [
      'digraph G {',
      '  subgraph cluster_0 {',
      '    label=Backend',
      '    db -> api',
      '  }',
      '  subgraph cluster_1 {',
      '    label=Frontend',
      '    ui -> cdn',
      '  }',
      '  api -> ui',
      '}',
    ].join('\n');
    const { ast, geo } = buildGeo(source);
    // Only real nodes should exist: db, api, ui, cdn
    const nodeIds = ast.nodes.map((n) => n.id);
    expect(nodeIds).not.toContain('label=Backend');
    expect(nodeIds).not.toContain('label=Frontend');
    expect(nodeIds.sort()).toEqual(['api', 'cdn', 'db', 'ui']);
    // Cluster labels must be captured correctly
    const backend = geo.clusters.find((c) => c.id === 'cluster_0');
    const frontend = geo.clusters.find((c) => c.id === 'cluster_1');
    expect(backend?.label).toBe('Backend');
    expect(frontend?.label).toBe('Frontend');
    // No phantom node text in SVG
    const svg = renderDot(geo, theme);
    expect(svg).not.toContain('>label=Backend<');
    expect(svg).not.toContain('>label=Frontend<');
  });

  it('non-cluster subgraph does not produce a cluster geo', () => {
    const source = [
      'digraph {',
      '  subgraph sub0 { a; b }',
      '}',
    ].join('\n');
    const { geo } = buildGeo(source);
    expect(geo.clusters).toHaveLength(0);
  });
});

describe('renderDot — node fillcolor and color', () => {
  it('fillcolor + style=filled renders the node with the specified fill color', () => {
    const { geo } = buildGeo(`digraph { a [fillcolor="#FFCCCC", style=filled] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('#FFCCCC');
  });

  it('style=filled without fillcolor uses lightgrey (C DEFAULT_FILL)', () => {
    const { geo } = buildGeo(`digraph { a [style=filled] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('lightgrey');
  });

  it('color without style=filled sets border stroke only, not fill', () => {
    const { geo } = buildGeo(`digraph { a [color="#CC0000"] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('#CC0000');
    // The fill should remain the theme default, not the color value
    expect(svg).not.toContain('fill="#CC0000"');
  });

  it('color + style=filled uses color as fill when no fillcolor is set', () => {
    const { geo } = buildGeo(`digraph { a [color="#CC0000", style=filled] }`);
    const svg = renderDot(geo, theme);
    // C findFill(): fillcolor → color → DEFAULT_FILL
    expect(svg).toContain('fill="#CC0000"');
  });

  it('fillcolor takes precedence over color for fill when both are set', () => {
    const { geo } = buildGeo(`digraph { a [color="#CC0000", fillcolor="#FFCCCC", style=filled] }`);
    const svg = renderDot(geo, theme);
    expect(svg).toContain('fill="#FFCCCC"');
  });

  it('global node [fillcolor style=filled] defaults apply to all nodes', () => {
    // Statements must be separated so the parser sees them as distinct stmts.
    const { geo } = buildGeo(
      `digraph {\n  node [fillcolor="#AABBCC", style=filled]\n  a -> b\n}`,
    );
    const svg = renderDot(geo, theme);
    // Both a and b should pick up the default fill
    const fillMatches = (svg.match(/fill="#AABBCC"/g) ?? []).length;
    expect(fillMatches).toBeGreaterThanOrEqual(2);
  });
});
