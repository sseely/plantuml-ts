/**
 * mission G4 S5 — explicit content background `<rect>` for a non-default
 * diagram background. `document-shell.ts#assembleDocumentShell` (the
 * SHARED class/description/state module) folds background into the root
 * `style="...background:...;"` attribute alone and draws NO separate
 * `<rect>` — correct for the default `#FFFFFF` case (jar-verified,
 * `jocela-05-niba392`/`coteta-47-mare883`), but jar ALSO draws an explicit
 * full-canvas content `<rect>` (the FIRST child of the content `<g>`) when
 * the resolved background is non-default — jar-verified `dapuko-98-zuzo096`
 * (`skinparam BackgroundColor gray`, `<rect x="0" y="0" width="155"
 * height="121" fill="#808080" style="stroke:none;stroke-width:1;"/>`),
 * `niveno-60-tiro789`, `xexika-61-fedu273` (all three the SAME format).
 * Exact upstream source line NOT pinned down this iteration (a targeted
 * search of `TitledDiagram`/`CucaDiagram`/`GeneralImageBuilder`/
 * `TextBlockExporter` found the ROOT-style background assignment but not
 * this content-level rect draw call) — empirically confirmed via jar bytes
 * across all 11 non-default-background STATE fixtures in the corpus
 * (matches this project's own established "jar-verified, source line not
 * found" pattern for hard-to-trace mechanisms, e.g. mechanism 3's own
 * `transitionArrowheadInk` sub-bug, S4 ledger).
 */
import { describe, it, expect } from 'vitest';
import { renderState } from '../../../src/diagrams/state/renderer.js';
import { assembleSvg } from '../../../src/index.js';
import type { StateGeometry, StateNodeGeo } from '../../../src/diagrams/state/layout.js';
import { defaultTheme, deepMergeTheme } from '../../../src/core/theme.js';

function makeNode(overrides: Partial<StateNodeGeo> & Pick<StateNodeGeo, 'kind'>): StateNodeGeo {
  return {
    id: 'node1',
    display: 'NodeLabel',
    x: 10,
    y: 20,
    width: 80,
    height: 40,
    children: [],
    transitions: [],
    ...overrides,
  };
}

function makeGeo(overrides: Partial<StateGeometry> = {}): StateGeometry {
  return {
    totalWidth: 155,
    totalHeight: 121,
    states: [],
    transitions: [],
    ...overrides,
  };
}

describe('renderState — explicit background rect for non-default background', () => {
  it('draws NO explicit background <rect> for the default #FFFFFF background', () => {
    const node = makeNode({ kind: 'normal', display: 'S' });
    const geo = makeGeo({ states: [node] });
    const svg = assembleSvg(renderState(geo, defaultTheme));
    expect(svg).not.toMatch(/<rect x="0" y="0"/);
  });

  it('draws an explicit content <rect> matching jar exactly for a non-default background', () => {
    const grayTheme = deepMergeTheme(defaultTheme, { colors: { background: '#808080' } });
    const node = makeNode({ kind: 'normal', display: 'S' });
    const geo = makeGeo({ states: [node] });
    const svg = assembleSvg(renderState(geo, grayTheme));
    // jar-verified format (dapuko-98-zuzo096): x=0 y=0, full document
    // width/height, fill = the resolved background, stroke:none;stroke-width:1;
    // -- separate stroke/stroke-width attrs here, not jar's own style="..."
    // string: tests/oracle/svg-conformance/normalize.ts's own style-vs-
    // attrs equivalence (this codebase's established convention, see
    // renderer-shell.ts's own doc comment) makes both forms byte-equivalent
    // for the conformance comparator.
    expect(svg).toContain(
      '<rect x="0" y="0" width="155" height="121" fill="#808080" stroke="none" stroke-width="1"/>',
    );
  });

  it('positions the background rect as the FIRST child of the content <g>, before any entity markup', () => {
    const grayTheme = deepMergeTheme(defaultTheme, { colors: { background: '#808080' } });
    const node = makeNode({ kind: 'normal', display: 'S' });
    const geo = makeGeo({ states: [node] });
    const svg = assembleSvg(renderState(geo, grayTheme));
    const rectIdx = svg.indexOf('<rect x="0" y="0"');
    const entityIdx = svg.indexOf('class="entity"');
    expect(rectIdx).toBeGreaterThan(-1);
    expect(entityIdx).toBeGreaterThan(rectIdx);
  });
});
