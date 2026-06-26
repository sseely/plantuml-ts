import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { render, renderSync, renderAll } from '../../src/index.js';
import { FixedMeasurer } from '../../src/core/measurer.js';
import '../helpers/svg-assertions.js';

const testMeasurer = new FixedMeasurer(8, 16);
const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/usecase');

// Matched by usecasePlugin (usecase keyword) and NOT by sequencePlugin.
// Avoids "actor" keyword and "-->" arrows which trigger the sequence heuristic.
const BASIC_PUML = `@startuml
usecase Login
usecase Logout
usecase Register
@enduml`;

const TWO_BLOCK_PUML = `@startuml
usecase Search
usecase Filter
@enduml

@startuml
usecase Checkout
usecase Payment
@enduml`;

// ---------------------------------------------------------------------------
// render() — async API
// ---------------------------------------------------------------------------

describe('render() — use case diagram async API', () => {
  it('resolves to a string starting with <svg', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
  });

  it('resolves to a valid SVG element', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toBeValidSvg();
  });

  it('SVG does not contain PlantUML error', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).not.toContain('PlantUML error');
  });

  it('SVG contains use case names', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainText('Login');
    expect(svg).toContainText('Logout');
  });
});

// ---------------------------------------------------------------------------
// renderSync() — synchronous API (use case layout is now sync)
// ---------------------------------------------------------------------------

describe('renderSync() — use case diagram sync API', () => {
  it('returns an SVG starting with <svg', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
  });

  it('SVG does not contain PlantUML error', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).not.toContain('PlantUML error');
  });

  it('SVG does not contain "not supported"', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg.toLowerCase()).not.toContain('not supported');
  });

  it('SVG contains use case names', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainText('Login');
    expect(svg).toContainText('Logout');
  });
});

// ---------------------------------------------------------------------------
// renderAll() — multi-block API
// ---------------------------------------------------------------------------

describe('renderAll() — use case diagram multi-block', () => {
  it('returns array of length 2 for two blocks', async () => {
    const results = await renderAll(TWO_BLOCK_PUML, { measurer: testMeasurer });
    expect(results).toHaveLength(2);
  });

  it('each result starts with <svg', async () => {
    const results = await renderAll(TWO_BLOCK_PUML, { measurer: testMeasurer });
    for (const svg of results) {
      expect(svg).toMatch(/^<svg/);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture files
// ---------------------------------------------------------------------------

describe('usecase fixture files', () => {
  let fixtureFiles: string[];

  beforeAll(() => {
    fixtureFiles = readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith('.puml'))
      .map((f) => join(FIXTURES_DIR, f));
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  it('all fixture files produce SVG starting with <svg', async () => {
    for (const filePath of fixtureFiles) {
      const source = readFileSync(filePath, 'utf8');
      const svg = await render(source, { measurer: testMeasurer });
      expect(svg, `fixture: ${filePath}`).toMatch(/^<svg/);
    }
  });

  it('no fixture file produces a PlantUML error SVG', async () => {
    for (const filePath of fixtureFiles) {
      const source = readFileSync(filePath, 'utf8');
      const svg = await render(source, { measurer: testMeasurer });
      expect(svg, `fixture: ${filePath}`).not.toContain('PlantUML error');
    }
  });
});
