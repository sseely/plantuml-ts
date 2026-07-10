/**
 * entity-image-description.test.ts — T14: conformance + behavioral tests
 * for `EntityImageDescription` (svek/image/EntityImageDescription.java).
 *
 * jarFragment provenance: both reference fragments below are extracted,
 * VERBATIM (minus the `(-7,-7)` diagram-margin rebase — see
 * `symbols-component.test.ts`'s identical provenance note for why that
 * offset is unrelated to any drawing math this file's classes perform),
 * from real jar output — `java -jar
 * ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar -tsvg -pipe` on a
 * minimal single-element `.puml` (`[Comp1]` / `[Component] <<red>>`) —
 * captured 2026-07-09. These are FRESH captures for this task, not reused
 * from `test-results/dot-cache/**`: that corpus was independently
 * verified (during this task) to have been generated under a
 * "deterministic" measurement mode (see `leaf-sizing.ts`'s own
 * `LINE_HEIGHT_FACTOR` doc comment — height = font size exactly, no real
 * AWT ascent/descent), which measures text differently from the real AWT
 * jar `jarMeasurer` (D12) reproduces; mixing the two would silently fail
 * conformance for reasons unrelated to this task's own code. Confirmed by
 * direct computation: `jarMeasurer.measure('Comp1', {family:'sans-serif',
 * size:14})` = `{width: 49.0205, height: 16.4883}`, matching this file's
 * fresh capture exactly (`textLength="49.0205"`, entity height
 * `46.4883 = 30 (USymbolComponent2 margin) + 16.4883`).
 */
import { describe, expect, test } from 'vitest';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { FontStyle } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { jarMeasurer } from '../../../../src/core/measurer-jar.js';
import { ActorStyle } from '../../../../src/core/skin/ActorStyle.js';
import { ComponentStyle, USymbols } from '../../../../src/core/decoration/symbol/USymbols.js';
import type { UGraphicWithGroups } from '../../../../src/core/svek/DecorateEntityImage.js';
import {
  EntityImageDescription,
  ShapeType,
  Margins,
  resolveDescriptionUSymbol,
  type EntityImageDescriptionParams,
  type HexagonPolygon,
} from '../../../../src/core/svek/image/EntityImageDescription.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TITLE_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };
const STEREO_FONT: FontConfiguration = {
  family: 'sans-serif',
  size: 14,
  color: '#000000',
  styles: new Set([FontStyle.ITALIC]),
};

/** `DriverTextSvg` (the SVG text driver) computes each `<text>`
 *  element's own `textLength` attribute from THIS bounder at draw time —
 *  a SEPARATE seam from the `TextBlock#calculateDimension` this file's
 *  classes compute via `jarMeasurer` internally (see the sibling source
 *  file's "Text-construction seam" doc comment). Wiring it to
 *  `jarMeasurer` too keeps both seams' widths in agreement, matching
 *  `symbols-component.test.ts`'s identical `stubDriverStringBounder`
 *  convention (there hardcoded per-fixture; here computed generically
 *  since this suite's assertions cover more than one string). */
const jarBackedDriverBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    return { width: jarMeasurer.measure(text, { family: font.family, size: font.size }).width };
  },
};

/** `measurer: jarMeasurer` (dual-measurer conformance/ratchet mission,
 *  2026-07-10 — write-set expansion, journaled): `getStringBounder()`
 *  used to always report height 0 (a real bug, `Footprint.ts`'s doc
 *  comment) — `buildTextBlock` ignored the `StringBounder` it was given
 *  and measured via a module-hardcoded `jarMeasurer` reference instead,
 *  so this stub's height didn't matter. Now that `buildTextBlock` reads
 *  width/height/descent off the ACTUAL `StringBounder` `ug.getStringBounder()`
 *  returns, this stub must report real (jar-matching) values, or every
 *  text baseline in this suite's fixtures silently collapses to `y=0`.
 *  Passing the same `jarMeasurer` this file's `jarBackedDriverBounder`
 *  already uses for width keeps both seams consistent. */
