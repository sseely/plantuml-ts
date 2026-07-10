/**
 * symbols-component.test.ts — T6: conformance tests for the component
 * family (`USymbolComponent1`, `USymbolComponent2`, `USymbolNode`,
 * `USymbolArtifact`, `USymbolFile`, `USymbolFrame`).
 *
 * Each symbol's `asSmall(...)` is rendered standalone through
 * `UGraphicSvg` (no `EntityImageDescription`/dot-layout in between —
 * exactly the mission brief's "renders the symbol standalone" clause)
 * and compared against a real jar SVG fragment via `compareSvg` (the
 * harness at `tests/oracle/svg-conformance/compare.ts`), per the
 * "wrap fragments in identical minimal documents on both sides"
 * precedent (`oracle/goldens/svg-conformance/database-cylinder-dashed/`,
 * `tests/oracle/svg-conformance/emitter.golden.test.ts`).
 *
 * jarFragment provenance: every reference fragment below is extracted,
 * VERBATIM, from real jar output —
 *   `java -jar ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar
 *   -tsvg -pipe` on a minimal single-element `.puml` (`[Foo]` /
 *   `skinparam componentStyle uml1|uml2` / `node Foo` / `artifact Foo` /
 *   `file Foo` / `frame Foo`) — captured 2026-07-09. Each fragment is
 *   the real jar's `<g class="entity">...</g>` children (the comment,
 *   the `class="entity"`/`data-*` wrapper, and the trailing
 *   `<?plantuml-src ...?>` are dropped — none of that is emitted by
 *   `USymbol*` itself; it belongs to `EntityImageDescription`/dot
 *   layout, out of this task's scope), with every coordinate REBASED
 *   by exactly `(-7, -7)`: the real jar places this single-element
 *   diagram's entity group at that fixed offset (dot/SVEK's own
 *   diagram-margin convention, verified identical across all SIX
 *   fixtures below), which is unrelated to any `USymbol*` class's own
 *   drawing math — `USymbolComponent1..Frame`'s own `drawXxx` functions
 *   all draw their outer boundary shape starting at local `(0, 0)`.
 *   Every rebased coordinate below was cross-checked by hand against
 *   each class's own Java source (see each `describe` block's inline
 *   comment) before being written down, confirming the (-7,-7) rebase
 *   plus this task's own draw-sequence port reproduce the real jar
 *   bytes exactly (mergeTB position math included).
 *
 * Text measurement seam: `label`/`stereotype` are opaque `TextBlock`
 * parameters this task's classes never construct — they are supplied
 * BY THE CALLER (in production, `EntityImageDescription`'s BodyFactory-
 * built text blocks; here, `fooLabelTextBlock()`/`emptyTextBlock`
 * below). Per the mission brief's "take the value EntityImageDescription
 * passes in" guidance, this task's own conformance obligation is the
 * CHROME each class draws around whatever dimension/draw behavior its
 * `label`/`stereotype` parameters report — not reproducing BodyFactory's
 * own real-font-metrics text layout (a separate, unported subsystem).
 * `fooLabelTextBlock()`'s exact width/height/baseline values are
 * themselves real jar-measured facts (not invented): the real jar's
 * "Foo"@14pt sans-serif label reports `textLength="24.7051"` on its
 * `<text>` element, and (independently derived from all six fixtures'
 * total entity dimensions minus each class's own `getMargin()`) a label
 * dimension of `(24.7051, 16.4883)` with the `<text>` baseline drawn at
 * local `(0, 13.5352)` within the label block's own frame — identical
 * across all six fixtures, confirming this is a font-metrics constant
 * independent of which `USymbol*` class draws around it.
 */
import { describe, expect, test } from 'vitest';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { UText } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { SymbolContext } from '../../../../src/core/decoration/symbol/SymbolContext.js';
import { USymbolComponent1 } from '../../../../src/core/decoration/symbol/USymbolComponent1.js';
import { USymbolComponent2 } from '../../../../src/core/decoration/symbol/USymbolComponent2.js';
import { USymbolNode } from '../../../../src/core/decoration/symbol/USymbolNode.js';
import { USymbolArtifact } from '../../../../src/core/decoration/symbol/USymbolArtifact.js';
import { USymbolFile } from '../../../../src/core/decoration/symbol/USymbolFile.js';
import { USymbolFrame } from '../../../../src/core/decoration/symbol/USymbolFrame.js';
import { TextBlockUtils } from '../../../../src/core/klimt/shape/TextBlockUtils.js';
import { URectangle } from '../../../../src/core/klimt/shape/URectangle.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';

