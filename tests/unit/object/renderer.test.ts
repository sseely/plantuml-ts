/**
 * Object-diagram dispatch + rendering, ported to exercise the class engine
 * directly (object-dot-sync mission T5 — the standalone object plugin is
 * deleted; upstream has no separate object-diagram engine, so a pure
 * `object ...` block is a class-diagram block, routed and rendered by the
 * class plugin, matching upstream's `ClassDiagramFactory` registering
 * `CommandCreateEntityObject(Multilines)` alongside the class commands).
 *
 * Section 1 replaces the old `objectPlugin.accepts()` unit tests with a
 * registry-level dispatch test: it imports `src/index.js` for its plugin-
 * registration side effect and asserts the DiagramRegistry resolves a pure
 * object block to the class plugin (`type === 'class'`), not a dedicated
 * object plugin (which no longer exists).
 *
 * Sections 2-5 replace the old `objectPlugin.parse()/layoutSync()/render()`
 * calls with the equivalent `parseClass`/`layoutClass`/`renderClass` calls,
 * using multi-line `{ ... }` object bodies throughout — the old plugin-era
 * single-line inline-body form (`object Foo { x = 1 }`) was never valid
 * upstream syntax (CommandCreateEntityObjectMultilines is always
 * CommandMultilines2) and the ported class engine (T4) does not accept it;
 * see parser.test.ts for that divergence-removal note.
 */

import { describe, it, expect } from 'vitest';
import { registry } from '../../../src/core/dispatcher.js';
import { assembleSvg } from '../../../src/index.js';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { renderClass } from '../../../src/diagrams/class/renderer.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

function src(lines: string[]): UmlSource {
  return { lines, type: 'class' };
}

// Any of the kind-badge fill colors renderBadge() can draw (class 'C',
// interface 'I', abstract 'A', enum 'E', annotation '@') — object/map
// classifiers must draw none of them (renderer.ts's hasBadge() excludes
// 'object'/'map' from the badge entirely; upstream EntityImageObject has no
// circled-character affordance).
const BADGE_FILL_COLORS = ['#7B5EA7', '#3A8FA8', '#4DA34D', '#888888', '#4472B8'];

// ---------------------------------------------------------------------------
// 1. Registry dispatch — a pure object block routes to the class plugin
// ---------------------------------------------------------------------------

describe('registry dispatch — object diagrams', () => {
  it('routes a block typed "object" (the @startobject keyword suffix) to the class plugin', () => {
    const block = src(['object Foo']);
    const typedBlock: UmlSource = { ...block, type: 'object' };
    const plugin = registry.resolve(typedBlock);
    expect(plugin.type).toBe('class');
  });

  it('routes a pure "object ..." block probed under an untyped/class-typed block to the class plugin', () => {
    const plugin = registry.resolve(src(['object Foo', 'object Bar', 'Foo --> Bar']));
    expect(plugin.type).toBe('class');
  });

  it('also routes an ordinary class diagram (no object/map keyword) to the class plugin', () => {
    const plugin = registry.resolve(src(['class Foo', 'interface Bar']));
    expect(plugin.type).toBe('class');
  });
});

// ---------------------------------------------------------------------------
// 2. parseClass() on an object block
// ---------------------------------------------------------------------------

describe('parseClass() on an object diagram block', () => {
  it('produces a ClassDiagramAST with object classifiers', () => {
    const block = src(['object Alice', 'object Bob', 'Alice --> Bob']);
    const ast = parseClass(block);
    expect(ast.classifiers).toHaveLength(2);
    expect(ast.classifiers[0]!.kind).toBe('object');
    expect(ast.relationships).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. layoutClass() on the resulting AST
// ---------------------------------------------------------------------------

describe('layoutClass() on an object diagram AST', () => {
  it('returns ClassGeometry with positioned classifiers', () => {
    const block = src(['object Foo {', 'x = 1', '}']);
    const ast = parseClass(block);
    const geo = layoutClass(ast, theme, measurer);
    expect(geo.classifiers).toHaveLength(1);
    expect(geo.classifiers[0]!.kind).toBe('object');
    expect(geo.totalWidth).toBeGreaterThan(0);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. renderClass() produces SVG with no kind badge for object classifiers
// ---------------------------------------------------------------------------

describe('renderClass() on an object diagram geometry', () => {
  it('produces an SVG string', () => {
    const block = src(['object Foo {', 'x = 1', '}']);
    const ast = parseClass(block);
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('draws no kind-badge circle for object classifiers (upstream has no circled-character affordance -- object-dot-sync mission removes the pre-T4 divergence)', () => {
    const block = src(['object Foo']);
    const ast = parseClass(block);
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    expect(BADGE_FILL_COLORS.some((c) => svg.includes(c))).toBe(false);
  });

  it('renders member text with = separator (not :)', () => {
    const block = src(['object Foo {', 'name = Alice', '}']);
    const ast = parseClass(block);
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    expect(svg).toContain('name = Alice');
    expect(svg).not.toContain('name: Alice');
  });
});

// ---------------------------------------------------------------------------
// 5. Full pipeline — renderClass with multiple object classifiers
// ---------------------------------------------------------------------------

describe('renderClass() — multiple object classifiers', () => {
  it('draws no orange badge for object kind (badge removed -- see the renderClass() test above)', () => {
    const ast = parseClass(src(['object Bar']));
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    expect(svg).not.toContain('#E07020');
  });

  it('renders correctly with multiple objects and an edge label', () => {
    const ast = parseClass(src([
      'object A {',
      'x = 1',
      '}',
      'object B {',
      'y = 2',
      '}',
      'A --> B : link',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    expect(svg).toContain('link');
    expect(svg).toContain('x = 1');
    expect(svg).toContain('y = 2');
  });
});
