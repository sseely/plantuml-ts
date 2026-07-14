/**
 * Unified description diagram renderer tests — T17 klimt cutover.
 *
 * This suite REPLACES the pre-T17 `core/svg.ts`-marker-based suite
 * (mission report: full mapping of every old test, preserved-or-obsolete).
 * The new klimt-backed `renderDescription` delegates almost all visual
 * output to already-adopted, independently-verified modules
 * (`EntityImageDescription` — T14, `Cluster`/`ClusterDecoration` — T12,
 * `SvekEdge`/extremity factories — T13), so this file focuses on
 * `renderer.ts`'s OWN responsibilities: the SVG document preamble
 * (`SvgOption`/`UGraphicSvg.build`), uid assignment (`renderer-uid.ts`
 * integration), draw order (`SvekResult#drawU` fidelity — clusters, then
 * leaves, then edges), and smoke coverage that every symbol/container/
 * fallback path dispatches without throwing. Exact pixel/attribute
 * fidelity for any one shape is covered by that shape's own module tests
 * (`entity-image-description.test.ts`, `cluster.test.ts`,
 * `svek-edge.test.ts`) and by the jar-conformance E2E test in
 * `tests/integration/description.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { renderDescription, unwrapKlimtSvg, assembleKlimtShell } from '../../../src/diagrams/description/renderer.js';
import type {
  DescriptionGeometry,
  DescriptionEdgeGeo,
} from '../../../src/diagrams/description/layout.js';
import type { DescriptionNodeGeo } from '../../../src/diagrams/description/layout-helpers.js';
import { defaultTheme, darkTheme, deepMergeTheme } from '../../../src/core/theme.js';

// ---------------------------------------------------------------------------
// Geometry builder helpers
// ---------------------------------------------------------------------------

function makeDNode(overrides?: Partial<DescriptionNodeGeo>): DescriptionNodeGeo {
  return {
    id: 'n1',
    symbol: 'component',
    display: 'MyNode',
    x: 10,
    y: 10,
    width: 100,
    height: 40,
    children: [],
    ...overrides,
  };
}

function makeGeo(overrides?: Partial<DescriptionGeometry>): DescriptionGeometry {
  return {
    totalWidth: 200,
    totalHeight: 200,
    nodes: [],
    edges: [],
    ...overrides,
  };
}

/** A valid graphviz-spline point count (1 + 3n) — `SvekEdge`'s
 *  `buildDotPathFromSplinePoints` throws on any other count (see this
 *  file's "obsolete tests" note below). */
function makeEdge(overrides?: Partial<DescriptionEdgeGeo>): DescriptionEdgeGeo {
  return {
    id: 'e1',
    from: 'n1',
    to: 'n2',
    points: [
      { x: 10, y: 50 },
      { x: 60, y: 50 },
      { x: 110, y: 50 },
      { x: 150, y: 50 },
    ],
    dashed: false,
    arrowHead: 'open',
    ...overrides,
  };
}

function twoNodeGeo(edgeOverrides?: Partial<DescriptionEdgeGeo>): DescriptionGeometry {
  return makeGeo({
    nodes: [
      makeDNode({ id: 'n1', symbol: 'usecase', display: 'A', x: 10, y: 10, width: 100, height: 40 }),
      makeDNode({ id: 'n2', symbol: 'usecase', display: 'B', x: 10, y: 120, width: 100, height: 40 }),
    ],
    edges: [makeEdge(edgeOverrides)],
  });
}

// ---------------------------------------------------------------------------
// SVG document preamble (SvgOption / UGraphicSvg.build conformance)
// ---------------------------------------------------------------------------

describe('renderDescription — SVG document preamble', () => {
  it('produces valid SVG starting with <svg and ending with </svg>', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it('carries the DESCRIPTION diagram-type root attribute (upstream DiagramType.DESCRIPTION)', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain('data-diagram-type="DESCRIPTION"');
  });

  it('carries the D4′ version processing instruction placeholder', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain('<?plantuml $version$?>');
  });

  it('carries the standard xmlns/xmlns:xlink/version="1.1" attributes', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(svg).toContain('version="1.1"');
  });

  it('derives width/height/viewBox from the SvekResult recipe, ignoring geo.totalWidth/totalHeight (G0/T3 write-set expansion, journaled)', () => {
    // G0/T3 (renderer-ink-extent.ts#computeDocumentDims) replaced
    // geo.totalWidth/totalHeight as the minDim source with a LimitFinder
    // ink walk over the SAME draw sequence + the CucaDiagram outer margin
    // -- see that module's own doc comment. totalWidth/totalHeight
    // overrides are now inert for an empty node/edge geometry (this
    // suite's makeGeo() default): the ink walk finds nothing, so
    // MinMax collapses to LimitFinder#getMinMax's own infinity branch
    // (MinMax.getEmpty(true) = (0,0,0,0)) -> getDimension() = (0,0) ->
    // .delta(15,15) = (15,15) -> + CucaDiagram's (0,5,5,0) margin =
    // (20,20) -> ensureVisible's `Math.trunc(x)+1` floor = (21,21).
    // Fully hand-computable from this module's own two constant sets
    // with no dependency on any entity-drawing internals.
    const svg = renderDescription(makeGeo({ totalWidth: 300, totalHeight: 150 }), defaultTheme);
    expect(svg).toContain('width="21px"');
    expect(svg).toContain('height="21px"');
    expect(svg).toContain('viewBox="0 0 21 21"');
  });

  it('sets the css background from theme.colors.background', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain(`background:${defaultTheme.colors.background};`);
  });

  it('default vs dark theme use different backgrounds', () => {
    const svgDefault = renderDescription(makeGeo(), defaultTheme);
    const svgDark = renderDescription(makeGeo(), darkTheme);
    expect(svgDefault).toContain(`background:${defaultTheme.colors.background};`);
    expect(svgDark).toContain(`background:${darkTheme.colors.background};`);
    expect(svgDefault).not.toContain(`background:${darkTheme.colors.background};`);
  });

  it('an unseeded geometry (geo.seed undefined) still renders deterministically (defaults to 0n)', () => {
    const svg1 = renderDescription(makeGeo({ nodes: [makeDNode()] }), defaultTheme);
    const svg2 = renderDescription(makeGeo({ nodes: [makeDNode()] }), defaultTheme);
    expect(svg1).toBe(svg2);
  });

  it('a seeded geometry threads the seed into SvgGraphics (id prefixes stay stable across calls)', () => {
    const geo = makeGeo({ nodes: [makeDNode()], seed: 123456789n });
    const svg1 = renderDescription(geo, defaultTheme);
    const svg2 = renderDescription(geo, defaultTheme);
    expect(svg1).toBe(svg2);
  });
});

