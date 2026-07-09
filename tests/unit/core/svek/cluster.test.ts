/**
 * cluster.test.ts — T12: conformance + unit tests for the DRAWING half of
 * `Cluster.java` (svek/Cluster.ts, svek/ClusterDecoration.ts,
 * svek/PackageStyle.ts).
 *
 * Conformance fixtures (AC1/AC2) follow the same "wrap fragments in
 * identical minimal documents, compare via `compareSvg`" pattern as
 * `tests/unit/core/decoration/symbols-component.test.ts` — see that
 * file's module doc comment for the full rationale (`extractTopGroup`/
 * `wrapFragment` reused verbatim as local helpers here, per that file's
 * own one-helper-per-suite convention rather than a shared test-helpers
 * module).
 *
 * jarFragment provenance (AC1 — `<g class="cluster">` conformance):
 * `test-results/dot-cache/component/xagino-11-vazo768/in.svg`, a cached
 * real jar SVG (`java -jar plantuml-1.2026.7beta3.jar -tsvg`) for:
 *   skinparam package { BackgroundColor blue; BorderColor red;
 *     BorderThickness 4; FontColor green; FontSize 40 }
 *   package "Configuration files" { [foo] }
 * Its `<!--cluster Configuration files--><g class="cluster" ...>...</g>`
 * subtree is reproduced verbatim below (the `<!--entity foo-->` sibling
 * and trailing `<?plantuml-src?>` belong to the CHILD entity/whole-
 * diagram wrapper, out of this task's scope — same "drop what isn't this
 * task's own subtree" convention `symbols-component.test.ts` documents).
 *
 * jarFragment provenance (AC2 — dashed-border variant): no cached fixture
 * in `test-results/dot-cache` uses a dashed CONTAINER border (`##
 * [dashed]` only appears on class-diagram entities there); generated
 * directly from the same jar per the task's "jar-generated (provenance
 * in comment)" allowance —
 *   `java -jar ~/git/plantuml/build/libs/plantuml-1.2026.7beta3.jar
 *   -tsvg -pipe` on:
 *     package "Configuration files" #line:blue;line.dashed { [foo] }
 *   captured 2026-07-09. `#line:blue;line.dashed` is `Cluster.java`'s
 *   `Colors#getColor(LINE)`/`getSpecificLineStroke()` override path
 *   (`resolveBorderColor`/`getStrokeInternal` below) — a legitimate
 *   upstream syntax distinct from the class-diagram-only `##[dashed]`
 *   shorthand (confirmed by direct jar probing: `##[dashed]` on a
 *   `package` declaration is a parse error; `#line.dashed` is not).
 *
 * Every rebased/derived geometric fact below (rectangle position/width/
 * height, `dimTitle`, arc radii, baseline offsets) was hand-derived from
 * the real jar SVG's own path/text coordinates — see the inline comments
 * at each fixture for the arithmetic. The 14pt-font baseline offset
 * (13.5352) and label height (16.4883) used by the AC2 fixture
 * independently match `symbols-component.test.ts`'s own real-jar-
 * measured `FOO_BASELINE_DY`/`FOO_LABEL_HEIGHT` constants exactly,
 * cross-validating both fixtures' provenance.
 */
