import { describe, it, expect } from 'vitest';
import { renderSync } from '../../src/index.js';
import jsonFixtures from '../visual/data/json.json';

describe('JSON corpus fixtures — all 49 produce valid SVG', () => {
  for (const fixture of jsonFixtures as Array<{ slug: string; markup: string }>) {
    it(`renders ${fixture.slug}`, () => {
      const svg = renderSync(fixture.markup);
      expect(svg, `${fixture.slug} must contain <svg`).toContain('<svg');
      expect(svg.length, `${fixture.slug} must be non-trivial`).toBeGreaterThan(100);
    });
  }
});