// ---------------------------------------------------------------------------
// `scale ...` directive (mission G1 I-scale) — jar mechanism: EVERY numeric
// primitive (coordinates, font-size, stroke-width, textLength, root
// width/height/viewBox) is multiplied by the resolved scale factor at
// SVG-EMISSION time (`SvgGraphicsCore#format`/`#finalizeRootAttributes`,
// svg-graphics-core.ts — an already-faithful, pre-existing port this
// mission does not touch). DOT/layout itself is untouched (see
// layout.test.ts's "scale directive passthrough" suite) — these tests
// pin only the render-stage application.
// ---------------------------------------------------------------------------

describe('renderDescription — scale directive (G1 I-scale)', () => {
  it('no scale directive: root dims match the unscaled SvekResult recipe (baseline, unchanged)', () => {
    const svg = renderDescription(makeGeo(), defaultTheme);
    expect(svg).toContain('width="21px"');
    expect(svg).toContain('height="21px"');
    expect(svg).toContain('viewBox="0 0 21 21"');
  });

  it('`scale 2` (ScaleSimple) doubles the root width/height/viewBox (component/saveje-35-vumu271 mechanism)', () => {
    const svg = renderDescription(
      makeGeo({ scale: { kind: 'simple', factor: 2 } }),
      defaultTheme,
    );
    // Unscaled baseline is 21x21 (see the preceding describe block) —
    // Math.trunc(21*2) = 42 for both the style/viewBox ints and format(21)
    // = "42" for the raw width/height attrs (21*2 has no fractional part).
    expect(svg).toContain('width="42px"');
    expect(svg).toContain('height="42px"');
    expect(svg).toContain('viewBox="0 0 42 42"');
  });

  it('`scale 10` (ScaleSimple) clamps to an effective x4, not x10 (ScaleProtected — component/berome-43-xini276 mechanism)', () => {
    const svg = renderDescription(
      makeGeo({ scale: { kind: 'simple', factor: 10 } }),
      defaultTheme,
    );
    // 21 * 4 (clamped) = 84, NOT 21 * 10 = 210.
    expect(svg).toContain('width="84px"');
    expect(svg).toContain('height="84px"');
    expect(svg).toContain('viewBox="0 0 84 84"');
  });

  it('a fractional `scale 1.5` scales the root dims by exactly 1.5x', () => {
    const svg = renderDescription(
      makeGeo({ scale: { kind: 'simple', factor: 1.5 } }),
      defaultTheme,
    );
    // Math.trunc(21*1.5) = 31; format(21) = "31.5".
    expect(svg).toContain('width="31.5px"');
    expect(svg).toContain('height="31.5px"');
    expect(svg).toContain('viewBox="0 0 31 31"');
  });

  it('scale multiplies every drawn primitive, not just the root dims (font-size doubles on a real leaf)', () => {
    const unscaled = renderDescription(makeGeo({ nodes: [makeDNode()] }), defaultTheme);
    const scaled = renderDescription(
      makeGeo({ nodes: [makeDNode()], scale: { kind: 'simple', factor: 2 } }),
      defaultTheme,
    );
    const unscaledFontSize = /font-size="([0-9.]+)"/.exec(unscaled)?.[1];
    const scaledFontSize = /font-size="([0-9.]+)"/.exec(scaled)?.[1];
    expect(unscaledFontSize).toBeDefined();
    expect(Number(scaledFontSize)).toBeCloseTo(Number(unscaledFontSize) * 2, 5);
  });

  it('`scale width N` (ScaleWidth) resolves against the diagram\'s own PRE-ensureVisible unscaled dim, not the +1-padded root maxX', () => {
    // `resolveScaleFactor` is fed `computeDocumentDims`'s raw result (20 for
    // this empty geometry -- see the preceding describe block's comment:
    // (0,0) -> .delta(15,15) = (15,15) -> +CucaDiagram margin (0,5,5,0) =
    // (20,20)), matching upstream's `Scale#getScale(dim.width, dim.height)`
    // reading `calculateFinalDimension()` -- NOT the conservative
    // `Math.trunc(x)+1` maxX/maxY `ensureVisible` derives from it (21, the
    // baseline root width/height). `scale 40 width`: factor = 40/20 = 2.0
    // exactly, so root maxX (21) scales to Math.trunc(21*2)=42, matching
    // `scale 2`'s own ScaleSimple result byte-for-byte.
    const svg = renderDescription(
      makeGeo({ scale: { kind: 'width', target: 40 } }),
      defaultTheme,
    );
    expect(svg).toContain('width="42px"');
    expect(svg).toContain('viewBox="0 0 42 42"');
  });

  it('`scale max` never enlarges past 1x when the target exceeds the natural size', () => {
    const svg = renderDescription(
      makeGeo({ scale: { kind: 'maxWidth', target: 1000 } }),
      defaultTheme,
    );
    expect(svg).toContain('width="21px"');
    expect(svg).toContain('viewBox="0 0 21 21"');
  });
});

// ---------------------------------------------------------------------------
// UID assignment (renderer-uid.ts integration)
// ---------------------------------------------------------------------------

