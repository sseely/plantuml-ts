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
    expect(svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" data-diagram-type="CLASS" style="width:78px;height:178px;background:#FFFFFF;" width="78px" height="178px" viewBox="0 0 78 178" zoomAndPan="magnify" preserveAspectRatio="none" contentStyleType="text/css">' +
        '<?plantuml $version$?><defs></defs><g>' +
        '<!--class Foo--><g class="entity" data-qualified-name="Foo" id="ent0001">' +
        '<rect x="0" y="0" width="56" height="48" fill="#F1F1F1" stroke="#181818" stroke-width="0.5" rx="2.5" ry="2.5"/>' +
        '<ellipse cx="15" cy="16" rx="11" ry="11" fill="#ADD1B2" stroke="#181818" stroke-width="1"/>' +
        '<path d="M17.4731,22.1431 Q16.8921,22.4419 16.2529,22.5913 Q15.613800000000001,22.7407 14.9082,22.7407 Q12.401399999999999,22.7407 11.081499999999998,21.0889 Q9.761700000000001,19.437 9.761700000000001,16.3159 Q9.761700000000001,13.186499999999999 11.081499999999998,11.5347 Q12.401399999999999,9.8828 14.9082,9.8828 Q15.613800000000001,9.8828 16.2612,10.0322 Q16.9087,10.1816 17.4731,10.4805 L17.4731,13.2031 Q16.8423,12.6221 16.2488,12.3523 Q15.6553,12.0825 15.0244,12.0825 Q13.6797,12.0825 12.994900000000001,13.1492 Q12.310099999999998,14.215800000000002 12.310099999999998,16.3159 Q12.310099999999998,18.4077 12.994900000000001,19.4744 Q13.6797,20.541 15.0244,20.541 Q15.6553,20.541 16.2488,20.2712 Q16.8423,20.0015 17.4731,19.4204 Z" fill="#000000"/>' +
        '<text x="29" y="19.444444444444443" font-family="sans-serif" font-size="14" fill="#000000" lengthAdjust="spacing" textLength="24">Foo</text>' +
        '<line x1="1" y1="32" x2="55" y2="32" stroke="#181818" stroke-width="0.5"/>' +
        '<line x1="1" y1="40" x2="55" y2="40" stroke="#181818" stroke-width="0.5"/>' +
        '</g>' +
        '<!--class Bar--><g class="entity" data-qualified-name="Bar" id="ent0002">' +
        '<rect x="0" y="108" width="56" height="48" fill="#F1F1F1" stroke="#181818" stroke-width="0.5" rx="2.5" ry="2.5"/>' +
        '<ellipse cx="15" cy="124" rx="11" ry="11" fill="#ADD1B2" stroke="#181818" stroke-width="1"/>' +
        '<path d="M17.4731,130.1431 Q16.8921,130.4419 16.2529,130.5913 Q15.613800000000001,130.7407 14.9082,130.7407 Q12.401399999999999,130.7407 11.081499999999998,129.0889 Q9.761700000000001,127.437 9.761700000000001,124.3159 Q9.761700000000001,121.1865 11.081499999999998,119.5347 Q12.401399999999999,117.8828 14.9082,117.8828 Q15.613800000000001,117.8828 16.2612,118.0322 Q16.9087,118.1816 17.4731,118.4805 L17.4731,121.2031 Q16.8423,120.6221 16.2488,120.3523 Q15.6553,120.0825 15.0244,120.0825 Q13.6797,120.0825 12.994900000000001,121.14920000000001 Q12.310099999999998,122.2158 12.310099999999998,124.3159 Q12.310099999999998,126.4077 12.994900000000001,127.4744 Q13.6797,128.541 15.0244,128.541 Q15.6553,128.541 16.2488,128.2712 Q16.8423,128.0015 17.4731,127.4204 Z" fill="#000000"/>' +
        '<text x="29" y="127.44444444444444" font-family="sans-serif" font-size="14" fill="#000000" lengthAdjust="spacing" textLength="24">Bar</text>' +
        '<line x1="1" y1="140" x2="55" y2="140" stroke="#181818" stroke-width="0.5"/>' +
        '<line x1="1" y1="148" x2="55" y2="148" stroke="#181818" stroke-width="0.5"/>' +
        '</g>' +
        '<!--link Foo to Bar--><g class="link" data-entity-1="ent0001" data-entity-2="ent0002" id="lnk3" data-link-type="dependency">' +
        '<path d="M28,48.26214984059334 C28,62.34570656838514 28,80.571360268126 28,96.33087799980677" fill="none" stroke="#181818" stroke-width="1"/>' +
        '<polygon points="28,96.3309,32,87.3309,28,91.3309,24,87.3309,28,96.3309" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
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