/** Real jar-measured `StringBounder` (dual-measurer mission, 2026-07-10 —
 *  re-baseline, see `newGraphic()`'s doc comment for the same mechanism):
 *  `calculateDimensionSlow`/`getNameDimension` below used to pass an
 *  always-`(0,0)` stub because `buildTextBlock`'s `calculateDimension`
 *  ignored its `stringBounder` argument entirely. It no longer does —
 *  these two call sites need a bounder that actually reports the same
 *  jar-measured numbers `jarBackedDriverBounder`/`newGraphic()` already
 *  use, or every dimension collapses to 0. */
function jarBackedStringBounder(): { calculateDimension: (font: { family: string; size: number }, text: string) => XDimension2D; getDescent: (font: { family: string; size: number }, text: string) => number } {
  return {
    calculateDimension(font, text) {
      const { width, height } = jarMeasurer.measure(text, { family: font.family, size: font.size });
      return new XDimension2D(width, height);
    },
    getDescent(font, text) {
      return jarMeasurer.getDescent({ family: font.family, size: font.size }, text);
    },
  };
}

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', jarBackedDriverBounder, jarMeasurer);
}

/** Extracts this port's outer `<g>...</g><svg>` content (the top-level
 *  group `UGraphicSvg.register()` always opens) — matches
 *  `symbols-component.test.ts`'s identical `extractTopGroup` helper. */
function extractTopGroup(svg: string): string {
  const match = /<g>([\s\S]*)<\/g><\/svg>$/.exec(svg);
  if (match === null) throw new Error('extractTopGroup: no top-level <g>...</g></svg> found');
  const inner = match[1];
  if (inner === undefined) throw new Error('extractTopGroup: capture group did not match');
  return inner;
}

function wrapFragment(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg"><g>${inner}</g></svg>`;
}

function render(entity: EntityImageDescription): string {
  const ug = newGraphic();
  entity.drawU(ug);
  return wrapFragment(extractTopGroup(ug.getSvgString()));
}

function expectConformant(ours: string, jarFragment: string): void {
  const { pass, diffs } = compareSvg(ours, wrapFragment(jarFragment), 'deterministic');
  expect(pass, `first diff: ${JSON.stringify(diffs[0])}`).toBe(true);
}

/** Real jar style/geometry facts common to both fixtures below (see the
 *  module doc comment's provenance note): `backColor=#F1F1F1`,
 *  `foreColor=#181818`, `stroke-width=0.5`, `roundCorner=5` (renders
 *  `rx=ry=2.5`), no shadow, no diagonal corner — identical to
 *  `symbols-component.test.ts`'s `fooSymbolContext()`. */
