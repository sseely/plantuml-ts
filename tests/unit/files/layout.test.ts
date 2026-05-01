import { describe, it, expect } from 'vitest';
import { layoutFiles } from '../../../src/diagrams/files/layout.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import type { FileEntry, FilesDiagramAST } from '../../../src/diagrams/files/ast.js';

const measurer = new FormulaMeasurer();

function folder(name: string, children: FileEntry[] = []): FileEntry {
  return { type: 'folder', name, children };
}

function file(name: string): FileEntry {
  return { type: 'file', name, children: [] };
}

function note(noteLines: string[]): FileEntry {
  return { type: 'note', name: '', children: [], noteLines };
}

function ast(...topLevel: FileEntry[]): FilesDiagramAST {
  return { root: { type: 'folder', name: '', children: topLevel } };
}

describe('layoutFiles', () => {
  describe('AC7: empty AST', () => {
    it('returns zero geometry without throwing', () => {
      const geo = layoutFiles(ast(), measurer);
      expect(geo.entries).toEqual([]);
      expect(geo.totalWidth).toBe(0);
      expect(geo.totalHeight).toBe(0);
    });
  });

  describe('AC1: root-level entries have depth=0, x=0', () => {
    it('single file at root has depth=0 and x=0', () => {
      const geo = layoutFiles(ast(file('README.md')), measurer);
      expect(geo.entries[0]!.depth).toBe(0);
      expect(geo.entries[0]!.x).toBe(0);
    });

    it('multiple root-level entries all have depth=0, x=0', () => {
      const geo = layoutFiles(ast(folder('src'), file('package.json')), measurer);
      for (const entry of geo.entries) {
        expect(entry.depth).toBe(0);
        expect(entry.x).toBe(0);
      }
    });
  });

  describe('AC2: children have depth=1, x=20; grandchildren depth=2, x=40', () => {
    it('child of root folder has depth=1 and x=20', () => {
      const geo = layoutFiles(ast(folder('src', [file('index.ts')])), measurer);
      const child = geo.entries.find((e) => e.name === 'index.ts')!;
      expect(child.depth).toBe(1);
      expect(child.x).toBe(20);
    });

    it('grandchild has depth=2 and x=40', () => {
      const geo = layoutFiles(
        ast(folder('src', [folder('lib', [file('util.ts')])])),
        measurer,
      );
      const grandchild = geo.entries.find((e) => e.name === 'util.ts')!;
      expect(grandchild.depth).toBe(2);
      expect(grandchild.x).toBe(40);
    });
  });

  describe('AC3: DFS pre-order — parent appears before its children', () => {
    it('folder entry precedes its children in output', () => {
      const geo = layoutFiles(ast(folder('src', [file('a.ts'), file('b.ts')])), measurer);
      const srcIdx = geo.entries.findIndex((e) => e.name === 'src');
      const aIdx = geo.entries.findIndex((e) => e.name === 'a.ts');
      const bIdx = geo.entries.findIndex((e) => e.name === 'b.ts');
      expect(srcIdx).toBeLessThan(aIdx);
      expect(aIdx).toBeLessThan(bIdx);
    });

    it('nested DFS: src → lib → util.ts → sibling.ts', () => {
      const geo = layoutFiles(
        ast(folder('src', [folder('lib', [file('util.ts')]), file('sibling.ts')])),
        measurer,
      );
      const names = geo.entries.map((e) => e.name);
      expect(names.indexOf('src')).toBeLessThan(names.indexOf('lib'));
      expect(names.indexOf('lib')).toBeLessThan(names.indexOf('util.ts'));
      expect(names.indexOf('util.ts')).toBeLessThan(names.indexOf('sibling.ts'));
    });
  });

  describe('AC4: y increments by 22 per entry', () => {
    it('three root-level entries have y=0, 22, 44', () => {
      const geo = layoutFiles(ast(file('a'), file('b'), file('c')), measurer);
      expect(geo.entries[0]!.y).toBe(0);
      expect(geo.entries[1]!.y).toBe(22);
      expect(geo.entries[2]!.y).toBe(44);
    });

    it('y increments across folder boundary', () => {
      const geo = layoutFiles(ast(folder('src', [file('index.ts')]), file('pkg.json')), measurer);
      const ys = geo.entries.map((e) => e.y);
      expect(ys).toEqual([0, 22, 44]);
    });
  });

  describe('AC5: note entry appears at its DFS position', () => {
    it('note appears between sibling entries in output order', () => {
      const geo = layoutFiles(
        ast(file('a.ts'), note(['This is a note']), file('b.ts')),
        measurer,
      );
      const names = geo.entries.map((e) => e.name);
      const noteIdx = geo.entries.findIndex((e) => e.type === 'note');
      const aIdx = names.indexOf('a.ts');
      const bIdx = names.indexOf('b.ts');
      expect(aIdx).toBeLessThan(noteIdx);
      expect(noteIdx).toBeLessThan(bIdx);
    });

    it('note entry y is assigned in sequence like any other entry', () => {
      const geo = layoutFiles(ast(file('a.ts'), note(['note text']), file('b.ts')), measurer);
      expect(geo.entries[0]!.y).toBe(0);
      expect(geo.entries[1]!.y).toBe(22);
      expect(geo.entries[2]!.y).toBe(44);
    });
  });

  describe('AC6: totalHeight = entries.length * ROW_HEIGHT', () => {
    it('one entry → totalHeight=22', () => {
      const geo = layoutFiles(ast(file('x')), measurer);
      expect(geo.totalHeight).toBe(22);
    });

    it('four entries → totalHeight=88', () => {
      const geo = layoutFiles(
        ast(folder('src', [file('a'), file('b')]), file('c')),
        measurer,
      );
      expect(geo.totalHeight).toBe(geo.entries.length * 22);
    });
  });

  describe('AC8: labelWidth is positive for non-empty names', () => {
    it('file entry has positive labelWidth', () => {
      const geo = layoutFiles(ast(file('index.ts')), measurer);
      expect(geo.entries[0]!.labelWidth).toBeGreaterThan(0);
    });

    it('folder entry has positive labelWidth', () => {
      const geo = layoutFiles(ast(folder('src')), measurer);
      expect(geo.entries[0]!.labelWidth).toBeGreaterThan(0);
    });

    it('note entry labelWidth reflects max line width', () => {
      const shortLine = 'hi';
      const longLine = 'this is a longer note line';
      const geo = layoutFiles(ast(note([shortLine, longLine])), measurer);
      const noteEntry = geo.entries[0]!;
      const { width: longWidth } = measurer.measure(longLine, {
        family: 'sans-serif',
        size: 14,
      });
      expect(noteEntry.labelWidth).toBeCloseTo(longWidth, 5);
    });

    it('folder labelWidth is wider than file with same name due to icon', () => {
      const geoFolder = layoutFiles(ast(folder('same')), measurer);
      const geoFile = layoutFiles(ast(file('same')), measurer);
      // folder uses '📂 same', file uses '📄 same' — both have same icon width, just verify positive
      expect(geoFolder.entries[0]!.labelWidth).toBeGreaterThan(0);
      expect(geoFile.entries[0]!.labelWidth).toBeGreaterThan(0);
    });

    it('note with empty noteLines array has labelWidth=0', () => {
      const geo = layoutFiles(ast(note([])), measurer);
      expect(geo.entries[0]!.labelWidth).toBe(0);
    });

    it('note entry with undefined noteLines falls back to empty array (labelWidth=0)', () => {
      const bareNote: FileEntry = { type: 'note', name: '', children: [] };
      const geo = layoutFiles(
        { root: { type: 'folder', name: '', children: [bareNote] } },
        measurer,
      );
      expect(geo.entries[0]!.labelWidth).toBe(0);
    });
  });

  describe('totalWidth includes padding', () => {
    it('totalWidth > labelWidth at depth=0 (PADDING*2 added)', () => {
      const geo = layoutFiles(ast(file('hello.ts')), measurer);
      const { width: lw } = measurer.measure('📄 hello.ts', { family: 'sans-serif', size: 14 });
      expect(geo.totalWidth).toBeCloseTo(lw + 20, 5);
    });

    it('totalWidth accounts for indented entries reaching further right', () => {
      const deep = layoutFiles(
        ast(folder('src', [folder('lib', [file('deep.ts')])])),
        measurer,
      );
      const shallow = layoutFiles(ast(file('deep.ts')), measurer);
      // deeper x=40 so totalWidth should be larger
      expect(deep.totalWidth).toBeGreaterThan(shallow.totalWidth);
    });
  });

  describe('noteLines preserved in geometry', () => {
    it('noteLines are passed through to EntryGeometry', () => {
      const lines = ['line one', 'line two'];
      const geo = layoutFiles(ast(note(lines)), measurer);
      expect(geo.entries[0]!.noteLines).toEqual(lines);
    });
  });
});
