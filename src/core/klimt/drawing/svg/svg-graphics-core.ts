/**
 * svg-graphics-core.ts — SvgGraphics's document-lifecycle layer: the
 * options shape, low-level number formatting, fill/stroke state, and
 * gradient-def registration needed by the constructor itself.
 *
 * Upstream: klimt/drawing/svg/SvgGraphics.java (1,267 ln) + its
 * companion net.atmp.SvgOption (222 ln) + style/LengthAdjust.java (a
 * 3-value enum) + the nested enum `HColor.TransparentFillBehavior`.
 * SvgGraphics.java exceeds this repo's 500-line file cap (D2′), so it is
 * split along its own method groups, chained by inheritance and
 * re-exported as a single `SvgGraphics` class from `svg-graphics.ts`.
 * Ended up four files, not the 2–3 estimated in the mission brief —
 * reported per D2′, since the document-lifecycle slice alone (this
 * file) needed a further split once the shadow/filter-def methods were
 * counted:
 *
 * 1. `svg-graphics-core.ts` (this file) — `SvgGraphicsCore`: fields,
 *    constructor/document setup, `format`/`fillMe`/`styleMe`/fill-stroke
 *    state, gradient-def registration (the constructor's backcolor-
 *    gradient branch needs it), finalize/serialize.
 * 2. `svg-graphics-shadow.ts` — `SvgGraphicsShadow extends
 *    SvgGraphicsCore`: shadow filters and back-color filters
 *    (`manageShadow`, `addFilterShadowId`, `getFilterBackColor`) — used
 *    only by shape-drawing methods, never by the constructor.
 * 3. `svg-graphics-elements.ts` — `SvgGraphicsElements extends
 *    SvgGraphicsShadow`: the shape-drawing methods (`svgEllipse`,
 *    `svgRectangle`, `svgLine`, `svgPolygon`, `text`, `svgPath`, plus the
 *    legacy `newpath`/`moveto`/…/`fill` path-builder API).
 * 4. `svg-graphics.ts` — `SvgGraphics extends SvgGraphicsElements`:
 *    group/link management, comments, and the D3′ stubs (`openLink`,
 *    `closeLink`, `svgImage`, `addCommentMetadata`).
 *
 * `createRectangleInternal` lives here rather than alongside `svgRectangle`
 * (upstream's own placement) because the constructor's `paintBackcolor`
 * needs it and a base class cannot call a subclass-only method —
 * deliberate deviation from upstream's exact grouping, reported per D2′.
 *
 * `SvgOption` (upstream: `net.atmp.SvgOption`, a fluent builder wired to
 * `ConfigurationStore<OptionKey>`, `Display` and `ColorMapper`/`HColor`,
 * none of which are ported) is adapted to a plain readonly data shape
 * carrying only the fields `SvgGraphics.java` actually reads —
 * `option.getFont()` appears solely inside a commented-out line there,
 * and `getLinkTarget()` is never read at all, so both are dropped.
 * `backcolor` is `Paint | undefined` per this klimt port's
 * Paint-for-HColor seam (`src/core/paint.ts`), which also removes the
 * need for `ColorMapper`.
 *
 * D4′ preamble conformance: upstream's constructor writes
 * `Version.versionString()` into the `<?plantuml ...?>` PI via a static
 * call. This port takes `version` as an explicit constructor param
 * instead — the cached jar fixtures this port conforms against
 * (`test-results/dot-cache/component/*\/in.svg`) all contain the literal
 * token `$version$`, not a real version string, so tests pass that token
 * through rather than the port inventing version resolution.
 */

import { XmlDocument } from './xml-writer.js';
import type { XmlNode } from './xml-writer.js';
import type { Paint } from '../../../paint.js';
import type { Dimension2D } from '../../shape/UEllipse.js';

/** Upstream: `style/LengthAdjust.java` (a 3-value enum), ported as an
 * as-const object — too small for its own file. */
export const LengthAdjust = {
  NONE: 'NONE',
  SPACING: 'SPACING',
  SPACING_AND_GLYPHS: 'SPACING_AND_GLYPHS',
} as const;
export type LengthAdjust = (typeof LengthAdjust)[keyof typeof LengthAdjust];

