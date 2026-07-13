/**
 * T5 (mission G0b, batch 2) — annotation-matcher wiring into the class,
 * state, and sequence parsers.
 *
 * Verifies the parser-level contract only (decisions.md D3): `title`/
 * `legend`/`caption`/`header`/`footer`/`mainframe` directives land in
 * `ast.annotations` instead of being silently dropped or misparsed as
 * engine content, a directive line inside an open multiline construct
 * (`note … end note`) stays construct text, and annotation-free input is
 * unaffected. Chrome rendering is T7+ — out of scope here.
 *
 * @see plans/g0b-annotations/batch-2/T5-parsers-a.md
 * @see plans/g0b-annotations/decisions.md (D3)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseClass } from '../../src/diagrams/class/parser.js';
import type { UmlSource } from '../../src/core/block-extractor.js';
import { parseState } from '../../src/diagrams/state/parser.js';
import { parseSequence } from '../../src/diagrams/sequence/parser.js';
import { isEmpty, isDisplayPositionedNull } from '../../src/core/annotations/index.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../corpus');

/** Split markup into trimmed, non-empty content lines (as `UmlSource.lines`
 *  / `parseSequence`'s raw-line contract expect). */
const L = (s: string): string[] =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x !== '');

function parseClassSource(source: string) {
  const block: UmlSource = { lines: L(source), type: 'class' };
  return parseClass(block);
}

function parseStateSource(source: string) {
  const block: UmlSource = { lines: L(source), type: 'state' };
  return parseState(block);
}

// ---------------------------------------------------------------------------
// class
// ---------------------------------------------------------------------------

describe('class — annotation commands land in ast.annotations', () => {
  it('a top-level `title X` line sets annotations.title and creates no phantom classifier', () => {
    const ast = parseClassSource('class Foo\ntitle My Diagram\nclass Bar');
    expect(ast.annotations).toBeDefined();
    expect(isDisplayPositionedNull(ast.annotations!.title)).toBe(false);
    expect(ast.annotations!.title.display).toEqual(['My Diagram']);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['Foo', 'Bar']);
  });

  it('a `legend ... end legend` block lands in annotations.legend, no leak into classifiers', () => {
    const ast = parseClassSource('class foo\nlegend\nsome legend text\nend legend');
    expect(isDisplayPositionedNull(ast.annotations!.legend)).toBe(false);
    expect(ast.annotations!.legend.display).toEqual(['some legend text']);
    // The legend body must not have created a phantom classifier/note.
    expect(ast.classifiers.map((c) => c.id)).toEqual(['foo']);
    expect(ast.notes).toHaveLength(0);
  });

  it('endlegend (one word) is also consumed — matches the pre-existing pendingLegend closer spellings', () => {
    const ast = parseClassSource('class foo\nlegend\ntext\nendlegend\nclass bar');
    expect(ast.annotations!.legend.display).toEqual(['text']);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['foo', 'bar']);
  });

  it('a `title:`/`header:` colon-form line at top level is member-addition (CommandAddMethod), not chrome — matches upstream registration order', () => {
    // ClassDiagramFactory registers CommonCommands.addTitleCommands LAST
    // (line 168 of ~170), AFTER the generic `CODE : text` member rule (line
    // 109) -- so `header: text` creates/appends to a classifier literally
    // named `header`, exactly like real upstream output (see parser.ts's
    // doc). Only the space-separated form (no colon) is unambiguous.
    const ast = parseClassSource('header: not a chrome directive');
    expect(isDisplayPositionedNull(ast.annotations!.header)).toBe(true);
    expect(ast.classifiers.map((c) => c.id)).toEqual(['header']);
  });

  it('annotation-free input: annotations is empty and classifiers/relationships are unaffected', () => {
    const source = readFileSync(join(CORPUS, 'class/bajotu-30-soku184.puml'), 'utf8');
    const bodyLines = source
      .split('\n')
      .filter((l) => !/^@(start|end)uml/i.test(l.trim()));
    const ast = parseClassSource(bodyLines.join('\n'));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.classifiers.map((c) => c.id).sort()).toEqual(['cl2', 'p1', 'p1.cl1']);
    expect(ast.relationships).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

describe('state — annotation commands land in ast.annotations', () => {
  it('a top-level `title X` line sets annotations.title and creates no phantom state', () => {
    const ast = parseStateSource('state A\ntitle My State Diagram\nstate B');
    expect(isDisplayPositionedNull(ast.annotations!.title)).toBe(false);
    expect(ast.annotations!.title.display).toEqual(['My State Diagram']);
    expect(ast.states.map((s) => s.id)).toEqual(['A', 'B']);
  });

  it('a `caption My caption` line sets annotations.caption', () => {
    const ast = parseStateSource('state A\ncaption My caption');
    expect(ast.annotations!.caption.display).toEqual(['My caption']);
    expect(ast.states.map((s) => s.id)).toEqual(['A']);
  });

  it('a `HEADER: text` description line stays a description line on a state named HEADER (CommandAddField wins) — the desebo-47-maro096 regression guard', () => {
    // StateDiagramFactory registers CommonCommands.addCommonCommands1 LAST
    // (line 118 of ~120), AFTER CommandAddField (line 94) -- verified
    // against the desebo-47-maro096 oracle DOT (16 nodes incl. a degree-0
    // "HEADER" state). If the matcher ran before dispatchCommand, this
    // state would vanish (folded into annotations.header instead).
    const ast = parseStateSource('HEADER: 0x00h FW_VERSION_0');
    expect(isDisplayPositionedNull(ast.annotations!.header)).toBe(true);
    expect(ast.states.map((s) => s.id)).toEqual(['HEADER']);
  });

  it('annotation-free input: annotations is empty and states are unaffected', () => {
    const source = readFileSync(join(CORPUS, 'state/fuxavu-11-goco024.puml'), 'utf8');
    const bodyLines = source
      .split('\n')
      .filter((l) => !/^@(start|end)uml/i.test(l.trim()));
    const ast = parseStateSource(bodyLines.join('\n'));
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.states.map((s) => s.id)).toEqual(['single1', 'single2']);
  });
});

