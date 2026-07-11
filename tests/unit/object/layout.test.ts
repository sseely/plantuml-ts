/**
 * Object-diagram layout behavior, ported to exercise the class engine
 * directly (object-dot-sync mission T5 — the standalone object plugin is
 * deleted; `layoutClass` already renders `kind: 'object'` classifiers
 * faithfully, per class-object-map-sizing.ts / T4). All source fixtures here
 * use forms the class engine actually accepts (bare declaration, quoted
 * alias, multi-line `{ ... }` body) — see parser.test.ts for the two
 * plugin-era forms (inline single-line body, unquoted `as` alias) that were
 * never valid upstream syntax and are not carried forward.
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import { layoutClass } from '../../../src/diagrams/class/layout.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';

const measurer = new FormulaMeasurer();
const theme = defaultTheme;

function src(lines: string[]): UmlSource {
  return { lines, type: 'class' };
}

// ---------------------------------------------------------------------------
// 1. Object classifiers get kind 'object' in geometry
// ---------------------------------------------------------------------------

describe('layoutClass with object diagram — classifier kind', () => {
  it('produces classifiers with kind object', () => {
    const ast = parseClass(src(['object Foo']));
    const geo = layoutClass(ast, theme, measurer);
    expect(geo.classifiers).toHaveLength(1);
    expect(geo.classifiers[0]!.kind).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// 2. Member rows use "field = value" format (no visibility icon indent)
// ---------------------------------------------------------------------------

describe('layoutClass with object diagram — member row format', () => {
  it('formats member rows as "name = value" without visibility icon', () => {
    const ast = parseClass(src([
      'object Alice {',
      '  firstName = Alice',
      '  age = 30',
      '}',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const c = geo.classifiers[0]!;

    // Rows: header + 2 members
    expect(c.rows).toHaveLength(3);

    const memberRows = c.rows.slice(1);
    // Member text should use = separator
    expect(memberRows[0]!.text).toBe('firstName = Alice');
    expect(memberRows[1]!.text).toBe('age = 30');

    // No visibility icon for object members
    expect(memberRows[0]!.visibilityIcon).toBeUndefined();
    expect(memberRows[1]!.visibilityIcon).toBeUndefined();

    // Indent is the real MethodsOrFieldsArea.asBlockMemberImpl left margin
    // (withMargin(this, 6, 4) -- object-dot-sync mission, upstream-faithful
    // sizing) rather than the old ICON_WIDTH + 4 class-member indent.
    expect(memberRows[0]!.indent).toBe(6);
  });

  it('formats bare field name (no value) without = separator', () => {
    const ast = parseClass(src([
      'object X {',
      '  name',
      '}',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    const memberRow = geo.classifiers[0]!.rows[1]!;
    expect(memberRow.text).toBe('name');
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple objects produce multiple classifiers
// ---------------------------------------------------------------------------

describe('layoutClass with object diagram — multiple objects', () => {
  it('lays out two objects with non-overlapping positions', () => {
    const ast = parseClass(src([
      'object Alice',
      'object Bob',
      'Alice --> Bob',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    expect(geo.classifiers).toHaveLength(2);
    expect(geo.edges).toHaveLength(1);

    const [a, b] = geo.classifiers;
    // They must not overlap
    const aRight = a!.x + a!.width;
    const bRight = b!.x + b!.width;
    const nonOverlap =
      aRight <= b!.x || bRight <= a!.x || // horizontal separation
      a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y; // vertical separation
    expect(nonOverlap).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Empty object diagram
// ---------------------------------------------------------------------------

describe('layoutClass with object diagram — empty', () => {
  it('returns zero-size geometry for empty diagram', () => {
    const ast = parseClass(src([]));
    const geo = layoutClass(ast, theme, measurer);
    expect(geo.totalWidth).toBe(0);
    expect(geo.totalHeight).toBe(0);
    expect(geo.classifiers).toHaveLength(0);
    expect(geo.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Canonical example — 3 objects + 2 edges
// ---------------------------------------------------------------------------

describe('layoutClass with object diagram — canonical example', () => {
  it('produces 3 classifiers and 2 edges from the canonical diagram', () => {
    const ast = parseClass(src([
      'object "User : Alice" as alice {',
      '  firstName = Alice',
      '  lastName = Wonderland',
      '  age = 30',
      '}',
      'object "User : Bob" as bob {',
      '  firstName = Bob',
      '  lastName = Hope',
      '  age = 45',
      '}',
      'object Address {',
      '  street = 123 Main St',
      '  city = Springfield',
      '}',
      'alice --> bob : knows',
      'alice --> Address : livesAt',
    ]));
    const geo = layoutClass(ast, theme, measurer);
    expect(geo.classifiers).toHaveLength(3);
    expect(geo.edges).toHaveLength(2);
    expect(geo.totalWidth).toBeGreaterThan(0);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });
});
