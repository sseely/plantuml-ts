/**
 * T4 (mission SI5b+E2r, batch 2) — shared sprite-definition matcher wiring
 * into every parser that also carries `matchAnnotationCommand` (grepped
 * across `src/diagrams/`, see the T4 task's parser wiring table). Verifies
 * the parser-level contract only: `sprite $name [WxH/N[z]] { ... }` lands
 * in `ast.sprites` instead of being silently dropped or misparsed as engine
 * content, a sprite-shaped line inside an open multiline note construct
 * stays note text (same D3 discipline as the annotation matcher), and
 * sprite-free input is unaffected.
 *
 * @see plans/si5b-stdlib/batch-2/overview.md (T4)
 */
import { describe, it, expect } from 'vitest';
import type { UmlSource } from '../../src/core/block-extractor.js';
import { getSprite } from '../../src/core/sprite-commands.js';
import type { SpriteMonochrome } from '../../src/core/klimt/sprite/SpriteMonochrome.js';

import { parseClass } from '../../src/diagrams/class/parser.js';
import { parseState } from '../../src/diagrams/state/parser.js';
import { parseSequence } from '../../src/diagrams/sequence/parser.js';
import { parseDescription } from '../../src/diagrams/description/parser.js';
import { parseActivity } from '../../src/diagrams/activity/parser.js';
import { parseBoard } from '../../src/diagrams/board/parser.js';
import { parseChronology } from '../../src/diagrams/chronology/parser.js';
import { parseFiles } from '../../src/diagrams/files/parser.js';
import { parsePacket } from '../../src/diagrams/packetdiag/parser.js';
import { parseYaml } from '../../src/diagrams/yaml/parser.js';
import { parseHcl } from '../../src/diagrams/hcl/parser.js';
import { parseJson } from '../../src/diagrams/json/parser.js';
import { parseDot } from '../../src/diagrams/dot/parser.js';
import { parseChart } from '../../src/diagrams/chart/parser.js';

/** Split markup into trimmed, non-empty content lines -- same helper as
 *  `annotations-parsers-a.test.ts` (mission G0b/T5). */
const L = (s: string): string[] =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x !== '');

const SPRITE_BLOCK = 'sprite $Icon {\nF0\n0A\n}';

function expectIcon(sprites: unknown): void {
  const registry = sprites as Parameters<typeof getSprite>[0];
  const sprite = getSprite(registry, 'Icon') as SpriteMonochrome | undefined;
  expect(sprite).toBeDefined();
  expect(sprite!.width).toBe(2);
  expect(sprite!.height).toBe(2);
  expect(sprite!.getGray(0, 0)).toBe(15);
  expect(sprite!.getGray(1, 1)).toBe(10);
}

// ---------------------------------------------------------------------------
// Registry population -- one test per wired parser
// ---------------------------------------------------------------------------