/** Upstream: the nested enum `HColor.TransparentFillBehavior`. */
export const TransparentFillBehavior = {
  WITH_FILL_NONE: 'WITH_FILL_NONE',
  WITH_FILL_OPACITY: 'WITH_FILL_OPACITY',
} as const;
export type TransparentFillBehavior = (typeof TransparentFillBehavior)[keyof typeof TransparentFillBehavior];

/** See the module doc comment above for the `net.atmp.SvgOption` adaptation. */
export interface SvgOption {
  readonly lengthAdjust: LengthAdjust;
  readonly preserveAspectRatio: string;
  readonly hover: string | null;
  readonly svgDimensionStyle: boolean;
  readonly minDim: Dimension2D;
  readonly backcolor: Paint | undefined;
  readonly scale: number;
  readonly rootAttributes: ReadonlyMap<string, string>;
  readonly title: string | null;
  readonly desc: string | null;
  readonly interactiveBaseFilename: string | null;
}

/** Upstream: `SvgOption.basic()` — a `SvgOption` with upstream's
 * documented defaults, overridable per field. */
export function basicSvgOption(overrides: Partial<SvgOption> = {}): SvgOption {
  return {
    lengthAdjust: LengthAdjust.SPACING,
    preserveAspectRatio: 'none',
    hover: null,
    svgDimensionStyle: true,
    minDim: { width: 0, height: 0 },
    backcolor: undefined,
    scale: 1.0,
    rootAttributes: new Map(),
    title: null,
    desc: null,
    interactiveBaseFilename: null,
    ...overrides,
  };
}

// Upstream: SvgGraphics.java's private static getSeed(long). Long.toString
// (x, 36) becomes Math.abs(seed).toString(36) — an accepted range
// reduction to a JS `number` (a Java `long` is 64-bit; seeds passed here
// are small hashed values well within Number.MAX_SAFE_INTEGER, so no
// BigInt is introduced without a demonstrated need).
function getSeed(seed: number): string {
  return Math.abs(seed).toString(36);
}

// Shared by format(): trims the trailing zeros (and the decimal point
// itself, if nothing follows it) off a %.4f-formatted numeric string.
// Upstream: the shared tail of SvgGraphics#format's body.
function trimTrailingZeros(s: string): string {
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length - 1;
  while (end > dot && s[end] === '0') end--;
  if (end === dot) end--;
  return s.slice(0, end + 1);
}

// Upstream: the if/else-if chain inside createSvgGradient(color1, color2,
// policy) selecting the gradient vector. Factored out to keep
// createSvgGradient's own CCN low.
function gradientVector(policy: string): { x1: string; y1: string; x2: string; y2: string } {
  if (policy === '|') return { x1: '0%', y1: '50%', x2: '100%', y2: '50%' };
  if (policy === '\\') return { x1: '0%', y1: '100%', x2: '100%', y2: '0%' };
  if (policy === '-') return { x1: '50%', y1: '0%', x2: '50%', y2: '100%' };
  return { x1: '0%', y1: '0%', x2: '100%', y2: '100%' };
}

/**
 * SvgGraphicsCore — see the module doc comment above.
 *
 * NOT ported (out of scope for the whole class, reported once here):
 * the second `createSvgGradient(HColorLinearGradient, ColorMapper)`
 * overload, `buildLinearGradientKey`, `formatPercent`, `formatOpacity` —
 * all four exist solely to support multi-stop linear gradients read off
 * `HColorLinearGradient`, a type this klimt port's Paint-for-HColor seam
 * has no representation for (`Paint`'s `Gradient` is 2-stop-only,
 * matching the *other*, ported, overload exactly). `fillMe`'s own
 * opacity formatting uses a literal `toFixed(5)` (`%1.5f`) directly —
 * that call site never went through `formatOpacity` upstream either.
 */
export class SvgGraphicsCore {
  protected readonly document: XmlDocument;
  protected readonly root: XmlNode;
  protected readonly defs: XmlNode;
  protected readonly gRoot: XmlNode;

