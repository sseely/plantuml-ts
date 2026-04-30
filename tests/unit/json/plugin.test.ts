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

  it('renders null root without crashing', async () => {
    const svg = await render('@startjson\nnull\n@endjson');
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  it('renders an array root', async () => {
    const svg = await render('@startjson\n[1, 2, 3]\n@endjson');
    expect(svg).toContain('<svg');
  });
});
