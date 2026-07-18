/**
 * Iteration 6 (class-dot-sync): four note-command variants dropped by the
 * parser because the note-opener/single-line regexes had no room for a
 * URL, stereotype, or color segment between the entity reference and the
 * `:`/end-of-line. Upstream's grammar makes all three optional in that
 * exact order (STEREO, then COLOR, then URL) — see
 * `CommandFactoryNoteOnEntity.java:92-116` (attached forms) and
 * `CommandFactoryNote.java:77-107` (freestanding forms, no URL group).
 *
 * `ClassNote` (ast.ts) carries no stereotype/url fields, so those are
 * parsed and discarded. `color` IS captured (G2 N34, `ast.ts#ClassNote
 * .color`'s doc comment) — see the "color forms" describe block below,
 * which now asserts on it directly.
 *
 * Corpus fixtures exercising each case: danozo-79-nunu375, neruke-07-ruce381,
 * xekeje-31-taba218, xokipa-29-rafu481.
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

describe('note command variants — URL / stereotype / color decorations', () => {
  // danozo-79-nunu375: multi-line opener with a URL right after `of <Entity>`.
  it('multi-line note-of opener followed by a [[url]] is not dropped', () => {
    const ast = parse(
      ['class Alice', 'note left of Alice [[http://www.google.fr]]', 'Note', 'end note'].join(
        '\n',
      ),
    );
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'Alice', position: 'left', text: 'Note' });
  });

  // neruke-07-ruce381: multi-line opener with a stereotype on the note-position line.
  // G2 N37: the stereotype VALUE is now captured (`ClassNote.stereotype`,
  // `NOTE_STEREO_CAPTURE`) -- was merely "not dropped" (consumed but
  // discarded) before this iteration.
  it('multi-line note-of opener followed by a <<stereotype>> captures its value', () => {
    const ast = parse(
      ['class A', 'note left of A <<faint>>', 'test red', 'end note'].join('\n'),
    );
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({
      target: 'A', position: 'left', text: 'test red', stereotype: 'faint',
    });
  });

  describe('xekeje-31-taba218 — color forms', () => {
    it('single-line `note <pos> of X #color: text`', () => {
      const ast = parse(['class A1', 'note left of A1 #green: note green'].join('\n'));
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]).toMatchObject({
        target: 'A1',
        position: 'left',
        text: 'note green',
        color: '#green',
      });
    });

    it('multi-line opener `note <pos> of X #color` with `end note` closer', () => {
      const ast = parse(
        ['class A1', 'note bottom of A1 #red', 'this is red', 'end note'].join('\n'),
      );
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]).toMatchObject({
        target: 'A1',
        position: 'bottom',
        text: 'this is red',
        color: '#red',
      });
    });

    it('freestanding multi-line opener `note as N #color` with one-word `endnote` closer', () => {
      const ast = parse(['note as N1 #blue', 'this is blue', 'endnote'].join('\n'));
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]).toMatchObject({ id: 'N1', text: 'this is blue', color: '#blue' });
      expect(ast.notes[0]!.target).toBeUndefined();
    });

    it('freestanding single-line `note "text" as N #color`', () => {
      const ast = parse('note "toto toto" as N2 #666666');
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]).toMatchObject({ id: 'N2', text: 'toto toto', color: '#666666' });
      expect(ast.notes[0]!.target).toBeUndefined();
    });

    it('multi-line brace opener `note <pos> of X #color {` closed by `}`', () => {
      const ast = parse(
        ['class A1', 'note left of A1 #green {', 'body', '}'].join('\n'),
      );
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]).toMatchObject({ target: 'A1', position: 'left', color: '#green' });
    });

    // G2 N37: brace opener + stereotype + color TOGETHER -- verifies the
    // NOTE_STEREO_CAPTURE/NOTE_COLOR/brace-closer match-index shift
    // (match[3]=stereotype, match[4]=color, match[5]=closer).
    it('multi-line brace opener `note <pos> of X <<stereotype>> #color {` closed by `}`', () => {
      const ast = parse(
        ['class A1', 'note left of A1 <<faint>> #green {', 'body', '}'].join('\n'),
      );
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]).toMatchObject({
        target: 'A1', position: 'left', text: 'body', stereotype: 'faint', color: '#green',
      });
    });

    it('compound `#color;line.bold:purple;text:777` is captured whole', () => {
      const ast = parse(
        ['class cl1', 'note right of cl1 #blue;line.bold:purple;text:FF0', 'end note'].join('\n'),
      );
      expect(ast.notes).toHaveLength(1);
      expect(ast.notes[0]!.color).toBe('#blue;line.bold:purple;text:FF0');
    });
  });

  // xokipa-29-rafu481: no `of`, stereotype + inline colon text.
  it('single-line `note <pos> <<stereotype>>: text` with no `of` clause', () => {
    const ast = parse(['class Foo', 'note left <<green>>: On last defined class'].join('\n'));
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({
      target: 'Foo',
      position: 'left',
      text: 'On last defined class',
      stereotype: 'green',
    });
  });

  // G2 N37: single-line note stereotype + color TOGETHER -- verifies the
  // NOTE_STEREO_CAPTURE/NOTE_COLOR match-index shift (match[3]=stereotype,
  // match[4]=color) rather than either field silently absorbing the other.
  it('single-line `note <pos> of X <<stereotype>> #color: text` (both decorations together)', () => {
    const ast = parse(['class A1', 'note left of A1 <<faint>> #green: text here'].join('\n'));
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({
      target: 'A1', position: 'left', text: 'text here', stereotype: 'faint', color: '#green',
    });
  });

  // G2 N37: multi-line freestanding opener (6d) -- match[3]=stereotype,
  // match[4]=color.
  it('freestanding multi-line `note as N <<stereotype>> #color` opener', () => {
    const ast = parse(['note as N4 <<faint>> #blue', 'body', 'end note'].join('\n'));
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ id: 'N4', text: 'body', stereotype: 'faint', color: '#blue' });
  });

  // G2 N37: single-line freestanding (6e) -- match[4]=stereotype, match[5]=color.
  it('freestanding single-line `note "text" as N <<stereotype>> #color`', () => {
    const ast = parse('note "toto" as N5 <<faint>> #red');
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ id: 'N5', text: 'toto', stereotype: 'faint', color: '#red' });
  });
});

describe('regression — plain note forms unchanged', () => {
  it('plain single-line `note <pos> of X: text`', () => {
    const ast = parse(['class Alice', 'note left of Alice: hello'].join('\n'));
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ target: 'Alice', position: 'left', text: 'hello' });
  });

  it('plain freestanding multi-line `note as N` with `end note` closer', () => {
    const ast = parse(['note as N3', 'body text', 'end note'].join('\n'));
    expect(ast.notes).toHaveLength(1);
    expect(ast.notes[0]).toMatchObject({ id: 'N3', text: 'body text' });
  });
});