  // Named `fillColor`, not upstream's `fill` — TS (unlike Java) has one
  // namespace for fields and methods per class, and the legacy
  // path-builder method `fill(windingRule)` (svg-graphics-elements.ts)
  // needs the name `fill`.
  protected fillColor = 'black';
  protected stroke = 'black';
  protected strokeWidth: string;
  protected strokeDasharray: string | null = null;
  protected readonly backcolorString: string | null;

  private maxX = 10;
  private maxY = 10;

  protected readonly filterUid: string;
  protected readonly shadowId: string;
  protected readonly gradientId: string;

  protected readonly option: SvgOption;

  private pendingBackground: XmlNode | null = null;
  private robotoAdded = false;

  private readonly gradients = new Map<string, string>();

  protected hidden = false;
  protected readonly images = new Map<string, string>();
  protected readonly pendingElements: XmlNode[] = [];

  constructor(seed: number, option: SvgOption, version: string) {
    this.document = new XmlDocument();
    this.option = option;
    this.ensureVisible(option.minDim.width, option.minDim.height);

    this.root = this.getRootNode(version);
    for (const [key, value] of option.rootAttributes) this.root.setAttribute(key, value);

    // Create a node named defs, which will be the parent for a pair of
    // linear gradient definitions.
    this.defs = this.simpleElement('defs');
    this.gRoot = this.simpleElement('g');
    this.strokeWidth = this.format(1);
    this.filterUid = 'b' + getSeed(seed);
    this.shadowId = 'f' + getSeed(seed);
    this.gradientId = 'g' + getSeed(seed);

    if (option.hover !== null) this.defs.appendChild(this.getPathHover(option.hover));
    this.setupInteractiveMode();
    this.backcolorString = this.setupBackcolor();
  }

  private setupInteractiveMode(): void {
    if (this.option.interactiveBaseFilename === null) return;
    const styles = this.getStylesForInteractiveMode();
    if (styles !== null) this.defs.appendChild(styles);
    const script = this.getScriptForInteractiveMode();
    if (script !== null) this.defs.appendChild(script);
  }

  private setupBackcolor(): string | null {
    const backcolor = this.option.backcolor;
    if (backcolor === undefined) return null;
    if (typeof backcolor !== 'string') {
      const id = this.createSvgGradient(backcolor.color1, backcolor.color2, backcolor.policy);
      this.paintBackcolor(`url(#${id})`);
      return null;
    }
    if (backcolor !== '#00000000' && backcolor !== '#000000' && backcolor !== '#FFFFFF') {
      this.paintBackcolor(backcolor);
    }
    return backcolor;
  }

  protected ensureVisible(x: number, y: number): void {
    if (x > this.maxX) this.maxX = Math.trunc(x) + 1;
    if (y > this.maxY) this.maxY = Math.trunc(y) + 1;
  }

  /** Upstream: `addRoboto()`. `protected`, not `private`, since `text()`
   * (`svg-graphics-elements.ts`) calls it for `fontFamily === 'roboto'`. */
  protected addRoboto(): void {
    if (this.robotoAdded) return;
    // https://stackoverflow.com/questions/36253961/using-google-fonts-with-svg-object
    const style = this.document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setTextContent(
      "@import url('https://fonts.googleapis.com/css?family=Roboto:400,100,100italic,300,300italic,400italic,500,500italic,700,700italic,900,900italic');",
    );
    this.defs.appendChild(style);
    this.robotoAdded = true;
  }

  private paintBackcolor(back: string): void {
    this.setFillColor(back);
    this.setStrokeColor(null);
    this.pendingBackground = this.createRectangleInternal(0, 0, 0, 0);
    this.getG().appendChild(this.pendingBackground);
  }

  /**
   * Upstream loads `/svg/<baseFilename>.css`/`.js` classpath resources
   * for interactive-mode styling/scripting. This port has no embedded
   * resource bundle, so both always return `null` — matching upstream's
   * own "resource missing" branch (`Log.error`, return `null`), which is
   * what happens today for every diagram since `interactiveBaseFilename`
   * is `null` unless a caller sets it. Not a D3′ stub (no throw):
   * interactive mode stays a faithful no-op, not an error.
   */
  private getStylesForInteractiveMode(): XmlNode | null {
    return null;
  }

  private getScriptForInteractiveMode(): XmlNode | null {
    return null;
  }

