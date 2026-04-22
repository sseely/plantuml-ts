import { renderSync } from '../../src/index.js';
import { FixedMeasurer } from '../../src/core/measurer.js';
import { readFileSync } from 'fs';

export const testMeasurer = new FixedMeasurer(8, 16);

export function renderFixture(source: string): string {
  return renderSync(source, { measurer: testMeasurer });
}

export function renderFile(fixturePath: string): string {
  const source = readFileSync(fixturePath, 'utf8');
  return renderFixture(source);
}
