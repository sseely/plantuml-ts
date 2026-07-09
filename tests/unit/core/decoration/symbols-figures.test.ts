/**
 * symbols-figures.test.ts — T9: conformance tests for the figures family
 * (`USymbolActor`, `USymbolActorBusiness`, `USymbolPerson`,
 * `USymbolBoundary`, `USymbolControl`, `USymbolEntityDomain`,
 * `USymbolInterface`, `USymbolUsecase`).
 *
 * Each symbol's `asSmall(...)` is rendered standalone through
 * `UGraphicSvg` (no `EntityImageDescription`/dot-layout in between) and
 * compared against a real jar SVG fragment via `compareSvg` (the harness
 * at `tests/oracle/svg-conformance/compare.ts`) — same "wrap fragments
 * in identical minimal documents on both sides" convention as
 * `symbols-component.test.ts` (T6).
 *
 * jarFragment provenance: every reference fragment below is extracted,
 * VERBATIM, from real jar output —
 *   `java -jar ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar
 *   -tsvg -pipe` on a two-entity `.puml` forcing a DESCRIPTION diagram
 *   (a bare `actor Foo`/`boundary Foo`/etc. alone parses as a SEQUENCE
 *   diagram participant — verified empirically; pairing with a second
 *   entity + a dependency edge, e.g. `actor Foo\nusecase Bar\nFoo -->
 *   Bar`, forces `data-diagram-type="DESCRIPTION"`, the real
 *   `USymbols`-dispatched engine) — captured 2026-07-09. Each fragment
 *   is the real jar's `<g class="entity">...</g>` children for the
 *   FIRST entity ("Foo") only, with every coordinate REBASED by a
 *   constant offset (verified by hand against each class's own Java
 *   source math BEFORE being written down — see each `describe`
 *   block's inline comment for the specific cross-check): unlike T6's
 *   uniform `(-7,-7)`, this family's per-fixture offset varies (each
 *   entity's own icon width differs, and SVEK horizontally/vertically
 *   centers the entity within its allocated layout cell), so the offset
 *   is re-derived per fixture from at least two independent features
 *   (e.g. the icon's own circle center AND the label's own baseline)
 *   agreeing on the SAME additive constant — never asserted from a
 *   single coordinate alone.
 *
 * Text measurement seam: `label`/`stereotype` are opaque `TextBlock`
 * parameters these classes never construct — supplied by the caller
 * (production: `EntityImageDescription`'s BodyFactory-built blocks;
 * here: `fooLabelTextBlock()`/`emptyTextBlock`, reusing T6's exact
 * jar-measured "Foo"@14pt constants — `textLength="24.7051"`, dimension
 * `(24.7051, 16.4883)`, baseline `dy=13.5352`, identical across every
 * fixture in both suites, confirming it is a font-metrics constant
 * independent of which `USymbol*` class draws around it).
 *
 * `USymbolInterface` conformance note: `EntityImageDescription.java`
 * sets `hideText = (symbol == USymbols.INTERFACE)` and calls `asSmall`
 * with ALL-EMPTY `name`/`label`/`stereotype` blocks for this one symbol
 * — the real entity's "Foo" text is drawn SEPARATELY, below the icon,
 * by `EntityImageDescription` itself (out of this task's scope). This
 * suite's Interface test therefore calls `asSmall` with empty blocks
 * too (matching production's actual call shape) and expects ONLY the
 * icon in the rendered fragment.
 *
 * `USymbolUsecase` conformance note: `TextBlockInEllipse`'s ellipse-
 * fitting algorithm (`Footprint`) re-measures its drawn `UText` shapes
 * via `ug.getStringBounder()` directly (not via the `TextBlock`'s own
 * `calculateDimension`) — see `Footprint.ts#MyUGraphic.drawText`. This
 * port's `UGraphicSvg#getStringBounder()` is documented to always
 * report height=0 (a pre-existing, out-of-this-task's-write-set
 * limitation — see `u-graphic-svg.ts`'s own doc comment), which would
 * silently degenerate the fitted ellipse's aspect ratio for ANY label.
 * This suite works around it with a test-local `RealHeightUGraphic`
 * (a thin `UGraphicDelegator` overriding only `getStringBounder()` to
 * report the real jar-measured "Foo" dimension) wrapped around the real
 * `UGraphicSvg` before calling `asSmall.drawU` — draws still land in the
 * SAME underlying `SvgGraphics` document (`UGraphicSvg#copyUGraphic`'s
 * documented sharing contract), so the final rendered fragment is
 * unaffected; only the ellipse-fitting math sees the corrected bounder.
 */