describe('sprite registry population per engine', () => {
  it('class: parseClass populates ast.sprites, no phantom classifier', () => {
    const block: UmlSource = { lines: L(`class Foo\n${SPRITE_BLOCK}\nclass Bar`), type: 'class' };
    const ast = parseClass(block);
    expectIcon(ast.sprites);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Foo', 'Bar']);
  });

  it('state: parseState populates ast.sprites, no phantom state', () => {
    const block: UmlSource = { lines: L(`state A\n${SPRITE_BLOCK}\nstate B`), type: 'state' };
    const ast = parseState(block);
    expectIcon(ast.sprites);
    expect(ast.states.map((s) => s.id)).toEqual(['A', 'B']);
  });

  it('sequence: parseSequence populates ast.sprites, not a message/participant', () => {
    const ast = parseSequence(['Alice -> Bob: hi', ...L(SPRITE_BLOCK), 'Bob -> Alice: hello']);
    expectIcon(ast.sprites);
    expect(ast.events.filter((e) => e.kind === 'message')).toHaveLength(2);
  });

  it('description: parseDescription populates ast.sprites (replaces the old discard-only stub)', () => {
    const block: UmlSource = {
      lines: L(`component c1\n${SPRITE_BLOCK}\ncomponent c2`),
      type: 'description',
    };
    const ast = parseDescription(block);
    expectIcon(ast.sprites);
    expect(ast.nodes.map((n) => n.id)).toEqual(['c1', 'c2']);
  });

  it('activity: parseActivity populates ast.sprites, not an action node', () => {
    const block: UmlSource = { lines: L(`:step one;\n${SPRITE_BLOCK}\n:step two;`), type: 'activity' };
    const ast = parseActivity(block);
    expectIcon(ast.sprites);
    expect(ast.nodes.filter((n) => n.kind === 'action')).toHaveLength(2);
  });

  it('board: parseBoard populates ast.sprites, not an activity label', () => {
    const source: UmlSource = { lines: L(`root\n${SPRITE_BLOCK}\n+child`), type: 'board' };
    const ast = parseBoard(source);
    expectIcon(ast.sprites);
    expect(ast.activities.map((a) => a.name)).toEqual(['root']);
  });

  it('chronology: parseChronology populates ast.sprites, not an event', () => {
    const source: UmlSource = {
      lines: L(`[Launch] happens at 2024-01-01 00:00:00\n${SPRITE_BLOCK}`),
      type: 'chronology',
    };
    const ast = parseChronology(source);
    expectIcon(ast.sprites);
    expect(ast.events.map((e) => e.name)).toEqual(['Launch']);
  });

  it('files: parseFiles populates ast.sprites, not a path entry', () => {
    const source: UmlSource = { lines: L(`/root/\n${SPRITE_BLOCK}\n/root/file.txt`), type: 'files' };
    const ast = parseFiles(source);
    expectIcon(ast.sprites);
    expect(ast.root.children.map((c) => c.name)).toEqual(['root']);
  });

  it('packetdiag: parsePacket populates ast.sprites, not a field line', () => {
    const source: UmlSource = { lines: L(`0-15: Source\n${SPRITE_BLOCK}\n16-31: Dest`), type: 'packetdiag' };
    const ast = parsePacket(source);
    expectIcon(ast.sprites);
    expect(ast.items.map((i) => i.label)).toEqual(['Source', 'Dest']);
  });

  it('json: parseJson populates ast.sprites, JSON body still parses', () => {
    const source: UmlSource = { lines: [...L(SPRITE_BLOCK), '{"a": 1}'], type: 'json' };
    const ast = parseJson(source);
    expectIcon(ast.sprites);
    expect(ast.root).toEqual({ a: 1 });
    expect(ast.parseError).toBe(false);
  });

  it('yaml: parseYaml populates ast.sprites, YAML body still parses', () => {
    const source: UmlSource = { lines: [...L(SPRITE_BLOCK), 'a: 1'], type: 'yaml' };
    const ast = parseYaml(source);
    expectIcon(ast.sprites);
    expect(ast.root).toEqual({ a: '1' });
  });

  it('hcl: parseHcl populates ast.sprites, HCL body still parses', () => {
    const source: UmlSource = { lines: [...L(SPRITE_BLOCK), 'a = 1'], type: 'hcl' };
    const ast = parseHcl(source);
    expectIcon(ast.sprites);
    expect(ast.root).toEqual({ a: '1' });
  });

  it('dot: parseDot populates ast.sprites, DOT body still parses', () => {
    const ast = parseDot(`${SPRITE_BLOCK}\ndigraph { a -> b }`);
    expectIcon(ast.sprites);
    expect(ast.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('chart: parseChart populates ast.sprites, series data still parses', () => {
    const source: UmlSource = { lines: [...L(SPRITE_BLOCK), 'bar [1,2,3]'], type: 'chart' };
    const ast = parseChart(source);
    expectIcon(ast.sprites);
    expect(ast.series).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Multiline-note safety (D3): a sprite-shaped line inside an open note body
// must stay note text, never be consumed as a sprite definition.
// ---------------------------------------------------------------------------

describe('sprite matcher never steals a line from an open multiline note (D3)', () => {
  it('sequence: `note over A` containing a `sprite $X {` line keeps it as note text', () => {
    const ast = parseSequence(['participant A', 'note over A', 'sprite $X {', 'end note']);
    expect(getSprite(ast.sprites!, 'X')).toBeUndefined();
    const noteEvents = ast.events.filter((e) => e.kind === 'note');
    expect(noteEvents).toHaveLength(1);
    expect(noteEvents[0]).toMatchObject({ kind: 'note', text: 'sprite $X {' });
  });

  it('class: `note left of Foo` containing a `sprite $X {` line keeps it as note text', () => {
    const block: UmlSource = {
      lines: L('class Foo\nnote left of Foo\nsprite $X {\nend note'),
      type: 'class',
    };
    const ast = parseClass(block);
    expect(getSprite(ast.sprites!, 'X')).toBeUndefined();
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]!.text).toContain('sprite $X {');
  });

  it('state: `note left of A` containing a `sprite $X {` line keeps it as note text', () => {
    const block: UmlSource = {
      lines: L('state A\nnote left of A\nsprite $X {\nend note'),
      type: 'state',
    };
    const ast = parseState(block);
    expect(getSprite(ast.sprites!, 'X')).toBeUndefined();
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes![0]!.text).toContain('sprite $X {');
  });

  it('description: `note left of c1` containing a `sprite $X {` line keeps it as note text', () => {
    const block: UmlSource = {
      lines: L('component c1\nnote left of c1\nsprite $X {\nend note'),
      type: 'description',
    };
    const ast = parseDescription(block);
    expect(getSprite(ast.sprites!, 'X')).toBeUndefined();
  });

  it('activity: `note left` containing a `sprite $X {` line keeps it as note text', () => {
    const block: UmlSource = {
      lines: L(':step;\nnote left\nsprite $X {\nend note'),
      type: 'activity',
    };
    const ast = parseActivity(block);
    expect(getSprite(ast.sprites!, 'X')).toBeUndefined();
    const noteNode = ast.nodes.find((n) => n.kind === 'note');
    expect(noteNode).toBeDefined();
    expect((noteNode as { text: string }).text).toContain('sprite $X {');
  });
});

// ---------------------------------------------------------------------------
// Sprite-free input is unaffected
// ---------------------------------------------------------------------------

describe('sprite-free input leaves ast.sprites empty and other fields unaffected', () => {
  it('class: no sprite block -> ast.sprites has no entries', () => {
    const block: UmlSource = { lines: L('class Foo\nclass Bar'), type: 'class' };
    const ast = parseClass(block);
    expect(ast.sprites!.byName.size).toBe(0);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Foo', 'Bar']);
  });

  it('sequence: no sprite block -> ast.sprites has no entries', () => {
    const ast = parseSequence(['Alice -> Bob: hi']);
    expect(ast.sprites!.byName.size).toBe(0);
  });
});
