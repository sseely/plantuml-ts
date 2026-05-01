import { describe, it, expect } from 'vitest';
import { parseFiles } from '../../../src/diagrams/files/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';
import type { FileEntry } from '../../../src/diagrams/files/ast.js';

function makeSource(lines: string[]): UmlSource {
  return { lines, type: 'files' };
}

/** Convenience: find a direct child by name. */
function child(node: FileEntry, name: string): FileEntry | undefined {
  return node.children.find((c) => c.name === name);
}

describe('parseFiles', () => {
  // -------------------------------------------------------------------------
  // AC1 — /src/foo.ts → root has folder `src`; `src` has file `foo.ts`
  // -------------------------------------------------------------------------
  it('AC1: /src/foo.ts creates folder src containing file foo.ts', () => {
    const ast = parseFiles(makeSource(['@startfiles', '/src/foo.ts', '@endfiles']));
    const src = child(ast.root, 'src');
    expect(src).toBeDefined();
    expect(src!.type).toBe('folder');
    const foo = child(src!, 'foo.ts');
    expect(foo).toBeDefined();
    expect(foo!.type).toBe('file');
  });

  // -------------------------------------------------------------------------
  // AC2 — /src/ (trailing slash) → folder src with no file children
  // -------------------------------------------------------------------------
  it('AC2: trailing slash declares folder with no file child', () => {
    const ast = parseFiles(makeSource(['/src/']));
    const src = child(ast.root, 'src');
    expect(src).toBeDefined();
    expect(src!.type).toBe('folder');
    expect(src!.children.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC3 — /.github (no trailing slash) → DATA file `.github` at root
  // -------------------------------------------------------------------------
  it('AC3: path without trailing slash and no nested separator is a file at root', () => {
    const ast = parseFiles(makeSource(['/.github']));
    const entry = child(ast.root, '.github');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('file');
  });

  // -------------------------------------------------------------------------
  // AC4 — shared folder: /src/a.ts then /src/b.ts → single src folder
  // -------------------------------------------------------------------------
  it('AC4: two paths sharing a prefix reuse the same folder node', () => {
    const ast = parseFiles(makeSource(['/src/a.ts', '/src/b.ts']));
    const src = child(ast.root, 'src');
    expect(src).toBeDefined();
    // Only one `src` folder
    const srcFolders = ast.root.children.filter(
      (c) => c.type === 'folder' && c.name === 'src',
    );
    expect(srcFolders.length).toBe(1);
    expect(src!.children.length).toBe(2);
    expect(child(src!, 'a.ts')!.type).toBe('file');
    expect(child(src!, 'b.ts')!.type).toBe('file');
  });

  // -------------------------------------------------------------------------
  // AC5 — <note> after /src/foo.ts attaches to src folder (not foo.ts)
  // -------------------------------------------------------------------------
  it('AC5: note after a file attaches to the parent folder of that file', () => {
    const ast = parseFiles(
      makeSource(['/src/foo.ts', '<note>', 'A note line', '</note>']),
    );
    const src = child(ast.root, 'src');
    expect(src).toBeDefined();
    const note = src!.children.find((c) => c.type === 'note');
    expect(note).toBeDefined();
    expect(note!.noteLines).toEqual(['A note line']);
    // foo.ts itself should have no children
    const foo = child(src!, 'foo.ts');
    expect(foo!.children.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC6 — <note> as first entry (no prior file) → NOTE child of root
  // -------------------------------------------------------------------------
  it('AC6: note with no prior file entry attaches to root', () => {
    const ast = parseFiles(
      makeSource(['<note>', 'root note', '</note>']),
    );
    const note = ast.root.children.find((c) => c.type === 'note');
    expect(note).toBeDefined();
    expect(note!.noteLines).toEqual(['root note']);
  });

  // -------------------------------------------------------------------------
  // AC7 — <style>…</style> silently consumed; !theme and blanks ignored
  // -------------------------------------------------------------------------
  it('AC7: style blocks and !-directives are silently consumed', () => {
    const ast = parseFiles(
      makeSource([
        '<style>',
        '.foo { color: red }',
        '</style>',
        '!theme plain',
        '',
        '/main.ts',
      ]),
    );
    expect(ast.root.children.length).toBe(1);
    expect(ast.root.children[0]!.type).toBe('file');
    expect(ast.root.children[0]!.name).toBe('main.ts');
  });

  // -------------------------------------------------------------------------
  // AC8 — @startfiles / @endfiles wrapper lines produce no tree entries
  // -------------------------------------------------------------------------
  it('AC8: @startfiles and @endfiles are stripped without producing entries', () => {
    const ast = parseFiles(
      makeSource(['@startfiles', '/index.ts', '@endfiles']),
    );
    expect(ast.root.children.length).toBe(1);
    expect(ast.root.children[0]!.name).toBe('index.ts');
  });

  // -------------------------------------------------------------------------
  // AC9 — ~ in filename treated as part of the name
  // -------------------------------------------------------------------------
  it('AC9: tilde in filename is treated as a regular character', () => {
    const ast = parseFiles(makeSource(['/tests/~init.py']));
    const tests = child(ast.root, 'tests');
    expect(tests).toBeDefined();
    const f = child(tests!, '~init.py');
    expect(f).toBeDefined();
    expect(f!.type).toBe('file');
  });

  // -------------------------------------------------------------------------
  // AC10 — Full nested path /a/b/c/d.ts → nested folders a → b → c → file d
  // -------------------------------------------------------------------------
  it('AC10: deeply nested path creates nested folder chain', () => {
    const ast = parseFiles(makeSource(['/a/b/c/d.ts']));
    const a = child(ast.root, 'a');
    const b = child(a!, 'b');
    const c = child(b!, 'c');
    const d = child(c!, 'd.ts');
    expect(a!.type).toBe('folder');
    expect(b!.type).toBe('folder');
    expect(c!.type).toBe('folder');
    expect(d!.type).toBe('file');
  });

  // -------------------------------------------------------------------------
  // Extra tests to reach 90/90/90 coverage
  // -------------------------------------------------------------------------

  it('empty source returns empty root', () => {
    const ast = parseFiles(makeSource([]));
    expect(ast.root.type).toBe('folder');
    expect(ast.root.name).toBe('');
    expect(ast.root.children).toEqual([]);
  });

  it('root entry: /file.txt is a file directly under root', () => {
    const ast = parseFiles(makeSource(['/file.txt']));
    expect(ast.root.children.length).toBe(1);
    expect(ast.root.children[0]!.name).toBe('file.txt');
    expect(ast.root.children[0]!.type).toBe('file');
  });

  it('note after trailing-slash folder uses last real file as anchor', () => {
    // lastCreated stays as /src/a.ts after /src/ because trailing slash
    // returns null and we leave lastCreated unchanged
    const ast = parseFiles(
      makeSource(['/src/a.ts', '/lib/', '<note>', 'n', '</note>']),
    );
    // note should attach to parent of a.ts = src
    const src = child(ast.root, 'src');
    const note = src!.children.find((c) => c.type === 'note');
    expect(note).toBeDefined();
  });

  it('multi-line note captures all inner lines', () => {
    const ast = parseFiles(
      makeSource([
        '/doc/readme.md',
        '<note>',
        'line1',
        'line2',
        'line3',
        '</note>',
      ]),
    );
    const doc = child(ast.root, 'doc');
    const note = doc!.children.find((c) => c.type === 'note');
    expect(note!.noteLines).toEqual(['line1', 'line2', 'line3']);
  });

  it('note does not update lastCreated — subsequent note still attaches to same parent', () => {
    const ast = parseFiles(
      makeSource([
        '/pkg/mod.ts',
        '<note>',
        'first note',
        '</note>',
        '<note>',
        'second note',
        '</note>',
      ]),
    );
    const pkg = child(ast.root, 'pkg');
    const notes = pkg!.children.filter((c) => c.type === 'note');
    expect(notes.length).toBe(2);
  });

  it('unrecognised lines (no leading /) are silently ignored', () => {
    const ast = parseFiles(makeSource(['some random text', '/valid.ts']));
    expect(ast.root.children.length).toBe(1);
    expect(ast.root.children[0]!.name).toBe('valid.ts');
  });

  it('@STARTFILES uppercase wrapper is stripped', () => {
    const ast = parseFiles(makeSource(['@STARTFILES', '/a.ts', '@ENDFILES']));
    expect(ast.root.children.length).toBe(1);
    expect(ast.root.children[0]!.name).toBe('a.ts');
  });

  it('sibling files under root are each direct file children', () => {
    const ast = parseFiles(makeSource(['/a.ts', '/b.ts', '/c.ts']));
    expect(ast.root.children.length).toBe(3);
    expect(ast.root.children.map((c) => c.name)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('full fixture: typical project layout', () => {
    const lines = [
      '@startfiles',
      '/src/index.ts',
      '/src/utils/helper.ts',
      '/src/utils/math.ts',
      '/tests/unit/parser.test.ts',
      '/.github/workflows/ci.yml',
      '/package.json',
      '@endfiles',
    ];
    const ast = parseFiles(makeSource(lines));
    const src = child(ast.root, 'src');
    const utils = child(src!, 'utils');
    expect(utils!.children.length).toBe(2);
    const tests = child(ast.root, 'tests');
    const unit = child(tests!, 'unit');
    expect(unit!.children.length).toBe(1);
    const github = child(ast.root, '.github');
    expect(github!.type).toBe('folder');
    expect(child(github!, 'workflows')).toBeDefined();
    expect(child(ast.root, 'package.json')!.type).toBe('file');
  });
});