import { describe, expect, test } from 'vitest';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { UGraphic } from '../../../../src/core/klimt/UGraphic.js';
import type { UChange } from '../../../../src/core/klimt/UChange.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { UText } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UHorizontalLine } from '../../../../src/core/klimt/shape/UHorizontalLine.js';
import { UEllipse } from '../../../../src/core/klimt/shape/UEllipse.js';
import { RotatedEllipse } from '../../../../src/core/svek/image/RotatedEllipse.js';
import type { StringBounder } from '../../../../src/core/klimt/font/StringBounder.js';
import { UGraphicDelegator } from '../../../../src/core/klimt/drawing/UGraphicDelegator.js';
import { SymbolContext } from '../../../../src/core/decoration/symbol/SymbolContext.js';
import { USymbolActor } from '../../../../src/core/decoration/symbol/USymbolActor.js';
import { USymbolActorBusiness } from '../../../../src/core/decoration/symbol/USymbolActorBusiness.js';
import { USymbolPerson } from '../../../../src/core/decoration/symbol/USymbolPerson.js';
import { USymbolBoundary } from '../../../../src/core/decoration/symbol/USymbolBoundary.js';
import { USymbolControl } from '../../../../src/core/decoration/symbol/USymbolControl.js';
import { USymbolEntityDomain } from '../../../../src/core/decoration/symbol/USymbolEntityDomain.js';
import { USymbolInterface } from '../../../../src/core/decoration/symbol/USymbolInterface.js';
import { USymbolUsecase } from '../../../../src/core/decoration/symbol/USymbolUsecase.js';
import { ActorStyle } from '../../../../src/core/skin/ActorStyle.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';

// ---------------------------------------------------------------------------
// Shared fixtures (same jar-measured "Foo"@14pt constants as T6's
// symbols-component.test.ts — see the module doc comment above).
// ---------------------------------------------------------------------------

const FOO_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };
const FOO_LABEL_WIDTH = 24.7051;
const FOO_LABEL_HEIGHT = 16.4883;
const FOO_BASELINE_DY = 13.5352;

function fooLabelTextBlock(): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(FOO_LABEL_WIDTH, FOO_LABEL_HEIGHT),
    drawU: (ug) => {
      ug.apply(new UTranslate(0, FOO_BASELINE_DY)).draw(UText.build('Foo', FOO_FONT));
    },
  };
}

const emptyTextBlock: TextBlock = {
  calculateDimension: () => new XDimension2D(0, 0),
  drawU: () => {
    // no-op: matches every fixture's un-stereotyped "Foo" element.
  },
};

/** Real jar style facts common to every fixture below: `backColor=
 * #F1F1F1`, `foreColor=#181818`, `stroke-width=0.5`, no shadow, no
 * round/diagonal corner (none of this family's classes read those two
 * fields). */
function fooSymbolContext(): SymbolContext {
  return new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 0, 0, 0);
}