import { describe, expect, test, vi } from 'vitest';
import type { TextBlock } from '../../../../src/core/klimt/shape/TextBlock.js';
import type { UGraphic } from '../../../../src/core/klimt/UGraphic.js';
import type { UChange } from '../../../../src/core/klimt/UChange.js';
import type { UParam } from '../../../../src/core/klimt/UParam.js';
import { XDimension2D } from '../../../../src/core/klimt/geom/XDimension2D.js';
import { HorizontalAlignment } from '../../../../src/core/klimt/geom/HorizontalAlignment.js';
import { UTranslate } from '../../../../src/core/klimt/UTranslate.js';
import { UStroke } from '../../../../src/core/klimt/UStroke.js';
import { UText, FontStyle } from '../../../../src/core/klimt/shape/UText.js';
import type { FontConfiguration } from '../../../../src/core/klimt/shape/UText.js';
import { USymbol } from '../../../../src/core/decoration/symbol/USymbol.js';
import type { SymbolContext } from '../../../../src/core/decoration/symbol/SymbolContext.js';
import { UGraphicSvg } from '../../../../src/core/klimt/drawing/svg/u-graphic-svg.js';
import { basicSvgOption } from '../../../../src/core/klimt/drawing/svg/svg-graphics.js';
import type { StringBounder as DriverStringBounder } from '../../../../src/core/klimt/drawing/svg/driver-text-svg.js';
import { compareSvg } from '../../../oracle/svg-conformance/compare.js';
import {
  Cluster,
  resolveBorderColor,
  resolveRoundCorner,
  resolveBackColor,
  getStrokeInternal,
  type ClusterGroupInfo,
  type ClusterHeaderInfo,
  type ClusterStyleDefaults,
  type ClusterSymbolInfo,
} from '../../../../src/core/svek/Cluster.js';
import type { ClusterGeometry } from '../../../../src/core/svek/ClusterDecoration.js';
import { ClusterDecoration } from '../../../../src/core/svek/ClusterDecoration.js';
import { PackageStyle, packageStyleToUSymbol } from '../../../../src/core/svek/PackageStyle.js';
import { USymbolNode } from '../../../../src/core/decoration/symbol/USymbolNode.js';
import { USymbolCard } from '../../../../src/core/decoration/symbol/USymbolCard.js';
import { USymbolDatabase } from '../../../../src/core/decoration/symbol/USymbolDatabase.js';
import { USymbolCloud } from '../../../../src/core/decoration/symbol/USymbolCloud.js';
import { USymbolFrame } from '../../../../src/core/decoration/symbol/USymbolFrame.js';
import { USymbolRectangle } from '../../../../src/core/decoration/symbol/USymbolRectangle.js';
import { USymbolFolder } from '../../../../src/core/decoration/symbol/USymbolFolder.js';

// ---------------------------------------------------------------------------
// Shared harness (mirrors symbols-component.test.ts's own local helpers)
// ---------------------------------------------------------------------------

const emptyTextBlock: TextBlock = {
  calculateDimension: () => new XDimension2D(0, 0),
  drawU: () => {
    // no-op stub — every fixture below has no stereotype.
  },
};

/** A title `TextBlock` test double that draws real `UText` output, exactly
 * matching the "Text measurement seam" convention `symbols-component
 * .test.ts` documents: this task's classes never construct text — the
 * caller (BodyFactory-equivalent) supplies the finished `TextBlock`. */
function titleTextBlock(text: string, width: number, height: number, baselineDy: number, font: FontConfiguration): TextBlock {
  return {
    calculateDimension: () => new XDimension2D(width, height),
    drawU: (ug) => {
      ug.apply(new UTranslate(0, baselineDy)).draw(UText.build(text, font));
    },
  };
}

const driverStringBounder: DriverStringBounder = {
  calculateDimension(font, text) {
    if (text === 'Configuration files' && font.size === 40) return { width: 309.25 };
    if (text === 'Configuration files' && font.size === 14) return { width: 135.4951 };
    return { width: 0 };
  },
};

function newGraphic(): UGraphicSvg {
  return UGraphicSvg.build(0, basicSvgOption(), '$version$', driverStringBounder);
}

/** See `symbols-component.test.ts`'s identical helper: extracts this
 * port's single top-level `<g>...</g>` — Cluster's own nested `<g
 * class="cluster">` group does not confuse the greedy match, since only
 * the OUTER wrapper's opening tag is the bare, attribute-less `<g>`. */
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

/** A minimal `UGraphic` with NO `startGroup`/`closeGroup` — proves
 * `Cluster`'s local `requireGroups` throws instead of silently skipping
 * the group wrap (mirrors `decorate-entity.test.ts`'s identical
 * `GrouplessUGraphic` double for `DecorateEntityImage`'s own
 * `requireGroups`). */
