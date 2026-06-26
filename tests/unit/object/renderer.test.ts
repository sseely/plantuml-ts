import { describe, it, expect } from 'vitest';
import { objectPlugin } from '../../../src/diagrams/object/index.js';
import { parseObject } from '../../../src/diagrams/object/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { renderClass } from '../../../src/diagrams/class/renderer.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

function src(lines: string[]): UmlSource {
  return { lines, type: 'object' };
}

// ---------------------------------------------------------------------------
// 1. Plugin accepts() heuristic
// ---------------------------------------------------------------------------

describe('objectPlugin.accepts()', () => {
  it('returns true when a line starts with "object "', () => {
    expect(objectPlugin.accepts(['object Foo'])).toBe(true);
  });

  it('returns true for object with quoted display', () => {
    expect(objectPlugin.accepts(['object "User : Alice" as alice'])).toBe(true);
  });

  it('returns false for class diagrams', () => {
    expect(objectPlugin.accepts(['class Foo', 'interface Bar'])).toBe(false);
  });

  it('returns false for empty lines', () => {
    expect(objectPlugin.accepts([])).toBe(false);
  });

  it('only checks the first 20 lines', () => {
    const lines = Array.from({ length: 25 }, (_, i) => (i < 21 ? '' : 'object Foo'));
    expect(objectPlugin.accepts(lines)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Plugin parse() delegates to parseObject
// ---------------------------------------------------------------------------

describe('objectPlugin.parse()', () => {
  it('produces a ClassDiagramAST with object classifiers', () => {
    const block = src(['object Alice', 'object Bob', 'Alice --> Bob']);
    const ast = objectPlugin.parse(block);
    expect(ast.classifiers).toHaveLength(2);
    expect(ast.classifiers[0]!.kind).toBe('object');
    expect(ast.relationships).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Plugin layoutSync()
// ---------------------------------------------------------------------------

// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md
describe.skip('objectPlugin.layoutSync()', () => {
  it('returns ClassGeometry with positioned classifiers', () => {
    const block = src(['object Foo { x = 1 }']);
    const ast = objectPlugin.parse(block);
    const geo = objectPlugin.layoutSync(ast, theme, measurer);
    expect(geo.classifiers).toHaveLength(1);
    expect(geo.classifiers[0]!.kind).toBe('object');
    expect(geo.totalWidth).toBeGreaterThan(0);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Plugin render() produces SVG with object badge
// ---------------------------------------------------------------------------

// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md
describe.skip('objectPlugin.render()', () => {
  it('produces an SVG string', () => {
    const block = src(['object Foo { x = 1 }']);
    const ast = objectPlugin.parse(block);
    const geo = objectPlugin.layoutSync(ast, theme, measurer);
    const svg = objectPlugin.render(geo, theme);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('includes the O badge letter for object classifiers', () => {
    const block = src(['object Foo']);
    const ast = objectPlugin.parse(block);
    const geo = objectPlugin.layoutSync(ast, theme, measurer);
    const svg = objectPlugin.render(geo, theme);
    expect(svg).toContain('>O<');
  });

  it('renders member text with = separator (not :)', () => {
    const block = src(['object Foo { name = Alice }']);
    const ast = objectPlugin.parse(block);
    const geo = objectPlugin.layoutSync(ast, theme, measurer);
    const svg = objectPlugin.render(geo, theme);
    expect(svg).toContain('name = Alice');
    expect(svg).not.toContain('name: Alice');
  });
});

// ---------------------------------------------------------------------------
// 5. Full pipeline — renderClass with object classifier directly
// ---------------------------------------------------------------------------

// pending graphviz-ts adapter — see plans/burn-graphviz-engines/handoff-adapter.md
describe.skip('renderClass with object classifier', () => {
  it('renders orange badge (#E07020) for object kind', () => {
    const ast = parseObject(src(['object Bar']));
    const geo = layoutClass(ast, theme, measurer);
    const svg = renderClass(geo, theme);
    expect(svg).toContain('#E07020');
  });

  it('renders correctly with multiple objects and an edge label', () => {
    const ast = parseObject(src([
      'object A { x = 1 }',
      'object B { y = 2 }',
      'A --> B : link',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const svg = renderClass(geo, theme);
    expect(svg).toContain('link');
    expect(svg).toContain('x = 1');
    expect(svg).toContain('y = 2');
  });
});
