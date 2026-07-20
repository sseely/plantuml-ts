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
import { resolveSkinparam } from '../../../src/core/skinparam.js';

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

// ---------------------------------------------------------------------------
// 6. skinparam {object,map,json}BackgroundColor -- G3/O1 (each kind has its
// OWN StyleSignature upstream (`EntityImageObject`/`Map`/`Json#getStyleSignature`
// -- `SName.object`/`map`/`json`, all under `objectDiagram`), independent of
// class's `SName.class_` -- unlike class/interface/enum (which upstream
// coincidentally SHARE one StyleSignature, `renderer-classifier-box.ts
// #classifierFill`'s own doc comment), so object/map/json must NOT inherit
// class's `classBackgroundColor`/`<style> class {}` cascade. Reuses the
// generic per-element `ELEMENT_BUCKET_SNAMES` bucket (`skinparam.ts`) the
// SAME mechanism `note`/`spotClass` already ride (D1/D4) -- `object`/`map`/
// `json` added as new bucket snames. OUT OF SCOPE (named, not silently
// dropped): the LEGACY tag-scoped form (`objectBackgroundColor<<tag>>`) --
// ALL `<<tag>>`-suffixed skinparam keys are discarded to `unknown[]` except
// `classBorderThickness<<X>>` (skinparam.ts's own doc comment on that early
// branch) -- a separate, larger mechanism (stereotype-qualified skinparam
// value lookup, `SkinParam.java:904-938`), deferred.
// ---------------------------------------------------------------------------

