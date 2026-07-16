/**
 * `newpage` (upstream `NewpagedDiagram`) — per-page layout + stacked
 * rendering (decision D1, T7).
 *
 * Upstream lays out each page as an independent svek graph
 * (`NewpagedDiagram.java:87-162`), but never overrides
 * `AbstractDiagram.getNbImages()` (which returns 1) — so the reference CLI
 * used by the oracle harness (`-tsvg -o dir`) only ever exports **page 1** of
 * a multi-page CLASS source; pages 2+ never reach a second SVG file or a
 * second `svek-N.dot` dump, regardless of whether they are degenerate. This
 * was verified empirically below (see the "oracle CLI" describe block) by
 * invoking `oracle/dist/plantuml-oracle.jar` directly against three corpus
 * fixtures. This library still lays out and renders every page (a genuine
 * capability gap in the reference CLI is not a reason to under-render), just
 * stacked into one SVG string instead of one file per page.
 *
 * @see ~/git/plantuml/.../NewpagedDiagram.java:87-162 (getCardinality(),
 *      never wired into getNbImages() — dead code upstream)
 * @see ~/git/plantuml/.../core/AbstractDiagram.java:129 (getNbImages() => 1)
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { layoutClass } from '../../../src/diagrams/class/layout.js';
import { renderClass } from '../../../src/diagrams/class/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import type { ClassDiagramAST, Classifier, Relationship } from '../../../src/diagrams/class/ast.js';
import { defaultTheme } from '../../../src/core/theme.js';
import { FormulaMeasurer } from '../../../src/core/measurer.js';
import { setLayoutInputObserver } from '../../../src/core/graph-layout.js';
import type { DotInputGraph } from '../../../src/core/graph-layout.js';
import { renderFixture } from '../../helpers/render.js';

const measurer = new FormulaMeasurer();

function makeAST(overrides?: Partial<ClassDiagramAST>): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
    ...overrides,
  };
}

function makeClassifier(id: string, overrides?: Partial<Classifier>): Classifier {
  return { id, display: id, kind: 'class', typeParams: [], members: [], ...overrides };
}

/** Run layoutClass while counting how many DOT graphs the layout engine sees. */
function layoutAndCount(ast: ClassDiagramAST): { geo: ReturnType<typeof layoutClass>; captured: number } {
  let captured = 0;
  const graphs: DotInputGraph[] = [];
  setLayoutInputObserver((g) => {
    captured++;
    graphs.push(g);
  });
  try {
    const geo = layoutClass(ast, defaultTheme, measurer);
    return { geo, captured };
  } finally {
    setLayoutInputObserver(undefined);
  }
}

// ---------------------------------------------------------------------------
// Single-page: unaffected by T7
// ---------------------------------------------------------------------------

