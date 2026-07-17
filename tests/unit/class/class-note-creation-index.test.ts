/**
 * G2 N15: `ClassNote.creationIndex`/`.phantomSlot` — the shared parse-time
 * creation counter now accounts for `CommandFactoryNoteOnEntity`'s "GMN"
 * phantom quark-code slot (a counter increment consumed by no drawn entity
 * at all), so a note-bearing fixture's `entN` uid numbering interleaves
 * correctly with classifiers/namespaces created before and after it.
 *
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:327
 * @see ~/git/plantuml/.../command/note/CommandFactoryNote.java:197
 * @see ~/git/plantuml/.../command/note/CommandFactoryTipOnEntity.java:218-220
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:725-731
 */
import { describe, it, expect } from 'vitest';
import { parseClass } from '../../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

describe('note creation-index / phantom-slot threading (G2 N15)', () => {
  it('a non-tip attached note (multi-line, `note <pos> of X ... end note`) consumes ' +
     'a phantom GMN slot before its own — jar-verified fezugi-39-fujo327 ' +
     '(class a=ent0001, phantom=ent0002 [discarded], note=ent0003)', () => {
    const ast = parse('class a\nnote right of a\nnote on a\nend note');
    expect(ast.classifiers[0]).toMatchObject({ id: 'a', creationIndex: 1 });
    expect(ast.notes[0]).toMatchObject({ creationIndex: 3, phantomSlot: true });
  });

  it('a non-tip attached note (single-line, `note <pos> of X : text`) also ' +
     'consumes the phantom slot', () => {
    const ast = parse('class a\nnote right of a : hi');
    expect(ast.notes[0]).toMatchObject({ creationIndex: 3, phantomSlot: true });
  });

  it('a bare `note <pos>` (implicit target, still CommandFactoryNoteOnEntity) ' +
     'ALSO consumes the phantom slot — GMN generation is unconditional on ' +
     'idShort in the upstream source', () => {
    const ast = parse('class a\nnote bottom: hi');
    expect(ast.notes[0]).toMatchObject({ implicitTarget: true, creationIndex: 3, phantomSlot: true });
  });

  it('a freestanding note (`note "text" as N1`) consumes only ONE slot — no ' +
     'GMN call in CommandFactoryNote', () => {
    const ast = parse('class a\nnote "hi" as N1');
    expect(ast.notes[0]).toMatchObject({ id: 'N1', creationIndex: 2 });
    expect(ast.notes[0]!.phantomSlot).toBeUndefined();
  });

  it('a freestanding multi-line note (`note as N1 ... end note`) also consumes ' +
     'only one slot', () => {
    const ast = parse('class a\nnote as N1\nhello\nend note');
    expect(ast.notes[0]).toMatchObject({ id: 'N1', creationIndex: 2 });
    expect(ast.notes[0]!.phantomSlot).toBeUndefined();
  });

  it('a member-tip note (`note <pos> of X::member`) leaves creationIndex ' +
     'undefined — CommandFactoryTipOnEntity has no GMN call, and its ' +
     'host+position merge is not modeled at parse time (pre-existing ' +
     'fallback numbering, unchanged since N13)', () => {
    const ast = parse('class a { int i }\nnote right of a::i\ntip\nend note');
    expect(ast.notes[0]!.targetPort).toBe('i');
    expect(ast.notes[0]!.creationIndex).toBeUndefined();
    expect(ast.notes[0]!.phantomSlot).toBeUndefined();
  });

  it('a classifier created AFTER a note reflects the note\'s two-slot ' +
     'consumption in its own creationIndex, keeping later entities ' +
     'correctly interleaved', () => {
    const ast = parse('class a\nnote right of a: hi\nclass b');
    expect(ast.classifiers[0]).toMatchObject({ id: 'a', creationIndex: 1 });
    expect(ast.notes[0]).toMatchObject({ creationIndex: 3, phantomSlot: true });
    expect(ast.classifiers[1]).toMatchObject({ id: 'b', creationIndex: 4 });
  });

  it('a classifier created AFTER a freestanding note only reflects one ' +
     'consumed slot', () => {
    const ast = parse('class a\nnote "hi" as N1\nclass b');
    expect(ast.notes[0]).toMatchObject({ creationIndex: 2 });
    expect(ast.classifiers[1]).toMatchObject({ id: 'b', creationIndex: 3 });
  });
});
