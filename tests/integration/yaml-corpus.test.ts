import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import yamlFixtures from '../visual/data/yaml.json';

describe('YAML corpus fixtures', () => {
  for (const fixture of yamlFixtures as Array<{ slug: string; markup: string }>) {
    it(`renders ${fixture.slug}`, () => {
      const svg = renderSync(fixture.markup);
      expect(svg).toContain('<svg');
      expect(svg.length).toBeGreaterThan(100);
    });
  }
});