const stubDriverStringBounder: DriverStringBounder = {
  calculateDimension(_font, text) {
    if (text === 'Foo') return { width: FOO_LABEL_WIDTH };
    return { width: 0 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stubDriverStringBounder);
}

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

function render(asSmall: TextBlock): string {
  const ug = newGraphic();
  asSmall.drawU(ug);
  return wrapFragment(extractTopGroup(ug.getSvgString()));
}

function expectConformant(ours: string, jarFragment: string): void {
  const { pass, diffs } = compareSvg(ours, wrapFragment(jarFragment), 'deterministic');
  expect(pass, `first diff: ${JSON.stringify(diffs[0])}`).toBe(true);
}

// ---------------------------------------------------------------------------
// USymbolUsecase-only harness: works around `UGraphicSvg#getStringBounder()`'s
// documented height=0 gap (see module doc comment).
// ---------------------------------------------------------------------------

const REAL_FOO_BOUNDER: StringBounder = {
  calculateDimension(_font, text) {
    if (text === 'Foo') return new XDimension2D(FOO_LABEL_WIDTH, FOO_LABEL_HEIGHT);
    return new XDimension2D(0, 0);
  },
};

class RealHeightUGraphic extends UGraphicDelegator {
  constructor(
    ug: UGraphic,
    private readonly bounder: StringBounder,
  ) {
    super(ug);
  }

  apply(change: UChange): UGraphic {
    return new RealHeightUGraphic(this.getUg().apply(change), this.bounder);
  }

  override getStringBounder(): StringBounder {
    return this.bounder;
  }
}

function renderUsecase(asSmall: TextBlock): string {
  const svgGraphic = newGraphic();
  const wrapped = new RealHeightUGraphic(svgGraphic, REAL_FOO_BOUNDER);
  asSmall.drawU(wrapped);
  return wrapFragment(extractTopGroup(svgGraphic.getSvgString()));
}

// ---------------------------------------------------------------------------
// Reference fragments (jar-derived, rebased — see provenance note above)
// ---------------------------------------------------------------------------

// Source: `actor Foo\nusecase Bar\nFoo --> Bar` -- entity Foo:
// raw ellipse cx="24.21" cy="14"; path "M24.21,22 L24.21,49 M11.21,30
// L37.21,30 M24.21,49 L11.21,64 M24.21,49 L37.21,64"; text x="11.8575"
// y="79.0352". Offset (10.71, 5.5), cross-checked against
// `ActorStickMan.java`'s own head-center math (startX=5.5, centerX=13.5,
// thickness=0.5) AND the label's `labelY=60` (dimStickMan.height,
// getPreferredHeight()) + baseline 13.5352 -- both agree on the SAME
// (10.71, 5.5) constant.
const JAR_ACTOR_ELLIPSE = '<ellipse cx="13.5" cy="8.5" rx="8" ry="8" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>';
const JAR_ACTOR_PATH =
  '<path d="M13.5,16.5 L13.5,43.5 M0.5,24.5 L26.5,24.5 M13.5,43.5 L0.5,58.5 M13.5,43.5 L26.5,58.5" style="stroke:#181818;stroke-width:0.5;" fill="none"/>';
const JAR_ACTOR_TEXT =
  '<text x="1.1475" y="73.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';
const JAR_ACTOR_FOO = JAR_ACTOR_ELLIPSE + JAR_ACTOR_PATH + JAR_ACTOR_TEXT;

// Source: `actor/ Foo\nusecase Bar\nFoo --> Bar` -- entity Foo: SAME
// ellipse/path/text as JAR_ACTOR_FOO (identical offset (10.71,5.5)), with
// one extra `<line>` (the business slash) inserted BETWEEN the ellipse
// and the body path -- matching `ActorStickMan.java#drawU`'s own draw
// order (head, then `specialBusiness` when `actorBusiness`, then the
// body path) -- raw x1="22.2662" y1="21.7603" x2="31.9703" y2="12.0562",
// rebased by the same (10.71,5.5).
const JAR_ACTOR_BUSINESS_LINE =
  '<line x1="11.5562" y1="16.2603" x2="21.2603" y2="6.5562" style="stroke:#181818;stroke-width:0.5;"/>';
const JAR_ACTOR_BUSINESS_FOO = JAR_ACTOR_ELLIPSE + JAR_ACTOR_BUSINESS_LINE + JAR_ACTOR_PATH + JAR_ACTOR_TEXT;

// Source: `person Foo\nusecase Bar\nFoo --> Bar` -- entity Foo: raw
// ellipse cx="29.3525" cy="14.4815" rx="8.4815" ry="8.4815"; rect
// x="7" y="22.9631" w="44.7051" h="36.4883" rx/ry="8.4815"; text
// x="17" y="46.4982". Offset (7, 6), cross-checked against
// `USymbolPerson.java`'s own math: dimBody=(44.7051,36.4883) (matches
// the rect exactly, headSize=2*8.4815=16.963, posx=(44.7051-16.963)/2
// =13.87105 -> head center (22.35255, 8.4815)) AND
// margin.getY1()+headSize=26.963 + baseline 13.5352 = 40.4982 -- both
// agree on the SAME (7, 6) constant.
const JAR_PERSON_FOO =
  '<ellipse cx="22.3525" cy="8.4815" rx="8.4815" ry="8.4815" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="0" y="16.9631" width="44.7051" height="36.4883" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="8.4815" ry="8.4815"/>' +
  '<text x="10" y="40.4982" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// Source: `boundary Foo\nusecase Bar\nFoo --> Bar` -- entity Foo: raw
// path "M6,6 L6,30 M6,18 L23,18"; ellipse cx="35" cy="18" rx="12"
// ry="12"; text x="14.1475" y="47.5352". Offset (2, 2), cross-checked
// against `Boundary.java`'s own math (margin=4, radius=12, left=17 --
// circle center = (4+17+12, 4+12) = (33, 16); path (4,4)-(4,28) and
// (4,16)-(21,16)) AND labelX=(49-24.7051)/2=12.14745, labelY=32 +
// baseline 13.5352 = 45.5352 -- both agree on the SAME (2, 2) constant.
const JAR_BOUNDARY_FOO =
  '<path d="M4,4 L4,28 M4,16 L21,16" style="stroke:#181818;stroke-width:0.5;" fill="none"/>' +
  '<ellipse cx="33" cy="16" rx="12" ry="12" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="12.1475" y="45.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// Source: `control Foo\nusecase Bar\nFoo --> Bar` -- entity Foo: raw
// ellipse cx="24.21" cy="23" rx="12" ry="12"; polygon
// "20.21,11,26.21,6,24.21,11,26.21,16,20.21,11"; text x="11.8575"
// y="52.5352". Offset (8.21, 7), cross-checked against `Control.java`'s
// own math (margin=4, radius=12 -- circle center=(16,16); polygon
// anchor (x+radius-xContact, y)=(12,4), points (12,4)-(18,-1)-(16,4)-
// (18,9)-(12,4)) AND labelX=(32-24.7051)/2=3.64745, labelY=32 + baseline
// 13.5352 = 45.5352 -- both agree on the SAME (8.21, 7) constant.
const JAR_CONTROL_FOO =
  '<ellipse cx="16" cy="16" rx="12" ry="12" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<polygon points="12,4,18,-1,16,4,18,9,12,4" fill="#181818" style="stroke:#181818;stroke-width:1;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
  '<text x="3.6475" y="45.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// Source: `entity Foo\nusecase Bar\nFoo --> Bar` -- entity Foo: raw
// ellipse cx="24.21" cy="18" rx="12" ry="12"; line x1="12.21" y1="32"
// x2="36.21" y2="32"; text x="11.8575" y="47.5352". Offset (8.21, 2),
// cross-checked against `EntityDomain.java`'s own math (margin=4,
// radius=12, suppY=2 -- circle center=(16,16); hline from
// (4,4+24+2=30) to (28,30)) AND labelX=3.64745, labelY=32+13.5352=
// 45.5352 -- both agree on the SAME (8.21, 2) constant.
const JAR_ENTITY_DOMAIN_FOO =
  '<ellipse cx="16" cy="16" rx="12" ry="12" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<line x1="4" y1="30" x2="28" y2="30" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="3.6475" y="45.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// Source: `interface Foo\nusecase Bar\nFoo --> Bar` -- entity Foo: raw
// ellipse cx="24.21" cy="14" rx="8" ry="8" (this is the ONLY shape --
// `hideText` means no text is part of `asSmall`'s own output, see module
// doc comment). Offset (15.21, 5) = (cx-rx, cy-ry) -- tautological once
// `hideText` is accounted for: with all-empty label/stereotype,
// `USymbolSimpleAbstract#asSmall`'s `stickmanX`/`stickmanY` both reduce
// to 0 (dimTotal == dimStickMan == (18,18)), so `CircleInterface2`'s own
// icon draws at local (0,0) -- `margin=1, radius=8` places its center at
// local (9, 9) exactly.
const JAR_INTERFACE_FOO = '<ellipse cx="9" cy="9" rx="8" ry="8" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>';

// Source: `usecase Foo\nactor Bar\nBar --> Foo` -- entity Foo: raw
// ellipse cx="26.4691" cy="156.649" rx="20.4691" ry="14.659"; text
// x="14.1166" y="161.3931". Offset (cx-rx, cy-ry) = (6, 141.99) --
// tautological: `TextBlockInEllipse#drawU` always draws its ellipse at
// local (0,0) (no extra translate before it), so `cx` MUST equal `rx`
// and `cy` MUST equal `ry` once rebased; the fitted radii themselves
// (20.4691, 14.659) are the real, hard-to-hand-derive conformance fact
// this fixture captures (T9 acceptance criterion 1).
const JAR_USECASE_FOO =
  '<ellipse cx="20.4691" cy="14.659" rx="20.4691" ry="14.659" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="8.1166" y="19.4031" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// Source: `usecase/ Foo\nactor Bar\nBar --> Foo` -- entity Foo: raw
// ellipse cx="36.3686" cy="156.649" rx="30.3686" ry="14.659"; text
// x="24.0161" y="159.94"; line x1="64.3167" y1="151.5389" x2="45.5881"
// y2="170.2675". Offset (cx-rx, cy-ry) = (6, 141.99) -- same
// tautological derivation as JAR_USECASE_FOO (ellipse always at local
// (0,0)); the wider fitted radius (30.3686 vs. 20.4691) reflects the
// extra 7px left/right margin the business variant wraps its content
// in (see `USymbolUsecase.ts`'s own doc comment on the margin-call
// porting-fidelity fix).
const JAR_USECASE_BUSINESS_FOO =
  '<ellipse cx="30.3686" cy="14.659" rx="30.3686" ry="14.659" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="18.0161" y="17.95" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>' +
  '<line x1="58.3167" y1="9.5489" x2="39.5881" y2="28.2775" style="stroke:#181818;stroke-width:0.5;"/>';

// ---------------------------------------------------------------------------
// Conformance tests (AC1)
// ---------------------------------------------------------------------------

describe('USymbolActor (T9, AC1) -- stick-figure stickman', () => {
  test('asSmall renders conformant vs. the jar fragment (actor Foo)', () => {
    const symbol = new USymbolActor(ActorStyle.STICKMAN);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_ACTOR_FOO);
  });

  test('getSNames reports "actor"', () => {
    expect(new USymbolActor(ActorStyle.STICKMAN).getSNames()).toEqual(['actor']);
  });

  test('ActorStyle.HOLLOW/AWESOME are deferred (unreachable, documented)', () => {
    const symbol = new USymbolActor(ActorStyle.HOLLOW);
    const ctx = fooSymbolContext();
    expect(() => symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER)).toThrow(
      /ActorHollow\/ActorAwesome/,
    );
  });
});