describe('renderDescription — uid assignment', () => {
  it('assigns ent0001 to a single leaf node', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ id: 'n1' })] }), defaultTheme);
    expect(svg).toContain('id="ent0001"');
  });

  it('assigns sequential ent%04d uids in pre-order (container before its children)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'package', display: 'Pkg', width: 200, height: 150, children: [child] });
    const sibling = makeDNode({ id: 'n2', symbol: 'component', display: 'Sibling', x: 220 });
    const svg = renderDescription(makeGeo({ nodes: [container, sibling] }), defaultTheme);
    // container "pkg" created first (ent0001), then its child "c1" (ent0002),
    // then the top-level sibling "n2" (ent0003) — matches CucaDiagram's
    // AtomicInteger creation-order counter (renderer-uid.ts doc comment).
    const clusterIdx = svg.indexOf('<g class="cluster"');
    const childIdx = svg.indexOf('data-qualified-name="c1"');
    const siblingIdx = svg.indexOf('data-qualified-name="n2"');
    expect(svg.slice(clusterIdx, clusterIdx + 60)).toContain('id="ent0001"');
    expect(svg.slice(childIdx, childIdx + 40)).toContain('id="ent0002"');
    expect(svg.slice(siblingIdx, siblingIdx + 40)).toContain('id="ent0003"');
  });

  it('assigns lnkN uids to edges after every node uid', () => {
    const svg = renderDescription(twoNodeGeo(), defaultTheme);
    // n1 -> ent0001, n2 -> ent0002, edge -> lnk3 (CucaDiagram#getUniqueSequence("lnk")).
    expect(svg).toContain('id="lnk3"');
  });

  it('multiple edges get sequential lnkN uids in geo.edges order', () => {
    const geo = makeGeo({
      nodes: [
        makeDNode({ id: 'n1', x: 10, y: 10 }),
        makeDNode({ id: 'n2', x: 10, y: 100 }),
        makeDNode({ id: 'n3', x: 10, y: 190 }),
      ],
      edges: [
        makeEdge({ id: 'e1', from: 'n1', to: 'n2' }),
        makeEdge({ id: 'e2', from: 'n2', to: 'n3' }),
      ],
    });
    const svg = renderDescription(geo, defaultTheme);
    expect(svg).toContain('id="lnk4"');
    expect(svg).toContain('id="lnk5"');
  });

  // I3b: when every node/edge carries a parse-time `creationIndex` (the
  // real `parseDescription()` path), `buildUidPlan` formats that value
  // DIRECTLY instead of deriving order from geo traversal -- gaps (from
  // discarded/removed/dropped upstream uids) must survive verbatim.
  it('formats ent%04d/lnkN directly from creationIndex when every node/edge carries one, gaps included', () => {
    const geo = makeGeo({
      nodes: [
        makeDNode({ id: 'n1', x: 10, y: 10, creationIndex: 1 }),
        makeDNode({ id: 'n2', x: 10, y: 100, creationIndex: 5 }),
      ],
      edges: [makeEdge({ id: 'e1', from: 'n1', to: 'n2', creationIndex: 9 })],
    });
    const svg = renderDescription(geo, defaultTheme);
    expect(svg).toContain('id="ent0001"');
    expect(svg).toContain('id="ent0005"');
    expect(svg).toContain('id="lnk9"');
    expect(svg).not.toContain('id="ent0002"');
  });
});

// ---------------------------------------------------------------------------
// Draw order (SvekResult#drawU fidelity: clusters, then leaves, then edges)
// ---------------------------------------------------------------------------

describe('renderDescription — draw order', () => {
  it('draws every cluster before any leaf entity', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'package', display: 'Pkg', width: 200, height: 150, children: [child] });
    const leaf = makeDNode({ id: 'n2', symbol: 'component', display: 'Leaf', x: 220 });
    const svg = renderDescription(makeGeo({ nodes: [container, leaf] }), defaultTheme);
    const clusterIdx = svg.indexOf('<g class="cluster"');
    const leafIdx = svg.indexOf('data-qualified-name="n2"');
    expect(clusterIdx).toBeGreaterThanOrEqual(0);
    expect(leafIdx).toBeGreaterThan(clusterIdx);
  });

  it('draws every leaf entity before any edge', () => {
    const svg = renderDescription(twoNodeGeo(), defaultTheme);
    const lastEntityIdx = svg.lastIndexOf('<g class="entity"');
    const linkIdx = svg.indexOf('<g class="link"');
    expect(lastEntityIdx).toBeGreaterThanOrEqual(0);
    expect(linkIdx).toBeGreaterThan(lastEntityIdx);
  });

  it('a nested container child is drawn as a leaf, positioned after its own cluster wrapper', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'package', display: 'Pkg', width: 200, height: 150, children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    const clusterIdx = svg.indexOf('<g class="cluster"');
    const childEntityIdx = svg.indexOf('<g class="entity"');
    expect(childEntityIdx).toBeGreaterThan(clusterIdx);
    expect(svg).toContain('Inner');
    expect(svg).toContain('Pkg');
  });

  // I3b: GraphvizImageBuilder.buildImage:226-227 -- printGroups(root) (every
  // group, recursively, INCLUDING its own leaf members) runs to completion
  // BEFORE printEntities(getUnpackagedEntities()) (top-level entities with
  // NO group parent) even starts -- a top-level UNGROUPED leaf draws LAST
  // regardless of its declaration position relative to a sibling container.
  it('a top-level leaf declared BEFORE a sibling container still draws AFTER that container and its members', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'package', display: 'Pkg', width: 200, height: 150, children: [child] });
    const leaf = makeDNode({ id: 'n2', symbol: 'component', display: 'Leaf', x: 220 });
    // leaf declared FIRST in the nodes array, container SECOND.
    const svg = renderDescription(makeGeo({ nodes: [leaf, container] }), defaultTheme);
    const clusterIdx = svg.indexOf('<g class="cluster"');
    const childEntityIdx = svg.indexOf('data-qualified-name="c1"');
    const leafIdx = svg.indexOf('data-qualified-name="n2"');
    expect(clusterIdx).toBeGreaterThanOrEqual(0);
    expect(childEntityIdx).toBeGreaterThan(clusterIdx);
    expect(leafIdx).toBeGreaterThan(childEntityIdx);
  });

  // I3b: java:416-418 -- an EXPLICITLY-braced but EMPTY container
  // (`component X { }`) is demoted to a leaf-drawn EMPTY_PACKAGE entity, but
  // is still registered as part of `printGroups`' OWN group-sibling
  // iteration (BEFORE any true top-level leaf), never among true leaves.
  it('an explicitly-declared EMPTY group draws before a top-level leaf declared earlier in source', () => {
    const emptyGroup = makeDNode({
      id: 'pkg', symbol: 'package', display: 'Pkg', children: [], declaredAsGroup: true,
    });
    const leaf = makeDNode({ id: 'n2', symbol: 'component', display: 'Leaf', x: 220 });
    const svg = renderDescription(makeGeo({ nodes: [leaf, emptyGroup] }), defaultTheme);
    const groupIdx = svg.indexOf('data-qualified-name="pkg"');
    const leafIdx = svg.indexOf('data-qualified-name="n2"');
    expect(groupIdx).toBeGreaterThanOrEqual(0);
    expect(leafIdx).toBeGreaterThan(groupIdx);
  });
});

