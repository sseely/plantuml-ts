import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'path';
import { readdirSync } from 'fs';
import { render, renderSync, renderAll } from '../../src/index.js';
import { defaultTheme } from '../../src/core/theme.js';
import { testMeasurer, renderFixture, renderFile } from '../helpers/render.js';
import '../helpers/svg-assertions.js';
import { WELCOME_MARKER, expectNoErrorDiagram } from '../helpers/error-diagram.js';

// ---------------------------------------------------------------------------
// Fixture directory
// ---------------------------------------------------------------------------

const FIXTURES_DIR = join(import.meta.dirname, '../fixtures/sequence');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASIC_PUML = `@startuml
Alice -> Bob: Hello
Bob --> Alice: Hi there
@enduml`;

const TWO_BLOCK_PUML = `@startuml
Alice -> Bob: first message
Bob --> Alice: reply
@enduml

@startuml
Carol -> Dave: second diagram
Dave --> Carol: ack
@enduml`;

const NO_BLOCK_PUML = `just some text without any startuml block`;

const DARK_THEME_PUML = `@startuml
Alice -> Bob: greet
Bob --> Alice: hello
@enduml`;

// ---------------------------------------------------------------------------
// render() — async API
// ---------------------------------------------------------------------------

describe('render() — async API', () => {
  it('resolves to a string starting with <svg', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
  });

  it('resolves to a valid SVG element', async () => {
    const svg = await render(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toBeValidSvg();
  });

  it('resolves even when source is empty', async () => {
    const svg = await render('', { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
  });
});

// ---------------------------------------------------------------------------
// renderSync() — synchronous API
// ---------------------------------------------------------------------------

describe('renderSync() — synchronous API', () => {
  it('returns a string starting with <svg', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
  });

  it('returns a valid SVG element', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toBeValidSvg();
  });

  it('includes <line or <path elements for messages', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    const hasArrow = svg.includes('<line') || svg.includes('<path');
    expect(hasArrow).toBe(true);
  });

  it('includes participant label text in the SVG', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainText('Alice');
    expect(svg).toContainText('Bob');
  });

  it('includes message label text in the SVG', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainText('Hello');
  });

  it('contains <rect elements (participant boxes)', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainElement('rect');
  });

  it('contains <text elements (labels)', () => {
    const svg = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(svg).toContainElement('text');
  });
});

// ---------------------------------------------------------------------------
// Error handling — invalid / missing source
// ---------------------------------------------------------------------------