class GrouplessUGraphic implements UGraphic {
  constructor(private readonly translate: UTranslate = UTranslate.none()) {}

  apply(change: UChange): UGraphic {
    if (change instanceof UTranslate) return new GrouplessUGraphic(this.translate.compose(change));
    return this;
  }

  draw(): void {
    // no-op: this double only needs to satisfy the UGraphic surface.
  }

  getParam(): UParam {
    throw new Error('GrouplessUGraphic: getParam not exercised by these tests');
  }

  getTranslate(): UTranslate {
    return this.translate;
  }

  getStringBounder(): never {
    throw new Error('GrouplessUGraphic: getStringBounder not exercised by these tests');
  }
}

function render(cluster: Cluster): string {
  const ug = newGraphic();
  cluster.drawU(ug);
  return wrapFragment(extractTopGroup(ug.getSvgString()));
}

function expectConformant(ours: string, jarFragment: string): void {
  const { pass, diffs } = compareSvg(ours, wrapFragment(jarFragment), 'deterministic');
  expect(pass, `first diff: ${JSON.stringify(diffs[0])}`).toBe(true);
}

// ---------------------------------------------------------------------------
// AC1 — package container conformance (solid border, explicit colors)
// ---------------------------------------------------------------------------

describe('Cluster (T12, AC1) — package container, real jar fragment', () => {
  test('drawU renders conformant vs. the jar cluster subtree', () => {
    // Real jar facts (xagino-11-vazo768): rectangleArea position (6,
    // 11.3889), width=325, height=119; dimTitle=(309.25, 40) — derived
    // from the jar path's own arc/line coordinates (see module doc
    // comment). skinparam package overrides: BackgroundColor blue
    // (#0000FF), BorderColor red (#FF0000), BorderThickness 4, FontColor
    // green (#008000), FontSize 40.
    const group: ClusterGroupInfo = {
      hidden: false,
      name: 'Configuration files',
      uid: 'ent0001',
      qualifiedName: 'Configuration files',
      location: { position: 9 },
      isRoot: false,
      lineColorOverride: '#FF0000',
      backColorOverride: '#0000FF',
      specificLineStroke: new UStroke(0, 0, 4),
    };
    const header: ClusterHeaderInfo = {
      title: titleTextBlock('Configuration files', 309.25, 40, 31.1111, {
        family: 'sans-serif',
        size: 40,
        color: '#008000',
        styles: new Set([FontStyle.BOLD]),
      }),
      stereo: emptyTextBlock,
      titleHorizontalAlignment: HorizontalAlignment.CENTER,
    };
    const geometry: ClusterGeometry = { position: new UTranslate(6, 11.3889), width: 325, height: 119 };
    const style: ClusterStyleDefaults = {
      shadowing: 0,
      roundCorner: 5,
      strictUmlStyle: false,
      diagonalCorner: 0,
      lineColorDefault: '#181818',
      backGroundColorDefault: null,
      strokeDefault: UStroke.simple(),
    };
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: null,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };

    const cluster = new Cluster(group, header, geometry, style, symbolInfo);
    const svg = render(cluster);

    const JAR_CLUSTER_FRAGMENT =
      '<g class="cluster" data-qualified-name="Configuration files" id="ent0001" data-source-line="9">' +
      '<path d="M8.5,11.3889 L318.75,11.3889 A3.75,3.75 0 0 1 321.25,13.8889 L328.25,57.3889 L328.5,57.3889 ' +
      'A2.5,2.5 0 0 1 331,59.8889 L331,127.8889 A2.5,2.5 0 0 1 328.5,130.3889 L8.5,130.3889 A2.5,2.5 0 0 1 6,127.8889 ' +
      'L6,13.8889 A2.5,2.5 0 0 1 8.5,11.3889" style="stroke:#FF0000;stroke-width:4;" fill="#0000FF"/>' +
      '<line x1="6" y1="57.3889" x2="328.25" y2="57.3889" style="stroke:#FF0000;stroke-width:4;"/>' +
      '<text x="10" y="44.5" fill="#008000" font-size="40" lengthAdjust="spacing" textLength="309.25" ' +
      'font-weight="700" font-family="sans-serif">Configuration files</text>' +
      '</g>';

    expectConformant(svg, JAR_CLUSTER_FRAGMENT);
  });

  test('drawU emits the "<!--cluster X-->" comment before the group', () => {
    const group: ClusterGroupInfo = {
      hidden: false,
      name: 'Configuration files',
      uid: 'ent0001',
      qualifiedName: 'Configuration files',
      location: null,
      isRoot: false,
      lineColorOverride: '#FF0000',
      backColorOverride: '#0000FF',
      specificLineStroke: new UStroke(0, 0, 4),
    };
    const header: ClusterHeaderInfo = {
      title: emptyTextBlock,
      stereo: emptyTextBlock,
      titleHorizontalAlignment: HorizontalAlignment.CENTER,
    };
    const geometry: ClusterGeometry = { position: new UTranslate(6, 11.3889), width: 325, height: 119 };
    const style: ClusterStyleDefaults = {
      shadowing: 0,
      roundCorner: 0,
      strictUmlStyle: false,
      diagonalCorner: 0,
      lineColorDefault: '#181818',
      backGroundColorDefault: null,
      strokeDefault: UStroke.simple(),
    };
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: PackageStyle.RECTANGLE,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };
    const ug = newGraphic();
    new Cluster(group, header, geometry, style, symbolInfo).drawU(ug);
    expect(ug.getSvgString()).toContain('<!--cluster Configuration files-->');
  });
});