// ---------------------------------------------------------------------------
// Node symbol dispatch — smoke coverage (exact fidelity lives in
// entity-image-description.test.ts / symbols-*.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — node symbol dispatch', () => {
  it('component node renders a <rect> with its label', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'OrderService' })] }), defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('OrderService');
  });

  it('interface node renders an <ellipse> with its label', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'interface', display: 'IPayment' })] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('IPayment');
  });

  it('actor node renders an <ellipse> head (rx===ry, the driver always emits <ellipse>) and a <path> body', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'actor', display: 'AdminUser', width: 50, height: 70 })] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<path');
    expect(svg).toContain('AdminUser');
  });

  it('actor-business node renders an extra diagonal <line>', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'actor-business', display: 'Manager', width: 50, height: 70 })] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<line');
    expect(svg).toContain('Manager');
  });

  it('usecase node renders an <ellipse> with its label', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'usecase', display: 'Login', width: 120, height: 40 })] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('Login');
  });

  it('usecase-business node renders an <ellipse> and a diagonal <line>', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'usecase-business', display: 'Pay', width: 120, height: 40 })] }), defaultTheme);
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<line');
    expect(svg).toContain('Pay');
  });

  it('database node renders a cylinder <path> with its label', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'database', display: 'PostgreSQL' })] }), defaultTheme);
    expect(svg).toContain('<path');
    expect(svg).toContain('PostgreSQL');
  });

  it('rectangle node renders a <rect> with its label', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'rectangle', display: 'System' })] }), defaultTheme);
    expect(svg).toContain('<rect');
    expect(svg).toContain('System');
  });

  it('hexagon node does not throw and renders its label (EntityImageDescriptionParams.hexagonPolygon: null — no outline computed yet, a pre-existing T14 gap outside this task\'s write-set)', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'hexagon', display: 'MyHex' })] }), defaultTheme);
    expect(svg.trimStart()).toMatch(/^<svg/);
    expect(svg).toContain('MyHex');
  });
});

// ---------------------------------------------------------------------------
// G1 I2 -- leaf entity stereotype text: SAME font-size as the title, italic
// (klimt/font/FontParam.java's `*_STEREOTYPE` entries -- e.g.
// `COMPONENT_STEREOTYPE(14, UFontFace.italic())` vs `COMPONENT(14, ...)`).
// A prior `theme.fontSize - 2` convention drew this smaller and upright.
// ---------------------------------------------------------------------------

describe('renderDescription — leaf entity stereotype font (G1 I2)', () => {
  it('a leaf entity stereotype renders italic, at the SAME font-size as the title (not smaller)', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'node', display: 'BB', stereotype: 'shared lib' })] }),
      defaultTheme,
    );
    const stereoText = svg.match(/<text[^>]*>«shared lib»<\/text>/)?.[0];
    expect(stereoText).toContain('font-style="italic"');
    expect(stereoText).toContain(`font-size="${defaultTheme.fontSize}"`);
  });

  it('a leaf entity title itself carries no font-style (only the stereotype is italic)', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'node', display: 'BB', stereotype: 'shared lib' })] }),
      defaultTheme,
    );
    const titleText = svg.match(/<text[^>]*>BB<\/text>/)?.[0];
    expect(titleText).not.toContain('font-style');
  });
});

// ---------------------------------------------------------------------------
// G1 I4b -- per-element FontSize/StereotypeFontSize skinparam + <style>
// wiring (previously unwired: renderer-symbol.ts#textFont read only the
// global theme.fontSize constant). Jar-verified sample fixtures cited per
// case; see decision-journal.md I4b + ledger.md I4b.
// ---------------------------------------------------------------------------

