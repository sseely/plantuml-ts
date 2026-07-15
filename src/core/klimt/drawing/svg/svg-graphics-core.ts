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
 *    ctor/document setup, format/fill/style state, gradient-def
 *    registration, finalize/serialize.
 * 2. `svg-graphics-shadow.ts` — `SvgGraphicsShadow`: shadow filters,
 *    back-color filters (shape-drawing methods only).
 * 3. `svg-graphics-elements.ts` — `SvgGraphicsElements`: shape-drawing
 *    methods (`svgEllipse`/`svgRectangle`/.../`svgPath`) + legacy
 *    `newpath`/`moveto`/.../`fill` path-builder API.
 * 4. `svg-graphics.ts` — `SvgGraphics`: group/link mgmt, comments, D3′
 *    stubs (`openLink`, `closeLink`, `svgImage`, `addCommentMetadata`).
 *
 * `createRectangleInternal` lives here (not alongside `svgRectangle`,
 * upstream's placement) since ctor's `paintBackcolor` needs it and a
 * base class can't call a subclass-only method (D2′ deviation).
 *
 * `SvgOption` (upstream: `net.atmp.SvgOption`, a fluent builder over
 * `ConfigurationStore`/`ColorMapper`/`HColor`, none ported) is a plain
 * readonly shape with only the fields `SvgGraphics.java` reads —
 * `getFont()`/`getLinkTarget()` dropped (unread or dead upstream).
 * `backcolor` is `Paint | undefined` (this port's Paint-for-HColor seam,
 * `src/core/paint.ts`), removing the need for `ColorMapper`.
 *
 * D4′ preamble conformance: upstream's ctor writes
 * `Version.versionString()` into the `<?plantuml ...?>` PI statically;
 * this port takes `version` as an explicit ctor param instead — cached
 * jar fixtures (`test-results/dot-cache/component/*\/in.svg`) all
 * contain the literal token `$version$`, so tests pass that through.
 *
 * D8 (locked, seed as bigint): upstream seed = `UmlSource.seed()`, a
 * Java `long` (~19 digits, outside `Number.MAX_SAFE_INTEGER`). `getSeed`/
 * ctor take `bigint | number` (widened; existing `number` call sites
 * still work via `BigInt(seed)`). Base-36 matches `Long.toString(Math
 * .abs(seed), 36)` incl. `Long.MIN_VALUE` overflow (see `LONG_MIN_VALUE`).
 * `seedOf` ports `UmlSource.seed()` itself (core/UmlSource.java, NOT
 * `StringUtils.seed(String)`): folds each line's Java `String.hashCode()`
 * + `'\n'` into a 64-bit accumulator seeded `1125899906842597`, via
 * `BigInt.asIntN` overflow. `source` = block lines `\n`-joined, no
 * trailing newline. Jar-verified, see `svg-graphics.test.ts`.
 */

import { XmlDocument } from './xml-writer.js';
import type { XmlNode } from './xml-writer.js';
import type { Paint } from '../../../paint.js';
import { isTransparentColor } from '../../../paint.js';
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

const LONG_MIN_VALUE = -(2n ** 63n); // Math.abs overflows to itself (D8)

// Widens a `number` seed to `bigint` (D8) — exact for small literals.
function toSeedBigInt(seed: bigint | number): bigint {
  return typeof seed === 'bigint' ? seed : BigInt(seed);
}

// Upstream: SvgGraphics.java's getSeed(long) (D8, see above).
function getSeed(seed: bigint | number): string {
  const s = toSeedBigInt(seed);
  const abs = s === LONG_MIN_VALUE ? LONG_MIN_VALUE : s < 0n ? -s : s;
  return abs.toString(36);
}

// Java String.hashCode() folded with 32-bit overflow (D8, see above).
function javaStringHashCode(s: string): bigint {
  let h = 0n;
  for (let i = 0; i < s.length; i++) {
    h = BigInt.asIntN(32, h * 31n + BigInt(s.charCodeAt(i)));
  }
  return h;
}

// Upstream: UmlSource.seed() (core/UmlSource.java), NOT
// StringUtils.seed(String) — a different algorithm (D8, see above).
const UML_SOURCE_SEED_INITIAL = 1125899906842597n;
const NEWLINE_CODE_POINT = 10n;

export function seedOf(source: string): bigint {
  let h = UML_SOURCE_SEED_INITIAL;
  for (const line of source.split('\n')) {
    h = BigInt.asIntN(64, h * 31n + javaStringHashCode(line));
    h = BigInt.asIntN(64, h * 31n + NEWLINE_CODE_POINT);
  }
  return h;
}

// Shared by format(): renders `%.4f` (Locale.US, HALF_UP) the way Java's
// `java.util.Formatter` does it — HALF_UP rounding applied to the value's
// SHORTEST ROUND-TRIP DECIMAL STRING, not to its exact IEEE754 binary
// value. Java's Formatter builds its decimal digits via
// `FloatingDecimal`/`FormattedFloatingDecimal` (the same "shortest string
// that reads back to this double" algorithm `Double.toString` uses), then
// rounds THAT digit string HALF_UP. JS's `Number.prototype.toFixed`
// instead rounds the double's true (long, often non-terminating) binary
// expansion — for a value whose shortest decimal sits exactly on a
// rounding boundary at the 4th place (e.g. 8.69375, whose real double is
// 8.6937499999999996447...), `toFixed(4)` rounds DOWN ("8.6937") while
// Java's `%.4f` rounds UP ("8.6938"): the last-decimal-digit divergence
// jar-verified against `component/luniju-97-tuja870`'s `text/@textLength`
// (mission G1/I4). `Number.prototype.toString()` already implements the
// same "shortest round-trip decimal" class of algorithm `Double.toString`
// does (both are correctly-rounded shortest-digit-string conversions), so
// reusing it here — rather than re-deriving digits from the binary
// mantissa — reproduces Java's rounding INPUT faithfully without a second
// bespoke float-to-decimal implementation.
function javaFixed4(x: number): string {
  const neg = x < 0;
  const shortest = Math.abs(x).toString();
  // `toString()` only switches to exponential notation for |x| >= 1e21 or
  // 0 < |x| < 1e-6 -- SVG pixel geometry never reaches either extreme (nor
  // does the jar's own %.4f range), so a plain decimal-notation string is
  // assumed below.
  /* v8 ignore next 3 -- unreachable for SVG geometry, see comment above */
  if (shortest.includes('e')) {
    return Math.abs(x).toFixed(4);
  }
  const dot = shortest.indexOf('.');
  const intPart = dot < 0 ? shortest : shortest.slice(0, dot);
  const fracPart = dot < 0 ? '' : shortest.slice(dot + 1);
  // Pad to (at least) 5 fractional digits so there is always a digit to
  // make the HALF_UP round/no-round decision on.
  const padded = (fracPart + '00000').slice(0, Math.max(5, fracPart.length));
  const keep = padded.slice(0, 4);
  const roundUp = padded.charCodeAt(4) - 48 >= 5;
  let digits = intPart + keep; // decimal point implicitly 4 digits from the right
  if (roundUp) digits = (BigInt(digits) + 1n).toString();
  const fracOut = digits.slice(-4);
  const intOut = digits.length > 4 ? digits.slice(0, digits.length - 4) : '0';
  return (neg ? '-' : '') + intOut + '.' + fracOut;
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
 * NOT ported (whole class, reported once): the second
 * `createSvgGradient(HColorLinearGradient, ColorMapper)` overload,
 * `buildLinearGradientKey`, `formatPercent`, `formatOpacity` — all four
 * support multi-stop gradients off `HColorLinearGradient`, unrepresented
 * in this port's 2-stop-only `Paint` `Gradient`. `fillMe`'s opacity
 * formatting uses a literal `toFixed(5)`, bypassing `formatOpacity` too.
 */
export class SvgGraphicsCore {
  protected readonly document: XmlDocument;
  protected readonly root: XmlNode;
  protected readonly defs: XmlNode;
  protected readonly gRoot: XmlNode;

  // Named `fillColor`, not upstream's `fill` — TS has one namespace for
  // fields/methods per class, and legacy `fill(windingRule)` needs `fill`.
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

  constructor(seed: bigint | number, option: SvgOption, version: string) {
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
    // G1 I5d: `HColor#toSvg` collapses ANY transparent color (named
    // `transparent`, or an explicit zero-alpha hex) to the canonical
    // `"#00000000"` BEFORE this comparison runs (`HColor.java:74-76`,
    // `SvgGraphics.java:179-183`) -- so upstream's `!color.equals
    // ("#00000000")` guard already covers every transparent spelling, not
    // just the one literal string. This port carried `backcolor` as a raw,
    // unconverted string, so a `skinparam BackgroundColor transparent`
    // value (`'transparent'`, never normalized to `'#00000000'`) slipped
    // past the old strict-equality check and drew a spurious background
    // `<rect>` the jar never emits.
    const canonical = isTransparentColor(backcolor) ? '#00000000' : backcolor;
    if (canonical !== '#00000000' && canonical !== '#000000' && canonical !== '#FFFFFF') {
      this.paintBackcolor(canonical);
    }
    return canonical;
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
   * Upstream loads `/svg/<baseFilename>.css`/`.js` classpath resources;
   * this port has no bundle, so both return `null` (matches upstream's
   * own resource-missing branch). Not a D3′ stub — a faithful no-op.
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

  // Returns a ref to a simple XML element node with no attributes.
  private simpleElement(type: string): XmlNode {
    const element = this.document.createElement(type);
    this.root.appendChild(element);
    return element;
  }

  // Returns a ref to a root node already set as the document root.
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
      // Upstream assigns `fill` as-is (bypassing fixColor's translation)
      // for alpha-preserving callers; `fixColor(null)` covers null.
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
   * Gradient id policy (D2′): per-document seed/counter scheme, NOT
   * `paint.ts#paintToSvg`'s content-hash scheme. `gradientId` (`"g" +
   * base36(abs(seed))`) is fixed per instance; each distinct
   * `(color1, color2, policy)` triple gets the next counter suffix in
   * registration order, de-duped like upstream's `Map<List<Object>, String>`.
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
   * format — the D4′ number-formatting rule: `%.4f` (`Locale.US`, HALF_UP
   * on the shortest round-trip decimal — see `javaFixed4`'s doc comment),
   * trailing zeros stripped, decimal point dropped if nothing follows
   * (`10.5`->`"10.5"`; `10.0`->`"10"`). Verified against
   * `test-results/dot-cache/component/sacuso-94-gugi476/in.svg`.
   * `x === 0` short-circuits to `"0"` (true for `-0` too).
   */
  protected format(xx: number): string {
    const x = xx * this.option.scale;
    if (x === 0) return '0';
    return trimTrailingZeros(javaFixed4(x));
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
   * Upstream: `createXml(OutputStream)` — returns the SVG document as a
   * `string` (pure-string renderer, no DOM/async/canvas). `images`
   * substitution is a no-op today (`svgImage` is a D3′ stub).
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