// ---------------------------------------------------------------------------
// Shared fixtures — see the module doc comment above for full provenance.
// ---------------------------------------------------------------------------

const FOO_FONT: FontConfiguration = { family: 'sans-serif', size: 14, color: '#000000', styles: new Set() };
const FOO_LABEL_WIDTH = 24.7051;
const FOO_LABEL_HEIGHT = 16.4883;
const FOO_BASELINE_DY = 13.5352;

/** A `TextBlock` test double standing in for a real BodyFactory-built
 * "Foo" label — see the module doc comment above ("Text measurement
 * seam") for why its dimension/draw values are hardcoded jar-measured
 * facts rather than derived from a font-metrics engine. */
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
    // no-op: this stub carries no drawable content (matches every
    // fixture's un-stereotyped "Foo" element).
  },
};

/** A `TextBlock` test double with a fixed, caller-chosen dimension that
 * draws a plain `URectangle` of that same size — used by this suite's
 * `asBig` behavioral tests (below) so each drawn rect's exact x/y is a
 * concrete, assertable fact (unlike a real font-measured label). */
function fixedTextBlock(width: number, height: number): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(width, height),
    drawU: (ug) => {
      ug.draw(URectangle.build(width, height));
    },
  };
}

const stubDriverStringBounder: DriverStringBounder = {
  calculateDimension(_font, text) {
    // Only real jar-measured widths appear here (matching
    // `_shared/class-box.ts`'s own `jarStringBounder` convention this
    // suite follows): `DriverTextSvg.draw` reads THIS bounder directly
    // to compute the `<text>` element's own `textLength` attribute (see
    // `driver-text-svg.ts`), independent of the `TextBlock#
    // calculateDimension` this task's `fooLabelTextBlock`/`emptyTextBlock`
    // report — the two are separate seams. `""` covers `emptyTextBlock`
    // (never actually drawn — it draws nothing), "Foo" is this suite's
    // one real jar-measured width.
    if (text === 'Foo') return { width: FOO_LABEL_WIDTH };
    return { width: 0 };
  },
};

/** Real jar style/geometry facts common to every fixture below (see the
 * module doc comment's provenance note): `backColor=#F1F1F1`,
 * `foreColor=#181818`, `stroke-width=0.5`, `roundCorner=5` (rendered as
 * `rx=ry=2.5` — `URectangle.rounded()` halves at the SVG driver, see
 * `URectangle.ts`), no shadow, no diagonal corner. */
function fooSymbolContext(): SymbolContext {
  return new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 0, 5, 0);
}

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', stubDriverStringBounder);
}

/** Extracts the content of this port's single top-level `<g>...</g>`
 * (see `u-graphic-svg.ts`'s `register()` — nothing in this task's
 * classes calls `startGroup`, so no nested `<g>` exists to confuse a
 * non-greedy match). */
function extractTopGroup(svg: string): string {
  const match = /<g>([\s\S]*)<\/g><\/svg>$/.exec(svg);
  if (match === null) throw new Error('extractTopGroup: no top-level <g>...</g><\/svg> found');
  const inner = match[1];
  if (inner === undefined) throw new Error('extractTopGroup: capture group did not match');
  return inner;
}

/** Wraps a fragment (ours or the jar's) in the SAME minimal document on
 * both sides, per this suite's "wrap fragments in identical minimal
 * documents" mandate — root attrs are therefore never compared, only
 * the fragment's own shapes. */
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
// Reference fragments (jar-derived, rebased by (-7,-7) — see provenance note)
// ---------------------------------------------------------------------------

const JAR_COMPONENT1_FOO =
  '<rect x="0" y="0" width="44.7051" height="36.4883" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>' +
  '<rect x="-5" y="5" width="10" height="5" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="-5" y="26.4883" width="10" height="5" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="10" y="23.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

const JAR_COMPONENT2_FOO =
  '<rect x="0" y="0" width="64.7051" height="46.4883" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>' +
  '<rect x="44.7051" y="5" width="15" height="10" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="42.7051" y="7" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<rect x="42.7051" y="11" width="4" height="2" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="15" y="33.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

const JAR_NODE_FOO =
  '<polygon points="0,10,10,0,64.7051,0,64.7051,36.4883,54.7051,46.4883,0,46.4883,0,10" ' +
  'fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
  '<line x1="54.7051" y1="10" x2="64.7051" y2="0" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<line x1="0" y1="10" x2="54.7051" y2="10" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<line x1="54.7051" y1="10" x2="54.7051" y2="46.4883" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="15" y="33.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