describe('USymbolActorBusiness (T9, AC1/AC2) -- stickman with a slash', () => {
  test('asSmall renders conformant vs. the jar fragment (actor/ Foo)', () => {
    const symbol = new USymbolActorBusiness();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_ACTOR_BUSINESS_FOO);
  });

  test('getSNames reports "business"', () => {
    expect(new USymbolActorBusiness().getSNames()).toEqual(['business']);
  });
});

describe('USymbolActor vs USymbolActorBusiness (AC2) -- the slash is the only delta', () => {
  test('ActorBusiness output equals Actor output plus exactly one <line> element', () => {
    const ctx1 = fooSymbolContext();
    const actorAsSmall = new USymbolActor(ActorStyle.STICKMAN).asSmall(
      emptyTextBlock,
      fooLabelTextBlock(),
      emptyTextBlock,
      ctx1,
      HorizontalAlignment.CENTER,
    );
    const ctx2 = fooSymbolContext();
    const businessAsSmall = new USymbolActorBusiness().asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx2, HorizontalAlignment.CENTER);

    const actorSvg = render(actorAsSmall);
    const businessSvg = render(businessAsSmall);

    const lineMatch = /<line[^>]*\/>/.exec(businessSvg);
    expect(lineMatch).not.toBeNull();
    const businessWithoutLine = businessSvg.replace(lineMatch![0], '');
    expect(businessWithoutLine).toBe(actorSvg);
  });
});