describe('renderDescription — per-element FontSize override (G1 I4b)', () => {
  it('a leaf entity title uses its own <sname>FontSize override, not theme.fontSize (cukafa-49-fona812)', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { component: { fontSize: 18 } } } });
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'Comp' })] }),
      theme,
    );
    const titleText = svg.match(/<text[^>]*>Comp<\/text>/)?.[0];
    expect(titleText).toContain('font-size="18"');
  });

  it('a leaf entity of a DIFFERENT sname is unaffected by another sname\'s FontSize override', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { component: { fontSize: 18 } } } });
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'node', display: 'NodeX' })] }),
      theme,
    );
    const titleText = svg.match(/<text[^>]*>NodeX<\/text>/)?.[0];
    expect(titleText).toContain(`font-size="${defaultTheme.fontSize}"`);
  });

  it('a leaf entity stereotype uses its own <sname>StereotypeFontSize override, independent of the title (mavicu-17-mago821)', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { node: { stereotypeFontSize: 20 } } } });
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'node', display: 'N1', stereotype: 'foo' })] }),
      theme,
    );
    const titleText = svg.match(/<text[^>]*>N1<\/text>/)?.[0];
    const stereoText = svg.match(/<text[^>]*>«foo»<\/text>/)?.[0];
    expect(stereoText).toContain('font-size="20"');
    expect(titleText).toContain(`font-size="${defaultTheme.fontSize}"`);
  });

  it('a stereotype falls back to the plain FontSize override when no StereotypeFontSize is set (CSS-cascade, not independently jar-verified)', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { component: { fontSize: 18 } } } });
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'C1', stereotype: 'bar' })] }),
      theme,
    );
    const stereoText = svg.match(/<text[^>]*>«bar»<\/text>/)?.[0];
    expect(stereoText).toContain('font-size="18"');
  });

  it('a container title/stereotype use the per-sname override the same way as a leaf entity (xagino-11-vazo768)', () => {
    const theme = deepMergeTheme(defaultTheme, { colors: { elements: { package: { fontSize: 40 } } } });
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({
      id: 'pkg', symbol: 'package', display: 'Config', width: 200, height: 150, children: [child],
    });
    const svg = renderDescription(makeGeo({ nodes: [container] }), theme);
    const titleText = svg.match(/<text[^>]*>Config<\/text>/)?.[0];
    expect(titleText).toContain('font-size="40"');
  });
});

// ---------------------------------------------------------------------------
// note / port fallback (no upstream USymbol mapping — renderer-entity.ts's
// local klimt-primitive fallback)
// ---------------------------------------------------------------------------

describe('renderDescription — note/port fallback', () => {
  it('note renders a box filled with theme.colors.noteBackground', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'note', display: 'my note' })] }), defaultTheme);
    expect(svg).toContain(`fill="${defaultTheme.colors.noteBackground}"`);
    expect(svg).toContain('my note');
  });

  it('multi-line note body renders one <text> per line', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'note', display: 'line one\nline two' })] }), defaultTheme);
    expect(svg).toContain('line one');
    expect(svg).toContain('line two');
    expect((svg.match(/<text/g) ?? []).length).toBe(2);
  });

  it('port renders a small box filled with theme.colors.nodeBackground, bordered with theme.colors.border at 1.5 stroke width (G1 I5: EntityImagePort.java:99-137 -- backcolor/bordercolor resolve through resolveElementPaint, not both hardcoded to theme.colors.border)', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'port', display: 'P', width: 20, height: 20 })] }), defaultTheme);
    const rect = svg.match(/<rect[^>]*width="20"[^>]*\/>/)?.[0];
    expect(rect).toContain(`fill="${defaultTheme.colors.nodeBackground}"`);
    expect(rect).toContain(`stroke:${defaultTheme.colors.border}`);
    expect(rect).toContain('stroke-width:1.5');
  });

  it('port draws its display text as a label, BEFORE the box in draw order (jar-verified child order: <text> then <rect>)', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'port', display: 'p1', width: 12, height: 12 })] }), defaultTheme);
    expect(svg).toContain('>p1<');
    const textIdx = svg.indexOf('<text');
    const rectIdx = svg.indexOf('<rect');
    expect(textIdx).toBeGreaterThan(-1);
    expect(rectIdx).toBeGreaterThan(-1);
    expect(textIdx).toBeLessThan(rectIdx);
  });

  it('port label position flips above/below the box via node.portLabelAbove (EntityImagePort.upPosition())', () => {
    const above = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'port', display: 'p1', width: 12, height: 12, portLabelAbove: true })] }),
      defaultTheme,
    );
    const below = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'port', display: 'p1', width: 12, height: 12, portLabelAbove: false })] }),
      defaultTheme,
    );
    const aboveY = Number(above.match(/<text[^>]*\by="(-?[\d.]+)"/)?.[1]);
    const belowY = Number(below.match(/<text[^>]*\by="(-?[\d.]+)"/)?.[1]);
    expect(aboveY).toBeLessThan(0);
    expect(belowY).toBeGreaterThan(0);
  });

  it('note and port both use the shared entity <g> wrapper WITHOUT a leading comment (upstream EntityImageNote.java:196-202 / EntityImagePort.java:110-116 never draw one -- only EntityImageDescription.java:295 does; see DecorateEntityImage.ts#decorateEntityDrawing doc, G1 I0)', () => {
    const svg = renderDescription(
      makeGeo({
        nodes: [
          makeDNode({ id: 'note1', symbol: 'note', display: 'N' }),
          makeDNode({ id: 'port1', symbol: 'port', display: 'P', x: 10, y: 100, width: 20, height: 20 }),
        ],
      }),
      defaultTheme,
    );
    expect(svg).not.toContain('<!--entity');
    expect(svg).toContain('<g class="entity" data-qualified-name="note1" id="ent0001">');
    expect(svg).toContain('<g class="entity" data-qualified-name="port1" id="ent0002">');
  });
});

// ---------------------------------------------------------------------------
// Container (cluster) rendering — T12 finding: packages/folders draw SOLID
// by default (renderer-cluster.ts's ClusterStyleDefaults.strokeDefault has
// no dasharray; the pre-T17 renderer-helpers.ts dashed-by-default behavior
// dies with that file's deletion — see this task's mission report).
// ---------------------------------------------------------------------------

