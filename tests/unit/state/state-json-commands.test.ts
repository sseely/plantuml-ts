/**
 * Unit tests for embedded `json Name { ... }` / `json Name value` leaves in
 * state diagrams — mission A4 Phase L iteration 20 (maruju-55-soko478).
 *
 * `CommandCreateJson`/`CommandCreateJsonSingleLine` are registered verbatim
 * by `StateDiagramFactory` (shared `objectdiagram.command` package). Covers
 * both the full-parser integration path (multiline body accumulation via
 * `ps.pendingJson`, single-line grammar) and the hand-rolled JSON parser's
 * branches directly (`parseJsonNode`).
 * @see ~/git/plantuml/.../statediagram/StateDiagramFactory.java:115-116
 */
import { describe, it, expect } from 'vitest';
import { parseState } from '../../../src/diagrams/state/parser.js';
import { parseJsonNode, isJsonCloser, finalizeJsonBody } from '../../../src/diagrams/state/state-json-commands.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { StateDiagramAST, State } from '../../../src/diagrams/state/ast.js';

function parse(source: string): StateDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'state' };
  return parseState(block);
}

function findState(ast: StateDiagramAST, id: string): State | undefined {
  return ast.states.find((s) => s.id === id);
}

describe('json multiline declaration (CommandCreateJson)', () => {
  it('parses a one-entry object body into jsonValue, kind json (maruju-55-soko478 shape)', () => {
    const ast = parse(`
      json foo1 {
        "foo2": "foo3"
      }
    `);
    const foo1 = findState(ast, 'foo1');
    expect(foo1?.kind).toBe('json');
    expect(foo1?.jsonValue).toEqual({
      kind: 'object',
      entries: [{ key: 'foo2', value: { kind: 'scalar', value: 'foo3' } }],
    });
  });

  it('preserves member key order exactly (no numeric-key reordering)', () => {
    const ast = parse(`
      json ordered {
        "10": "ten",
        "2": "two",
        "z": "letter"
      }
    `);
    const entries = findState(ast, 'ordered')?.jsonValue;
    expect(entries).toEqual({
      kind: 'object',
      entries: [
        { key: '10', value: { kind: 'scalar', value: 'ten' } },
        { key: '2', value: { kind: 'scalar', value: 'two' } },
        { key: 'z', value: { kind: 'scalar', value: 'letter' } },
      ],
    });
  });

  it('nested object and array values recurse correctly', () => {
    const ast = parse(`
      json nested {
        "a": { "b": 1, "c": [1, 2, 3] },
        "d": true,
        "e": null
      }
    `);
    expect(findState(ast, 'nested')?.jsonValue).toEqual({
      kind: 'object',
      entries: [
        {
          key: 'a',
          value: {
            kind: 'object',
            entries: [
              { key: 'b', value: { kind: 'scalar', value: 1 } },
              { key: 'c', value: { kind: 'array', items: [
                { kind: 'scalar', value: 1 },
                { kind: 'scalar', value: 2 },
                { kind: 'scalar', value: 3 },
              ] } },
            ],
          },
        },
        { key: 'd', value: { kind: 'scalar', value: true } },
        { key: 'e', value: { kind: 'scalar', value: null } },
      ],
    });
  });

  it('captures stereotype and color from the opener line', () => {
    const ast = parse(`
      json styled <<mystereo>> #red {
        "k": "v"
      }
    `);
    const s = findState(ast, 'styled');
    expect(s?.stereotype).toBe('mystereo');
    expect(s?.color).toBe('#red');
  });

  it('quoted display name with as-alias resolves id/display independently', () => {
    const ast = parse(`
      json "My Json" as jid {
        "k": "v"
      }
    `);
    const s = findState(ast, 'jid');
    expect(s).toBeDefined();
    expect(s?.display).toBe('My Json');
  });

  it('malformed JSON body leaves jsonValue unset but still creates the leaf', () => {
    const ast = parse(`
      json broken {
        not valid json at all
      }
    `);
    const s = findState(ast, 'broken');
    expect(s?.kind).toBe('json');
    expect(s?.jsonValue).toBeUndefined();
  });

  it('body that already supplies its own outer braces falls back to the unwrapped parse', () => {
    // Wrapping the body ('[1,2,3]') in an extra pair of braces produces
    // invalid JSON ('{[1,2,3]}'); finalizeJsonBody must retry unwrapped.
    const ast = parse(`
      json arr {
        [1,2,3]
      }
    `);
    expect(findState(ast, 'arr')?.jsonValue).toEqual({
      kind: 'array',
      items: [{ kind: 'scalar', value: 1 }, { kind: 'scalar', value: 2 }, { kind: 'scalar', value: 3 }],
    });
  });

  it('empty body measures/parses as an empty object (no entries)', () => {
    const ast = parse('json empty {\n}');
    const s = findState(ast, 'empty');
    expect(s?.kind).toBe('json');
    expect(s?.jsonValue).toEqual({ kind: 'object', entries: [] });
  });

  it('a json body line matching the generic CODE : text grammar is swallowed, not auto-created as a bogus state', () => {
    const ast = parse(`
      json foo1 {
        "foo2": "foo3"
      }
    `);
    expect(findState(ast, 'foo2')).toBeUndefined();
    expect(ast.states.map((s) => s.id)).toEqual(['foo1']);
  });

  it('pass-two replay does not duplicate the json leaf or its parsed value', () => {
    const ast = parse(`
      json once {
        "a": 1
      }
      once --> once
    `);
    const matches = ast.states.filter((s) => s.id === 'once');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.jsonValue).toEqual({ kind: 'object', entries: [{ key: 'a', value: { kind: 'scalar', value: 1 } }] });
  });
});

