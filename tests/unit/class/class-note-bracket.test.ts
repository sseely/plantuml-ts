/**
 * Brace-terminated multi-line note (mission A2, Fix B): `note <pos> [of X] {`
 * … `}` — a SEPARATE upstream grammar (`withBracket=true`) from the
 * `end note`-terminated form, registered alongside it
 * (ClassDiagramFactory.java:155-156). Traced to lenunu-95-bame774.
 *
 * @see ~/git/plantuml/.../command/note/CommandFactoryNoteOnEntity.java:120-146
 *   (getRegexConcatMultiLine(withBracket), END_WITH_BRACKET = `^(\})$`)
 * @see ~/git/plantuml/.../classdiagram/ClassDiagramFactory.java:150-157
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

describe('brace-terminated note on entity: `note <pos> [of X] {` … `}`', () => {
  it('parses a bare `note right {` closed by `}` (lenunu-95-bame774)', () => {
    const ast = parse(`
      class Example {
      }
      note left
      this is a note
      end note
      Example *-- Data
      note right {
      this is a right note
      }
    `);
    expect(ast.notes).toHaveLength(2);
    expect(ast.notes[0]).toMatchObject({
      position: 'left',
      target: 'Example',
      text: 'this is a note',
    });
    // No explicit `of <Entity>` on the brace note: it attaches to lastEntity,
    // which the preceding `Example *-- Data` relationship moved to `Data`.
    expect(ast.notes[1]).toMatchObject({
      position: 'right',
      target: 'Data',
      text: 'this is a right note',
    });
  });

  it('parses `note <pos> of <Entity> {` with an explicit target', () => {
    const ast = parse(`
      class Foo
      class Bar
      note top of Bar {
      line one
      line two
      }
    `);
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({
      position: 'top',
      target: 'Bar',
      text: 'line one\nline two',
    });
  });

  it('a lone `}` closes the brace note without leaking into namespace-close handling', () => {
    // A pending brace-note must consume its own `}` before the namespace
    // close rule ever sees the line — otherwise this would either close the
    // namespace early or leave the note unterminated.
    const ast = parse(`
      namespace ns {
      class Inside
      note right of Inside {
      body text
      }
      }
    `);
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'Inside', text: 'body text', namespace: 'ns' });
    expect(ast.classifiers.find((c) => c.display === 'Inside')).toBeDefined();
  });

  it('still supports the `end note`-terminated form unchanged (no regression)', () => {
    const ast = parse(`
      class Foo
      note right of Foo
      classic form
      end note
    `);
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'Foo', text: 'classic form' });
  });
});