describe('USymbolPerson (T9, AC1) -- rounded-figure variant', () => {
  test('asSmall renders conformant vs. the jar fragment (person Foo)', () => {
    const symbol = new USymbolPerson();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_PERSON_FOO);
  });

  test('getSNames reports "person"', () => {
    expect(new USymbolPerson().getSNames()).toEqual(['person']);
  });

  test('asBig throws (matches upstream UnsupportedOperationException)', () => {
    const symbol = new USymbolPerson();
    const ctx = fooSymbolContext();
    expect(() =>
      symbol.asBig(fooLabelTextBlock(), HorizontalAlignment.CENTER, emptyTextBlock, 100, 50, ctx, HorizontalAlignment.CENTER),
    ).toThrow();
  });
});

describe('USymbolBoundary (T9, AC1/AC3) -- robustness-diagram boundary icon', () => {
  test('asSmall renders conformant vs. the jar fragment (boundary Foo)', () => {
    const symbol = new USymbolBoundary();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_BOUNDARY_FOO);
  });

  test('AC3: icon geometry matches Boundary.java constants exactly (margin=4, radius=12, left=17)', () => {
    const symbol = new USymbolBoundary();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    // dimTotal collapses to just the icon's own dimension with empty label/stereo:
    // radius*2+left+2*margin=24+17+8=49, radius*2+2*margin=24+8=32.
    expect(asSmall.calculateDimension({} as never)).toEqual(new XDimension2D(49, 32));
  });

  test('getSNames reports "boundary"', () => {
    expect(new USymbolBoundary().getSNames()).toEqual(['boundary']);
  });
});

