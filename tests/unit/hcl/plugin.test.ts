import { describe, it, expect } from 'vitest';
import { hclPlugin } from '../../../src/diagrams/hcl/index.js';
import { renderSync } from '../../../src/index.js';

describe('hclPlugin', () => {
  it('has type hcl', () => { expect(hclPlugin.type).toBe('hcl'); });

  it('accepts always returns false', () => {
    expect(hclPlugin.accepts([])).toBe(false);
    expect(hclPlugin.accepts(['resource "r" "n" {'])).toBe(false);
    expect(hclPlugin.accepts(['key = "value"'])).toBe(false);
  });

  it('renders a flat key-value HCL block to SVG', () => {
    const svg = renderSync('@starthcl\nregion = "us-east-1"\n@endhcl');
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('us-east-1');
  });

  it('renders a nested resource block to SVG', () => {
    const svg = renderSync('@starthcl\nresource "aws_s3_bucket" "b" {\n  bucket = "test"\n}\n@endhcl');
    expect(svg).toMatch(/^<svg/);
  });

  it('renders an empty body without throwing', () => {
    const svg = renderSync('@starthcl\n@endhcl');
    expect(typeof svg).toBe('string');
  });

  it('does not include title text in SVG output', () => {
    const svg = renderSync('@starthcl\ntitle My Title\nkey = "value"\n@endhcl');
    expect(svg).not.toContain('My Title');
  });

  it('handles ternary expression without throwing', () => {
    const svg = renderSync('@starthcl\nfoo = cond ? "a" : "b"\n@endhcl');
    expect(typeof svg).toBe('string');
  });

  it('applies hcldiagram.node BackgroundColor style', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  node {',
      '    BackgroundColor "#ffcc00"',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('#ffcc00');
  });

  it('applies hcldiagram.document background color', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  document {',
      '    BackgroundColor "#aabbcc"',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('#aabbcc');
  });
});
