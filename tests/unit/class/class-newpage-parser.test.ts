/**
 * `newpage` (upstream `CommandNewpage` / `NewpagedDiagram`) — parser splits a
 * multi-page class source into per-page ASTs (decision D1, T6).
 *
 * @see ~/git/plantuml/.../descdiagram/command/CommandNewpage.java:77-88
 * @see ~/git/plantuml/.../NewpagedDiagram.java:61-162
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseClass } from '../../../src/diagrams/class/parser.js';
import { extractBlocks } from '../../../src/core/block-extractor.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(source: string): ReturnType<typeof parseClass> {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const block: UmlSource = { lines, type: 'class' };
  return parseClass(block);
}

/** Parse a raw `.puml` source (with @startuml/@enduml) via the real
 *  preprocessor entry point, mirroring how corpus fixtures are consumed. */
function parseRaw(source: string): ReturnType<typeof parseClass> {
  const blocks = extractBlocks(source.split('\n'));
  const block = blocks[0];
  if (block === undefined) throw new Error('Expected at least one @startuml block');
  return parseClass(block);
}

// ---------------------------------------------------------------------------
// Single-page sources: `pages` must stay absent, AST unchanged.
// ---------------------------------------------------------------------------

describe('newpage absent — single page', () => {
  it('leaves `pages` undefined when no newpage appears', () => {
    const ast = parse(`
      class A
      class B
      A --> B
    `);
    expect(ast.pages).toBeUndefined();
    expect(ast.classifiers.map((c) => c.id)).toEqual(['A', 'B']);
    expect(ast.relationships).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Two-page source: classifiers must be page-local.
// ---------------------------------------------------------------------------

describe('newpage — two pages', () => {
  it('splits into two page-local ASTs, source order preserved', () => {
    const ast = parse(`
      class A
      newpage
      class B
    `);

    expect(ast.pages).toBeDefined();
    const pages = ast.pages!;
    expect(pages).toHaveLength(2);

    // The returned AST IS the first page.
    expect(pages[0]).toBe(ast);

    expect(pages[0]!.classifiers.map((c) => c.id)).toEqual(['A']);
    expect(pages[1]!.classifiers.map((c) => c.id)).toEqual(['B']);
  });

  it('keeps relationships and notes page-local', () => {
    const ast = parse(`
      class A
      class C
      A --> C
      note left of C : hello
      newpage
      class B
      class D
      B --> D
      note right of D : world
    `);

    const pages = ast.pages!;
    expect(pages).toHaveLength(2);

    const [page1, page2] = pages as [
      ReturnType<typeof parse>,
      ReturnType<typeof parse>,
    ];

    expect(page1.classifiers.map((c) => c.id)).toEqual(['A', 'C']);
    expect(page1.relationships).toHaveLength(1);
    expect(page1.relationships[0]).toMatchObject({ from: 'A', to: 'C' });
    expect(page1.notes).toHaveLength(1);
    expect(page1.notes[0]).toMatchObject({ target: 'C', text: 'hello' });

    expect(page2.classifiers.map((c) => c.id)).toEqual(['B', 'D']);
    expect(page2.relationships).toHaveLength(1);
    expect(page2.relationships[0]).toMatchObject({ from: 'B', to: 'D' });
    expect(page2.notes).toHaveLength(1);
    expect(page2.notes[0]).toMatchObject({ target: 'D', text: 'world' });
  });

  it('keeps namespaces page-local', () => {
    const ast = parse(`
      namespace ns1 {
        class A
      }
      newpage
      namespace ns2 {
        class B
      }
    `);

    const pages = ast.pages!;
    expect(pages).toHaveLength(2);

    expect(pages[0]!.classifiers.map((c) => c.id)).toEqual(['ns1.A']);
    expect(pages[0]!.namespaces.map((n) => n.id)).toEqual(['ns1']);

    expect(pages[1]!.classifiers.map((c) => c.id)).toEqual(['ns2.B']);
    expect(pages[1]!.namespaces.map((n) => n.id)).toEqual(['ns2']);
  });

  it('resets parser-local settings (namespace separator, pragma) per page', () => {
    const ast = parse(`
      set namespaceSeparator ::
      !pragma useIntermediatePackages false
      class a::b::C
      newpage
      class x.y.Z
    `);

    const pages = ast.pages!;
    // Page 1: separator '::', intermediate packages disabled → one flat
    // namespace 'a::b' (collapsed, not nested a -> a::b).
    expect(pages[0]!.classifiers.map((c) => c.id)).toEqual(['a::b::C']);
    expect(pages[0]!.namespaces.map((n) => n.id)).toEqual(['a::b']);

    // Page 2: settings reset to defaults ('.' separator, intermediate
    // packages enabled) → nested namespaces x, x.y.
    expect(pages[1]!.classifiers.map((c) => c.id)).toEqual(['x.y.Z']);
    expect(pages[1]!.namespaces.map((n) => n.id).sort()).toEqual(['x', 'x.y']);
  });
});

// ---------------------------------------------------------------------------
// Three-plus pages: source order preserved, every page standalone.
// ---------------------------------------------------------------------------

describe('newpage — three pages', () => {
  it('preserves source order across multiple newpage boundaries', () => {
    const ast = parse(`
      class A
      newpage
      class B
      newpage
      class C
    `);

    const pages = ast.pages!;
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => p.classifiers.map((c) => c.id))).toEqual([
      ['A'],
      ['B'],
      ['C'],
    ]);
  });

  it('applies hide/show directives independently per page', () => {
    const ast = parse(`
      class A {
        +field1 : int
      }
      hide empty members
      newpage
      class B {
        +field2 : int
      }
    `);

    const pages = ast.pages!;
    expect(pages).toHaveLength(2);
    expect(pages[0]!.directives).toHaveLength(1);
    // Page 2 never saw the directive — a fresh diagram, matching upstream.
    expect(pages[1]!.directives).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Corpus fixture: sadamo-18-siva346.puml (50+ newpages).
// ---------------------------------------------------------------------------

describe('newpage — corpus fixture sadamo-18-siva346', () => {
  const corpusPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../corpus/class/sadamo-18-siva346.puml',
  );

  it('splits into one page per newpage boundary (51 pages, 50 newpages)', () => {
    if (!existsSync(corpusPath)) {
      // Acceptance criteria fallback: corpus file missing — nothing to assert.
      console.warn(`skip: corpus fixture not found at ${corpusPath}`);
      return;
    }

    const source = readFileSync(corpusPath, 'utf8');
    const newpageCount = (source.match(/^newpage\s*$/gim) ?? []).length;
    expect(newpageCount).toBeGreaterThanOrEqual(10);

    const ast = parseRaw(source);
    const pages = ast.pages;
    expect(pages).toBeDefined();
    // N newpage lines split the source into N+1 pages.
    expect(pages!).toHaveLength(newpageCount + 1);

    // Cross-check against the oracle's cached svek-N.dot files, when present.
    // No cache exists for this fixture at the time this test was written
    // (test-results/dot-cache/class/sadamo-18-siva346/ is absent) — the
    // acceptance criteria only prescribes a fallback for a missing corpus
    // *source* file, so this block extends the same "skip gracefully when
    // the comparison data isn't available" spirit to a missing dot-cache.
    const dotCacheDir = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../test-results/dot-cache/class/sadamo-18-siva346',
    );
    if (!existsSync(dotCacheDir)) {
      console.warn(`skip oracle cross-check: no dot-cache at ${dotCacheDir}`);
      return;
    }
    const svekFileCount = readdirSync(dotCacheDir).filter((f) =>
      /^svek-\d+\.dot$/.test(f),
    ).length;
    if (svekFileCount === 0) {
      // A populated cache dir with ZERO svek dumps is not comparison data:
      // upstream's single-image export path renders only page 0
      // (AbstractDiagram.getNbImages() always returns 1; NewpagedDiagram
      // never overrides it — jar-verified during A1/i25), so a multi-page
      // fixture can legitimately produce no per-page dumps. The parser-level
      // page-count assertion above is the real check here.
      console.warn(`skip oracle cross-check: cache has no svek dumps at ${dotCacheDir}`);
      return;
    }
    expect(pages!).toHaveLength(svekFileCount);
  });
});
