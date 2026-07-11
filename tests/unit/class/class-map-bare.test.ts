/**
 * Bare `map Name` (no `{` body) — upstream this is NOT CommandCreateMap
 * (whose start regex mandates a trailing `{`) but a TYPE alternative of
 * CommandCreateClass itself (CommandCreateClass.java:87: `...|dataclass|
 * record|map`), mapped through `LeafType.getLeafType` to an empty MAP leaf.
 * Jar probe confirmed: `@startuml map map0 @enduml` renders an empty map,
 * data-diagram-type CLASS. Pinned by Phase L iteration 5 of mission
 * object-dot-sync (fixture gatefi-65-curu360).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:87
 * @see ~/git/plantuml/.../abel/LeafType.java#getLeafType
 */

import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { ClassDiagramAST } from '../../../src/diagrams/class/ast.js';

function parse(source: string): ClassDiagramAST {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('bare map declaration (CommandCreateClass TYPE=map)', () => {
  it('parses gatefi-65-curu360 shape: bare map + empty-body map', () => {
    const ast = parse('map map0\nmap map1 {\n}');
    expect(ast.classifiers.map((c) => ({ id: c.id, kind: c.kind }))).toEqual([
      { id: 'map0', kind: 'map' },
      { id: 'map1', kind: 'map' },
    ]);
    expect(ast.classifiers[0]!.rows ?? []).toEqual([]);
  });

  it('bare map with display/as/stereotype/color header parts', () => {
    const ast = parse('map "Display" as M1 <<s>> #pink');
    const m = ast.classifiers[0]!;
    expect(m.kind).toBe('map');
    expect(m.id).toBe('M1');
    expect(m.display).toBe('Display');
    expect(m.stereotype).toBe('s');
    expect(m.color).toContain('#pink');
  });

  it('multiline form still wins for map X { (rows parsed, not class members)', () => {
    const ast = parse('map M {\nk => v\n}');
    expect(ast.classifiers[0]!.rows).toEqual([{ key: 'k', value: 'v' }]);
  });

  it('map <|-- Foo stays a relationship (name-start guard unaffected)', () => {
    const ast = parse('class map\nclass Foo\nmap <|-- Foo');
    expect(ast.relationships).toHaveLength(1);
  });
});
