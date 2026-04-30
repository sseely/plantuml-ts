import { describe, expect, it } from 'vitest';
import { layoutJson } from '../../../src/diagrams/json/layout.js';
import type { JsonDiagramAST } from '../../../src/diagrams/json/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FixedMeasurer } from '../../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * FixedMeasurer with charWidth=8, lineHeight=14 gives deterministic geometry
 * without any dependency on font rendering.
 */
const measurer = new FixedMeasurer(8, 14);

function makeAst(root: unknown, highlights: ReadonlyArray<readonly string[]> = [], parseError = false): JsonDiagramAST {
  return { root, parseError, highlights };
}

// ---------------------------------------------------------------------------
// Acceptance criteria tests
// ---------------------------------------------------------------------------

describe('layoutJson', () => {
  // 1. Flat object → 1 node, 2 rows
  it('flat object produces exactly 1 node with 2 rows', () => {
    const ast = makeAst({ a: 1, b: 'hello' });
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    expect(geo.nodes[0]!.rows).toHaveLength(2);
  });

  // 2. Object with nested child → 2 nodes, 1 edge
  it('nested object produces 2 nodes and 1 edge', () => {
    const ast = makeAst({ child: { x: 1 } });
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(2);
    expect(geo.edges).toHaveLength(1);
  });

  // 3. All nodes have positive dimensions and non-negative coordinates
  it('all nodes have width > 0, height > 0, x >= 0, y >= 0 for any valid JSON', () => {
    const ast = makeAst({ alpha: 'first', beta: 42, gamma: true, nested: { deep: 'value' } });
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes.length).toBeGreaterThan(0);
    for (const node of geo.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });

  // 4. Array root → rows keyed '0', '1', '2'
  it("array root produces rows with keys '0', '1', '2'", () => {
    const ast = makeAst([1, 2, 3]);
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    const keys = geo.nodes[0]!.rows.map((r) => r.key);
    expect(keys).toEqual(['0', '1', '2']);
  });

  // 5. Empty object → 1 node with 0 rows, height >= MIN_HEIGHT (15)
  it('empty object produces 1 node with 0 rows and height >= 15', () => {
    const ast = makeAst({});
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    expect(geo.nodes[0]!.rows).toHaveLength(0);
    expect(geo.nodes[0]!.height).toBeGreaterThanOrEqual(15);
  });

  // 6. Parse error → empty geometry
  it('parse error returns empty geometry', () => {
    const ast = makeAst(null, [], true);
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(0);
    expect(geo.edges).toHaveLength(0);
    expect(geo.width).toBe(0);
    expect(geo.height).toBe(0);
  });

  // 7. boolean true value → '☑ true'
  it("boolean true produces row value '☑ true'", () => {
    const ast = makeAst({ flag: true });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'flag');
    expect(row).toBeDefined();
    expect(row!.value).toBe('☑ true');
    expect(row!.valueType).toBe('boolean');
  });

  // 8. boolean false value → '☐ false'
  it("boolean false produces row value '☐ false'", () => {
    const ast = makeAst({ flag: false });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'flag');
    expect(row).toBeDefined();
    expect(row!.value).toBe('☐ false');
    expect(row!.valueType).toBe('boolean');
  });

  // 9. null value → '␀'
  it("null value produces row value '␀'", () => {
    const ast = makeAst({ n: null });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'n');
    expect(row).toBeDefined();
    expect(row!.value).toBe('␀');
    expect(row!.valueType).toBe('null');
  });

  // 10. Highlight path [["key"]] → row has highlight=true
  it('highlight path marks matching row with highlight=true', () => {
    const ast = makeAst({ key: 'hello' }, [['key']]);
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'key');
    expect(row).toBeDefined();
    expect(row!.highlight).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Additional structural tests
  // ---------------------------------------------------------------------------

  // 10b. Multi-segment highlight path navigates into child node
  it('two-segment highlight path highlights key in child node, not in root', () => {
    // #highlight "address" / "city" → "city" highlighted in address node,
    // "address" row in root should NOT be highlighted
    const ast = makeAst(
      { address: { city: 'NY', state: 'New York' } },
      [['address', 'city']],
    );
    const geo = layoutJson(ast, defaultTheme, measurer);

    // Root node: "address" row must NOT be highlighted
    const rootAddressRow = geo.nodes[0]!.rows.find((r) => r.key === 'address');
    expect(rootAddressRow).toBeDefined();
    expect(rootAddressRow!.highlight).toBe(false);

    // Child node (address): "city" row MUST be highlighted, "state" must not
    const childNode = geo.nodes.find((n) => n.id !== geo.nodes[0]!.id);
    expect(childNode).toBeDefined();
    const cityRow = childNode!.rows.find((r) => r.key === 'city');
    const stateRow = childNode!.rows.find((r) => r.key === 'state');
    expect(cityRow!.highlight).toBe(true);
    expect(stateRow!.highlight).toBe(false);
  });

  it('non-highlighted rows have highlight=false', () => {
    const ast = makeAst({ key: 'hello', other: 'world' }, [['key']]);
    const geo = layoutJson(ast, defaultTheme, measurer);

    const otherRow = geo.nodes[0]!.rows.find((r) => r.key === 'other');
    expect(otherRow).toBeDefined();
    expect(otherRow!.highlight).toBe(false);
  });

  it('nested value row has valueType "nested" and empty value string', () => {
    const ast = makeAst({ child: { x: 1 } });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const nestedRow = geo.nodes[0]!.rows.find((r) => r.key === 'child');
    expect(nestedRow).toBeDefined();
    expect(nestedRow!.valueType).toBe('nested');
    expect(nestedRow!.value).toBe('');
  });

  it('string value row has valueType "string"', () => {
    const ast = makeAst({ name: 'Alice' });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'name');
    expect(row).toBeDefined();
    expect(row!.valueType).toBe('string');
    expect(row!.value).toBe('Alice');
  });

  it('number value row has valueType "number" and stringified value', () => {
    const ast = makeAst({ count: 42 });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'count');
    expect(row).toBeDefined();
    expect(row!.valueType).toBe('number');
    expect(row!.value).toBe('42');
  });

  it('canvas width and height are positive for non-empty diagrams', () => {
    const ast = makeAst({ a: 1 });
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.width).toBeGreaterThan(0);
    expect(geo.height).toBeGreaterThan(0);
  });

  it('deeply nested tree produces correct node count', () => {
    // { a: { b: { c: 1 } } } → 3 nodes, 2 edges
    const ast = makeAst({ a: { b: { c: 1 } } });
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(3);
    expect(geo.edges).toHaveLength(2);
  });

  it('each node has keyColWidth >= MIN_COL_WIDTH (30) and valueColWidth >= MIN_COL_WIDTH', () => {
    const ast = makeAst({ x: 1, y: 2 });
    const geo = layoutJson(ast, defaultTheme, measurer);

    for (const node of geo.nodes) {
      expect(node.keyColWidth).toBeGreaterThanOrEqual(30);
      expect(node.valueColWidth).toBeGreaterThanOrEqual(30);
    }
  });

  it('row y offsets are non-decreasing and first row starts at V_PAD (4)', () => {
    const ast = makeAst({ a: 1, b: 2, c: 3 });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const rows = geo.nodes[0]!.rows;
    expect(rows[0]!.y).toBe(4); // V_PAD = 4
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.y).toBeGreaterThan(rows[i - 1]!.y);
    }
  });

  it('primitive root (number) is laid out as a single node with one row', () => {
    const ast = makeAst(42);
    const geo = layoutJson(ast, defaultTheme, measurer);

    expect(geo.nodes).toHaveLength(1);
    expect(geo.nodes[0]!.rows).toHaveLength(1);
    // key is empty string for wrapped primitive
    expect(geo.nodes[0]!.rows[0]!.key).toBe('');
  });
});
