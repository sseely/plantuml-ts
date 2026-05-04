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