describe('renderDescription — container (cluster) rendering', () => {
  it('package container renders a <g class="cluster"> wrapper with its label', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'package', display: 'Services', width: 200, height: 150, children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    expect(svg).toContain('<g class="cluster"');
    expect(svg).toContain('Services');
  });

  it('package container border is SOLID by default (no stroke-dasharray) — T12 finding', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'package', display: 'Services', width: 200, height: 150, children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('folder container also draws SOLID by default (same ClusterStyleDefaults as package)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'folder', display: 'Handlers', width: 200, height: 150, children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    expect(svg).not.toContain('stroke-dasharray');
    expect(svg).toContain('<g class="cluster"');
  });

  it('cloud container (children present) also renders as a cluster, solid border', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({ id: 'pkg', symbol: 'cloud', display: 'AWS', width: 200, height: 150, children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    expect(svg).toContain('<g class="cluster"');
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('a cloud with no children (empty container) draws as a leaf entity, not a cluster', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'cloud', display: 'AWS', children: [] })] }), defaultTheme);
    expect(svg).not.toContain('<g class="cluster"');
    expect(svg).toContain('AWS');
  });

  it('child nodes inside a container render alongside the container', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'InnerComp' });
    const parent = makeDNode({ id: 'pkg', symbol: 'package', display: 'MyPackage', width: 200, height: 150, children: [child] });
    const svg = renderDescription(makeGeo({ nodes: [parent] }), defaultTheme);
    expect(svg).toContain('InnerComp');
    expect(svg).toContain('MyPackage');
  });
});

// ---------------------------------------------------------------------------
// G1 I2 -- container title font weight + stereotype size/style (font-size
// 72->16, font-weight 73->8, and font-style 38->3 fixtures on the SVG
// conformance census after this fix; see decision-journal.md I2).
// ---------------------------------------------------------------------------

describe('renderDescription — container (cluster) title/stereotype font (G1 I2)', () => {
  it('a container title is BOLD (font-weight="700") regardless of its keyword (abel/Entity.java#getFontConfigurationForTitle -> FontParam.PACKAGE, inPackageTitle=true)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    for (const symbol of ['package', 'frame', 'node', 'cloud'] as const) {
      const container = makeDNode({ id: 'pkg', symbol, display: 'Title', width: 200, height: 150, children: [child] });
      const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
      const titleText = svg.match(/<text[^>]*>Title<\/text>/)?.[0];
      expect(titleText, `symbol=${symbol}`).toContain('font-weight="700"');
    }
  });

  it('a leaf entity title is NEVER bold (only container/group titles are)', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'Leaf' })] }), defaultTheme);
    const titleText = svg.match(/<text[^>]*>Leaf<\/text>/)?.[0];
    expect(titleText).not.toContain('font-weight');
  });

  it('a container stereotype renders italic, at the SAME font-size as the title (not smaller)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const container = makeDNode({
      id: 'pkg', symbol: 'node', display: 'Title', stereotype: 'shared node', width: 200, height: 150, children: [child],
    });
    const svg = renderDescription(makeGeo({ nodes: [container] }), defaultTheme);
    const stereoText = svg.match(/<text[^>]*>«shared node»<\/text>/)?.[0];
    expect(stereoText).toContain('font-style="italic"');
    expect(stereoText).toContain(`font-size="${defaultTheme.fontSize}"`);
    expect(stereoText).not.toContain('font-weight');
  });
});

// ---------------------------------------------------------------------------
// Edges — group wrapper, dashed style, labels/stereotypes
// (spline/extremity geometry is exhaustively covered by svek-edge.test.ts)
// ---------------------------------------------------------------------------

