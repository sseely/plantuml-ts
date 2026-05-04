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

  it('applies all hcldiagram.node style properties', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  node {',
      '    BackgroundColor "#aabbcc"',
      '    LineColor "#ff0000"',
      '    LineThickness 2',
      '    RoundCorner 5',
      '    MaximumWidth 200',
      '    HorizontalAlignment center',
      '    FontColor "#123456"',
      '    FontSize 14',
      '    FontName "Arial"',
      '    FontStyle bold',
      '    FontWeight bold',
      '    LineStyle dashed',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });

  it('applies hcldiagram.element style', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  element {',
      '    BackgroundColor "#aabbcc"',
      '  }',
      '}',
      '</style>',
      'key = "value"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });

  it('applies hcldiagram.arrow style properties', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  arrow {',
      '    LineColor "#ff0000"',
      '    LineThickness 2',
      '    LineStyle dashed',
      '  }',
      '}',
      '</style>',
      'resource "aws_vpc" "main" {}',
      'resource "aws_subnet" "sub" {}',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });

  it('applies hcldiagram.node.separator style properties', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  node {',
      '    separator {',
      '      LineColor "#ff0000"',
      '      LineThickness 2',
      '      LineStyle dashed',
      '    }',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });

  it('covers hclElem bg-absent FALSE branch and hclNode bg-absent FALSE branch', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  element {',
      '    LineColor "#ff0000"',
      '  }',
      '  node {',
      '    LineColor "#ff0000"',
      '    highlight {',
      '      BackgroundColor "#ff0000"',
      '    }',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });

  it('covers FALSE branches: empty style sections and non-numeric values', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  element {}',
      '  arrow {',
      '    LineThickness "not-a-number"',
      '  }',
      '  node {',
      '    BackGroundColor ""',
      '    LineThickness "bad"',
      '    RoundCorner "bad"',
      '    MaximumWidth "bad"',
      '    FontSize "bad"',
      '    HorizontalAlignment "diagonal"',
      '    separator {',
      '      LineThickness "bad"',
      '    }',
      '    highlight {}',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });

  it('applies hcldiagram.node.highlight style properties', () => {
    const src = [
      '@starthcl',
      '<style>',
      'hclDiagram {',
      '  node {',
      '    highlight {',
      '      BackgroundColor "#aabbcc"',
      '      FontColor "#123456"',
      '      FontStyle bold',
      '    }',
      '  }',
      '}',
      '</style>',
      'region = "us-east-1"',
      '@endhcl',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toMatch(/^<svg/);
  });
});