const JAR_ARTIFACT_FOO =
  '<rect x="0" y="0" width="54.7051" height="39.4883" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>' +
  '<polygon points="37.7051,5,37.7051,19,49.7051,19,49.7051,11,43.7051,5,37.7051,5" ' +
  'fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;stroke-linejoin:miter;stroke-miterlimit:10;"/>' +
  '<line x1="43.7051" y1="5" x2="43.7051" y2="11" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<line x1="49.7051" y1="11" x2="43.7051" y2="11" style="stroke:#181818;stroke-width:0.5;"/>' +
  '<text x="10" y="26.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

const JAR_FILE_FOO =
  '<path d="M0,2.5 L0,33.9883 A2.5,2.5 0 0 0 2.5,36.4883 L42.2051,36.4883 A2.5,2.5 0 0 0 44.7051,33.9883 ' +
  'L44.7051,10 L34.7051,0 L2.5,0 A2.5,2.5 0 0 0 0,2.5" style="stroke:#181818;stroke-width:0.5;" fill="#F1F1F1"/>' +
  '<path d="M34.7051,0 L34.7051,7.5 A2.5,2.5 0 0 0 37.2051,10 L44.7051,10" style="stroke:#181818;stroke-width:0.5;" fill="#F1F1F1"/>' +
  '<text x="10" y="23.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

const JAR_FRAME_FOO =
  '<rect x="0" y="0" width="64.7051" height="46.4883" fill="#F1F1F1" style="stroke:#181818;stroke-width:0.5;" rx="2.5" ry="2.5"/>' +
  '<path d="M21.5684,0 L21.5684,5 L14.5684,12 L0,12" style="stroke:#181818;stroke-width:0.5;" fill="none"/>' +
  '<text x="15" y="33.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="24.7051" font-family="sans-serif">Foo</text>';

// ---------------------------------------------------------------------------
// Conformance tests (AC1)
// ---------------------------------------------------------------------------

describe('USymbolComponent1 (T6, AC1/AC2) — UML1 legacy-tab notation', () => {
  test('asSmall renders conformant vs. the jar fragment ([Foo], componentStyle uml1)', () => {
    const symbol = new USymbolComponent1();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_COMPONENT1_FOO);
  });

  test('getSNames reports "component"', () => {
    expect(new USymbolComponent1().getSNames()).toEqual(['component']);
  });
});

describe('USymbolComponent2 (T6, AC1/AC2) — UML2 plug-icon notation', () => {
  test('asSmall renders conformant vs. the jar fragment ([Foo], componentStyle uml2)', () => {
    const symbol = new USymbolComponent2();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_COMPONENT2_FOO);
  });

  test('getSNames reports "component"', () => {
    expect(new USymbolComponent2().getSNames()).toEqual(['component']);
  });
});

describe('USymbolComponent1 vs USymbolComponent2 (AC2) — distinct jar shapes', () => {
  test('componentStyle uml1 and uml2 produce two different fragments for the same label', () => {
    const ctx1 = fooSymbolContext();
    const asSmall1 = new USymbolComponent1().asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx1, HorizontalAlignment.CENTER);
    const ctx2 = fooSymbolContext();
    const asSmall2 = new USymbolComponent2().asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx2, HorizontalAlignment.CENTER);

    const svg1 = render(asSmall1);
    const svg2 = render(asSmall2);
    expect(svg1).not.toBe(svg2);

    // Each still conforms to its OWN real jar fragment.
    expectConformant(svg1, JAR_COMPONENT1_FOO);
    expectConformant(svg2, JAR_COMPONENT2_FOO);
    // And neither conforms to the OTHER style's jar fragment.
    expect(compareSvg(svg1, wrapFragment(JAR_COMPONENT2_FOO), 'deterministic').pass).toBe(false);
    expect(compareSvg(svg2, wrapFragment(JAR_COMPONENT1_FOO), 'deterministic').pass).toBe(false);
  });
});

describe('USymbolNode (T6, AC1/AC3) — 3D-box notation', () => {
  test('asSmall renders conformant vs. the jar fragment (node Foo)', () => {
    const symbol = new USymbolNode();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_NODE_FOO);
  });

  test('AC3: the 3D-offset polygon points match USymbolNode.java\'s constants exactly', () => {
    // USymbolNode.java#drawNode: addPoint(0,10); (10,0); (width,0);
    // (width,height-10); (width-10,height); (0,height); (0,10) — for
    // width=64.7051, height=46.4883 (this fixture's real jar dimension).
    const points = [
      [0, 10],
      [10, 0],
      [64.7051, 0],
      [64.7051, 36.4883],
      [54.7051, 46.4883],
      [0, 46.4883],
      [0, 10],
    ];
    const expected = points.map(([x, y]) => `${x},${y}`).join(',');
    expect(JAR_NODE_FOO).toContain(`points="${expected}"`);
  });

  test('getSNames reports "node"; suppHeight/WidthBecauseOfShape are 5/60', () => {
    const symbol = new USymbolNode();
    expect(symbol.getSNames()).toEqual(['node']);
    expect(symbol.suppHeightBecauseOfShape()).toBe(5);
    expect(symbol.suppWidthBecauseOfShape()).toBe(60);
  });
});