describe('skinparam {object,map,json}BackgroundColor (G3/O1)', () => {
  it('tints an object classifier\'s box fill (plain, no stereotype)', () => {
    const { theme: t } = resolveSkinparam(new Map([['objectbackgroundcolor', 'red']]), defaultTheme);
    const ast = parseClass(src(['object Foo']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#FF0000"');
  });

  it('tints a map classifier\'s box fill independently of objectBackgroundColor', () => {
    const { theme: t } = resolveSkinparam(new Map([['mapbackgroundcolor', 'blue']]), defaultTheme);
    const ast = parseClass(src(['map M {', 'k => v', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#0000FF"');
  });

  it('tints a json classifier\'s box fill independently of objectBackgroundColor', () => {
    const { theme: t } = resolveSkinparam(new Map([['jsonbackgroundcolor', 'green']]), defaultTheme);
    const ast = parseClass(src(['json J {', '"a": 1', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#008000"');
  });

  it('does NOT tint a plain class classifier (object/map/json buckets are independent of class\'s own cascade)', () => {
    const { theme: t } = resolveSkinparam(new Map([['objectbackgroundcolor', 'red']]), defaultTheme);
    const ast = parseClass(src(['class C']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).not.toContain('fill="#FF0000"');
  });

  it('an explicit #color override still wins over objectBackgroundColor (existing precedence, unaffected)', () => {
    const { theme: t } = resolveSkinparam(new Map([['objectbackgroundcolor', 'red']]), defaultTheme);
    const ast = parseClass(src(['object Foo #purple']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#800080"');
    expect(svg).not.toContain('fill="#FF0000"');
  });
});

// G3/O2: `<style> objectDiagram { object { FontColor blue } } </style>`
// (or a bare `object { FontColor blue }` block) -- the SAME `object`/`map`/
// `json` ELEMENT_BUCKET_SNAMES bucket O1's own BackgroundColor fix
// populates ALSO carries `font` (`collectElementStyleBuckets`'s existing
// `fontcolor` extraction, unchanged) -- `renderRowText` previously never
// consulted `theme.colors.elements[kind]?.font` at all, only the CLASS-only
// `classCascade(Header)FontColor`/`.tagname` chain, so this tint had NO
// effect on ANY object/map/json row text. Jar-verified `figeze-77-fozi735`.
describe('theme.colors.elements.{object,map,json}.font (G3/O2)', () => {
  it("tints an object classifier's header + member row text", () => {
    const t = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        elements: { ...defaultTheme.colors.elements, object: { font: '#0000FF' } },
      },
    };
    const ast = parseClass(src(['object Foo {', 'field', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#0000FF"');
    expect(svg).not.toContain('fill="#000000"');
  });

  it("does NOT tint a plain class classifier's row text (independent of class's own cascade)", () => {
    const t = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        elements: { ...defaultTheme.colors.elements, object: { font: '#0000FF' } },
      },
    };
    const ast = parseClass(src(['class C {', 'field', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).not.toContain('fill="#0000FF"');
  });

  // Regression guard (jar-verified `lapato-45-neje847`): a bare `<style>
  // root { FontColor Red } </style>` with NO objectDiagram/object override
  // must still tint object row text -- the FIRST implementation of this
  // fix bypassed the class cascade ENTIRELY for object/map/json, losing
  // the root/element-level fallback `classCascadeFontColor` provides and
  // regressing this already-zero-diff fixture (caught by a full census
  // re-run, not by this test suite in isolation -- backfilled here so the
  // regression can never resurface silently).
  it('falls through to classCascadeFontColor for a root-level (non-object-specific) ' +
    'style override -- no elements.object bucket set at all', () => {
    const t = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: { ...defaultTheme.colors.graph, classCascadeFontColor: '#FF0000', classCascadeHeaderFontColor: '#FF0000' },
      },
    };
    const ast = parseClass(src(['object Foo {', 'field', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#FF0000"');
    expect(svg).not.toContain('fill="#000000"');
  });

  it('an object-specific elements.object.font bucket wins over classCascadeFontColor ' +
    'when BOTH are set (object-specific override has priority)', () => {
    const t = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: { ...defaultTheme.colors.graph, classCascadeFontColor: '#FF0000', classCascadeHeaderFontColor: '#FF0000' },
        elements: { ...defaultTheme.colors.elements, object: { font: '#0000FF' } },
      },
    };
    const ast = parseClass(src(['object Foo']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#0000FF"');
    expect(svg).not.toContain('fill="#FF0000"');
  });
});

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

// ---------------------------------------------------------------------------
// <style> object { header { BackgroundColor/FontColor/FontSize } } } (G3/O4)
// ---------------------------------------------------------------------------

describe('theme.colors.elements.object.header* (G3/O4, soxufi-98-nita528)', () => {
  function themeWithHeaderOverride(): typeof defaultTheme {
    return {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        elements: {
          ...defaultTheme.colors.elements,
          object: { background: '#FFFF00', font: '#0000FF', headerBackground: '#FF0000', headerFont: '#008000', headerFontSize: 20 },
        },
      },
    };
  }

  it('tints the NAME row text with headerFont/headerFontSize, member rows with the bare font', () => {
    const t = themeWithHeaderOverride();
    const ast = parseClass(src(['object Foo {', 'dummy', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('fill="#008000"'); // name row (header override)
    expect(svg).toContain('fill="#0000FF"'); // member row (bare bucket)
    expect(svg).toContain('font-size="20"'); // name row font-size override
  });

  it('draws a header-background <path> when headerBackground differs from the body fill', () => {
    const t = themeWithHeaderOverride();
    const ast = parseClass(src(['object Foo {', 'dummy', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).toContain('<path');
    expect(svg).toContain('fill="#FF0000"');
  });

  it('draws NO header-background path when headerBackground matches the body fill', () => {
    const t = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        elements: {
          ...defaultTheme.colors.elements,
          object: { background: '#FF0000', headerBackground: '#FF0000' },
        },
      },
    };
    const ast = parseClass(src(['object Foo {', 'dummy', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).not.toContain('<path');
  });

  it('does NOT tint a plain class classifier (object-kind only)', () => {
    const t = themeWithHeaderOverride();
    const ast = parseClass(src(['class C {', 'dummy', '}']));
    const geo = layoutClass(ast, t, measurer);
    const svg = assembleSvg(renderClass(geo, t));
    expect(svg).not.toContain('fill="#008000"');
    expect(svg).not.toContain('fill="#FF0000"'); // no header-background path
  });
});

// ---------------------------------------------------------------------------
// Object field visibility icons render stroke-only (G3/O4, xuvesu-44-laru205)
// ---------------------------------------------------------------------------

describe('object field visibility icon fill (G3/O4)', () => {
  it('draws a PUBLIC_FIELD icon with fill="none", even for method-looking text', () => {
    const ast = parseClass(src(['object Test {', '+ getName()', '}']));
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    expect(svg).toContain('data-visibility-modifier="PUBLIC_FIELD"');
    expect(svg).not.toContain('data-visibility-modifier="PUBLIC_METHOD"');
    // the icon's own <ellipse> (public = circle) must be unfilled
    const match = /<g data-visibility-modifier="PUBLIC_FIELD"><ellipse[^/]*\/>/.exec(svg);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('fill="none"');
  });

  it('draws a PRIVATE_FIELD icon (square) with fill="none"', () => {
    const ast = parseClass(src(['object Test {', '- secret', '}']));
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    const match = /<g data-visibility-modifier="PRIVATE_FIELD"><rect[^/]*\/>/.exec(svg);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('fill="none"');
  });
});