describe('USymbolControl (T9, AC1/AC3) -- robustness-diagram control icon', () => {
  test('asSmall renders conformant vs. the jar fragment (control Foo)', () => {
    const symbol = new USymbolControl();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_CONTROL_FOO);
  });

  test('AC3: wing-polygon geometry matches Control.java constants exactly (xWing=6, yAperture=5, xContact=4)', () => {
    const symbol = new USymbolControl();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const svg = render(asSmall);
    // anchor = (x+radius-xContact, y) = (4+12-4, 4) = (12, 4); points
    // (0,0),(6,-5),(4,0),(6,5),(0,0) relative to that anchor.
    expect(svg).toContain('<polygon points="12,4,18,-1,16,4,18,9,12,4"');
  });

  test('getSNames reports "control"', () => {
    expect(new USymbolControl().getSNames()).toEqual(['control']);
  });
});

describe('USymbolEntityDomain (T9, AC1/AC3) -- robustness-diagram entity icon', () => {
  test('asSmall renders conformant vs. the jar fragment (entity Foo)', () => {
    const symbol = new USymbolEntityDomain();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_ENTITY_DOMAIN_FOO);
  });

  test('AC3: underline offset matches EntityDomain.java constants exactly (radius=12, suppY=2)', () => {
    const symbol = new USymbolEntityDomain();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const svg = render(asSmall);
    // hline drawn at (x, y+2*radius+suppY) = (4, 4+24+2=30), width 2*radius=24.
    expect(svg).toContain('<line x1="4" y1="30" x2="28" y2="30"');
  });

  test('getSNames reports "entity"', () => {
    expect(new USymbolEntityDomain().getSNames()).toEqual(['entity']);
  });
});

describe('USymbolInterface (T9, AC1) -- lollipop circle (circle/() alias)', () => {
  test('asSmall renders conformant vs. the jar fragment (interface Foo, hideText: empty blocks)', () => {
    const symbol = new USymbolInterface();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_INTERFACE_FOO);
  });

  test('getSNames reports "interface"', () => {
    expect(new USymbolInterface().getSNames()).toEqual(['interface']);
  });
});