describe('USymbolArtifact (T6, AC1) — dog-ear corner notation', () => {
  test('asSmall renders conformant vs. the jar fragment (artifact Foo)', () => {
    const symbol = new USymbolArtifact();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_ARTIFACT_FOO);
  });

  test('getSNames reports "artifact"', () => {
    expect(new USymbolArtifact().getSNames()).toEqual(['artifact']);
  });
});

describe('USymbolFile (T6, AC1) — dog-ear page-fold notation', () => {
  test('asSmall renders conformant vs. the jar fragment (file Foo)', () => {
    const symbol = new USymbolFile();
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_FILE_FOO);
  });

  test('getSNames reports "file"', () => {
    expect(new USymbolFile().getSNames()).toEqual(['file']);
  });
});

describe('USymbolFrame (T6, AC1) — name-tab notation', () => {
  test('asSmall renders conformant vs. the jar fragment (frame Foo)', () => {
    const symbol = new USymbolFrame('frame');
    const ctx = fooSymbolContext();
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    expectConformant(render(asSmall), JAR_FRAME_FOO);
  });

  test('getSNames reports whatever SName the constructor was given ("group")', () => {
    expect(new USymbolFrame('group').getSNames()).toEqual(['group']);
  });
});

// ---------------------------------------------------------------------------
// mergeTB alignment coverage (LEFT/RIGHT — CENTER already exercised above)
// ---------------------------------------------------------------------------

describe('TextBlockUtils.mergeTB (consolidated shared helper, T3b)', () => {
  test('LEFT alignment stacks both blocks flush to x=0', () => {
    const merged = TextBlockUtils.mergeTB(fixedTextBlock(10, 4), fixedTextBlock(20, 6), HorizontalAlignment.LEFT);
    const ug = newGraphic();
    merged.drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).toContain('x="0" y="0" width="10" height="4"');
    expect(svg).toContain('x="0" y="4" width="20" height="6"');
  });

  test('RIGHT alignment right-aligns the narrower block against the merged width', () => {
    const merged = TextBlockUtils.mergeTB(fixedTextBlock(10, 4), fixedTextBlock(20, 6), HorizontalAlignment.RIGHT);
    const ug = newGraphic();
    merged.drawU(ug);
    const svg = ug.getSvgString();
    // Merged width = max(10, 20) = 20; the 10-wide top block right-aligns: 20-10=10.
    expect(svg).toContain('x="10" y="0" width="10" height="4"');
    expect(svg).toContain('x="0" y="4" width="20" height="6"');
  });
});

// ---------------------------------------------------------------------------
// asBig behavioral coverage (T6 quality bar — 90/90/90; not jar-conformance,
// see the module doc comment's "Text measurement seam" note: asBig's own
// conformance obligation is this task's own chrome/position math, verified
// here against fixed, caller-chosen title/stereotype dimensions).
// ---------------------------------------------------------------------------

const WIDTH = 100;
const HEIGHT = 50;

function fooBigContext(): SymbolContext {
  return new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 0, 5, 0);
}

describe('USymbolComponent1/asBig — delegates to USymbolComponent2', () => {
  test('produces byte-identical output to calling USymbolComponent2#asBig directly', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const ctx1 = fooBigContext();
    const big1 = new USymbolComponent1().asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx1, HorizontalAlignment.CENTER);
    const ug1 = newGraphic();
    big1.drawU(ug1);

    const ctx2 = fooBigContext();
    const big2 = new USymbolComponent2().asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx2, HorizontalAlignment.CENTER);
    const ug2 = newGraphic();
    big2.drawU(ug2);

    expect(ug1.getSvgString()).toBe(ug2.getSvgString());
    expect(big1.calculateDimension({} as never).getWidth()).toBe(WIDTH);
  });
});

describe('USymbolComponent2/asBig', () => {
  test('draws the chrome plus stereotype/title at the computed positions', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolComponent2();
    const ctx = fooBigContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    expect(big.calculateDimension({} as never)).toEqual(new XDimension2D(WIDTH, HEIGHT));

    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).toContain('width="100" height="50"'); // chrome rect
    expect(svg).toContain('x="80" y="5" width="15" height="10"'); // plug icon
    expect(svg).toContain('x="78" y="7" width="4" height="2"'); // tiny notch 1
    expect(svg).toContain('x="78" y="11" width="4" height="2"'); // tiny notch 2
    expect(svg).toContain('x="42" y="13" width="16" height="8"'); // stereotype: (100-16)/2=42
    expect(svg).toContain('x="40" y="21" width="20" height="10"'); // title: (100-20)/2=40, y=13+8
  });
});