// ---------------------------------------------------------------------------
// AC2 — dashed border variant (jar-generated fragment, see module doc comment)
// ---------------------------------------------------------------------------

describe('Cluster (T12, AC2) — dashed-border container variant', () => {
  test('drawU reproduces the jar\'s stroke-dasharray emission', () => {
    // Real jar facts (jar-generated, `#line:blue;line.dashed`, see module
    // doc comment): rectangleArea position (6,6), width=151, height=97.49;
    // dimTitle=(135.4951, 16.4883) — the standard 14pt default font
    // metrics, cross-validated against symbols-component.test.ts's own
    // FOO_LABEL_HEIGHT/FOO_BASELINE_DY constants.
    const group: ClusterGroupInfo = {
      hidden: false,
      name: 'Configuration files',
      uid: 'ent0001',
      qualifiedName: 'Configuration files',
      location: { position: 1 },
      isRoot: false,
      lineColorOverride: '#0000FF',
      backColorOverride: null,
      specificLineStroke: new UStroke(7, 7, 1),
    };
    const header: ClusterHeaderInfo = {
      title: titleTextBlock('Configuration files', 135.4951, 16.4883, 13.5352, {
        family: 'sans-serif',
        size: 14,
        color: '#000000',
        styles: new Set([FontStyle.BOLD]),
      }),
      stereo: emptyTextBlock,
      titleHorizontalAlignment: HorizontalAlignment.CENTER,
    };
    const geometry: ClusterGeometry = { position: new UTranslate(6, 6), width: 151, height: 97.49 };
    const style: ClusterStyleDefaults = {
      shadowing: 0,
      roundCorner: 5,
      strictUmlStyle: false,
      diagonalCorner: 0,
      lineColorDefault: '#181818',
      backGroundColorDefault: null,
      strokeDefault: UStroke.simple(),
    };
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: null,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };

    const cluster = new Cluster(group, header, geometry, style, symbolInfo);
    const svg = render(cluster);

    const JAR_DASHED_FRAGMENT =
      '<g class="cluster" data-qualified-name="Configuration files" id="ent0001" data-source-line="1">' +
      '<path d="M8.5,6 L144.9951,6 A3.75,3.75 0 0 1 147.4951,8.5 L154.4951,28.4883 L154.5,28.4883 ' +
      'A2.5,2.5 0 0 1 157,30.9883 L157,100.99 A2.5,2.5 0 0 1 154.5,103.49 L8.5,103.49 A2.5,2.5 0 0 1 6,100.99 ' +
      'L6,8.5 A2.5,2.5 0 0 1 8.5,6" style="stroke:#0000FF;stroke-width:1;stroke-dasharray:7,7;" fill="none"/>' +
      '<line x1="6" y1="28.4883" x2="154.4951" y2="28.4883" style="stroke:#0000FF;stroke-width:1;stroke-dasharray:7,7;"/>' +
      '<text x="10" y="21.5352" fill="#000000" font-size="14" lengthAdjust="spacing" textLength="135.4951" ' +
      'font-weight="700" font-family="sans-serif">Configuration files</text>' +
      '</g>';

    expectConformant(svg, JAR_DASHED_FRAGMENT);
  });
});