describe('renderDescription — edges', () => {
  it('edge renders a <g class="link"> wrapper referencing both endpoint uids', () => {
    const svg = renderDescription(twoNodeGeo(), defaultTheme);
    expect(svg).toContain('<g class="link"');
    expect(svg).toContain('data-entity-1="ent0001"');
    expect(svg).toContain('data-entity-2="ent0002"');
  });

  it('dashed edge has stroke-dasharray in its path style', () => {
    const svg = renderDescription(twoNodeGeo({ dashed: true }), defaultTheme);
    expect(svg).toContain('stroke-dasharray');
  });

  it('solid edge has no stroke-dasharray', () => {
    const svg = renderDescription(twoNodeGeo({ dashed: false }), defaultTheme);
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('edge path uses theme arrow color (emitted in the style attribute, not a bare stroke= attr)', () => {
    const svg = renderDescription(twoNodeGeo(), defaultTheme);
    expect(svg).toContain(`stroke:${defaultTheme.colors.arrow};`);
  });

  it('edge with an explicit label renders the label text', () => {
    const svg = renderDescription(
      twoNodeGeo({ label: { text: 'uses', x: 80, y: 45 } }),
      defaultTheme,
    );
    expect(svg).toContain('uses');
  });

  it('edge with a stereotype renders «stereotype» guillemet text', () => {
    const svg = renderDescription(twoNodeGeo({ stereotype: 'include' }), defaultTheme);
    expect(svg).toContain('«include»');
  });

  it('<<include>> link renders both dashed styling and the «include» label', () => {
    const svg = renderDescription(twoNodeGeo({ dashed: true, stereotype: 'include' }), defaultTheme);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('«include»');
  });

  it('«extend» stereotype renders correctly', () => {
    const svg = renderDescription(twoNodeGeo({ stereotype: 'extend' }), defaultTheme);
    expect(svg).toContain('«extend»');
  });

  // G1 I2 -- edge label font: klimt/font/FontParam.java:54,
  // `ARROW(13, UFontFace.normal())` -- a FIXED size (13) independent of
  // `theme.fontSize`, and the jar's default text color (black), NOT
  // `theme.colors.graph.edgeLabel` (a different, shared default used by
  // class/state/dot renderers). A prior `theme.fontSize - 2` convention
  // happened to also equal 13 under this port's default theme.fontSize of
  // 14, masking the divergence.
  it('an edge label renders at the fixed jar ARROW font-size (13), not theme.fontSize-derived', () => {
    const svg = renderDescription(twoNodeGeo({ stereotype: 'include' }), defaultTheme);
    const labelText = svg.match(/<text[^>]*>«include»<\/text>/)?.[0];
    expect(labelText).toContain('font-size="13"');
  });

  it('an edge label renders in the jar default black, not theme.colors.graph.edgeLabel', () => {
    const svg = renderDescription(twoNodeGeo({ stereotype: 'include' }), defaultTheme);
    const labelText = svg.match(/<text[^>]*>«include»<\/text>/)?.[0];
    expect(labelText).toContain('fill="#000000"');
    expect(defaultTheme.colors.graph.edgeLabel).not.toBe('#000000');
  });

  // G1 I3 -- path/@id family mechanism A: SvekEdge#setSharedIds (SvekEdge.
  // java:826, wired per-diagram in SvekResult.java:93-101) was never called
  // from this renderer's edge loop, so `SvekEdge`'s own per-instance default
  // `ids` Set (SvekEdge.ts) never saw a sibling edge's id -- two links whose
  // `idCommentForSvg()` produces the SAME base string never got the jar's
  // `-1`/`-2`-suffixed disambiguation (SvekEdge.java:1093 `uniq`).
  it('two edges with the same base id get uniq-suffixed path ids (jar SvekResult#drawU wiring)', () => {
    const geo = makeGeo({
      nodes: [
        makeDNode({ id: 'n1', x: 10, y: 10 }),
        makeDNode({ id: 'n2', x: 10, y: 100 }),
      ],
      edges: [
        makeEdge({ id: 'e1', from: 'n1', to: 'n2' }),
        makeEdge({ id: 'e2', from: 'n1', to: 'n2' }),
      ],
    });
    const svg = renderDescription(geo, defaultTheme);
    expect(svg).toContain('id="n1-to-n2"');
    expect(svg).toContain('id="n1-to-n2-1"');
  });

  // G1 I3 -- path/@id family mechanism B: `buildInput`'s `headDecor`
  // fallback (renderer-edge.ts) applied `fallbackHeadToken(edge.arrowHead)`
  // whenever `edge.headDecor` was absent, even when `edge.tailDecor` already
  // carried the link's real (single-sided) decor token -- synthesizing a
  // phantom head decor that flipped `looksLikeRevertedForSvg`/
  // `looksLikeNoDecorAtAllSvg` (link-decor.ts) into the wrong branch. A
  // tail-only-decorated edge (e.g. `B <-- A`) must resolve to the
  // `-backto-` id, not a bare `X-Y` id.
  it('tail-only decor (arrowHead classification alone must not synthesize a head decor) gets the -backto- id', () => {
    const svg = renderDescription(
      twoNodeGeo({ tailDecor: '<', arrowHead: 'open' }),
      defaultTheme,
    );
    expect(svg).toContain('id="n1-backto-n2"');
  });
});

// ---------------------------------------------------------------------------
// Per-element Paint resolution (T7 / D4) — carried through unchanged from
// renderer-entity.ts/renderer-cluster.ts's shared resolveElementPaint calls.
// ---------------------------------------------------------------------------

describe('renderDescription — per-element Paint (T7)', () => {
  const withElements = (
    elements: NonNullable<(typeof defaultTheme)['colors']['elements']>,
  ): typeof defaultTheme => ({
    ...defaultTheme,
    colors: { ...defaultTheme.colors, elements },
  });

  it('database gradient skinparam renders a url() gradient fill, not the class color (AC1)', () => {
    const theme = withElements({
      database: { background: { color1: '#c3d8f4', color2: '#6192d1', policy: '\\' } },
    });
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'database', display: 'DB' })] }), theme);
    expect(svg).toContain('<linearGradient');
    expect(svg).toMatch(/fill="url\(#g[0-9a-z]+\)"/);
  });

  it('component border resolves from its own element bucket (AC3)', () => {
    const theme = withElements({ component: { border: '#FF00FF' } });
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'C' })] }), theme);
    expect(svg).toContain('stroke:#FF00FF;');
  });

  it('a descriptive element with no override falls back to the root default background (AC2)', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'C' })] }), defaultTheme);
    expect(svg).toContain(defaultTheme.colors.nodeBackground);
  });

  it('a container does NOT yet honor a per-element bucket background override (documented gap: renderer-cluster.ts#buildCluster hardcodes backColorOverride: null — out of this task\'s write-set, see mission report)', () => {
    const child = makeDNode({ id: 'c1', symbol: 'component', display: 'Inner' });
    const over = makeDNode({ id: 'pkg', symbol: 'package', display: 'P', width: 200, height: 120, children: [child] });
    const overridden = renderDescription(makeGeo({ nodes: [over] }), withElements({ package: { background: '#ABCDEF' } }));
    // Current (unfixed) behavior: falls back to the package style default
    // (ClusterStyleDefaults.backGroundColorDefault -> theme.colors.graph.packageBackground, 'none').
    expect(overridden).not.toContain('fill="#ABCDEF"');
    expect(overridden).toContain('fill="none"');
  });
});

// ---------------------------------------------------------------------------
// Per-entity inline color/style override (T19) — `#orange;line:blue`,
// `#line.dashed` (klimt/color/Colors.java port, renderer-entity.ts
// #parseColorOverride). Only `line.dashed`/`.dotted`/`.bold` (bare, no
// named color) reach jar zero-diff conformance — named CSS colors pass
// through verbatim (no HColorSet name->hex table in this port), so
// `#orange;line:blue` renders literal `orange`/`blue`, not jar's hex.
// ---------------------------------------------------------------------------

