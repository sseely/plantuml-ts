/**
 * G3/O4: object bodies routed through the SAME `--`/`==`/`..`/`__`
 * enhanced-body engine class kind already uses (`class-body-enhanced-
 * layout.ts#measureEnhancedBody`) -- jar-verified `linazi-45-gevo553`
 * (`upstream `BodierLikeClassOrObject#getBody`'s OBJECT branch ALWAYS
 * routes through `BodyFactory.create1`/`BodyEnhanced1`, the SAME renderer
 * class uses only when a separator is present).
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { renderClass } from '../../../src/diagrams/class/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';

const measurer = new WidthTableMeasurer();
const theme = defaultTheme;

function src(lines: string[]): UmlSource {
  return { lines, type: 'class' };
}

describe('measureObjectClassifier -- enhanced body dispatch (G3/O4)', () => {
  it('routes an object body containing a "--" separator through enhancedBody', () => {
    const ast = parseClass(src([
      'object Foo1 {',
      'line one',
      '--',
      'line two',
      '}',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.enhancedBody).toBeDefined();
    expect(c.dividerYs).toEqual([18]); // headerRowHeight (nameHeight, no stereo)
  });

  it('does NOT set enhancedBody for a plain object body (zero behavior change)', () => {
    const ast = parseClass(src(['object Foo {', 'field1', '}']));
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;
    expect(c.enhancedBody).toBeUndefined();
  });

  // jar-verified: `linazi-45-gevo553`'s Foo1 -- a bare `==` separator draws
  // TWO parallel <line> elements (y and y+2), `UHorizontalLine#drawHLine`'s
  // own `style == '='` branch (`class-body-enhanced-layout.ts
  // #EnhancedDividerPart.doubleLine`'s own doc comment).
  it('draws TWO <line> elements for a bare "==" separator (double-line)', () => {
    const ast = parseClass(src([
      'object Foo1 {',
      'and group',
      '==',
      'things together.',
      '}',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    const lineCount = (svg.match(/<line /g) ?? []).length;
    // 1 header divider + 2 for the "==" double-line
    expect(lineCount).toBe(3);
  });

  it('draws only ONE <line> for a bare "--" separator (single line)', () => {
    const ast = parseClass(src([
      'object Foo1 {',
      'and group',
      '--',
      'things together.',
      '}',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const svg = assembleSvg(renderClass(geo, theme));
    const lineCount = (svg.match(/<line /g) ?? []).length;
    expect(lineCount).toBe(2); // 1 header divider + 1 for the "--" separator
  });
});
