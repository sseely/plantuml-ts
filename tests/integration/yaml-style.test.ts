import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import { parseYaml } from '../../src/diagrams/yaml/parser.js';
import yamlFixtures from '../visual/data/yaml.json';

function getMarkup(prefix: string): string {
  const f = (yamlFixtures as Array<{ slug: string; markup: string }>).find(
    (x) => x.slug.startsWith(prefix),
  );
  if (!f) throw new Error(`Fixture not found: ${prefix}`);
  return f.markup;
}

describe('YAML style block integration', () => {
  it('bedega-54: yamlDiagram node highlight style + #highlight produces SVG', () => {
    const svg = renderSync(getMarkup('bedega-54'));
    expect(svg).toContain('<svg');
    expect(svg.length).toBeGreaterThan(100);
    expect(svg).not.toContain('PlantUML error');
  });

  it('polela-38: yamlDiagram node background + list of objects produces SVG', () => {
    const svg = renderSync(getMarkup('polela-38'));
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('lelofi-17: style with line style values produces SVG', () => {
    const svg = renderSync(getMarkup('lelofi-17'));
    expect(svg).toContain('<svg');
  });

  it('gipoxa-19: element selector (yamlDiagram.element) produces SVG', () => {
    const svg = renderSync(getMarkup('gipoxa-19'));
    expect(svg).toContain('<svg');
  });

  it('bedega-54: style block stripped before YAML parsing — yamlDiagram not a key', () => {
    const markup = getMarkup('bedega-54');
    const ast = parseYaml({ lines: markup.split('\n'), type: 'yaml' });
    expect(ast.root).not.toHaveProperty('yamlDiagram');
    expect(ast.root).not.toHaveProperty('yamldiagram');
  });
});
