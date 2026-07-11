/**
 * Iteration 2 (class-dot-sync): the `of <Entity>` clause on `note <pos>` is
 * OPTIONAL in upstream's grammar. When absent, the note attaches to the last
 * created entity (upstream `CucaDiagram#lastEntity`, set by every
 * `reallyCreateLeaf` call — classifiers AND notes themselves).
 *
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:92-116
 *      getRegexConcatSingleLine — `of <Entity>` is a RegexOr(real-concat,
 *      RegexLeaf("")), i.e. optional.
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:293-308
 *      executeInternal — idShort==null -> cl1 = diagram.getLastEntity();
 *      null -> CommandExecutionResult.error("Nothing to note to").
 * @see ~/git/plantuml/.../net/atmp/CucaDiagram.java:218-228 reallyCreateLeaf
 *      unconditionally sets `this.lastEntity = result` for EVERY leaf it
 *      creates, including LeafType.NOTE — so a note updates lastEntity too.
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

describe('note on entity — optional `of` clause resolves to lastEntity', () => {
  it('(a) single-line note with no `of` attaches to the last created classifier', () => {
    const ast = parse('class A\nnote bottom: hi');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'A', position: 'bottom', text: 'hi' });
    expect(ast.classifiers).toHaveLength(1);
  });

  it('(b) multi-line note with no `of` attaches to the last created classifier', () => {
    const ast = parse('class A\nnote right\nline one\nline two\nend note');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({
      target: 'A',
      position: 'right',
      text: 'line one\nline two',
    });
  });

  it('(c) a note with no prior entity is dropped gracefully — no throw, no note', () => {
    expect(() => parse('note bottom: hi')).not.toThrow();
    const ast = parse('note bottom: hi');
    expect(ast.notes).toEqual([]);
  });

  it('(c-multi) a multi-line note with no prior entity is dropped gracefully', () => {
    expect(() => parse('note left\nbody\nend note')).not.toThrow();
    const ast = parse('note left\nbody\nend note');
    expect(ast.notes).toEqual([]);
  });

  it('(d) two classes then a bare note attaches to the SECOND (most recently created)', () => {
    const ast = parse('class A\nclass B\nnote top: hi');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'B', position: 'top', text: 'hi' });
  });

  it('(e) note-after-note: a bare note attaches to the PREVIOUS note, not the class', () => {
    // CucaDiagram#reallyCreateLeaf sets lastEntity on every leaf it creates,
    // including notes (LeafType.NOTE) — so after `note left of A` creates a
    // note, lastEntity is that note, and a following bare note attaches to it.
    const ast = parse('class A\nnote left of A: first\nnote bottom: second');
    expect(ast.notes).toHaveLength(2);
    expect(ast.notes[0]).toMatchObject({ target: 'A', position: 'left', text: 'first' });
    expect(ast.notes[1]!.position).toBe('bottom');
    expect(ast.notes[1]!.text).toBe('second');
    // Second note's target is the FIRST note's generated id, not "A".
    expect(ast.notes[1]!.target).toBe(ast.notes[0]!.id);
  });

  it('(f) existing `note left of X: text` (explicit target) is unchanged', () => {
    const ast = parse('class Alice\nnote left of Alice : hello');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'Alice', position: 'left', text: 'hello' });
  });

  it('an explicit target still wins even when a different entity was created most recently', () => {
    const ast = parse('class A\nclass B\nnote top of A: hi');
    expect(ast.notes[0]).toMatchObject({ target: 'A', position: 'top', text: 'hi' });
  });

  it('re-declaring an existing classifier still updates lastEntity (unconditional setLastEntity)', () => {
    // CommandCreateClass.java:202 `diagram.setLastEntity(entity)` runs
    // UNCONDITIONALLY after resolving the declaration's quark, whether that
    // quark was just created or already existed (e.g. `set separator none`
    // makes a bare re-declaration resolve to an entity declared earlier in a
    // different scope). Fixture: kejeka-49-kofa156.
    const ast = parse(
      [
        'set separator none',
        'package Mall {',
        '  class Inventory',
        '}',
        'class Item {',
        '}',
        'note bottom: 1',
        'class Inventory {',
        '}',
        'note right: 2',
      ].join('\n'),
    );
    expect(ast.classifiers).toHaveLength(2);
    expect(ast.notes).toHaveLength(2);
    // First note (bare) attaches to Item, the last entity created before it.
    expect(ast.notes[0]).toMatchObject({ target: 'Item', position: 'bottom', text: '1' });
    // Second note (bare) attaches to the re-declared Inventory (lastEntity was
    // reset to it by the second `class Inventory {}`, even though that
    // declaration reused the existing Mall.Inventory quark) — NOT to the
    // first note.
    expect(ast.notes[1]).toMatchObject({ target: 'Inventory', position: 'right', text: '2' });
  });
});
