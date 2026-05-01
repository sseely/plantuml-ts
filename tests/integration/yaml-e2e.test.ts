import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import yamlFixtures from '../visual/data/yaml.json';

function getMarkup(prefix: string): string {
  const f = yamlFixtures.find((x) => x.slug.startsWith(prefix));
  if (!f) throw new Error(`Fixture not found: ${prefix}`);
  return f.markup;
}

function expectSvg(markup: string, slug: string): void {
  const svg = renderSync(markup);
  expect(svg, `${slug} must produce SVG`).toContain('<svg');
  expect(svg.length, `${slug} must be non-trivial`).toBeGreaterThan(200);
}

describe('YAML end-to-end: plugin produces SVG for corpus fixtures', () => {
  it('lifuxe-66: simple key-value (FOO1/FOO2)', () => {
    expectSvg('@startyaml\nFOO1: bar1\nFOO2: bar2\n@endyaml', 'lifuxe-66');
  });

  it('medosa-24: dot-keys', () => {
    expectSvg(getMarkup('medosa-24'), 'medosa-24');
  });

  it('sudabi-56: fruit + color list', () => {
    expectSvg(getMarkup('sudabi-56'), 'sudabi-56');
  });

  it('xubife-72: deep Kubernetes YAML', () => {
    expectSvg(getMarkup('xubife-72'), 'xubife-72');
  });

  it('finofu-94: root-level list', () => {
    expectSvg(getMarkup('finofu-94'), 'finofu-94');
  });

  it('coxima-79: key with dots and slash', () => {
    expectSvg(
      '@startyaml\napp.kubernetes.io/component: grafana\n@endyaml',
      'coxima-79',
    );
  });

  it('poxedu-72: complex highlight + tab-indented', () => {
    expectSvg(getMarkup('poxedu-72'), 'poxedu-72');
  });

  it('ketunu-15: comments, multiline, block scalar', () => {
    expectSvg(getMarkup('ketunu-15'), 'ketunu-15');
  });

  it('gatuva-87: list of YAML objects', () => {
    expectSvg(getMarkup('gatuva-87'), 'gatuva-87');
  });
});
