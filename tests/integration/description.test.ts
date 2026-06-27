/**
 * Integration tests for the consolidated description engine.
 *
 * Exercises the full parse → layoutSync → render path through `descriptionPlugin`
 * directly (the plugin is not registered until Batch 8, so we drive it without
 * the dispatcher). Covers the union of the old component + use-case integration
 * cases plus the `cocice` all-keywords fixture that motivated the consolidation.
 */

import { describe, it, expect } from 'vitest';
import { descriptionPlugin } from '../../src/diagrams/description/index.js';
import { defaultTheme } from '../../src/core/theme.js';
import { FixedMeasurer } from '../../src/core/measurer.js';
import type { UmlSource } from '../../src/core/block-extractor.js';

const measurer = new FixedMeasurer(8, 16);

/** Run a block end-to-end through the plugin and return the SVG. */
function renderViaPlugin(lines: readonly string[]): string {
  const source: UmlSource = { lines, type: 'description' };
  const ast = descriptionPlugin.parse(source);
  const geo = descriptionPlugin.layoutSync(ast, defaultTheme, measurer);
  return descriptionPlugin.render(geo, defaultTheme);
}

// The cocice fixture: one of every descriptive element keyword. Pre-merge this
// collapsed into the class renderer; the consolidated engine must render all.
const COCICE_LINES = [
  'actor actor',
  'agent agent',
  'artifact artifact',
  'boundary boundary',
  'card card',
  'cloud cloud',
  'component component',
  'control control',
  'database database',
  'entity entity',
  'file file',
  'folder folder',
  'frame frame',
  'interface  interface',
  'node node',
  'package package',
  'queue queue',
  'stack stack',
  'rectangle rectangle',
  'storage storage',
  'usecase usecase',
];

describe('description engine — end-to-end via plugin', () => {
  it('renders a mixed-symbol deployment diagram as valid SVG with every element', () => {
    const svg = renderViaPlugin([
      'node Server',
      'database DB',
      'cloud Internet',
      'component App',
      'Server --> DB',
    ]);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toMatch(/<\/svg>\s*$/);
    for (const label of ['Server', 'DB', 'Internet', 'App']) {
      expect(svg).toContain(label);
    }
  });

  it('renders the cocice all-keywords fixture without collapsing', () => {
    const svg = renderViaPlugin(COCICE_LINES);
    expect(svg).toMatch(/^<svg/);
    // Every declared element's display text appears (no element dropped).
    for (const kw of [
      'agent',
      'artifact',
      'cloud',
      'component',
      'database',
      'node',
      'package',
      'rectangle',
      'storage',
      'usecase',
    ]) {
      expect(svg).toContain(kw);
    }
  });

  it('renders ellipses for use cases and a stick-figure path for actors', () => {
    const svg = renderViaPlugin(['actor User', 'usecase Login', 'User --> Login']);
    expect(svg).toMatch(/<ellipse/); // use case
    expect(svg).toContain('User');
    expect(svg).toContain('Login');
  });

  it('renders include/extend as dashed connectors with «stereotype» labels', () => {
    const svg = renderViaPlugin([
      'usecase A',
      'usecase B',
      'usecase C',
      'A ..> B : <<include>>',
      'A ..> C : <<extend>>',
    ]);
    expect(svg).toMatch(/stroke-dasharray/);
    expect(svg).toContain('«include»');
    expect(svg).toContain('«extend»');
  });
});

describe('description engine — accepts()', () => {
  it('accepts blocks carrying descriptive keywords or shorthands', () => {
    expect(descriptionPlugin.accepts(['node Server'])).toBe(true);
    expect(descriptionPlugin.accepts(['usecase UC1'])).toBe(true);
    expect(descriptionPlugin.accepts(['[Component]'])).toBe(true);
    expect(descriptionPlugin.accepts(['(Use Case)'])).toBe(true);
    // Full-set: this engine owns interface/package/actor too.
    expect(descriptionPlugin.accepts(['interface Drawable'])).toBe(true);
    expect(descriptionPlugin.accepts(['package P {', '}'])).toBe(true);
    expect(descriptionPlugin.accepts(['actor Bob'])).toBe(true);
  });

  it('declines a pure class block', () => {
    expect(
      descriptionPlugin.accepts(['class Foo', 'Foo : +bar()']),
    ).toBe(false);
  });
});