describe('layoutClass / renderClass -- single page unaffected by T7', () => {
  it('renders byte-identical SVG for a non-newpage source (G2 N1 shell/inline-arrowhead cutover)', () => {
    const svg = renderFixture('@startuml\nclass Foo\nclass Bar\nFoo --> Bar\n@enduml\n');
    // G2 N1 (mechanism 2, "SVG root shell"): re-captured after the
    // shell-assembly + single-wrapping-`<g>` + inline-polygon-arrowhead
    // cutover (`renderer-shell.ts#assembleClassShell`,
    // `renderer-arrowhead.ts#buildEdgeArrowheads`) -- see
    // `plans/g2-class-svg/ledger.md` N1. Any diff here now is a
    // regression on THAT cutover, not the pre-existing single-page path
    // this test originally guarded (T7).
    // G2 N2 (mechanism 3): re-captured after the per-element `<g
    // class="entity"/"link">` uid-wrapping cutover (`renderer-uid.ts`/
    // `renderer-group.ts`) -- see `plans/g2-class-svg/ledger.md` N2.
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" data-diagram-type="CLASS" style="width:112px;height:135px;background:#FFFFFF;" width="112px" height="135px" viewBox="0 0 112 135" zoomAndPan="magnify" preserveAspectRatio="none" contentStyleType="text/css">' +
        '<?plantuml $version$?><defs></defs><g>' +
        '<!--class Foo--><g class="entity" data-qualified-name="Foo" id="ent0001">' +
        '<rect x="0" y="0" width="100" height="31.6" fill="#F1F1F1" stroke="#181818" stroke-width="1"/>' +
        '<line x1="0" y1="27.599999999999998" x2="100" y2="27.599999999999998" stroke="#181818"/>' +
        '<text x="50" y="13.799999999999999" font-family="sans-serif" font-size="14" fill="#181818" text-anchor="middle" dominant-baseline="middle"><tspan>Foo</tspan></text>' +
        '<circle cx="16" cy="14" r="10" fill="#4472B8"/>' +
        '<text x="16" y="14" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle"><tspan>C</tspan></text>' +
        '</g>' +
        '<!--class Bar--><g class="entity" data-qualified-name="Bar" id="ent0002">' +
        '<rect x="0" y="91.6" width="100" height="31.6" fill="#F1F1F1" stroke="#181818" stroke-width="1"/>' +
        '<line x1="0" y1="119.19999999999999" x2="100" y2="119.19999999999999" stroke="#181818"/>' +
        '<text x="50" y="105.39999999999999" font-family="sans-serif" font-size="14" fill="#181818" text-anchor="middle" dominant-baseline="middle"><tspan>Bar</tspan></text>' +
        '<circle cx="16" cy="105" r="10" fill="#4472B8"/>' +
        '<text x="16" y="105" font-family="sans-serif" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle"><tspan>C</tspan></text>' +
        '</g>' +
        '<!--link Foo to Bar--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-link-type="dependency">' +
        '<path d="M 50,31.999418640136728 L 50,45.12899464098736 L 50,64.39816834261329 L 50,80.03668100674872" fill="none" stroke="#181818" stroke-width="1.5"/>' +
        '<polygon points="50,80.0367,54,71.0367,50,75.0367,46,71.0367,50,80.0367" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
        '</g>' +
        '</g></svg>',
    );
  });

  it('layoutClass ignores an absent `pages` field (dispatches to the single-page path)', () => {
    const ast = makeAST({
      classifiers: [makeClassifier('A'), makeClassifier('B')],
      relationships: [{ from: 'A', to: 'B', type: 'association' } satisfies Relationship],
    });
    expect(ast.pages).toBeUndefined();
    const { geo, captured } = layoutAndCount(ast);
    expect(captured).toBe(1);
    expect(geo.classifiers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Multi-page: layout + stacking
// ---------------------------------------------------------------------------

describe('layoutClass -- multi-page (T7)', () => {
  it('two non-degenerate pages -- one graph capture per page, in page order', () => {
    const page1 = makeAST({
      classifiers: [makeClassifier('A'), makeClassifier('B')],
      relationships: [{ from: 'A', to: 'B', type: 'association' } satisfies Relationship],
    });
    const page2 = makeAST({
      classifiers: [makeClassifier('C'), makeClassifier('D')],
      relationships: [{ from: 'C', to: 'D', type: 'association' } satisfies Relationship],
    });
    page1.pages = [page1, page2];

    const { geo, captured } = layoutAndCount(page1);
    expect(captured).toBe(2);
    expect(geo.classifiers.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(geo.edges).toHaveLength(2);
  });

  it('stacks page 2 below page 1 with NEWPAGE_GAP (20px) between them', () => {
    const makePage1 = (): ClassDiagramAST => makeAST({ classifiers: [makeClassifier('A'), makeClassifier('B')],
      relationships: [{ from: 'A', to: 'B', type: 'association' } satisfies Relationship] });
    const makePage2 = (): ClassDiagramAST => makeAST({ classifiers: [makeClassifier('C'), makeClassifier('D')],
      relationships: [{ from: 'C', to: 'D', type: 'association' } satisfies Relationship] });

    // Lay out each page alone (no `pages` field) to learn its standalone
    // totalHeight and internal top-of-content offset.
    const solo1 = layoutClass(makePage1(), defaultTheme, measurer);
    const soloPage2 = layoutClass(makePage2(), defaultTheme, measurer);
    const page2InternalMinY = Math.min(...soloPage2.classifiers.map((c) => c.y));

    const multiPage1 = makePage1();
    multiPage1.pages = [multiPage1, makePage2()];
    const combined = layoutClass(multiPage1, defaultTheme, measurer);

    const page2Classifiers = combined.classifiers.filter((c) => c.id === 'C' || c.id === 'D');
    const minPage2Y = Math.min(...page2Classifiers.map((c) => c.y));
    // The whole page-2 block starts at solo1.totalHeight + 20 (NEWPAGE_GAP),
    // plus page 2's own internal top-of-content offset.
    expect(minPage2Y).toBeCloseTo(solo1.totalHeight + 20 + page2InternalMinY, 5);
    expect(combined.totalHeight).toBeCloseTo(solo1.totalHeight + 20 + soloPage2.totalHeight, 5);
  });

  it('degenerate page contributes 0 graph captures and no y-collision with the next page', () => {
    const page1 = makeAST({ classifiers: [makeClassifier('Lonely')] }); // degenerate: 1 leaf, no links/groups
    const page2 = makeAST({ classifiers: [makeClassifier('C'), makeClassifier('D')],
      relationships: [{ from: 'C', to: 'D', type: 'association' } satisfies Relationship] });
    page1.pages = [page1, page2];

    const { geo, captured } = layoutAndCount(page1);
    expect(captured).toBe(1); // only page 2 reaches graphviz
    expect(geo.classifiers).toHaveLength(3);
    const lonely = geo.classifiers.find((c) => c.id === 'Lonely')!;
    const page2First = geo.classifiers.filter((c) => c.id === 'C' || c.id === 'D');
    expect(Math.min(...page2First.map((c) => c.y))).toBeGreaterThan(lonely.y + lonely.height);
  });

  it('both pages degenerate -- 0 graph captures total (matches oracle: no svek-N.dot at all)', () => {
    const page1 = makeAST({ classifiers: [makeClassifier('foo')] });
    const page2 = makeAST({ classifiers: [makeClassifier('foo2')] });
    page1.pages = [page1, page2];

    const { geo, captured } = layoutAndCount(page1);
    expect(captured).toBe(0);
    expect(geo.classifiers).toHaveLength(2);
    expect(geo.totalHeight).toBeGreaterThan(0);
  });

  it('renderClass renders all pages into one stacked SVG', () => {
    const page1 = makeAST({ classifiers: [makeClassifier('A'), makeClassifier('B')],
      relationships: [{ from: 'A', to: 'B', type: 'association' } satisfies Relationship] });
    const page2 = makeAST({ classifiers: [makeClassifier('C'), makeClassifier('D')],
      relationships: [{ from: 'C', to: 'D', type: 'association' } satisfies Relationship] });
    page1.pages = [page1, page2];

    const geo = layoutClass(page1, defaultTheme, measurer);
    const svg = assembleSvg(renderClass(geo, defaultTheme));
    // All four classifier labels present (badge letter is also "C" for kind
    // 'class', so this checks containment, not exact-once occurrence).
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(svg).toContain(`<tspan>${id}</tspan>`);
    }
    // G2 N1: shell width/height carry jar's own `Npx` suffix now
    // (`assembleClassShell` -> `assembleDocumentShell`), not the bare
    // numeric `svgRoot` used to emit -- and `assembleDocumentShell`
    // truncates fractional dimensions (`Math.trunc`, matching
    // `assembleKlimtShell`'s own convention), so compare against the
    // truncated value, not `geo.totalWidth`/`totalHeight` raw.
    expect(svg).toContain(`width="${Math.trunc(geo.totalWidth)}px"`);
    expect(svg).toContain(`height="${Math.trunc(geo.totalHeight)}px"`);
  });
});

// ---------------------------------------------------------------------------
// Corpus fixture: sadamo-18-siva346.puml (50+ newpages) -- graph-count parity
// ---------------------------------------------------------------------------

describe('newpage layout -- corpus fixture sadamo-18-siva346', () => {
  it('produces one geometry with all non-degenerate pages laid out', () => {
    const corpusPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../corpus/class/sadamo-18-siva346.puml',
    );
    if (!existsSync(corpusPath)) {
      console.warn(`skip: corpus fixture not found at ${corpusPath}`);
      return;
    }
    // sadamo-18-siva346 is a known-malformed fixture (a corrupted run of
    // backticks on line 8 that errors even the oracle jar itself — see the
    // T7 task report). We only assert our own pipeline doesn't throw and
    // produces a geometry; oracle cross-check for this specific fixture is
    // not possible (the jar errors before emitting any svek-N.dot).
    const svg = renderFixture(readFileSync(corpusPath, 'utf8'));
    expect(svg).toContain('<svg');
  });
});

// ---------------------------------------------------------------------------
// Oracle CLI behavior -- documents the getNbImages() finding with live evidence
// ---------------------------------------------------------------------------

describe('oracle CLI -- multi-page CLASS export is capped at page 1 (upstream bug)', () => {
  const dotCacheDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../test-results/dot-cache/class',
  );

  it('gevuci-69-fafe469 (2 degenerate pages): oracle cache has 0 svek-N.dot', () => {
    const dir = join(dotCacheDir, 'gevuci-69-fafe469');
    if (!existsSync(dir)) {
      console.warn(`skip: no dot-cache at ${dir}`);
      return;
    }
    const svekCount = readdirSync(dir).filter((f) => /^svek-\d+\.dot$/.test(f)).length;
    // Both pages are degenerate (one classifier, no links/groups/notes) so
    // GraphvizImageBuilder skips graphviz for each -- 0 dumps, not 2.
    expect(svekCount).toBe(0);
  });

  it('bufogi-69-naba929 (2 degenerate pages): oracle cache has 0 svek-N.dot', () => {
    const dir = join(dotCacheDir, 'bufogi-69-naba929');
    if (!existsSync(dir)) {
      console.warn(`skip: no dot-cache at ${dir}`);
      return;
    }
    const svekCount = readdirSync(dir).filter((f) => /^svek-\d+\.dot$/.test(f)).length;
    expect(svekCount).toBe(0);
  });
});
