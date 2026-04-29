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
    });

    it('sets root to null for invalid JSON', () => {
      const ast = parse(['{not valid json}']);
      expect(ast.root).toBeNull();
      expect(ast.highlights).toHaveLength(0);
    });

    it('sets root to null for empty body', () => {
      const ast = parse([]);
      expect(ast.root).toBeNull();
    });

    it('sets root to null for whitespace-only body', () => {
      const ast = parse(['   ', '  ']);
      expect(ast.root).toBeNull();
    });
  });

  describe('#highlight directive parsing', () => {
    it('parses a single-segment highlight', () => {
      const ast = parse(['#highlight "key"', '{"key": "value"}']);
      expect(ast.highlights).toEqual([['key']]);
    });

    it('parses a multi-segment highlight path', () => {
      const ast = parse(['#highlight "a" / "b"', '{"a": {"b": 1}}']);
      expect(ast.highlights).toEqual([['a', 'b']]);
    });

    it('strips stereotype from highlight line', () => {
      const ast = parse(['#highlight "a" / "b" <<foo>>', '{"a": {"b": 1}}']);
      expect(ast.highlights).toEqual([['a', 'b']]);
    });

    it('strips stereotype with surrounding whitespace', () => {
      const ast = parse(['#highlight "key" <<MyStyle>>', '{"key": 1}']);
      expect(ast.highlights).toEqual([['key']]);
    });

    it('collects multiple highlight directives', () => {
      const ast = parse([
        '#highlight "first"',
        '#highlight "second" / "nested"',
        '{"first": 1, "second": {"nested": 2}}',
      ]);
      expect(ast.highlights).toEqual([['first'], ['second', 'nested']]);
    });

    it('returns empty highlights when no #highlight lines present', () => {
      const ast = parse(['{"a": 1}']);
      expect(ast.highlights).toHaveLength(0);
    });

    it('parses highlight before JSON body without corrupting body', () => {
      const ast = parse(['#highlight "name"', '{"name": "Bob"}']);
      expect(ast.root).toEqual({ name: 'Bob' });
      expect(ast.highlights).toEqual([['name']]);
    });

    it('parses a three-segment highlight path', () => {
      const ast = parse([
        '#highlight "a" / "b" / "c"',
        '{"a": {"b": {"c": true}}}',
      ]);
      expect(ast.highlights).toEqual([['a', 'b', 'c']]);
    });
  });

  describe('acceptance criteria from spec', () => {
    it('given valid JSON object, root equals parsed object', () => {
      const ast = parse(['{ "x": 1, "y": 2 }']);
      expect(ast.root).toEqual({ x: 1, y: 2 });
    });

    it('given #highlight "key", highlights contains [[key]]', () => {
      const ast = parse(['#highlight "key"', '{"key": 0}']);
      expect(ast.highlights).toContainEqual(['key']);
    });

    it('given #highlight "a" / "b" <<foo>>, highlights contains [["a","b"]]', () => {
      const ast = parse(['#highlight "a" / "b" <<foo>>', '{}']);
      expect(ast.highlights).toContainEqual(['a', 'b']);
    });

    it('given invalid JSON, root is null and highlights is empty', () => {
      const ast = parse(['not json at all']);
      expect(ast.root).toBeNull();
      expect(ast.highlights).toHaveLength(0);
    });

    it('given bare JSON array [1,2,3], root is [1,2,3]', () => {
      const ast = parse(['[1,2,3]']);
      expect(ast.root).toEqual([1, 2, 3]);
    });
  });
});