// ---------------------------------------------------------------------------
// Behavioral coverage — hidden guard, "##"-prefix, defensive catch
// ---------------------------------------------------------------------------

describe('Cluster/drawU — behavioral branches', () => {
  const geometry: ClusterGeometry = { position: UTranslate.none(), width: 10, height: 10 };
  const style: ClusterStyleDefaults = {
    shadowing: 0,
    roundCorner: 0,
    strictUmlStyle: false,
    diagonalCorner: 0,
    lineColorDefault: '#181818',
    backGroundColorDefault: null,
    strokeDefault: UStroke.simple(),
  };
  const header: ClusterHeaderInfo = {
    title: emptyTextBlock,
    stereo: emptyTextBlock,
    titleHorizontalAlignment: HorizontalAlignment.CENTER,
  };

  test('hidden group draws nothing at all', () => {
    const group: ClusterGroupInfo = {
      hidden: true,
      name: 'Hidden',
      uid: 'ent0001',
      qualifiedName: 'Hidden',
      location: null,
      isRoot: false,
      lineColorOverride: null,
      backColorOverride: null,
      specificLineStroke: null,
    };
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: PackageStyle.RECTANGLE,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };
    const ug = newGraphic();
    new Cluster(group, header, geometry, style, symbolInfo).drawU(ug);
    expect(ug.getSvgString()).not.toContain('cluster');
  });

  test('a UGraphic without startGroup/closeGroup support throws (requireGroups guard)', () => {
    const group: ClusterGroupInfo = {
      hidden: false,
      name: 'Foo',
      uid: 'ent0001',
      qualifiedName: 'Foo',
      location: null,
      isRoot: false,
      lineColorOverride: null,
      backColorOverride: null,
      specificLineStroke: null,
    };
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: PackageStyle.RECTANGLE,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };
    const cluster = new Cluster(group, header, geometry, style, symbolInfo);
    expect(() => cluster.drawU(new GrouplessUGraphic())).toThrow(/does not support startGroup\/closeGroup/);
  });

    test('a "##"-prefixed name suppresses the comment but still draws the group', () => {
    const group: ClusterGroupInfo = {
      hidden: false,
      name: '##synthetic',
      uid: 'ent0002',
      qualifiedName: '##synthetic',
      location: null,
      isRoot: false,
      lineColorOverride: null,
      backColorOverride: null,
      specificLineStroke: null,
    };
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: PackageStyle.RECTANGLE,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };
    const ug = newGraphic();
    new Cluster(group, header, geometry, style, symbolInfo).drawU(ug);
    const svg = ug.getSvgString();
    expect(svg).not.toContain('<!--cluster');
    expect(svg).toContain('class="cluster"');
  });

  test('an unresolvable USymbol (no explicit symbol, no toUSymbol() mapping) is caught and logged, not left to crash the render', () => {
    const group: ClusterGroupInfo = {
      hidden: false,
      name: 'Broken',
      uid: 'ent0003',
      qualifiedName: 'Broken',
      location: null,
      isRoot: false,
      lineColorOverride: null,
      backColorOverride: null,
      specificLineStroke: null,
    };
    // PackageStyle.AGENT maps to no USymbol (packageStyleToUSymbol
    // returns null) and no explicit symbol is set — ClusterDecoration's
    // getTextBlock throws (upstream: UnsupportedOperationException)
    // before anything is drawn inside the group.
    const symbolInfo: ClusterSymbolInfo = {
      symbol: null,
      packageStyle: PackageStyle.AGENT,
      defaultPackageStyle: PackageStyle.FOLDER,
      stereoAlignment: HorizontalAlignment.CENTER,
    };
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ug = newGraphic();
    expect(() => new Cluster(group, header, geometry, style, symbolInfo).drawU(ug)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    // Upstream's own `closeTopPendingElement` (SvgGraphics.java, ported
    // verbatim in `svg-graphics.ts`) discards a pending `<g>` with no
    // drawn children rather than emitting an empty group — since nothing
    // was drawn before the mid-draw failure, the group never materializes.
    // The important behavior under test is: render did not crash, and
    // the failure was logged, not silently swallowed.
    expect(ug.getSvgString()).not.toContain('class="cluster"');
    consoleErrorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Pure-function unit coverage
// ---------------------------------------------------------------------------

describe('resolveBorderColor', () => {
  test('an explicit override wins over the style default', () => {
    expect(resolveBorderColor('#FF0000', '#181818')).toBe('#FF0000');
  });

  test('falls back to the style default when there is no override', () => {
    expect(resolveBorderColor(null, '#181818')).toBe('#181818');
  });
});

describe('resolveRoundCorner', () => {
  test('strictUmlStyle forces 0 regardless of the style value', () => {
    expect(resolveRoundCorner(25, true)).toBe(0);
  });

  test('passes the style value through when not strict', () => {
    expect(resolveRoundCorner(5, false)).toBe(5);
  });
});

describe('getStrokeInternal', () => {
  test('a specific line stroke override wins', () => {
    const override = new UStroke(2, 2, 3);
    expect(getStrokeInternal(override, UStroke.simple())).toBe(override);
  });

  test('falls back to the style stroke when there is no override', () => {
    const styleStroke = UStroke.withThickness(2);
    expect(getStrokeInternal(null, styleStroke)).toBe(styleStroke);
  });
});

describe('resolveBackColor', () => {
  test('a root group never paints a background', () => {
    expect(resolveBackColor(true, '#0000FF', '#00FF00')).toBe('none');
  });

  test('an explicit override wins over the style default', () => {
    expect(resolveBackColor(false, '#0000FF', '#00FF00')).toBe('#0000FF');
  });

  test('falls back to the style default when there is no override', () => {
    expect(resolveBackColor(false, null, '#00FF00')).toBe('#00FF00');
  });

  test('both null resolves to "none"', () => {
    expect(resolveBackColor(false, null, null)).toBe('none');
  });

  test('an explicit "none" override still resolves to "none" (isTransparentPaint branch)', () => {
    expect(resolveBackColor(false, 'none', '#00FF00')).toBe('none');
  });

  test('a "#00000000" style default resolves to "none"', () => {
    expect(resolveBackColor(false, null, '#00000000')).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// PackageStyle.toUSymbol() mapping
// ---------------------------------------------------------------------------

describe('packageStyleToUSymbol', () => {
  test.each([
    [PackageStyle.NODE, USymbolNode, 'node'],
    [PackageStyle.CARD, USymbolCard, 'card'],
    [PackageStyle.DATABASE, USymbolDatabase, 'database'],
    [PackageStyle.CLOUD, USymbolCloud, 'cloud'],
    [PackageStyle.FRAME, USymbolFrame, 'frame'],
    [PackageStyle.RECTANGLE, USymbolRectangle, 'rectangle'],
    [PackageStyle.FOLDER, USymbolFolder, 'package'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test.each's tuple typing can't express a per-row constructor union; `any` is confined to this table.
  ] as any[])('%s maps to %s (SName %s)', (style: string, ctor: new () => USymbol, sname: string) => {
    const symbol = packageStyleToUSymbol(style as never);
    expect(symbol).toBeInstanceOf(ctor);
    expect(symbol?.getSNames()).toEqual([sname]);
  });

  test.each([PackageStyle.AGENT, PackageStyle.STORAGE, PackageStyle.COMPONENT1, PackageStyle.COMPONENT2, PackageStyle.ARTIFACT])(
    '%s maps to null (no USymbol fallback, matches upstream)',
    (style) => {
      expect(packageStyleToUSymbol(style)).toBeNull();
    },
  );
});

// ---------------------------------------------------------------------------
// ClusterDecoration — isolated unit coverage (guess() branches, throw path)
// ---------------------------------------------------------------------------

class RecordingUSymbol extends USymbol {
  lastCall: { width: number; height: number; symbolContext: SymbolContext } | null = null;

  getSNames(): readonly string[] {
    return ['recording'];
  }

  asSmall(): TextBlock {
    return emptyTextBlock;
  }

  asBig(
    title: TextBlock,
    _labelAlignment: HorizontalAlignment,
    _stereo: TextBlock,
    width: number,
    height: number,
    symbolContext: SymbolContext,
  ): TextBlock {
    this.lastCall = { width, height, symbolContext };
    return {
      calculateDimension: () => new XDimension2D(width, height),
      drawU: (ug: UGraphic) => title.drawU(ug),
    };
  }
}

describe('ClusterDecoration', () => {
  test('an explicit symbol wins over a packageStyle fallback', () => {
    const symbol = new RecordingUSymbol();
    const decoration = new ClusterDecoration(
      PackageStyle.RECTANGLE,
      symbol,
      emptyTextBlock,
      emptyTextBlock,
      { position: UTranslate.none(), width: 40, height: 20 },
      UStroke.simple(),
    );
    const ug = newGraphic();
    decoration.drawU(ug, '#FF0000', '#00FF00', 2, 3, HorizontalAlignment.CENTER, HorizontalAlignment.LEFT, 1);

    expect(symbol.lastCall?.width).toBe(40);
    expect(symbol.lastCall?.height).toBe(20);
    expect(symbol.lastCall?.symbolContext.getDeltaShadow()).toBe(2);
    expect(symbol.lastCall?.symbolContext.getRoundCorner()).toBe(3);
    expect(symbol.lastCall?.symbolContext.getDiagonalCorner()).toBe(1);
    expect(symbol.lastCall?.symbolContext.getBackColor()).toBe('#FF0000');
    expect(symbol.lastCall?.symbolContext.getForeColor()).toBe('#00FF00');
  });

  test('no explicit symbol falls back to the packageStyle mapping', () => {
    const decoration = new ClusterDecoration(
      PackageStyle.NODE,
      null,
      emptyTextBlock,
      emptyTextBlock,
      { position: UTranslate.none(), width: 10, height: 10 },
      UStroke.simple(),
    );
    const tb = decoration.getTextBlock(null, null, 0, 0, HorizontalAlignment.CENTER, HorizontalAlignment.CENTER, 0);
    expect(tb.calculateDimension({} as never)).toEqual(new XDimension2D(10, 10));
  });

  test('no symbol and no packageStyle throws (upstream: UnsupportedOperationException)', () => {
    const decoration = new ClusterDecoration(
      null,
      null,
      emptyTextBlock,
      emptyTextBlock,
      { position: UTranslate.none(), width: 10, height: 10 },
      UStroke.simple(),
    );
    expect(() => decoration.getTextBlock(null, null, 0, 0, HorizontalAlignment.CENTER, HorizontalAlignment.CENTER, 0)).toThrow(
      /no USymbol resolved/,
    );
  });

  test('a packageStyle with no toUSymbol() mapping (e.g. AGENT) also throws', () => {
    const decoration = new ClusterDecoration(
      PackageStyle.AGENT,
      null,
      emptyTextBlock,
      emptyTextBlock,
      { position: UTranslate.none(), width: 10, height: 10 },
      UStroke.simple(),
    );
    expect(() => decoration.getTextBlock(null, null, 0, 0, HorizontalAlignment.CENTER, HorizontalAlignment.CENTER, 0)).toThrow(
      /no USymbol resolved/,
    );
  });
});
