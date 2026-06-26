import { describe, it, expect } from 'vitest';
import { parseYaml } from '../../../src/diagrams/yaml/parser.js';
import { parseJson } from '../../../src/diagrams/json/parser.js';
import { layoutJson } from '../../../src/diagrams/json/layout.js';
import { renderJson } from '../../../src/diagrams/json/renderer.js';
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { JsonDiagramAST } from '../../../src/diagrams/json/ast.js';

function makeYamlSource(lines: string[]): UmlSource {
  return { lines, type: 'yaml' };
}

function makeJsonSource(lines: string[]): UmlSource {
  return { lines, type: 'json' };
}

// ---------------------------------------------------------------------------
// Layer 2: Parser captures styleClass
// ---------------------------------------------------------------------------

describe('parseYaml — captures styleClass from <<stereotype>>', () => {
  it('captures h1 from <<h1>> directive', () => {
    const ast = parseYaml(makeYamlSource(['#highlight "fruit" <<h1>>', 'fruit: Apple', 'size: Large']));
    expect(ast.highlights).toHaveLength(1);
    expect(ast.highlights[0]).toEqual({ path: ['fruit'], styleClass: 'h1' });
  });

  it('captures h2 from <<h2>> directive', () => {
    const ast = parseYaml(makeYamlSource(['#highlight "size" <<h2>>', 'fruit: Apple', 'size: Large']));
    expect(ast.highlights[0]).toEqual({ path: ['size'], styleClass: 'h2' });
  });

  it('empty styleClass when no <<stereotype>> present', () => {
    const ast = parseYaml(makeYamlSource(['#highlight "fruit"', 'fruit: Apple']));
    expect(ast.highlights[0]).toEqual({ path: ['fruit'], styleClass: '' });
  });

  it('normalises styleClass to lowercase', () => {
    const ast = parseYaml(makeYamlSource(['#highlight "fruit" <<H1>>', 'fruit: Apple']));
    expect(ast.highlights[0]!.styleClass).toBe('h1');
  });

  it('captures styleClass from multi-segment path with stereotype', () => {
    const ast = parseYaml(makeYamlSource([
      '#highlight "address" / "city" <<highlight>>',
      'address:',
      '  city: NYC',
    ]));
    expect(ast.highlights[0]).toEqual({ path: ['address', 'city'], styleClass: 'highlight' });
  });
});

describe('parseJson — captures styleClass from <<stereotype>>', () => {
  it('captures h1 from <<h1>> directive in JSON parser', () => {
    const ast = parseJson(makeJsonSource(['#highlight "fruit" <<h1>>', '{"fruit": "Apple"}']));
    expect(ast.highlights).toHaveLength(1);
    expect(ast.highlights[0]).toEqual({ path: ['fruit'], styleClass: 'h1' });
  });

  it('empty styleClass when no <<stereotype>> in JSON parser', () => {
    const ast = parseJson(makeJsonSource(['#highlight "fruit"', '{"fruit": "Apple"}']));
    expect(ast.highlights[0]).toEqual({ path: ['fruit'], styleClass: '' });
  });

  it('normalises styleClass to lowercase in JSON parser', () => {
    const ast = parseJson(makeJsonSource(['#highlight "fruit" <<H2>>', '{"fruit": "Apple"}']));
    expect(ast.highlights[0]!.styleClass).toBe('h2');
  });
});

// ---------------------------------------------------------------------------
// Layer 3: layoutJson propagates styleClass to row.highlight
// ---------------------------------------------------------------------------

describe('layoutJson — propagates styleClass to row.highlight', () => {
  it('row.highlight is "h1" when directive has styleClass "h1"', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { json: { highlightClasses: { h1: { background: '#00FF00' } } } } },
    });
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple', size: 'Large' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: 'h1' }],
    };
    const geo = layoutJson(ast, theme, new FormulaMeasurer());
    const row = geo.nodes[0]!.rows.find(r => r.key === 'fruit');
    expect(row?.highlight).toBe('h1');
  });

  it('row.highlight is "" when directive has no styleClass', () => {
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: '' }],
    };
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    const row = geo.nodes[0]!.rows.find(r => r.key === 'fruit');
    expect(row?.highlight).toBe('');
  });

  it('non-highlighted rows have highlight=false', () => {
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple', size: 'Large' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: 'h1' }],
    };
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    const row = geo.nodes[0]!.rows.find(r => r.key === 'size');
    expect(row?.highlight).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 4: renderJson uses highlightClasses background
// ---------------------------------------------------------------------------

describe('renderJson — uses highlightClasses background for named class', () => {
  it('uses class background color instead of default highlightBackground', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { json: { highlightClasses: { h1: { background: '#ABCDEF' } } } } },
    });
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: 'h1' }],
    };
    const geo = layoutJson(ast, theme, new FormulaMeasurer());
    const svg = renderJson(geo, theme);
    expect(svg).toContain('#ABCDEF');
    // Default highlight color should not be used
    expect(svg).not.toContain('#CCFF02');
  });

  it('falls back to default highlight color when class not defined in highlightClasses', () => {
    // h1 class present in directive but not in theme.highlightClasses
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: 'h1' }],
    };
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    const svg = renderJson(geo, defaultTheme);
    const hlBg = defaultTheme.colors.graph.json?.highlightBackground ?? '#CCFF02';
    expect(svg).toContain(hlBg);
  });

  it('uses class fontColor for text when defined', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { json: { highlightClasses: { h1: { background: '#ABCDEF', fontColor: '#FF0000' } } } } },
    });
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: 'h1' }],
    };
    const geo = layoutJson(ast, theme, new FormulaMeasurer());
    const svg = renderJson(geo, theme);
    expect(svg).toContain('#FF0000');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: YAML parse → layout → render with <<h1>>
// ---------------------------------------------------------------------------

describe('end-to-end: YAML <<h1>> highlight class in SVG output', () => {
  it('full pipeline uses class background from theme', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: { graph: { json: { highlightClasses: { h1: { background: '#00FF00' } } } } },
    });
    const ast = parseYaml(makeYamlSource([
      '#highlight "fruit" <<h1>>',
      'fruit: Apple',
      'size: Large',
    ]));
    const geo = layoutJson(ast, theme, new FormulaMeasurer());
    const svg = renderJson(geo, theme);
    expect(svg).toContain('#00FF00');
    expect(svg).not.toContain('#CCFF02');
  });

  it('full pipeline with no class uses default highlight color', () => {
    const ast = parseYaml(makeYamlSource([
      '#highlight "fruit"',
      'fruit: Apple',
      'size: Large',
    ]));
    const geo = layoutJson(ast, defaultTheme, new FormulaMeasurer());
    const svg = renderJson(geo, defaultTheme);
    const hlBg = defaultTheme.colors.graph.json?.highlightBackground ?? '#CCFF02';
    expect(svg).toContain(hlBg);
  });

  it('two highlights with different classes use their respective colors', () => {
    const theme = deepMergeTheme(defaultTheme, {
      colors: {
        graph: {
          json: {
            highlightClasses: {
              h1: { background: '#FF0000' },
              h2: { background: '#0000FF' },
            },
          },
        },
      },
    });
    const ast = parseYaml(makeYamlSource([
      '#highlight "fruit" <<h1>>',
      '#highlight "size" <<h2>>',
      'fruit: Apple',
      'size: Large',
    ]));
    const geo = layoutJson(ast, theme, new FormulaMeasurer());
    const svg = renderJson(geo, theme);
    expect(svg).toContain('#FF0000');
    expect(svg).toContain('#0000FF');
  });
});
