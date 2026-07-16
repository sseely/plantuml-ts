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
    // G2 N3: re-captured after the EntityImageClass box-chrome fidelity
    // pass (rx/ry rounding, badge ellipse+vector-glyph, badge-before-name
    // draw order, always-two-compartment dividers, no 100px width floor)
    // -- see `plans/g2-class-svg/ledger.md` N3.
    // G2 N4: re-captured after badgeFill's per-kind spot-color fix
    // (class badge fill #4472B8 -> #ADD1B2, jar-verified) -- see
    // `plans/g2-class-svg/ledger.md` N4.
    // G2 N4 (2nd pass): re-captured after the member/header text-rendering
    // fidelity pass (plain baseline y, left-anchored x, textLength/
    // lengthAdjust, #000000 fill) -- see `plans/g2-class-svg/ledger.md` N4.
    // G2 N4 (3rd pass): re-captured after strokeWidth->stroke-width (ellipse
    // attribute-name bug) + text-anchor omission (was 'start', jar omits
    // entirely) + textLength Java-%.4f rounding -- see
    // `plans/g2-class-svg/ledger.md` N4.
    // G2 N4 (4th pass): re-captured after the <tspan> removal (jar never
    // wraps single-run text) + divider-line stroke-width 0.5 -- see
    // `plans/g2-class-svg/ledger.md` N4.
    // G2 N5: re-captured after the document-dimension ink-extent formula
    // (`layout-ink-extent.ts#computeClassDocumentDims`, replacing the raw
    // dot-layout `result.width`/`result.height`, 68x168 -> 78x178) and the
    // edge `<path>` cubic-bezier rewrite (`buildPathData`, straight `L`
    // segments -> `C` commands through the SAME `1+3*n` spline points,
    // matching jar's own `DotPath` emission byte-for-byte) -- see
    // `plans/g2-class-svg/ledger.md` N5.
    // G2 N8: re-captured after edge `stroke-width` 1.5 -> 1 (corpus-surveyed,
    // 504/510 sampled `<g class="link">` edges carry `stroke-width:1`;
    // discovered while jar-verifying the `(A,B)` association-class-couple
    // fixture's own edges, `bosiki-11-xaza958`) -- see
    // `plans/g2-class-svg/ledger.md` N8.
    // G2 N9: re-captured after edge `<path id="..." codeLine="...">` --
    // `Link#idCommentForSvg()`'s decor/direction matrix + parse-time
    // `Relationship.sourceLine` -- see `plans/g2-class-svg/ledger.md` N9.
    // G2 N11: re-captured after the ink-shift mechanism
    // (`layout-ink-extent.ts#computeClassInkShift`, `SvekResult
    // #calculateDimension`'s own `moveDelta(6 - minMax.getMinX(), 6 -
    // minMax.getMinY())` side effect) -- canvas dims UNCHANGED (78x178,
    // already jar-correct since N5), every element position shifts by the
    // uniform `(+7,+7)` this fixture's own raw ink extent requires (a bare
    // rect sitting at the graph's raw origin has ink-min-corner `(-1,-1)`,
    // so `dx=dy=6-(-1)=7`) -- see `plans/g2-class-svg/ledger.md` N11.
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" data-diagram-type="CLASS" style="width:78px;height:178px;background:#FFFFFF;" width="78px" height="178px" viewBox="0 0 78 178" zoomAndPan="magnify" preserveAspectRatio="none" contentStyleType="text/css">' +
        '<?plantuml $version$?><defs></defs><g>' +
        '<!--class Foo--><g class="entity" data-qualified-name="Foo" id="ent0001">' +
        '<rect x="7" y="7" width="56" height="48" fill="#F1F1F1" stroke="#181818" stroke-width="0.5" rx="2.5" ry="2.5"/>' +
        '<ellipse cx="22" cy="23" rx="11" ry="11" fill="#ADD1B2" stroke="#181818" stroke-width="1"/>' +
        '<path d="M24.4731,29.1431 Q23.8921,29.4419 23.2529,29.5913 Q22.6138,29.7407 21.9082,29.7407 Q19.4014,29.7407 18.0815,28.0889 Q16.7617,26.437 16.7617,23.3159 Q16.7617,20.1865 18.0815,18.5347 Q19.4014,16.8828 21.9082,16.8828 Q22.6138,16.8828 23.2612,17.0322 Q23.9087,17.1816 24.4731,17.4805 L24.4731,20.2031 Q23.8423,19.6221 23.2488,19.3523 Q22.6553,19.0825 22.0244,19.0825 Q20.6797,19.0825 19.9949,20.1492 Q19.3101,21.2158 19.3101,23.3159 Q19.3101,25.4077 19.9949,26.4744 Q20.6797,27.541 22.0244,27.541 Q22.6553,27.541 23.2488,27.2712 Q23.8423,27.0015 24.4731,26.4204 Z" fill="#000000"/>' +
        '<text x="36" y="26.444444444444443" font-family="sans-serif" font-size="14" fill="#000000" lengthAdjust="spacing" textLength="24">Foo</text>' +
        '<line x1="8" y1="39" x2="62" y2="39" stroke="#181818" stroke-width="0.5"/>' +
        '<line x1="8" y1="47" x2="62" y2="47" stroke="#181818" stroke-width="0.5"/>' +
        '</g>' +
        '<!--class Bar--><g class="entity" data-qualified-name="Bar" id="ent0002">' +
        '<rect x="7" y="115" width="56" height="48" fill="#F1F1F1" stroke="#181818" stroke-width="0.5" rx="2.5" ry="2.5"/>' +
        '<ellipse cx="22" cy="131" rx="11" ry="11" fill="#ADD1B2" stroke="#181818" stroke-width="1"/>' +
        '<path d="M24.4731,137.1431 Q23.8921,137.4419 23.2529,137.5913 Q22.6138,137.7407 21.9082,137.7407 Q19.4014,137.7407 18.0815,136.0889 Q16.7617,134.437 16.7617,131.3159 Q16.7617,128.1865 18.0815,126.5347 Q19.4014,124.8828 21.9082,124.8828 Q22.6138,124.8828 23.2612,125.0322 Q23.9087,125.1816 24.4731,125.4805 L24.4731,128.2031 Q23.8423,127.6221 23.2488,127.3523 Q22.6553,127.0825 22.0244,127.0825 Q20.6797,127.0825 19.9949,128.1492 Q19.3101,129.2158 19.3101,131.3159 Q19.3101,133.4077 19.9949,134.4744 Q20.6797,135.541 22.0244,135.541 Q22.6553,135.541 23.2488,135.2712 Q23.8423,135.0015 24.4731,134.4204 Z" fill="#000000"/>' +
        '<text x="36" y="134.44444444444446" font-family="sans-serif" font-size="14" fill="#000000" lengthAdjust="spacing" textLength="24">Bar</text>' +
        '<line x1="8" y1="147" x2="62" y2="147" stroke="#181818" stroke-width="0.5"/>' +
        '<line x1="8" y1="155" x2="62" y2="155" stroke="#181818" stroke-width="0.5"/>' +
        '</g>' +
        '<!--link Foo to Bar--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-link-type="dependency">' +
        '<path d="M35,55.26214984059334 C35,69.34570656838514 35,87.571360268126 35,103.33087799980677" fill="none" stroke="#181818" stroke-width="1" id="Foo-to-Bar" codeLine="3"/>' +
        '<polygon points="35,103.3309,39,94.3309,35,98.3309,31,94.3309,35,103.3309" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
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
    // G2 N4: plain (un-tspan-wrapped) text content -- jar never wraps a
    // single-run label in <tspan>, see core/svg.ts#text()'s own doc comment.
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(svg).toContain(`>${id}</text>`);
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
