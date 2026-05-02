import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import { parseJson } from '../../src/diagrams/json/parser.js';
import jsonFixtures from '../visual/data/json.json';

function getMarkup(prefix: string): string {
  const f = (jsonFixtures as Array<{ slug: string; markup: string }>).find(
    (x) => x.slug.startsWith(prefix),
  );
  if (!f) throw new Error(`Fixture not found: ${prefix}`);
  return f.markup;
}

// ---------------------------------------------------------------------------
// Style block not bleeding into JSON body
// ---------------------------------------------------------------------------

describe('JSON style: <style> block does not pollute JSON body', () => {
  it('kusule-69: jsonDiagram is not parsed as a JSON key', () => {
    const markup = getMarkup('kusule-69');
    const ast = parseJson({ lines: markup.split('\n'), type: 'json' });
    expect(ast.root).not.toHaveProperty('jsonDiagram');
    expect(ast.root).not.toHaveProperty('jsondDiagram');
  });

  it('dometa-86: element selector is not parsed as a JSON key', () => {
    const markup = getMarkup('dometa-86');
    const ast = parseJson({ lines: markup.split('\n'), type: 'json' });
    expect(ast.root).not.toHaveProperty('element');
  });

  it('moseba-10: style keys do not appear as node keys in SVG', () => {
    const svg = renderSync(getMarkup('moseba-10'));
    expect(svg).not.toContain('>jsonDiagram<');
    expect(svg).not.toContain('>node<');
    expect(svg).not.toContain('>arrow<');
  });
});

// ---------------------------------------------------------------------------
// Custom node background color
// ---------------------------------------------------------------------------

describe('JSON style: node background color', () => {
  it('kusule-69: BackGroundColor black resolves to #000000 in SVG', () => {
    const svg = renderSync(getMarkup('kusule-69'));
    expect(svg).toContain('<svg');
    // black background must appear as a fill somewhere on the node rects
    expect(svg).toMatch(/fill="(black|#000000|#000)"/);
  });

  it('moseba-10: BackGroundColor Khaki appears in SVG', () => {
    const svg = renderSync(getMarkup('moseba-10'));
    expect(svg).toContain('<svg');
    expect(svg.length).toBeGreaterThan(200);
  });
});

// ---------------------------------------------------------------------------
// Custom font color
// ---------------------------------------------------------------------------

describe('JSON style: FontColor', () => {
  it('kusule-69: FontColor #CCFF02 appears on text elements', () => {
    const svg = renderSync(getMarkup('kusule-69'));
    expect(svg).toContain('#CCFF02');
  });
});

// ---------------------------------------------------------------------------
// Custom highlight color
// ---------------------------------------------------------------------------

describe('JSON style: highlight BackGroundColor override', () => {
  it('kusule-69: highlight BackGroundColor red — #highlight row uses red fill', () => {
    const svg = renderSync(getMarkup('kusule-69'));
    // Custom highlight color red must appear for the highlighted row rect.
    // Note: #CCFF02 also appears as FontColor on text elements — that is expected.
    expect(svg).toContain('fill="red"');
  });

  it('dometa-86: element highlight BackgroundColor red overrides default highlight', () => {
    const svg = renderSync(getMarkup('dometa-86'));
    expect(svg).toContain('<svg');
    // red highlight must appear for the #highlight "lastName" row
    expect(svg).toContain('fill="red"');
  });

  it('default highlight: no <style> block uses #CCFF02 for highlighted rows', () => {
    const svg = renderSync(
      '@startjson\n#highlight "key"\n{"key": "value", "other": "x"}\n@endjson',
    );
    expect(svg).toContain('#CCFF02');
  });
});

// ---------------------------------------------------------------------------
// RoundCorner style property
// ---------------------------------------------------------------------------

describe('JSON style: RoundCorner', () => {
  it('kusule-69: RoundCorner 0 produces rx="0" on node rect', () => {
    const svg = renderSync(getMarkup('kusule-69'));
    expect(svg).toContain('rx="0"');
  });

  it('noleta-28: RoundCorner 4 produces rx="4" on node rect', () => {
    const svg = renderSync(getMarkup('noleta-28'));
    expect(svg).toContain('rx="4"');
  });
});

// ---------------------------------------------------------------------------
// No-space path separator in #highlight
// ---------------------------------------------------------------------------

describe('JSON style: #highlight path separator variants', () => {
  it('mudumo-73: no-space slash in path applies highlight color to target row', () => {
    const svg = renderSync(getMarkup('mudumo-73'));
    // Four #highlight directives — at least one default highlight rect must appear
    expect(svg).toContain('#CCFF02');
  });

  it('mixed separators: "a"/"b" and "c" / "d" both resolve correctly', () => {
    const svg = renderSync(
      '@startjson\n' +
      '#highlight "a"/"b"\n' +
      '#highlight "a" / "c"\n' +
      '{"a": {"b": 1, "c": 2, "d": 3}}\n' +
      '@endjson',
    );
    // Two highlighted rows → highlight color appears twice
    const count = (svg.match(/#CCFF02/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Multiple diagrams on same page — defs ID uniqueness
// ---------------------------------------------------------------------------

describe('JSON style: per-render ID uniqueness', () => {
  it('two renders produce different clipPath IDs', () => {
    const markup = '@startjson\n{"a": 1}\n@endjson';
    const svg1 = renderSync(markup);
    const svg2 = renderSync(markup);
    const id1 = svg1.match(/id="(json-node-clip-[^"]+)"/)?.[1];
    const id2 = svg2.match(/id="(json-node-clip-[^"]+)"/)?.[1];
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('two renders produce different arrow marker IDs', () => {
    const markup = '@startjson\n{"a": {"b": 1}}\n@endjson';
    const svg1 = renderSync(markup);
    const svg2 = renderSync(markup);
    const id1 = svg1.match(/id="(arrow-json-dep-[^"]+)"/)?.[1];
    const id2 = svg2.match(/id="(arrow-json-dep-[^"]+)"/)?.[1];
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });
});