describe('USymbolUsecase (T9, AC1) -- ellipse fitted around its content', () => {
  test('asSmall renders conformant vs. the jar fragment (usecase Foo)', () => {
    const symbol = new USymbolUsecase(false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(renderUsecase(asSmall), JAR_USECASE_FOO);
  });

  test('getSNames reports "usecase" (non-business)', () => {
    expect(new USymbolUsecase(false).getSNames()).toEqual(['usecase']);
  });

  test('asBig throws (matches upstream UnsupportedOperationException)', () => {
    const symbol = new USymbolUsecase(false);
    const ctx = fooSymbolContext();
    expect(() =>
      symbol.asBig(fooLabelTextBlock(), HorizontalAlignment.CENTER, emptyTextBlock, 100, 50, ctx, HorizontalAlignment.CENTER),
    ).toThrow();
  });
});

describe('USymbolUsecase business variant (T9, AC1) -- wider ellipse + diagonal slash', () => {
  test('asSmall renders conformant vs. the jar fragment (usecase/ Foo)', () => {
    const symbol = new USymbolUsecase(true);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(renderUsecase(asSmall), JAR_USECASE_BUSINESS_FOO);
  });

  test('getSNames reports "usecase" and "business"', () => {
    expect(new USymbolUsecase(true).getSNames()).toEqual(['usecase', 'business']);
  });
});

// ---------------------------------------------------------------------------
// Coverage-closing tests (90/90/90 quality bar) -- exercise the remaining
// branches/functions the conformance fixtures above don't naturally reach:
// shadow ternaries (`isShadowing() ? 4.0 : 0.0`), the `Paint | null ?? 'none'`
// seam, `USymbolUsecase#calculateDimension`, and `MyUGraphicEllipse`'s
// `UHorizontalLine` clip path (`drawHline`/`getStencil2`/`getNormalized`).
// ---------------------------------------------------------------------------

function shadowedSymbolContext(): SymbolContext {
  return new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 4, 0, 0);
}

describe('Robustness trio + Interface: shadow branch (isShadowing() true -> deltaShadow=4)', () => {
  test('USymbolBoundary: shadowed render differs from unshadowed and carries a filter', () => {
    const plain = render(new USymbolBoundary().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, fooSymbolContext(), HorizontalAlignment.CENTER));
    const shadowed = render(
      new USymbolBoundary().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, shadowedSymbolContext(), HorizontalAlignment.CENTER),
    );
    expect(shadowed).not.toBe(plain);
    expect(shadowed).toContain('filter=');
    expect(plain).not.toContain('filter=');
  });

  test('USymbolControl: shadowed render differs from unshadowed and carries a filter', () => {
    const plain = render(new USymbolControl().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, fooSymbolContext(), HorizontalAlignment.CENTER));
    const shadowed = render(
      new USymbolControl().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, shadowedSymbolContext(), HorizontalAlignment.CENTER),
    );
    expect(shadowed).not.toBe(plain);
    expect(shadowed).toContain('filter=');
  });

  test('USymbolEntityDomain: shadowed render differs from unshadowed and carries a filter', () => {
    const plain = render(
      new USymbolEntityDomain().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, fooSymbolContext(), HorizontalAlignment.CENTER),
    );
    const shadowed = render(
      new USymbolEntityDomain().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, shadowedSymbolContext(), HorizontalAlignment.CENTER),
    );
    expect(shadowed).not.toBe(plain);
    expect(shadowed).toContain('filter=');
  });

  test('USymbolInterface: shadowed render differs from unshadowed and carries a filter', () => {
    const plain = render(new USymbolInterface().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, fooSymbolContext(), HorizontalAlignment.CENTER));
    const shadowed = render(
      new USymbolInterface().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, shadowedSymbolContext(), HorizontalAlignment.CENTER),
    );
    expect(shadowed).not.toBe(plain);
    expect(shadowed).toContain('filter=');
  });
});

describe('ActorStickMan: shadow branch (fashion.getDeltaShadow() !== 0)', () => {
  test('shadowed stickman render differs from unshadowed and carries a filter', () => {
    const plain = render(
      new USymbolActor(ActorStyle.STICKMAN).asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, fooSymbolContext(), HorizontalAlignment.CENTER),
    );
    const shadowed = render(
      new USymbolActor(ActorStyle.STICKMAN).asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, shadowedSymbolContext(), HorizontalAlignment.CENTER),
    );
    expect(shadowed).not.toBe(plain);
    expect(shadowed).toContain('filter=');
  });
});

