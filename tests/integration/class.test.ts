import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { render, renderSync, renderAll } from '../../src/index.js';
import { FixedMeasurer } from '../../src/core/measurer.js';
import '../helpers/svg-assertions.js';
import { expectNoErrorDiagram } from '../helpers/error-diagram.js';

const testMeasurer = new FixedMeasurer(8, 16);
const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/class');

// Matched by classPlugin (class keyword) and NOT by sequencePlugin.
const BASIC_PUML = `@startuml
class Animal {
  +name: String
  +speak(): void
}
class Dog {
  +fetch(): void
}
Animal <|-- Dog
@enduml`;

const TWO_BLOCK_PUML = `@startuml
class Foo
@enduml

@startuml
class Bar
@enduml`;

// ---------------------------------------------------------------------------
// render() — async API
// ---------------------------------------------------------------------------

describe('render() — class diagram async API', () => {
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
    expectNoErrorDiagram(svg);
  });

  it('SVG contains class names', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainText('Animal');
    expect(svg).toContainText('Dog');
  });
});

// ---------------------------------------------------------------------------
// renderSync() — class diagrams now supported via synchronous dot layout
// ---------------------------------------------------------------------------

describe('renderSync() — class diagram sync API', () => {
  it('returns an SVG starting with <svg', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
  });

  it('SVG does not contain PlantUML error', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expectNoErrorDiagram(svg);
  });

  it('SVG contains class names', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainText('Animal');
    expect(svg).toContainText('Dog');
  });
});

// ---------------------------------------------------------------------------
// renderAll() — multi-block API
// ---------------------------------------------------------------------------

describe('renderAll() — class diagram multi-block', () => {
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

describe('class fixture files', () => {
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
      expectNoErrorDiagram(svg, `fixture: ${filePath}`);
    }
  });
});
