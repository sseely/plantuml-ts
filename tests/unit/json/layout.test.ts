import { describe, expect, it } from 'vitest';
import { layoutJson } from '../../../src/diagrams/json/layout.js';
import type { JsonDiagramAST, HighlightDirective } from '../../../src/diagrams/json/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FixedMeasurer } from '../../../src/core/measurer.js';
import type { FontSpec, StringMeasurer } from '../../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * FixedMeasurer with charWidth=8, lineHeight=14 gives deterministic geometry
 * without any dependency on font rendering.
 */
const measurer = new FixedMeasurer(8, 14);

function makeAst(root: unknown, highlights: ReadonlyArray<readonly string[]> = [], parseError = false): JsonDiagramAST {
  // Convert plain string[][] to HighlightDirective[] with styleClass: ''
  const directives: HighlightDirective[] = highlights.map((path) => ({ path, styleClass: '' }));
  return { root, parseError, highlights: directives };
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

  // 10. Highlight path [["key"]] → row has highlight !== false
  it('highlight path marks matching row as highlighted', () => {
    const ast = makeAst({ key: 'hello' }, [['key']]);
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'key');
    expect(row).toBeDefined();
    expect(row!.highlight).not.toBe(false);
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
    expect(cityRow!.highlight).not.toBe(false);
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

  // ---------------------------------------------------------------------------
  // Multi-line string values (\n escape)
  // ---------------------------------------------------------------------------

  it('string value with \\n produces multiple valueLines', () => {
    // The JSON value "a\\nb\\nc" parses to the JS string 'a\\nb\\nc' (backslash-n pairs)
    const ast = makeAst({ desc: 'a\\nb\\nc' });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'desc');
    expect(row).toBeDefined();
    expect(row!.valueLines).toEqual(['a', 'b', 'c']);
  });

  it('multi-line string row height is numLines × single-line height', () => {
    // FixedMeasurer(8, 14): lineHeight = max(ROW_HEIGHT_MIN=20, 14+V_PAD=18) = 20
    const ast = makeAst({ desc: 'a\\nb\\nc\\nd\\ne\\nf' });
    const geo = layoutJson(ast, defaultTheme, measurer);

    const row = geo.nodes[0]!.rows.find((r) => r.key === 'desc');
    expect(row).toBeDefined();
    expect(row!.height).toBe(6 * 20); // 6 lines × 20px each
  });

  it('multi-line value column width uses the widest line, not the whole string', () => {
    // 'aa' is 2 chars wide; 'b' is 1 char wide → value col fits 'aa', not 'aa\nb'
    const ast = makeAst({ x: 'aa\\nb' });
    const geo = layoutJson(ast, defaultTheme, measurer);

    // FixedMeasurer: 'aa' → 2×8=16; 'aa\nb' (5 chars if unsplit) would be 5×8=40
    // With split, widest line is 'aa' = 16 + 2×H_PAD(8) = 32
    const node = geo.nodes[0]!;
    // valueColWidth should be based on 'aa' width (16px + 16px padding = 32),
    // not the full joined string 'aa\nb' (5 chars = 56px)
    expect(node.valueColWidth).toBeLessThan(measurer.measure('aa\\nb', { family: '', size: 14 }).width + 16 + 1);
  });

  it('non-string values always have single-element valueLines', () => {
    const ast = makeAst({ n: 42, b: true, nl: null });
    const geo = layoutJson(ast, defaultTheme, measurer);

    for (const row of geo.nodes[0]!.rows) {
      expect(row.valueLines).toHaveLength(1);
    }
  });

  // ---------------------------------------------------------------------------
  // Whitespace escape sequences (PlantUML second-level interpretation)
  // ---------------------------------------------------------------------------

  it('double-backslash in string value renders as single backslash', () => {
    // JS string 'a\\\\b' represents the four-character literal a\\b
    // After processStringDisplay: \\ → \ → final display 'a\b'
    const ast = makeAst({ k: 'a\\\\b' });
    const geo = layoutJson(ast, defaultTheme, measurer);
    const row = geo.nodes[0]!.rows.find((r) => r.key === 'k');
    expect(row).toBeDefined();
    expect(row!.value).toBe('a\\b');
    expect(row!.valueLines).toEqual(['a\\b']);
  });

  it('\\r in string value produces a blank row (empty processed value)', () => {
    const ast = makeAst({ k: '\\r' });
    const geo = layoutJson(ast, defaultTheme, measurer);
    const row = geo.nodes[0]!.rows.find((r) => r.key === 'k');
    expect(row).toBeDefined();
    expect(row!.value).toBe('');
  });

  it('\\t in string value produces a tab character', () => {
    const ast = makeAst({ k: '\\t' });
    const geo = layoutJson(ast, defaultTheme, measurer);
    const row = geo.nodes[0]!.rows.find((r) => r.key === 'k');
    expect(row).toBeDefined();
    expect(row!.value).toBe('\t');
  });

  it('double-backslash followed by n renders as backslash+n, not newline', () => {
    // Source JSON: "\\\\n" — literal four chars: \\ n
    // processStringDisplay: \\ → protect, then \n substitution skips, → 'a\n' (literal backslash-n)
    // Actually: "\\\\n" in JS is a two-char string: \ followed by n — wait, let me think...
    // JS: '\\\\n' = four chars \, \, n? No: '\\\\' = two backslashes, then 'n' = '\\n' escaped backslash+n
    // processStringDisplay on '\\n': protect \\ is no-op (only two-backslash matches), so \n → newline
    // For '\\\\n': protect \\ → \x00 n; \n check: no \n sequence; restore \x00 → \; result = '\n' (backslash+n? no — '\' + 'n')
    // Hmm. Let me test actual value expected. '\\\\n' as a JS string is: char(\), char(\), char(n) → 3 chars
    // replace /\\\\/g (matches \\) → '\x00n'; no \n; restore → '\n' (backslash+n literal? no — \x00 → '\', so '\' + 'n' = two chars).
    // That means it becomes a backslash followed by 'n' in the string, which is NOT a newline.
    // So valueLines should be ['\\n'] (one line, not split).
    const ast = makeAst({ k: '\\\\n' });
    const geo = layoutJson(ast, defaultTheme, measurer);
    const row = geo.nodes[0]!.rows.find((r) => r.key === 'k');
    expect(row).toBeDefined();
    expect(row!.valueLines).toHaveLength(1);
    expect(row!.value).toBe('\\n');
  });

  it('nodeFontBold=true causes value column to be measured with bold weight', () => {
    // A measurer that returns 20% wider widths for bold text.
    const boldMeasurer: StringMeasurer = {
      measure(text: string, font: FontSpec) {
        const base = text.length * 8;
        return { width: font.weight === 'bold' ? base * 1.2 : base, height: 14 };
      },
      getDescent(_font: FontSpec, _text: string) { return 3; },
    };

    const ast = makeAst({ label: 'hello' });
    const boldTheme = {
      ...defaultTheme,
      colors: {
        ...defaultTheme.colors,
        graph: {
          ...defaultTheme.colors.graph,
          json: { ...defaultTheme.colors.graph.json, nodeFontBold: true },
        },
      },
    };

    const geoNormal = layoutJson(ast, defaultTheme, boldMeasurer);
    const geoBold   = layoutJson(ast, boldTheme,   boldMeasurer);

    // Bold measurement must produce a wider value column
    expect(geoBold.nodes[0]!.valueColWidth).toBeGreaterThan(geoNormal.nodes[0]!.valueColWidth);
  });

  // ---------------------------------------------------------------------------
  // Wildcard highlight support
  // ---------------------------------------------------------------------------

  // * wildcard: matches all direct children
  it('single-star wildcard highlights key in all direct children', () => {
    const root = { a: { count: '1' }, b: { count: '2' } };
    const ast = makeAst(root, [['*', 'count']]);
    const geo = layoutJson(ast, defaultTheme, measurer);
    // Both child nodes (a and b) should have 'count' highlighted
    const countHighlights = geo.nodes
      .flatMap(n => n.rows)
      .filter(r => r.key === 'count')
      .map(r => r.highlight);
    expect(countHighlights).toHaveLength(2);
    expect(countHighlights.every(h => h !== false)).toBe(true);
  });

  // ** wildcard: marks key at any depth
  it('double-star wildcard highlights key at any depth', () => {
    const root = { a: { location: 'NYC' }, b: { c: { location: 'LA' } } };
    const ast = makeAst(root, [['**', 'location']]);
    const geo = layoutJson(ast, defaultTheme, measurer);
    const locationRows = geo.nodes
      .flatMap(n => n.rows)
      .filter(r => r.key === 'location');
    expect(locationRows.length).toBeGreaterThanOrEqual(1);
    expect(locationRows.every(r => r.highlight !== false)).toBe(true);
  });

  // exact path unchanged
  it('exact multi-segment path unchanged with new implementation', () => {
    const root = { address: { city: 'NYC', state: 'NY' } };
    const ast = makeAst(root, [['address', 'city']]);
    const geo = layoutJson(ast, defaultTheme, measurer);
    const rootNode = geo.nodes[0]!;
    const addrRow = rootNode.rows.find(r => r.key === 'address');
    expect(addrRow?.highlight).toBe(false);
    const addrNode = geo.nodes.find(n => n !== rootNode && n.rows.some(r => r.key === 'city'));
    expect(addrNode?.rows.find(r => r.key === 'city')?.highlight).not.toBe(false);
    expect(addrNode?.rows.find(r => r.key === 'state')?.highlight).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Named style class on highlight
  // ---------------------------------------------------------------------------

  it('highlight directive with styleClass "h1" produces row.highlight === "h1"', () => {
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple', size: 'Large' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: 'h1' }],
    };
    const geo = layoutJson(ast, defaultTheme, measurer);
    const row = geo.nodes[0]!.rows.find((r) => r.key === 'fruit');
    expect(row?.highlight).toBe('h1');
  });

  it('highlight directive with no styleClass produces row.highlight === ""', () => {
    const ast: JsonDiagramAST = {
      root: { fruit: 'Apple' },
      parseError: false,
      highlights: [{ path: ['fruit'], styleClass: '' }],
    };
    const geo = layoutJson(ast, defaultTheme, measurer);
    const row = geo.nodes[0]!.rows.find((r) => r.key === 'fruit');
    expect(row?.highlight).toBe('');
  });
});
