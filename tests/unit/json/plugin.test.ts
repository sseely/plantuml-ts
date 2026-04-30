import { describe, it, expect } from 'vitest';
import { render } from '../../../src/index.js';
import { jsonPlugin } from '../../../src/diagrams/json/index.js';

describe('jsonPlugin.accepts', () => {
  it('returns true for object-start lines', () => {
    expect(jsonPlugin.accepts(['{', '"a": 1', '}'])).toBe(true);
  });

  it('returns true for array-start lines', () => {
    expect(jsonPlugin.accepts(['[', '1, 2, 3', ']'])).toBe(true);
  });

  it('returns true for #highlight-prefixed lines', () => {
    expect(jsonPlugin.accepts(['#highlight "key"', '{"key": 1}'])).toBe(true);
  });

  it('returns true for null literal', () => {
    expect(jsonPlugin.accepts(['null'])).toBe(true);
  });

  it('returns true for true literal', () => {
    expect(jsonPlugin.accepts(['true'])).toBe(true);
  });

  it('returns true for false literal', () => {
    expect(jsonPlugin.accepts(['false'])).toBe(true);
  });

  it('returns true for a JSON string scalar', () => {
    expect(jsonPlugin.accepts(['"hello"'])).toBe(true);
  });

  it('returns true for a JSON number scalar', () => {
    expect(jsonPlugin.accepts(['42'])).toBe(true);
  });

  it('returns true for a negative JSON number', () => {
    expect(jsonPlugin.accepts(['-1.5'])).toBe(true);
  });

  it('returns false for sequence diagram content', () => {
    expect(jsonPlugin.accepts(['A->B: message', 'B-->A: reply'])).toBe(false);
  });

  it('returns false for empty lines', () => {
    expect(jsonPlugin.accepts(['', '  '])).toBe(false);
  });
});

describe('render @startjson end-to-end', () => {
  it('renders a simple object and SVG contains the key text', async () => {
    const svg = await render('@startjson\n{"key":"val"}\n@endjson');
    expect(svg).toContain('key');
    expect(svg).toContain('<svg');
  });

  it('renders null scalar as a node containing the null symbol', async () => {
    const svg = await render('@startjson\nnull\n@endjson');
    expect(svg).toContain('<svg');
    expect(svg).toContain('␀');
  });

  it('renders string scalar', async () => {
    const svg = await render('@startjson\n"Hi"\n@endjson');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Hi');
  });

  it('renders number scalar', async () => {
    const svg = await render('@startjson\n42\n@endjson');
    expect(svg).toContain('<svg');
    expect(svg).toContain('42');
  });

  it('renders an array root', async () => {
    const svg = await render('@startjson\n[1, 2, 3]\n@endjson');
    expect(svg).toContain('<svg');
  });
});

describe('render @startjson — style block', () => {
  const diagramWithStyle = [
    '@startjson',
    '<style>',
    'element {',
    '  BackgroundColor: white;',
    '  LineColor: black;',
    '  highlight {',
    '    BackgroundColor: red;',
    '  }',
    '  header {',
    '    FontStyle: bold;',
    '  }',
    '}',
    '</style>',
    '#highlight "lastName"',
    '{"firstName":"John","lastName":"Smith"}',
    '@endjson',
  ].join('\n');

  it('applies element.highlight.BackgroundColor: red to highlighted row', async () => {
    const svg = await render(diagramWithStyle);
    expect(svg).toContain('fill="red"');
  });

  it('applies element.header.FontStyle: bold to key column text', async () => {
    const svg = await render(diagramWithStyle);
    expect(svg).toContain('font-weight="bold"');
  });

  it('still renders the JSON content correctly', async () => {
    const svg = await render(diagramWithStyle);
    expect(svg).toContain('firstName');
    expect(svg).toContain('Smith');
  });
});