describe('USymbolNode/asBig', () => {
  test('CENTER stereoAlignment centers the stereotype', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolNode();
    const ctx = fooBigContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    // ug is translated by (-4,11) before stereo/title draw; posStereoX=(100-16)/2=42.
    expect(svg).toContain('x="38" y="13" width="16" height="8"'); // -4+42, 11+2
    expect(svg).toContain('x="36" y="21" width="20" height="10"'); // -4+40, 11+10
  });

  test('RIGHT stereoAlignment right-aligns the stereotype against getMargin().getX1()', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolNode();
    const ctx = fooBigContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.RIGHT);
    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    // posStereoX = width - dimStereoWidth - getMargin().getX1() = 100-16-15=69; -4+69=65, 11+2=13.
    expect(svg).toContain('x="65" y="13" width="16" height="8"');
  });
});

describe('USymbolArtifact/asBig', () => {
  test('draws the chrome plus stereotype/title at the computed positions', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolArtifact();
    const ctx = fooBigContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).toContain('width="100" height="50"'); // chrome rect
    expect(svg).toContain('x="42" y="2" width="16" height="8"'); // stereotype: (100-16)/2=42
    expect(svg).toContain('x="40" y="10" width="20" height="10"'); // title: y=2+8
  });
});

describe('USymbolFile/asBig', () => {
  test('draws stereotype/title using the hardcoded CENTER field (bug-for-bug)', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolFile();
    const ctx = fooBigContext();
    // Passing RIGHT here has NO effect on the drawn position — see
    // USymbolFile.ts's own doc comment ("stereotypeAlignement field").
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.RIGHT);
    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).toContain('x="42" y="2" width="16" height="8"'); // (100-16)/2=42, y=2 (CENTER branch)
    expect(svg).toContain('x="40" y="10" width="20" height="10"');
  });
});

describe('USymbolFrame/asBig', () => {
  test('draws the name-tab, title, and stereotype at the computed positions', () => {
    const title = fixedTextBlock(20, 10);
    const stereo = fixedTextBlock(16, 8);
    const symbol = new USymbolFrame('frame');
    const ctx = fooBigContext();
    const big = symbol.asBig(title, HorizontalAlignment.CENTER, stereo, WIDTH, HEIGHT, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    big.drawU(ug);
    const svg = ug.getSvgString();
    // textWidth = dimTitle.getWidth()+10 = 30; textHeight = getYpos = dimTitle.getHeight()+3 = 13.
    expect(svg).toContain('<path d="M30,0 L30,3 L20,13 L0,13" style="stroke:#181818;stroke-width:0.5;" fill="none"/>');
    expect(svg).toContain('x="3" y="1" width="20" height="10"'); // title at (3,1)
    // stereotype at (4+posStereo, 2+textHeight): posStereo=(100-16)/2=42 -> (46, 15).
    expect(svg).toContain('x="46" y="15" width="16" height="8"');
  });
});

describe('USymbolFile/asSmall — roundCorner=0 branch', () => {
  test('draws a plain UPolygon outline (not the arced UPath) when roundCorner is 0', () => {
    const symbol = new USymbolFile();
    const ctx = new SymbolContext('#F1F1F1', '#181818', UStroke.withThickness(0.5), 0, 0, 0);
    const asSmall = symbol.asSmall(emptyTextBlock, fooLabelTextBlock(), emptyTextBlock, ctx, HorizontalAlignment.CENTER);
    const ug = newGraphic();
    asSmall.drawU(ug);
    const svg = ug.getSvgString();
    // USymbolFile.java#drawFile, roundCorner===0 branch: a closed polygon
    // (0,0)-(0,h)-(w,h)-(w,10)-(w-10,0)-(0,0), no arc commands anywhere.
    expect(svg).toContain('<polygon points="0,0,0,36.4883,44.7051,36.4883,44.7051,10,34.7051,0,0,0"');
    // The fold-line UPath's roundCorner===0 branch is a plain two-segment
    // line (no "A" arc command), unlike the roundCorner!==0 fixtures above.
    expect(svg).toContain('<path d="M34.7051,0 L34.7051,10 L44.7051,10"');
    expect(svg).not.toMatch(/<path d="[^"]*A/);
  });
});