describe('json single-line declaration (CommandCreateJsonSingleLine)', () => {
  it.each([
    ['boolTrue', 'true', { kind: 'scalar', value: true }],
    ['boolFalse', 'false', { kind: 'scalar', value: false }],
    ['numberVal', '42', { kind: 'scalar', value: 42 }],
    ['negativeNumber', '-7', { kind: 'scalar', value: -7 }],
    ['nullLit', 'null', { kind: 'scalar', value: null }],
    ['stringVal', '"hello"', { kind: 'scalar', value: 'hello' }],
    ['arrayVal', '[1,2,3]', { kind: 'array', items: [{ kind: 'scalar', value: 1 }, { kind: 'scalar', value: 2 }, { kind: 'scalar', value: 3 }] }],
    ['objectVal', '{"k": "v"}', { kind: 'object', entries: [{ key: 'k', value: { kind: 'scalar', value: 'v' } }] }],
  ] as const)('json %s value %s parses to %j', (name, literal, expected) => {
    const ast = parse(`json ${name} ${literal}`);
    expect(findState(ast, name)?.jsonValue).toEqual(expected);
  });

  it('quoted display + as-alias form resolves id/display', () => {
    const ast = parse('json "Display Text" as sid 42');
    const s = findState(ast, 'sid');
    expect(s?.display).toBe('Display Text');
    expect(s?.jsonValue).toEqual({ kind: 'scalar', value: 42 });
  });

  it('captures stereotype and color', () => {
    const ast = parse('json styled <<st>> #blue 1');
    const s = findState(ast, 'styled');
    expect(s?.stereotype).toBe('st');
    expect(s?.color).toBe('#blue');
  });

  it('does not consume subsequent lines (single-line, no pending body)', () => {
    const ast = parse(`
      json single 1
      state Next
    `);
    expect(findState(ast, 'single')?.jsonValue).toEqual({ kind: 'scalar', value: 1 });
    expect(findState(ast, 'Next')).toBeDefined();
  });
});

describe('parseJsonNode (hand-rolled order-preserving parser)', () => {
  it('returns null for empty/malformed input', () => {
    expect(parseJsonNode('')).toBeNull();
    expect(parseJsonNode('{')).toBeNull();
    expect(parseJsonNode('{"a": }')).toBeNull();
    expect(parseJsonNode('[1, 2')).toBeNull();
    expect(parseJsonNode('{"a" 1}')).toBeNull();
    expect(parseJsonNode('true extra')).toBeNull();
  });

  it('parses every named escape sequence inside a string', () => {
    const parsed = parseJsonNode(String.raw`"a\\b\/c\bd\fe\nf\rg\thA"`);
    expect(parsed).toEqual({ kind: 'scalar', value: 'a\\b/c\bd\fe\nf\rg\th' + 'A' });
  });

  it('parses an escaped double-quote inside a string', () => {
    const parsed = parseJsonNode(String.raw`"say \"hi\""`);
    expect(parsed).toEqual({ kind: 'scalar', value: 'say "hi"' });
  });

  it('passes an unrecognized escape sequence through literally', () => {
    const parsed = parseJsonNode(String.raw`"a\qb"`);
    expect(parsed).toEqual({ kind: 'scalar', value: 'a\\qb' });
  });

  it('parses a \\u unicode escape sequence', () => {
    const parsed = parseJsonNode(String.raw`"\u0041\u0042"`);
    expect(parsed).toEqual({ kind: 'scalar', value: 'AB' });
  });

  it('rejects an object body missing a comma or closing brace between members', () => {
    expect(parseJsonNode('{"a":1 "b":2}')).toBeNull();
  });

  it('parses decimal and exponent numeric forms', () => {
    expect(parseJsonNode('3.14')).toEqual({ kind: 'scalar', value: 3.14 });
    expect(parseJsonNode('1e3')).toEqual({ kind: 'scalar', value: 1000 });
    expect(parseJsonNode('-2.5e-1')).toEqual({ kind: 'scalar', value: -0.25 });
  });

  it('parses an empty array and an empty object', () => {
    expect(parseJsonNode('[]')).toEqual({ kind: 'array', items: [] });
    expect(parseJsonNode('{}')).toEqual({ kind: 'object', entries: [] });
  });

  it('rejects trailing data after a complete value', () => {
    expect(parseJsonNode('1 2')).toBeNull();
  });
});

describe('isJsonCloser', () => {
  it('matches a bare closing brace, with or without surrounding whitespace', () => {
    expect(isJsonCloser('}')).toBe(true);
    expect(isJsonCloser('  }  ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isJsonCloser('"a": 1')).toBe(false);
    expect(isJsonCloser('} extra')).toBe(false);
  });
});

describe('finalizeJsonBody', () => {
  it('leaves jsonValue unset on total parse failure (both wrapped and unwrapped attempts fail)', () => {
    const target: State = {
      id: 't', display: 't', kind: 'json', children: [], concurrentRegions: [], transitions: [],
    };
    finalizeJsonBody(target, ['not json at all }{']);
    expect(target.jsonValue).toBeUndefined();
  });
});
