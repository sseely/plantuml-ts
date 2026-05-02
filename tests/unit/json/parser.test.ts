import { describe, expect, it } from 'vitest';
import { parseJson } from '../../../src/diagrams/json/parser.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parse(lines: string[]) {
  return parseJson({ lines, type: 'json' as const });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseJson', () => {
  describe('JSON body parsing', () => {
    it('parses a valid JSON object', () => {
      const ast = parse(['{"name": "Alice", "age": 30}']);
      expect(ast.root).toEqual({ name: 'Alice', age: 30 });
    });

    it('parses a valid JSON array', () => {
      const ast = parse(['[1, 2, 3]']);
      expect(ast.root).toEqual([1, 2, 3]);
    });

    it('parses a multi-line JSON object', () => {
      const ast = parse(['{', '  "key": "value"', '}']);
      expect(ast.root).toEqual({ key: 'value' });
    });

    it('parses a JSON string scalar', () => {
      const ast = parse(['"hello"']);
      expect(ast.root).toBe('hello');
    });

    it('parses a JSON number scalar', () => {
      const ast = parse(['42']);
      expect(ast.root).toBe(42);
    });

    it('parses a JSON null literal', () => {
      const ast = parse(['null']);
      expect(ast.root).toBeNull();
      expect(ast.parseError).toBe(false);
    });

    it('sets parseError for invalid JSON', () => {
      const ast = parse(['{not valid json}']);
      expect(ast.parseError).toBe(true);
      expect(ast.highlights).toHaveLength(0);
    });

    it('sets root to null and parseError false for empty body', () => {
      const ast = parse([]);
      expect(ast.root).toBeNull();
      expect(ast.parseError).toBe(false);
    });

    it('sets root to null and parseError false for whitespace-only body', () => {
      const ast = parse(['   ', '  ']);
      expect(ast.root).toBeNull();
      expect(ast.parseError).toBe(false);
    });

    it('parses JSON with inline // comments (JSONC)', () => {
      const ast = parse([
        '{',
        '  "firstName": "John",',
        '  "lastName": "Smith", // Comment',
        '  "isAlive": true // True when alive',
        '}',
      ]);
      expect(ast.parseError).toBe(false);
      expect(ast.root).toEqual({ firstName: 'John', lastName: 'Smith', isAlive: true });
    });

    it('parses JSON with block /* */ comments (JSONC)', () => {
      const ast = parse([
        '{',
        '  /* block comment */',
        '  "x": 1',
        '}',
      ]);
      expect(ast.parseError).toBe(false);
      expect(ast.root).toEqual({ x: 1 });
    });

    it('parses JSON with trailing comma (JSONC)', () => {
      const ast = parse(['{"a": 1, "b": 2,}']);
      expect(ast.parseError).toBe(false);
      expect(ast.root).toEqual({ a: 1, b: 2 });
    });
  });

  describe('#highlight directive parsing', () => {
    it('parses a single-segment highlight', () => {
      const ast = parse(['#highlight "key"', '{"key": "value"}']);
      expect(ast.highlights).toEqual([{ path: ['key'], styleClass: '' }]);
    });

    it('parses a multi-segment highlight path', () => {
      const ast = parse(['#highlight "a" / "b"', '{"a": {"b": 1}}']);
      expect(ast.highlights).toEqual([{ path: ['a', 'b'], styleClass: '' }]);
    });

    it('captures stereotype from highlight line as styleClass', () => {
      const ast = parse(['#highlight "a" / "b" <<foo>>', '{"a": {"b": 1}}']);
      expect(ast.highlights).toEqual([{ path: ['a', 'b'], styleClass: 'foo' }]);
    });

    it('captures stereotype with surrounding whitespace as styleClass (lowercased)', () => {
      const ast = parse(['#highlight "key" <<MyStyle>>', '{"key": 1}']);
      expect(ast.highlights).toEqual([{ path: ['key'], styleClass: 'mystyle' }]);
    });

    it('collects multiple highlight directives', () => {
      const ast = parse([
        '#highlight "first"',
        '#highlight "second" / "nested"',
        '{"first": 1, "second": {"nested": 2}}',
      ]);
      expect(ast.highlights).toEqual([
        { path: ['first'], styleClass: '' },
        { path: ['second', 'nested'], styleClass: '' },
      ]);
    });

    it('returns empty highlights when no #highlight lines present', () => {
      const ast = parse(['{"a": 1}']);
      expect(ast.highlights).toHaveLength(0);
    });

    it('collects #highlight for non-existent paths without error', () => {
      const ast = parse(['#highlight "nonexistent"', '#highlight "a" / "missing"', '{"a": 1}']);
      expect(ast.parseError).toBe(false);
      expect(ast.highlights).toHaveLength(2);
      expect(ast.highlights[0]).toEqual({ path: ['nonexistent'], styleClass: '' });
      expect(ast.highlights[1]).toEqual({ path: ['a', 'missing'], styleClass: '' });
    });

    it('parses highlight before JSON body without corrupting body', () => {
      const ast = parse(['#highlight "name"', '{"name": "Bob"}']);
      expect(ast.root).toEqual({ name: 'Bob' });
      expect(ast.highlights).toEqual([{ path: ['name'], styleClass: '' }]);
    });

    it('parses a three-segment highlight path', () => {
      const ast = parse([
        '#highlight "a" / "b" / "c"',
        '{"a": {"b": {"c": true}}}',
      ]);
      expect(ast.highlights).toEqual([{ path: ['a', 'b', 'c'], styleClass: '' }]);
    });

    it('parses highlight path with no spaces around slashes', () => {
      const ast = parse([
        '#highlight "quiz"/"maths"/"q1"/"options"',
        '{}',
      ]);
      expect(ast.highlights).toEqual([{ path: ['quiz', 'maths', 'q1', 'options'], styleClass: '' }]);
    });

    it('parses highlight path mixing spaced and unspaced slashes', () => {
      const ast = parse([
        '#highlight "quiz"/"maths" / "q2"/"options"/"2"',
        '{}',
      ]);
      expect(ast.highlights).toEqual([{ path: ['quiz', 'maths', 'q2', 'options', '2'], styleClass: '' }]);
    });
  });

  describe('@startjson/@endjson wrapper stripping', () => {
    it('strips bare @startjson and @endjson lines', () => {
      const ast = parse(['@startjson', '{"a": 1}', '@endjson']);
      expect(ast.root).toEqual({ a: 1 });
      expect(ast.parseError).toBe(false);
    });

    it('strips @startjson with trailing whitespace', () => {
      const ast = parse(['@startjson  ', '{"b": 2}']);
      expect(ast.root).toEqual({ b: 2 });
      expect(ast.parseError).toBe(false);
    });

    it('strips @STARTJSON case-insensitively', () => {
      const ast = parse(['@STARTJSON', '{"c": 3}', '@ENDJSON']);
      expect(ast.root).toEqual({ c: 3 });
      expect(ast.parseError).toBe(false);
    });

    it('strips @startjson alongside #highlight directives', () => {
      const ast = parse(['@startjson', '#highlight "x"', '{"x": 1}', '@endjson']);
      expect(ast.root).toEqual({ x: 1 });
      expect(ast.highlights).toEqual([{ path: ['x'], styleClass: '' }]);
    });
  });

  describe('<style> block handling', () => {
    it('style block does not bleed into JSON body', () => {
      const ast = parse([
        '<style>',
        'element { BackgroundColor: red; }',
        '</style>',
        '{"key": "val"}',
      ]);
      expect(ast.root).toEqual({ key: 'val' });
      expect(ast.parseError).toBe(false);
    });
  });

  describe('acceptance criteria from spec', () => {
    it('given valid JSON object, root equals parsed object', () => {
      const ast = parse(['{ "x": 1, "y": 2 }']);
      expect(ast.root).toEqual({ x: 1, y: 2 });
    });

    it('given #highlight "key", highlights contains directive with path [key]', () => {
      const ast = parse(['#highlight "key"', '{"key": 0}']);
      expect(ast.highlights).toContainEqual({ path: ['key'], styleClass: '' });
    });

    it('given #highlight "a" / "b" <<foo>>, highlights contains directive with path ["a","b"] and styleClass "foo"', () => {
      const ast = parse(['#highlight "a" / "b" <<foo>>', '{}']);
      expect(ast.highlights).toContainEqual({ path: ['a', 'b'], styleClass: 'foo' });
    });

    it('given invalid JSON, parseError is true and highlights is empty', () => {
      const ast = parse(['not json at all']);
      expect(ast.parseError).toBe(true);
      expect(ast.highlights).toHaveLength(0);
    });

    it('given bare JSON array [1,2,3], root is [1,2,3]', () => {
      const ast = parse(['[1,2,3]']);
      expect(ast.root).toEqual([1, 2, 3]);
    });
  });
});