describe('CircleInterface2 / Control: null-color seam (Paint | null ?? \'none\')', () => {
  test('USymbolInterface with null back/fore colors renders the SVG "none" paint keyword', () => {
    const ctx = new SymbolContext(null, null, UStroke.withThickness(0.5), 0, 0, 0);
    const svg = render(new USymbolInterface().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER));
    expect(svg).toContain('fill="none"');
  });

  test('USymbolControl with a null foreColor renders the SVG "none" paint keyword for the wing polygon', () => {
    const ctx = new SymbolContext('#F1F1F1', null, UStroke.withThickness(0.5), 0, 0, 0);
    const svg = render(new USymbolControl().asSmall(emptyTextBlock, emptyTextBlock, emptyTextBlock, ctx, HorizontalAlignment.CENTER));
    expect(svg).toContain('fill="none"');
  });
});

describe('USymbolUsecase: calculateDimension + UHorizontalLine clip path (coverage)', () => {
  test('calculateDimension reports the fitted ellipse dimension directly (no drawU)', () => {
    const symbol = new USymbolUsecase(false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const dim = asSmall.calculateDimension(REAL_FOO_BOUNDER);
    // Matches JAR_USECASE_FOO's fitted radii: rx=20.4691, ry=14.659 -> width/height = 2*rx, 2*ry.
    expect(dim.getWidth()).toBeCloseTo(40.9382, 2);
    expect(dim.getHeight()).toBeCloseTo(29.319, 2);
  });

  /** A label that draws a Creole horizontal rule instead of plain text --
   * exercises `MyUGraphicEllipse#drawHline`/`getStencil2`/`getNormalized`
   * (the ellipse-clipped stencil path), never reached by the plain "Foo"
   * text fixtures above. */
  function horizontalRuleLabel(): TextBlock {
    return {
      calculateDimension: () => new XDimension2D(FOO_LABEL_WIDTH, FOO_LABEL_HEIGHT),
      drawU: (ug) => {
        ug.draw(UHorizontalLine.infinite(1, 0, 0, '-'));
      },
    };
  }

  test('a horizontal-rule label clips to the fitted ellipse boundary without error', () => {
    const symbol = new USymbolUsecase(false);
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, horizontalRuleLabel(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const svg = renderUsecase(asSmall);
    // The ellipse itself, plus at least one clipped <line> for the rule.
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<line');
  });
});

describe('RotatedEllipse (coverage) -- direct accessor + preserved-dead-code checks', () => {
  test('getA/getB/getBeta report half-width, half-height, and the rotation angle', () => {
    const ellipse = UEllipse.build(40, 20);
    const rotated = new RotatedEllipse(ellipse, Math.PI / 4);
    expect(rotated.getA()).toBe(20);
    expect(rotated.getB()).toBe(10);
    expect(rotated.getBeta()).toBe(Math.PI / 4);
  });

  test('getPoint(0) returns the unrotated major-axis vertex rotated by beta', () => {
    const ellipse = UEllipse.build(40, 20);
    const rotated = new RotatedEllipse(ellipse, Math.PI / 2);
    const p = rotated.getPoint(0);
    // theta=0 -> (a,0) before rotation; beta=PI/2 rotates it to (0,a).
    expect(p.getX()).toBeCloseTo(0, 6);
    expect(p.getY()).toBeCloseTo(20, 6);
  });

  test('preserved dead code: `other` returns all[0] when diff0>diff1, else all[1] (upstream RotatedEllipse.java has no caller)', () => {
    const ellipse = UEllipse.build(40, 20);
    const rotated = new RotatedEllipse(ellipse, 0);
    const withPrivateAccess = rotated as unknown as { other(all: readonly [number, number], some: number): number };
    expect(withPrivateAccess.other([1, 10], 2)).toBe(10);
    expect(withPrivateAccess.other([1, 10], 9)).toBe(1);
  });
});