describe('renderDescription — per-entity inline color override (T19)', () => {
  it('#line.dashed sets a dashed stroke with thickness 1, no color change', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'usecase', display: 'c', color: '#line.dashed' })] }),
      defaultTheme,
    );
    expect(svg).toContain('stroke-dasharray:7,7;');
    expect(svg).toContain('stroke-width:1;');
  });

  it('#line.dotted sets a dotted (1,3) stroke with thickness 1', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'c', color: '#line.dotted' })] }),
      defaultTheme,
    );
    expect(svg).toContain('stroke-dasharray:1,3;');
    expect(svg).toContain('stroke-width:1;');
  });

  it('#line.bold sets a solid stroke with thickness 2, no dasharray', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'c', color: '#line.bold' })] }),
      defaultTheme,
    );
    expect(svg).not.toContain('stroke-dasharray');
    expect(svg).toContain('stroke-width:2;');
  });

  it('bare #orange overrides the background fill only', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'c', color: '#orange' })] }),
      defaultTheme,
    );
    expect(svg).toContain('fill="orange"');
  });

  it('#orange;line:blue overrides background and border independently', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'usecase', display: 'c', color: '#orange;line:blue' })] }),
      defaultTheme,
    );
    expect(svg).toContain('fill="orange"');
    expect(svg).toContain('stroke:blue;');
  });

  it('text:color overrides the label font color', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'c', color: '#text:coral' })] }),
      defaultTheme,
    );
    expect(svg).toContain('fill="coral"');
  });

  it('a node with no color override uses the default entity stroke (0.5)', () => {
    const svg = renderDescription(
      makeGeo({ nodes: [makeDNode({ symbol: 'component', display: 'c' })] }),
      defaultTheme,
    );
    expect(svg).not.toContain('stroke-dasharray');
    expect(svg).toContain('stroke-width:0.5;');
  });
});

// ---------------------------------------------------------------------------
// G1 I1 -- unwrapKlimtSvg's klimtShell marker + assembleKlimtShell's own
// root-attribute/prolog/defs shell (the root-attr-loss fix)
// ---------------------------------------------------------------------------

describe('unwrapKlimtSvg — klimtShell marker (G1 I1)', () => {
  it('sets klimtShell: true unconditionally (every call site is already annotated-only)', () => {
    const svg = renderDescription(makeGeo({ nodes: [makeDNode()] }), defaultTheme);
    const fragment = unwrapKlimtSvg(svg, defaultTheme.colors.background);
    expect(fragment.klimtShell).toBe(true);
  });

  it('sets klimtShell: true on the extraDefs branch too', () => {
    // A degenerate (empty) geometry still produces a complete klimt
    // document with a self-closing <defs/> -- exercises the "extraDefs
    // absent" branch, which the OTHER unit test above already covers via
    // the "present" shape; this fixture instead pins the shape when
    // unwrapKlimtSvg's extraDefs IS non-empty (a gradient-using fixture),
    // via a hand-built klimt-shaped string (unwrapKlimtSvg is a narrow
    // string-level unwrap of the EXACT producer shape, not a general SVG
    // parser -- see its own doc comment).
    const klimtSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'version="1.1" viewBox="0 0 10 10">' +
      '<?plantuml $version$?><defs><linearGradient id="g0"/></defs>' +
      '<g><rect/></g></svg>';
    const fragment = unwrapKlimtSvg(klimtSvg, '#FFFFFF');
    expect(fragment.klimtShell).toBe(true);
    expect(fragment.extraDefs).toBe('<linearGradient id="g0"/>');
  });
});

describe('assembleKlimtShell (G1 I1)', () => {
  it('carries every root attribute the generic svgRoot omits', () => {
    const doc = assembleKlimtShell({ body: '<g/>', width: 100, height: 50, background: '#FFFFFF' });
    expect(doc).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(doc).toContain('version="1.1"');
    expect(doc).toContain('data-diagram-type="DESCRIPTION"');
    expect(doc).toContain('zoomAndPan="magnify"');
    expect(doc).toContain('preserveAspectRatio="none"');
    expect(doc).toContain('contentStyleType="text/css"');
    expect(doc).toContain('<?plantuml $version$?>');
  });

  it('folds background into the root style attribute, not a separate <rect> (matches finalizeRootAttributes)', () => {
    const doc = assembleKlimtShell({ body: '<g/>', width: 100, height: 50, background: '#FF0000' });
    expect(doc).toContain('style="width:100px;height:50px;background:#FF0000;"');
    expect(doc).not.toContain('<rect');
  });

  it('omits the background segment of style for a transparent/none background', () => {
    const doc = assembleKlimtShell({ body: '<g/>', width: 100, height: 50, background: 'transparent' });
    expect(doc).toContain('style="width:100px;height:50px;"');
    expect(doc).not.toContain('background:');
  });

  it('defaults background to #FFFFFF when omitted (matches svgRoot\'s own default)', () => {
    const doc = assembleKlimtShell({ body: '<g/>', width: 100, height: 50 });
    expect(doc).toContain('background:#FFFFFF;');
  });

  it('emits width/height/viewBox truncated to integers (Math.trunc, matching finalizeRootAttributes)', () => {
    const doc = assembleKlimtShell({ body: '<g/>', width: 100.7, height: 50.2, background: '#FFFFFF' });
    expect(doc).toContain('width="100px"');
    expect(doc).toContain('height="50px"');
    expect(doc).toContain('viewBox="0 0 100 50"');
  });

  it('splices extraDefs into the single <defs> block with no ALL_ARROW_TYPES marker injection', () => {
    const doc = assembleKlimtShell({
      body: '<g/>',
      width: 10,
      height: 10,
      background: '#FFFFFF',
      extraDefs: '<linearGradient id="g0"/>',
    });
    expect(doc).toContain('<defs><linearGradient id="g0"/></defs>');
    expect(doc).not.toContain('arrow-sync');
    expect(doc).not.toContain('marker');
  });

  it('emits an empty <defs> block when extraDefs is absent', () => {
    const doc = assembleKlimtShell({ body: '<g/>', width: 10, height: 10, background: '#FFFFFF' });
    expect(doc).toContain('<defs></defs>');
  });

  it('places the body verbatim after defs, before the closing tag', () => {
    const doc = assembleKlimtShell({ body: '<g class="mark">X</g>', width: 10, height: 10, background: '#FFFFFF' });
    expect(doc.endsWith('<g class="mark">X</g></svg>')).toBe(true);
  });
});