function baseParams(overrides: Partial<EntityImageDescriptionParams>): EntityImageDescriptionParams {
  return {
    entity: { name: 'Comp1', uid: 'ent0001', qualifiedName: 'Comp1', location: { position: 1 }, url: null },
    symbol: { keyword: 'component', actorStyle: ActorStyle.STICKMAN, componentStyle: ComponentStyle.UML2 },
    labels: { codeName: 'Comp1', displayText: 'Comp1', stereotypeLabels: [] },
    paint: {
      forecolor: '#181818',
      backcolor: '#F1F1F1',
      roundCorner: 5,
      diagonalCorner: 0,
      deltaShadow: 0,
      stroke: UStroke.withThickness(0.5),
      fontTitle: TITLE_FONT,
      fontStereo: STEREO_FONT,
      titleAlignment: HorizontalAlignment.CENTER,
      stereotypeAlignment: HorizontalAlignment.CENTER,
    },
    links: [],
    fixCircleLabelOverlapping: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1 — component entity draws the full entity subtree, conformant vs.
// a cached jar fragment (rebased -7,-7 per this file's provenance note).
// ---------------------------------------------------------------------------

const JAR_COMP1 =
  '<!--entity Comp1-->' +
  '<g class="entity" data-qualified-name="Comp1" id="ent0001" data-source-line="1">' +
  '<rect x="0" y="0" width="89.0205" height="46.4883" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>' +
  '<rect x="69.0205" y="5" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="67.0205" y="7" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="67.0205" y="11" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="15" y="33.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="49.0205" font-family="sans-serif">Comp1</text>' +
  '</g>';

describe('EntityImageDescription (T14, AC1) — component entity subtree', () => {
  test('drawU renders the comment+group+USymbolComponent2 chrome+title conformant vs. the jar fragment', () => {
    const entity = new EntityImageDescription(baseParams({}));
    expectConformant(render(entity), JAR_COMP1);
  });

  test('getShapeType reports RECTANGLE for a plain component', () => {
    const entity = new EntityImageDescription(baseParams({}));
    expect(entity.getShapeType()).toBe(ShapeType.RECTANGLE);
  });

  test('calculateDimensionSlow matches the jar-measured entity size', () => {
    const entity = new EntityImageDescription(baseParams({}));
    const dim = entity.calculateDimensionSlow(jarBackedStringBounder());
    expect(dim.getWidth()).toBeCloseTo(89.0205, 3);
    expect(dim.getHeight()).toBeCloseTo(46.4883, 3);
  });

  test('getShield returns Margins.NONE for a non-interface symbol', () => {
    const entity = new EntityImageDescription(baseParams({}));
    const shield = entity.getShield({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(shield).toBe(Margins.NONE);
  });

  test('getNameDimension returns the "name" TextBlock dimension when hideText is false', () => {
    const entity = new EntityImageDescription(baseParams({}));
    const dim = entity.getNameDimension(jarBackedStringBounder());
    expect(dim.getWidth()).toBeCloseTo(49.0205, 3);
    expect(dim.getHeight()).toBeCloseTo(16.4883, 3);
  });
});

// ---------------------------------------------------------------------------
// Margins — direct coverage of every ported member (upstream: svek/Margins
// .java, ported in full — see EntityImageDescription.ts's module doc
// comment). Not all reachable through EntityImageDescription's own
// control flow, so exercised directly per this project's 90/90/90 rule.
// ---------------------------------------------------------------------------

describe('Margins', () => {
  test('uniform builds all four sides equal', () => {
    const m = Margins.uniform(4);
    expect(m.getX1()).toBe(4);
    expect(m.getX2()).toBe(4);
    expect(m.getY1()).toBe(4);
    expect(m.getY2()).toBe(4);
  });

  test('getTotalWidth/getTotalHeight sum the two axis sides', () => {
    const m = new Margins(1, 2, 3, 4);
    expect(m.getTotalWidth()).toBe(3);
    expect(m.getTotalHeight()).toBe(7);
  });

  test('isZero is true only for Margins.NONE-shaped values', () => {
    expect(Margins.NONE.isZero()).toBe(true);
    expect(new Margins(1, 0, 0, 0).isZero()).toBe(false);
  });

  test('merge takes the per-side maximum', () => {
    const merged = new Margins(1, 5, 2, 8).merge(new Margins(3, 2, 6, 1));
    expect(merged.getX1()).toBe(3);
    expect(merged.getX2()).toBe(5);
    expect(merged.getY1()).toBe(6);
    expect(merged.getY2()).toBe(8);
  });

  test('toString reports the MARGIN[x1,x2,y1,y2] format', () => {
    expect(new Margins(1, 2, 3, 4).toString()).toBe('MARGIN[1,2,3,4]');
  });
});

// ---------------------------------------------------------------------------
// buildDesc branch coverage — the "empty desc" (isWhite / package-leaf)
// branches (EntityImageDescriptionSupport.ts's buildDesc).
// ---------------------------------------------------------------------------

describe('EntityImageDescription — desc branch coverage', () => {
  test('a blank displayText produces an empty desc block ("isWhite" branch)', () => {
    const entity = new EntityImageDescription(
      baseParams({ labels: { codeName: 'Comp1', displayText: '   ', stereotypeLabels: [] } }),
    );
    const dim = entity.calculateDimensionSlow({ calculateDimension: () => new XDimension2D(0, 0) });
    // Margin-only width (40) since desc contributes nothing to asSmall's
    // mergeTB(stereo, label) — matches USymbolComponent2's own margin math.
    expect(dim.getWidth()).toBeCloseTo(40, 3);
  });

  test('a package leaf with default display produces an empty desc block ("isPackageLeaf" branch)', () => {
    const entity = new EntityImageDescription(
      baseParams({
        symbol: { keyword: 'package', actorStyle: ActorStyle.STICKMAN, componentStyle: ComponentStyle.UML2 },
        labels: { codeName: 'Pack1', displayText: 'Pack1', stereotypeLabels: [] },
      }),
    );
    expect(() => entity.calculateDimensionSlow({ calculateDimension: () => new XDimension2D(0, 0) })).not.toThrow();
  });

  test('a custom displayText differing from codeName uses fontBody when supplied ("differs" branch)', () => {
    const BODY_FONT: FontConfiguration = { family: 'sans-serif', size: 10, color: '#000000', styles: new Set() };
    const params = baseParams({ labels: { codeName: 'Comp1', displayText: 'Custom Label', stereotypeLabels: [] } });
    const entity = new EntityImageDescription({ ...params, paint: { ...params.paint, fontBody: BODY_FONT } });
    const svg = render(entity);
    expect(svg).toContain('Custom Label');
    expect(svg).not.toContain('>Comp1<');
  });
});

// ---------------------------------------------------------------------------
// getShield — hasSomeHorizontalLinkDoubleDecorated as the SOLE guard
// (the other two guards must be false to isolate this branch).
// ---------------------------------------------------------------------------

describe('EntityImageDescription — getShield double-decorated-link guard', () => {
  test('returns Margins.NONE when a single invisible-but-double-decorated link touches the entity', () => {
    const entity = new EntityImageDescription(
      baseParams({
        symbol: { keyword: 'interface', actorStyle: ActorStyle.STICKMAN, componentStyle: ComponentStyle.UML2 },
        labels: { codeName: 'IFoo', displayText: 'IFoo', stereotypeLabels: [] },
        links: [{ length: 1, otherEntityId: 'other', isInvis: true, isDoubleDecorated: true }],
      }),
    );
    const shield = entity.getShield({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(shield).toBe(Margins.NONE);
  });
});

// ---------------------------------------------------------------------------
// requireGroups — the "ug lacks startGroup/closeGroup" throw branch.
// ---------------------------------------------------------------------------

describe('EntityImageDescription — requireGroups guard', () => {
  test('drawU throws when passed a UGraphic without startGroup/closeGroup', () => {
    const entity = new EntityImageDescription(baseParams({}));
    const bareUg = {
      apply: () => bareUg,
      draw: () => {},
      getParam: () => ({}) as never,
      getTranslate: () => UTranslate.none(),
      getStringBounder: () => ({ calculateDimension: () => new XDimension2D(0, 0) }),
    };
    expect(() => entity.drawU(bareUg as never)).toThrow(/startGroup\/closeGroup/);
  });
});

// ---------------------------------------------------------------------------
// AC2 — stereotype guillemet block places per upstream math
// ---------------------------------------------------------------------------

const JAR_COMPONENT_STEREO =
  '<!--entity Component-->' +
  '<g class="entity" data-qualified-name="Component" id="ent0001" data-source-line="1">' +
  '<rect x="0" y="0" width="119.1807" height="62.9766" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>' +
  '<rect x="99.1807" y="5" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="97.1807" y="7" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="97.1807" y="11" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="36.0854" y="33.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="37.0098" font-style="italic" font-family="sans-serif">«red»</text>' +
  '<text x="15" y="50.0234" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="79.1807" font-family="sans-serif">Component</text>' +
  '</g>';

describe('EntityImageDescription (T14, AC2) — stereotype guillemet block', () => {
  test('drawU stacks «red» above the title, conformant vs. the jar fragment', () => {
    const entity = new EntityImageDescription(
      baseParams({
        entity: { name: 'Component', uid: 'ent0001', qualifiedName: 'Component', location: { position: 1 }, url: null },
        labels: { codeName: 'Component', displayText: 'Component', stereotypeLabels: ['red'] },
      }),
    );
    expectConformant(render(entity), JAR_COMPONENT_STEREO);
  });

  test('an empty stereotypeLabels array produces no stereotype line (identical to AC1 fixture)', () => {
    const withEmpty = new EntityImageDescription(baseParams({ labels: { codeName: 'Comp1', displayText: 'Comp1', stereotypeLabels: [] } }));
    expectConformant(render(withEmpty), JAR_COMP1);
  });
});

// ---------------------------------------------------------------------------
// AC3 — URL/link/image paths throw, citing D3′ deferred drivers
// ---------------------------------------------------------------------------

describe('EntityImageDescription (T14, AC3) — D3′ deferred URL/link driver', () => {
  test('drawU throws when the entity carries a non-null url', () => {
    const entity = new EntityImageDescription(
      baseParams({ entity: { name: 'Comp1', uid: 'ent0001', qualifiedName: 'Comp1', location: null, url: 'https://example.com' } }),
    );
    expect(() => entity.drawU(newGraphic())).toThrow(/D3-prime/);
  });

  test('the throw message names the deferred openLink/closeLink driver', () => {
    const entity = new EntityImageDescription(
      baseParams({ entity: { name: 'Comp1', uid: 'ent0001', qualifiedName: 'Comp1', location: null, url: 'https://example.com' } }),
    );
    expect(() => entity.drawU(newGraphic())).toThrow(/openLink\/closeLink/);
  });
});

// ---------------------------------------------------------------------------
// Symbol resolution (resolveDescriptionUSymbol) — the "IMPORTANT verified
// finding" business-variant coverage.
// ---------------------------------------------------------------------------

describe('resolveDescriptionUSymbol — keyword to USymbol resolution', () => {
  test('null keyword falls through to null (caller applies componentStyle fallback)', () => {
    expect(resolveDescriptionUSymbol(null, ActorStyle.STICKMAN, ComponentStyle.UML2)).toBeNull();
  });

  test('"usecase/" resolves directly to USECASE_BUSINESS (bypasses fromString, per the verified finding)', () => {
    expect(resolveDescriptionUSymbol('usecase/', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBe(USymbols.USECASE_BUSINESS);
  });

  test('"usecase" resolves directly to USECASE', () => {
    expect(resolveDescriptionUSymbol('usecase', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBe(USymbols.USECASE);
  });

  test('"circle" resolves directly to INTERFACE', () => {
    expect(resolveDescriptionUSymbol('circle', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBe(USymbols.INTERFACE);
  });

  test('"actor/" resolves to ACTOR_STICKMAN_BUSINESS via USymbols.fromString\'s own actor/ branch', () => {
    expect(resolveDescriptionUSymbol('actor/', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBe(USymbols.ACTOR_STICKMAN_BUSINESS);
  });

  test('"actor" resolves via the caller\'s actorStyle', () => {
    expect(resolveDescriptionUSymbol('actor', ActorStyle.HOLLOW, ComponentStyle.UML2)).toBe(USymbols.ACTOR_HOLLOW);
  });

  test('"component" resolves via the caller\'s componentStyle', () => {
    expect(resolveDescriptionUSymbol('component', ActorStyle.STICKMAN, ComponentStyle.UML1)).toBe(USymbols.COMPONENT1);
  });

  test('"portin"/"portout"/"port" resolve to null (EntityImagePort\'s domain, out of scope)', () => {
    expect(resolveDescriptionUSymbol('portin', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBeNull();
    expect(resolveDescriptionUSymbol('portout', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBeNull();
    expect(resolveDescriptionUSymbol('port', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBeNull();
  });

  test('an unrecognized keyword resolves to null', () => {
    expect(resolveDescriptionUSymbol('not-a-real-keyword', ActorStyle.STICKMAN, ComponentStyle.UML2)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hideText (INTERFACE) behavioral coverage — not jar-conformance (this
// port's own chrome/position math, per the established "Text measurement
// seam" convention `symbols-component.test.ts` documents).
// ---------------------------------------------------------------------------

describe('EntityImageDescription — hideText (INTERFACE symbol)', () => {
  function interfaceParams(): EntityImageDescriptionParams {
    return baseParams({
      symbol: { keyword: 'interface', actorStyle: ActorStyle.STICKMAN, componentStyle: ComponentStyle.UML2 },
      labels: { codeName: 'IFoo', displayText: 'IFoo', stereotypeLabels: [] },
    });
  }

  test('getShapeType reports RECTANGLE when fixCircleLabelOverlapping is false', () => {
    const entity = new EntityImageDescription(interfaceParams());
    expect(entity.getShapeType()).toBe(ShapeType.RECTANGLE);
  });

  test('getShapeType reports RECTANGLE_WITH_CIRCLE_INSIDE when fixCircleLabelOverlapping is true', () => {
    const entity = new EntityImageDescription({ ...interfaceParams(), fixCircleLabelOverlapping: true });
    expect(entity.getShapeType()).toBe(ShapeType.RECTANGLE_WITH_CIRCLE_INSIDE);
  });

  test('getNameDimension returns (0,0) when hideText is true', () => {
    const entity = new EntityImageDescription(interfaceParams());
    const dim = entity.getNameDimension({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(dim.getWidth()).toBe(0);
    expect(dim.getHeight()).toBe(0);
  });

  test('getOverscanX returns a non-negative overscan for a wide title on a small interface circle', () => {
    const entity = new EntityImageDescription(interfaceParams());
    const overscan = entity.getOverscanX({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(overscan).toBeGreaterThanOrEqual(0);
  });

  test('getShield returns non-NONE margins when there is a title wider than the small circle', () => {
    const entity = new EntityImageDescription(interfaceParams());
    const shield = entity.getShield({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(shield).not.toBe(Margins.NONE);
    expect(shield.getX1()).toBeGreaterThan(0);
  });

  test('getShield returns Margins.NONE when a horizontal visible link touches the entity (and overlap fix is off)', () => {
    const entity = new EntityImageDescription({
      ...interfaceParams(),
      links: [{ length: 1, otherEntityId: 'other', isInvis: false, isDoubleDecorated: false }],
    });
    const shield = entity.getShield({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(shield).toBe(Margins.NONE);
  });

  test('getShield returns Margins.NONE when there is a double link to the same other entity', () => {
    const entity = new EntityImageDescription({
      ...interfaceParams(),
      links: [
        { length: 1, otherEntityId: 'other', isInvis: true, isDoubleDecorated: false },
        { length: 2, otherEntityId: 'other', isInvis: true, isDoubleDecorated: false },
      ],
    });
    const shield = entity.getShield({ calculateDimension: () => new XDimension2D(0, 0) });
    expect(shield).toBe(Margins.NONE);
  });

  test('getMagneticBorder returns a no-op border for a non-FOLDER shapeType', () => {
    const entity = new EntityImageDescription(interfaceParams());
    const border = entity.getMagneticBorder();
    expect(border.getForceAt({ x: 0, y: 0 }).getDx()).toBe(0);
    expect(border.getForceAt({ x: 0, y: 0 }).getDy()).toBe(0);
  });

  test('drawU draws the stereotype/desc overlay outside the small circle without throwing', () => {
    const entity = new EntityImageDescription({
      ...interfaceParams(),
      labels: { codeName: 'IFoo', displayText: 'IFoo', stereotypeLabels: ['iface'] },
    });
    const svg = render(entity);
    expect(svg).toContain('IFoo');
    expect(svg).toContain('«iface»');
  });
});

// ---------------------------------------------------------------------------
// Hexagon geometry — undefined vs null two-state adaptation
// ---------------------------------------------------------------------------

describe('EntityImageDescription — hexagon geometry adaptation', () => {
  const hexagonSymbol = { keyword: 'hexagon', actorStyle: ActorStyle.STICKMAN, componentStyle: ComponentStyle.UML2 };

  /** `hexagonPolygon` OMITTED entirely — upstream: no `Bibliotekon`. */
  function hexagonParamsOmitted(): EntityImageDescriptionParams {
    return baseParams({ symbol: hexagonSymbol });
  }

  /** `hexagonPolygon` explicitly present (possibly `null`) — upstream: a
   *  `Bibliotekon` exists, with or without a polygon for this node. */
  function hexagonParamsWith(hexagonPolygon: HexagonPolygon | null): EntityImageDescriptionParams {
    return baseParams({ symbol: hexagonSymbol, hexagonPolygon });
  }

  test('getShapeType reports HEXAGON', () => {
    const entity = new EntityImageDescription(hexagonParamsWith(null));
    expect(entity.getShapeType()).toBe(ShapeType.HEXAGON);
  });

  test('drawU throws when hexagonPolygon is omitted (upstream: bibliotekon == null)', () => {
    const entity = new EntityImageDescription(hexagonParamsOmitted());
    expect(() => entity.drawU(newGraphic())).toThrow(/bibliotekon/);
  });

  test('drawU does not throw and skips the draw when hexagonPolygon is explicitly null', () => {
    const entity = new EntityImageDescription(hexagonParamsWith(null));
    expect(() => entity.drawU(newGraphic())).not.toThrow();
  });

  /** A minimal recording fake — NOT a real `UGraphicSvg` — since
   *  `fakePolygon` is not a real klimt shape with a registered SVG
   *  driver; this test only needs to observe that `drawHexagon` calls
   *  `ug.draw(hexagonPolygon)` and `setDeltaShadow` with the right
   *  value, not produce real SVG output. */
  function fakeUGraphic(): { ug: UGraphicWithGroups; drawnShapes: unknown[] } {
    const drawnShapes: unknown[] = [];
    const ug: UGraphicWithGroups = {
      apply: () => ug,
      draw: (shape: unknown) => {
        drawnShapes.push(shape);
      },
      getParam: () => ({}) as never,
      getTranslate: () => UTranslate.none(),
      getStringBounder: () => ({ calculateDimension: () => new XDimension2D(0, 0) }),
      startGroup: () => {},
      closeGroup: () => {},
    };
    return { ug, drawnShapes };
  }

  test('drawU draws the polygon and applies deltaShadow when hexagonPolygon is supplied', () => {
    let sawDeltaShadow: number | undefined;
    const fakePolygon: HexagonPolygon = {
      setDeltaShadow(v: number): void {
        sawDeltaShadow = v;
      },
    };
    const { ug, drawnShapes } = fakeUGraphic();
    const params = hexagonParamsWith(fakePolygon);
    const entity = new EntityImageDescription({ ...params, paint: { ...params.paint, deltaShadow: 3 } });
    entity.drawU(ug);
    expect(drawnShapes).toContain(fakePolygon);
    expect(sawDeltaShadow).toBe(3);
  });
});
