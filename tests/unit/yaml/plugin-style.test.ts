import { describe, it, expect } from 'vitest';
import { renderSync } from '../../../src/index.js';

describe('YAML diagram style selectors', () => {
  it('yamldiagram.node backgroundcolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    BackGroundColor lightblue',
      '  }',
      '}',
      '</style>',
      'fruit: Apple',
      'size: Large',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node linecolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    LineColor #FF0000',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node linethickness applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    LineThickness 2',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node roundcorner applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    RoundCorner 5',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node maximumwidth applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    MaximumWidth 200',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node horizontalalignment center applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    HorizontalAlignment center',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node horizontalalignment left applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    HorizontalAlignment left',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node horizontalalignment right applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    HorizontalAlignment right',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node horizontalalignment invalid ignored', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    HorizontalAlignment justify',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node fontcolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    FontColor darkblue',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node fontsize applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    FontSize 14',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node fontname applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    FontName Arial',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node fontstyle bold applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    FontStyle bold',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node fontstyle italic applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    FontStyle italic',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node fontweight bold applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    FontWeight bold',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node linestyle applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    LineStyle dashed',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.arrow linecolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  arrow {',
      '    LineColor green',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
  });

  it('yamldiagram.arrow linethickness applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  arrow {',
      '    LineThickness 3',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.arrow linestyle applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  arrow {',
      '    LineStyle dotted',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node.separator linecolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    separator {',
      '      LineColor orange',
      '    }',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node.separator linethickness applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    separator {',
      '      LineThickness 1',
      '    }',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node.separator linestyle applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    separator {',
      '      LineStyle dashed',
      '    }',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node.highlight backgroundcolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    highlight {',
      '      BackGroundColor red',
      '    }',
      '  }',
      '}',
      '</style>',
      '#highlight "key"',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
  });

  it('yamldiagram.node.highlight fontcolor applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    highlight {',
      '      FontColor white',
      '    }',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.node.highlight fontstyle applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  node {',
      '    highlight {',
      '      FontStyle bold',
      '    }',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });

  it('yamldiagram.element as alias for yamldiagram.node applied without error', () => {
    const src = [
      '@startyaml',
      '<style>',
      'yamlDiagram {',
      '  element {',
      '    BackGroundColor yellow',
      '  }',
      '}',
      '</style>',
      'key: value',
      '@endyaml',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
  });

  it('jsonDiagram style selectors still work (no regression)', () => {
    const src = [
      '@startjson',
      '<style>',
      'jsonDiagram {',
      '  node {',
      '    BackGroundColor lightgreen',
      '  }',
      '}',
      '</style>',
      '{"key": "value"}',
      '@endjson',
    ].join('\n');
    const svg = renderSync(src);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('PlantUML error');
  });
});