// ---------------------------------------------------------------------------
// sequence
// ---------------------------------------------------------------------------

describe('sequence — annotation commands land in ast.annotations', () => {
  it('a top-level `title X` line sets annotations.title and is not a message/participant', () => {
    const ast = parseSequence(['Alice -> Bob: hi', 'title My Sequence', 'Bob -> Alice: hello']);
    expect(isDisplayPositionedNull(ast.annotations!.title)).toBe(false);
    expect(ast.annotations!.title.display).toEqual(['My Sequence']);
    expect(ast.events.filter((e) => e.kind === 'message')).toHaveLength(2);
    expect(ast.participants.map((p) => p.id)).toEqual(['Alice', 'Bob']);
  });

  it('a multiline `title ... end title` block sets annotations.title', () => {
    const ast = parseSequence(['title', 'line one', 'line two', 'end title', 'Alice -> Bob: hi']);
    expect(ast.annotations!.title.display).toEqual(['line one', 'line two']);
    expect(ast.events.filter((e) => e.kind === 'message')).toHaveLength(1);
  });

  it('`note over A` containing a `title inside` line keeps it as note text — annotations.title stays null (D3)', () => {
    const ast = parseSequence([
      'participant A',
      'note over A',
      'title not a title',
      'end note',
    ]);
    expect(isDisplayPositionedNull(ast.annotations!.title)).toBe(true);
    const noteEvents = ast.events.filter((e) => e.kind === 'note');
    expect(noteEvents).toHaveLength(1);
    expect(noteEvents[0]).toMatchObject({ kind: 'note', text: 'title not a title' });
  });

  it('annotation-free input: annotations is empty and participants/events are unaffected', () => {
    const source = readFileSync(join(CORPUS, 'sequence/A0001_Test.puml'), 'utf8');
    const bodyLines = source
      .split('\n')
      .filter((l) => !/^@(start|end)uml/i.test(l.trim()));
    const ast = parseSequence(bodyLines);
    expect(isEmpty(ast.annotations!)).toBe(true);
    expect(ast.participants.map((p) => p.id)).toEqual(['Bob', 'Alice']);
    expect(ast.events.filter((e) => e.kind === 'message')).toHaveLength(4);
  });
});