describe('error handling', () => {
  // SI6: a source with no `@start…@end` block used to produce the homegrown red
  // box reading "No diagram found in source". The jar renders the WELCOME
  // screen for it (live-oracle verified: `echo 'hello there' | plantuml -tsvg
  // -pipe` -> "Welcome to PlantUML!" + the start-here examples), which is what
  // this port now does. `PSystemWelcome` is upstream's `(Empty)` diagram.
  it('renders the Welcome screen when source has no @startuml block', () => {
    const svg = renderSync(NO_BLOCK_PUML, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContainText(WELCOME_MARKER);
    expect(svg).toContainText('You can start with a simple UML Diagram like:');
  });

  it('error output is still a valid SVG', () => {
    const svg = renderSync(NO_BLOCK_PUML, { measurer: testMeasurer });
    expect(svg).toBeValidSvg();
  });

  it('deeply nested but invalid content still returns valid SVG', () => {
    const weirdSource = `@startuml
$$$invalid%%%
@enduml`;
    const svg = renderSync(weirdSource, { measurer: testMeasurer });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toBeValidSvg();
  });
});

// ---------------------------------------------------------------------------
// renderAll() — multi-block API
// ---------------------------------------------------------------------------

describe('renderAll() — multi-block API', () => {
  it('returns an array of length 2 for two diagram blocks', async () => {
    const results = await renderAll(TWO_BLOCK_PUML, { measurer: testMeasurer });
    expect(results).toHaveLength(2);
  });

  it('each result in the array starts with <svg', async () => {
    const results = await renderAll(TWO_BLOCK_PUML, { measurer: testMeasurer });
    for (const svg of results) {
      expect(svg).toMatch(/^<svg/);
    }
  });

  it('returns empty array for source with no blocks', async () => {
    const results = await renderAll(NO_BLOCK_PUML, { measurer: testMeasurer });
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it('each block in multi-block source is a valid SVG', async () => {
    const results = await renderAll(TWO_BLOCK_PUML, { measurer: testMeasurer });
    for (const svg of results) {
      expect(svg).toBeValidSvg();
    }
  });

  it('handles !theme directive in source for renderAll', async () => {
    const source = `!theme dark
@startuml
Alice -> Bob: hi
@enduml`;
    const results = await renderAll(source, { measurer: testMeasurer });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^<svg/);
  });

  it('accepts Partial<Theme> object for renderAll theme option', async () => {
    const results = await renderAll(BASIC_PUML, {
      measurer: testMeasurer,
      theme: { fontFamily: 'Courier New, monospace' },
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatch(/^<svg/);
    expect(results[0]).toContain('Courier New, monospace');
  });

  it('renders each block independently in renderAll', async () => {
    const results = await renderAll(TWO_BLOCK_PUML, {
      measurer: testMeasurer,
      theme: 'dark',
    });
    expect(results).toHaveLength(2);
    for (const svg of results) {
      expect(svg).toContainText('#1E1E1E');
    }
  });
});

// ---------------------------------------------------------------------------
// Theme variants
// ---------------------------------------------------------------------------

describe('theme variants', () => {
  it('dark theme — SVG still starts with <svg', () => {
    const svg = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'dark',
    });
    expect(svg).toMatch(/^<svg/);
  });

  it('dark theme — SVG contains dark background fill #1E1E1E', () => {
    const svg = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'dark',
    });
    expect(svg).toContainText('#1E1E1E');
  });

  it('default theme — SVG contains white background fill #FFFFFF', () => {
    const svg = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'default',
    });
    expect(svg).toContainText('#FFFFFF');
  });

  it('dark theme uses a different background than default', () => {
    const dark = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'dark',
    });
    const def = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'default',
    });
    expect(dark).not.toEqual(def);
  });

  it('sketchy theme alias returns valid SVG', () => {
    const svg = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'sketchy',
    });
    expect(svg).toBeValidSvg();
  });

  it('monochrome theme alias returns valid SVG', () => {
    const svg = renderSync(DARK_THEME_PUML, {
      measurer: testMeasurer,
      theme: 'monochrome',
    });
    expect(svg).toBeValidSvg();
  });

  it('Partial<Theme> override — custom font family appears in SVG', () => {
    const svg = renderSync(BASIC_PUML, {
      measurer: testMeasurer,
      theme: { fontFamily: 'Courier New, monospace' },
    });
    expect(svg).toBeValidSvg();
    expect(svg).toContainText('Courier New, monospace');
  });

  it('Partial<Theme> override — custom border color appears in SVG', () => {
    // colors must be the full object (not a partial) due to exactOptionalPropertyTypes
    const svg = renderSync(BASIC_PUML, {
      measurer: testMeasurer,
      theme: {
        colors: { ...defaultTheme.colors, border: '#FF0000' },
      },
    });
    expect(svg).toBeValidSvg();
    expect(svg).toContainText('#FF0000');
  });

  // The `!theme` line sits INSIDE the block: `@start…@end` is split before the
  // preprocessor runs (SI7), so — as upstream — a TIM directive outside the
  // block is not part of any diagram and never executes.
  it('!theme directive in source is applied when no theme option given', () => {
    const source = `@startuml
!theme dark
Alice -> Bob: hi
@enduml`;
    const svg = renderSync(source, { measurer: testMeasurer });
    expect(svg).toContainText('#1E1E1E');
  });

  it('explicit theme option overrides !theme directive', () => {
    const source = `!theme dark
@startuml
Alice -> Bob: hi
@enduml`;
    const svg = renderSync(source, {
      measurer: testMeasurer,
      theme: 'default',
    });
    expect(svg).toContainText('#FFFFFF');
  });
});

// ---------------------------------------------------------------------------
// Fixture file rendering
// ---------------------------------------------------------------------------

describe('fixture files', () => {
  let fixtureFiles: string[];

  beforeAll(() => {
    fixtureFiles = readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith('.puml'))
      .map((f) => join(FIXTURES_DIR, f));
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  it('all fixture files produce SVG starting with <svg', () => {
    for (const filePath of fixtureFiles) {
      const svg = renderFile(filePath);
      expect(svg, `fixture: ${filePath}`).toMatch(/^<svg/);
    }
  });

  it('no fixture file produces a PlantUML error SVG', () => {
    for (const filePath of fixtureFiles) {
      const svg = renderFile(filePath);
      expectNoErrorDiagram(svg, `fixture: ${filePath}`);
    }
  });

  it('basic.puml — contains participant names Alice and Bob', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'basic.puml'));
    expect(svg).toContainText('Alice');
    expect(svg).toContainText('Bob');
  });

  it('basic.puml — contains message label "Hello"', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'basic.puml'));
    expect(svg).toContainText('Hello');
  });

  it('activation.puml — contains participant Carol', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'activation.puml'));
    expect(svg).toContainText('Carol');
  });

  it('autonumber.puml — contains numbered labels', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'autonumber.puml'));
    // autonumber prepends "1: " to messages
    expect(svg).toContainText('1:');
  });

  it('dividers.puml — contains section label text', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'dividers.puml'));
    expect(svg).toContainText('Initialization');
  });

  it('notes.puml — renders without error', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'notes.puml'));
    expect(svg).toBeValidSvg();
  });

  it('groups.puml — renders without error', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'groups.puml'));
    expect(svg).toBeValidSvg();
  });

  it('lost-found.puml — renders without error', () => {
    const svg = renderFile(join(FIXTURES_DIR, 'lost-found.puml'));
    expect(svg).toBeValidSvg();
  });
});

// ---------------------------------------------------------------------------
// renderFixture helper
// ---------------------------------------------------------------------------

describe('renderFixture helper', () => {
  it('produces the same output as renderSync with testMeasurer', () => {
    const fromHelper = renderFixture(BASIC_PUML);
    const fromDirect = renderSync(BASIC_PUML, { measurer: testMeasurer });
    expect(fromHelper).toBe(fromDirect);
  });
});