  private getPathHover(hover: string): XmlNode {
    const style = this.document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.appendCData(`path:hover { stroke: ${hover} !important;}`);
    return style;
  }

  // Returns a reference to a simple XML element node with no attributes.
  private simpleElement(type: string): XmlNode {
    const element = this.document.createElement(type);
    this.root.appendChild(element);
    return element;
  }

  // Returns a reference to a root node already set as the document root.
  private getRootNode(version: string): XmlNode {
    const svg = this.document.createElement('svg');
    this.document.setRoot(svg);

    // Add PlantUML version as processing instruction inside svg element
    // (placed as first child of <svg> for Confluence compatibility)
    // https://github.com/plantuml/plantuml/issues/2583
    svg.appendProcessingInstruction('plantuml', version);

    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svg.setAttribute('version', '1.1');

    if (this.option.title !== null) {
      const title = this.document.createElement('title');
      title.setTextContent(this.option.title);
      svg.appendChild(title);
    }

    if (this.option.desc !== null) {
      const descElement = this.document.createElement('desc');
      descElement.setTextContent(this.option.desc);
      svg.appendChild(descElement);
    }
    return svg;
  }

  /** Upstream: `createRectangleInternal` — see the module doc comment
   * above for why it lives here rather than alongside `svgRectangle`. */
  protected createRectangleInternal(x: number, y: number, width: number, height: number): XmlNode {
    const elt = this.document.createElement('rect');
    elt.setAttribute('x', this.format(x));
    elt.setAttribute('y', this.format(y));
    elt.setAttribute('width', this.format(width));
    elt.setAttribute('height', this.format(height));
    this.fillMe(elt);
    this.styleMe(elt, null);
    return elt;
  }

  protected styleMe(elt: XmlNode, suppStyle: string | null): void {
    if (this.strokeWidth === '0') return;

    let style = `stroke:${this.stroke};stroke-width:${this.strokeWidth};`;
    if (this.strokeDasharray !== null) style += `stroke-dasharray:${this.strokeDasharray};`;
    if (suppStyle !== null) style += suppStyle;
    elt.setAttribute('style', style);
  }

  protected fillMe(elt: XmlNode): void {
    const alpha = /^#[0-9A-Fa-f]{8}$/.exec(this.fillColor);
    if (alpha !== null) {
      elt.setAttribute('fill', this.fillColor.slice(0, 7));
      const opacity = parseInt(this.fillColor.slice(7), 16) / 255;
      elt.setAttribute('fill-opacity', opacity.toFixed(5));
    } else {
      elt.setAttribute('fill', this.fillColor);
    }
  }

  private fixColor(color: string | null): string {
    return color === null || color === '#00000000' ? 'none' : color;
  }

  setFillColor(
    fill: string | null,
    transparentFillBehaviour: TransparentFillBehavior = TransparentFillBehavior.WITH_FILL_NONE,
  ): void {
    if (transparentFillBehaviour === TransparentFillBehavior.WITH_FILL_OPACITY) {
      // Upstream assigns `fill` as-is here, bypassing fixColor's
      // null/"#00000000"->"none" translation, for callers preserving an
      // alpha-carrying color value verbatim. `fixColor(null)` covers the
      // null case with the same output fixColor would produce, without
      // inventing new behavior.
      this.fillColor = fill ?? this.fixColor(null);
      return;
    }
    this.fillColor = this.fixColor(fill);
  }

  setStrokeColor(stroke: string | null): void {
    this.stroke = this.fixColor(stroke);
  }

  setStrokeWidth(strokeWidth: number, strokeDasharray: readonly [number, number] | null): void {
    this.strokeWidth = this.format(strokeWidth);
    this.strokeDasharray =
      strokeDasharray === null ? null : `${this.format(strokeDasharray[0])},${this.format(strokeDasharray[1])}`;
  }

  getG(): XmlNode {
    if (this.pendingElements.length === 0) return this.gRoot;
    return this.pendingElements[0]!;
  }

  /**
   * Gradient id policy (D2′, ported verbatim): a per-document
   * seed/counter scheme, NOT the content-hash scheme
   * `src/core/paint.ts#paintToSvg` uses. `gradientId`
   * (`"g" + base36(abs(seed))`) is fixed per instance; each *distinct*
   * `(color1, color2, policy)` triple registered gets the next integer
   * suffix in registration order (`gradientId + gradients.size`); repeat
   * registrations of an already-seen triple return the previously
   * assigned id — the same de-dup upstream's `Map<List<Object>, String>`
   * provides, using a space-joined string key here in place of a
   * `List<Object>` key.
   */
  createSvgGradient(color1: string, color2: string, policy: string): string {
    const key = `${color1} ${color2} ${policy}`;
    const existing = this.gradients.get(key);
    if (existing !== undefined) return existing;

    const elt = this.document.createElement('linearGradient');
    const vector = gradientVector(policy);
    elt.setAttribute('x1', vector.x1);
    elt.setAttribute('y1', vector.y1);
    elt.setAttribute('x2', vector.x2);
    elt.setAttribute('y2', vector.y2);

    const id = this.gradientId + this.gradients.size;
    this.gradients.set(key, id);
    elt.setAttribute('id', id);

    const stop1 = this.document.createElement('stop');
    stop1.setAttribute('stop-color', color1);
    stop1.setAttribute('offset', '0%');
    const stop2 = this.document.createElement('stop');
    stop2.setAttribute('stop-color', color2);
    stop2.setAttribute('offset', '100%');

    elt.appendChild(stop1);
    elt.appendChild(stop2);
    this.defs.appendChild(elt);
    return id;
  }

  /**
   * format — THE number-formatting rule this port's conformance target
   * (D4′) hinges on. Upstream: `%.4f` (`Locale.US`), trailing zeros
   * stripped, and the decimal point itself dropped too if nothing is
   * left after it (`10.5` stays `"10.5"`; `10.0` becomes `"10"`).
   * Verified against `test-results/dot-cache/component/sacuso-94-gugi476/
   * in.svg`, e.g. `y="95.3489"` and `width="85.15"`. `x === 0`
   * short-circuits to `"0"` before formatting (true for `-0` too, in
   * both Java and JS).
   */
  protected format(xx: number): string {
    const x = xx * this.option.scale;
    if (x === 0) return '0';
    return trimTrailingZeros(x.toFixed(4));
  }

  protected formatBoolean(x: number): string {
    return x === 0 ? '0' : '1';
  }

  private finalizeRootAttributes(): void {
    const maxXscaled = Math.trunc(this.maxX * this.option.scale);
    const maxYscaled = Math.trunc(this.maxY * this.option.scale);
    let style = `width:${maxXscaled}px;height:${maxYscaled}px;`;

    if (this.backcolorString !== null && this.backcolorString !== '#00000000') {
      style += `background:${this.backcolorString};`;
    }

    if (this.option.svgDimensionStyle) {
      this.root.setAttribute('style', style);
      this.root.setAttribute('width', `${this.format(this.maxX)}px`);
      this.root.setAttribute('height', `${this.format(this.maxY)}px`);
    }
    this.root.setAttribute('viewBox', `0 0 ${maxXscaled} ${maxYscaled}`);
    this.root.setAttribute('zoomAndPan', 'magnify');
    this.root.setAttribute('preserveAspectRatio', this.option.preserveAspectRatio);
    this.root.setAttribute('contentStyleType', 'text/css');

    if (this.pendingBackground !== null) {
      this.pendingBackground.setAttribute('width', this.format(this.maxX));
      this.pendingBackground.setAttribute('height', this.format(this.maxY));
    }
  }

  /**
   * Upstream: `createXml(OutputStream)`. Returns the completed SVG
   * document as a `string` (this project's renderer is pure-string, no
   * DOM/async/canvas). The `images` substitution loop is a guaranteed
   * no-op today — `svgImage` is a D3′ throwing stub (`svg-graphics.ts`)
   * — kept for structural fidelity until a future task un-stubs it.
   */
  createXml(): string {
    this.finalizeRootAttributes();
    let s = this.document.toXml(0);
    for (const [key, value] of this.images) {
      /* v8 ignore next -- unreachable: `images` is never populated while
       * svgImage is a D3' throwing stub (svg-graphics.ts) */
      s = s.split(`<${key}/>`).join(value);
    }
    return s;
  }

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }
}
