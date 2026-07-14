/**
 * svg-graphics-elements.ts — the shape-drawing methods: every
 * `svg*`-prefixed element-creation call plus the legacy
 * `newpath`/`moveto`/…/`fill` path-builder API. Split boundary #3 of 4
 * for SvgGraphics.java — see `svg-graphics-core.ts`'s doc comment for
 * the full split rationale.
 *
 * Upstream: klimt/drawing/svg/SvgGraphics.java's element-creation
 * section: `svgEllipse`, `svgArcEllipse`, `svgRectangle`, `svgLine`,
 * `svgPolygon`, `text`, `svgPath`, and the legacy path-builder API
 * (`newpath`, `moveto`, `lineto`, `closepath`, `curveto`, `quadto`,
 * `fill(windingRule)`).
 *
 * NOT ported (reported): `drawPathIterator(x, y, PathIterator)` —
 * upstream's AWT-`PathIterator` interop wrapper around the legacy
 * path-builder API. `java.awt.geom.PathIterator` has no TS equivalent in
 * this pure-SVG, no-AWT-dependency renderer (`.claude/CLAUDE.md`: "no
 * DOM, no async, no canvas"), and nothing in this port's shape model
 * (`UPath` et al.) produces one — callers already have a `UPath` and use
 * `svgPath` directly. `TeaVM.a()`-gated `assert` statements (e.g.
 * `svgPolygon`'s even-length-points check) are debug-only in upstream
 * and are not ported either, matching that they compile out in
 * production Java too.
 *
 * Param-count adaptations (this port's 5-param function budget):
 * `text()`'s ten upstream parameters collapse into one `TextOptions`
 * object, following this port's established many-params-to-object-field
 * convention (e.g. `URectangle`'s `URectangleFields`, T2). `svgRectangle`
 * (7 upstream params) collapses its geometry into a `RectangleGeometry`
 * object the same way. `svgArcEllipse` and `curveto` (6 upstream params
 * each) instead reuse the rest-tuple-overload pattern already
 * established for `UPath#cubicTo`/`#quadTo` (T2): a single rest param
 * accepting either the original positional numbers or `Point2D` pairs,
 * so upstream's exact positional-number call convention stays available
 * to callers alongside the point-pair form.
 */

import { SvgGraphicsShadow } from './svg-graphics-shadow.js';
import { LengthAdjust } from './svg-graphics-core.js';
import type { XmlNode } from './xml-writer.js';
import { USegmentType } from '../../shape/UPath.js';
import type { UPath, USegment } from '../../shape/UPath.js';
import type { Point2D } from '../../UTranslate.js';

/** See the module doc comment above for the `text()` param collapse. */
export interface TextOptions {
  readonly fontFamily: string | null;
  readonly fontSize: number;
  readonly fontWeight: string | null;
  readonly fontStyle: string | null;
  readonly textDecoration: string | null;
  readonly textLength: number;
  readonly attributes: ReadonlyMap<string, string>;
  readonly textBackColor: string | null;
  readonly orientation?: number;
}

/** See the module doc comment above for the `svgRectangle` param collapse. */
export interface RectangleGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rx: number;
  readonly ry: number;
}

/**
 * SvgGraphicsElements — see the module doc comment above.
 *
 * Upstream: `SvgGraphics.java`. Ported in full: `svgEllipse`,
 * `svgArcEllipse`, `svgRectangle`, `svgLine`, `svgPolygon`, `text`,
 * `svgPath`, `newpath`/`moveto`/`lineto`/`closepath`/`curveto`/`quadto`/
 * `fill`.
 */
export class SvgGraphicsElements extends SvgGraphicsShadow {
  svgEllipse(x: number, y: number, xRadius: number, yRadius: number, deltaShadow: number): void {
    this.manageShadow(deltaShadow);
    if (!this.hidden) {
      const elt = this.document.createElement('ellipse');
      elt.setAttribute('cx', this.format(x));
      elt.setAttribute('cy', this.format(y));
      elt.setAttribute('rx', this.format(xRadius));
      elt.setAttribute('ry', this.format(yRadius));
      this.fillMe(elt);
      this.styleMe(elt, null);
      this.addFilterShadowId(elt, deltaShadow);
      this.getG().appendChild(elt);
    }
    this.ensureVisible(x + xRadius + deltaShadow * 2, y + yRadius + deltaShadow * 2);
  }

  svgArcEllipse(rx: number, ry: number, ...args: [number, number, number, number] | [Point2D, Point2D]): void {
    const [x1, y1, x2, y2] = args.length === 2 ? [args[0].x, args[0].y, args[1].x, args[1].y] : args;
    if (!this.hidden) {
      const d = `M${this.format(x1)},${this.format(y1)} A${this.format(rx)},${this.format(ry)} 0 0 0 ${this.format(x2)} ${this.format(y2)}`;
      const elt = this.document.createElement('path');
      elt.setAttribute('d', d);
      this.fillMe(elt);
      this.styleMe(elt, null);
      this.getG().appendChild(elt);
    }
    this.ensureVisible(x1, y1);
    this.ensureVisible(x2, y2);
  }

  svgRectangle(rect: RectangleGeometry, deltaShadow: number): void {
    const { x, y, width, height, rx, ry } = rect;
    if (height <= 0 || width <= 0) return;
    this.manageShadow(deltaShadow);
    if (!this.hidden) {
      const elt = this.createRectangleInternal(x, y, width, height);
      this.addFilterShadowId(elt, deltaShadow);
      if (rx > 0 && ry > 0) {
        elt.setAttribute('rx', this.format(rx));
        elt.setAttribute('ry', this.format(ry));
      }
      this.getG().appendChild(elt);
    }
    this.ensureVisible(x + width + 2 * deltaShadow, y + height + 2 * deltaShadow);
  }

  /**
   * Emits an `<image>` element with a PRE-ENCODED data-URI href — the T7
   * (SI5b+E2r) sprite/img-atom rendering seam (D7). This mirrors upstream's
   * OWN documented `<image>` shape (`SvgGraphics#svgImage(PortableImage,x,y)`,
   * java :945-958: `<image width height x y xlink:href="data:image/png;
   * base64,...">`) but is NOT a port of that method or its sibling
   * `svgImage(UImageSvg,...)` overload — those remain the D3'-deferred
   * throwing stubs on `SvgGraphics` (`svg-graphics.ts`) covering upstream's
   * full `PortableImage`/`UImageSvg` encoding pipeline, which this port does
   * not have. This method instead takes the already-built href/width/height
   * T7's resolver computed (T5's PNG data URI, or an `<img>` atom's own
   * verbatim `dataUri`) and just emits the element upstream's method would
   * have produced for it.
   */
  svgImageDataUri(x: number, y: number, width: number, height: number, href: string): void {
    if (!this.hidden) {
      const elt = this.document.createElement('image');
      elt.setAttribute('width', this.format(width));
      elt.setAttribute('height', this.format(height));
      elt.setAttribute('x', this.format(x));
      elt.setAttribute('y', this.format(y));
      elt.setAttribute('xlink:href', href);
      this.getG().appendChild(elt);
    }
    this.ensureVisible(x, y);
    this.ensureVisible(x + width, y + height);
  }

  svgLine(x1: number, y1: number, x2: number, y2: number, deltaShadow: number): void {
    this.manageShadow(deltaShadow);
    if (!this.hidden) {
      const elt = this.document.createElement('line');
      elt.setAttribute('x1', this.format(x1));
      elt.setAttribute('y1', this.format(y1));
      elt.setAttribute('x2', this.format(x2));
      elt.setAttribute('y2', this.format(y2));
      this.styleMe(elt, null);
      this.addFilterShadowId(elt, deltaShadow);
      this.getG().appendChild(elt);
    }
    this.ensureVisible(x1 + 2 * deltaShadow, y1 + 2 * deltaShadow);
    this.ensureVisible(x2 + 2 * deltaShadow, y2 + 2 * deltaShadow);
  }

  svgPolygon(deltaShadow: number, ...points: readonly number[]): void {
    this.manageShadow(deltaShadow);
    if (!this.hidden) {
      const elt = this.document.createElement('polygon');
      elt.setAttribute('points', points.map((p) => this.format(p)).join(','));
      this.fillMe(elt);
      this.styleMe(elt, 'stroke-linejoin:miter;stroke-miterlimit:10;');
      this.addFilterShadowId(elt, deltaShadow);
      this.getG().appendChild(elt);
    }
    for (let i = 0; i < points.length; i += 2) {
      this.ensureVisible(points[i]! + 2 * deltaShadow, points[i + 1]! + 2 * deltaShadow);
    }
  }

  text(text: string, x: number, y: number, opts: TextOptions): void {
    this.ensureVisible(x, y);
    this.ensureVisible(x + opts.textLength, y);
    if (this.hidden) return;

    const elt = this.document.createElement('text');
    elt.setAttribute('x', this.format(x));
    elt.setAttribute('y', this.format(y));
    this.fillMe(elt);
    this.applyTextOrientation(elt, x, y, opts.orientation ?? 0);
    elt.setAttribute('font-size', this.format(opts.fontSize));
    this.applyTextLengthAdjust(elt, opts.textLength);
    if (opts.fontWeight !== null) elt.setAttribute('font-weight', opts.fontWeight);
    if (opts.fontStyle !== null) elt.setAttribute('font-style', opts.fontStyle);
    if (opts.textDecoration !== null) elt.setAttribute('text-decoration', opts.textDecoration);

    const resolvedText = this.applyTextFontFamily(elt, opts.fontFamily, text);
    if (opts.textBackColor !== null) {
      elt.setAttribute('filter', `url(#${this.getFilterBackColor(opts.textBackColor)})`);
    }
    for (const [name, value] of opts.attributes) elt.setAttribute(name, value);

    elt.setTextContent(resolvedText);
    this.getG().appendChild(elt);
  }

  private applyTextOrientation(elt: XmlNode, x: number, y: number, orientation: number): void {
    if (orientation === 90) elt.setAttribute('transform', `rotate(-90 ${this.format(x)} ${this.format(y)})`);
    else if (orientation === 270) elt.setAttribute('transform', `rotate(90 ${this.format(x)} ${this.format(y)})`);
  }

  private applyTextLengthAdjust(elt: XmlNode, textLength: number): void {
    if (this.option.lengthAdjust === LengthAdjust.SPACING) {
      elt.setAttribute('lengthAdjust', 'spacing');
      elt.setAttribute('textLength', this.format(textLength));
    } else if (this.option.lengthAdjust === LengthAdjust.SPACING_AND_GLYPHS) {
      elt.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      elt.setAttribute('textLength', this.format(textLength));
    }
  }

  // http://plantuml.sourceforge.net/qa/?qa=5432/svg-monospace-output-has-wrong-font-family
  private applyTextFontFamily(elt: XmlNode, fontFamily: string | null, text: string): string {
    if (fontFamily === null) return text;
    if (fontFamily.toLowerCase() === 'roboto') this.addRoboto();

    const resolvedFamily = fontFamily.toLowerCase() === 'monospaced' ? 'monospace' : fontFamily;
    elt.setAttribute('font-family', resolvedFamily);

    const lower = resolvedFamily.toLowerCase();
    // Upstream: text.replace(' ', (char) 160) — regular spaces become
    // U+00A0 (non-breaking space) for monospace/courier fonts.
    if (lower === 'monospace' || lower === 'courier') return text.split(' ').join(' ');
    return text;
  }

  svgPath(x: number, y: number, path: UPath, deltaShadow: number): void {
    this.manageShadow(deltaShadow);
    this.ensureVisible(x, y);
    let d = '';
    for (const seg of path) d += this.renderPathSegment(seg, x, y, deltaShadow);

    if (this.hidden) return;
    const elt = this.document.createElement('path');
    elt.setAttribute('d', d.trim());
    this.styleMe(elt, null);
    this.fillMe(elt);
    const id = path.getComment();
    if (id !== null) elt.setAttribute('id', id);
    const codeLine = path.getCodeLine();
    if (codeLine !== null) elt.setAttribute('codeLine', codeLine);
    this.addFilterShadowId(elt, deltaShadow);
    this.getG().appendChild(elt);
  }

  private renderPathSegment(seg: USegment, x: number, y: number, deltaShadow: number): string {
    const c = seg.coord;
    switch (seg.segmentType) {
      case USegmentType.SEG_MOVETO:
        this.ensureVisible(c[0]! + x + 2 * deltaShadow, c[1]! + y + 2 * deltaShadow);
        return `M${this.format(c[0]! + x)},${this.format(c[1]! + y)} `;
      case USegmentType.SEG_LINETO:
        this.ensureVisible(c[0]! + x + 2 * deltaShadow, c[1]! + y + 2 * deltaShadow);
        return `L${this.format(c[0]! + x)},${this.format(c[1]! + y)} `;
      case USegmentType.SEG_QUADTO:
        this.ensureVisible(c[0]! + x + 2 * deltaShadow, c[1]! + y + 2 * deltaShadow);
        this.ensureVisible(c[2]! + x + 2 * deltaShadow, c[3]! + y + 2 * deltaShadow);
        return `Q${this.format(c[0]! + x)},${this.format(c[1]! + y)} ${this.format(c[2]! + x)},${this.format(c[3]! + y)} `;
      case USegmentType.SEG_CUBICTO:
        return this.renderCubicSegment(c, x, y, deltaShadow);
      case USegmentType.SEG_ARCTO:
        return this.renderArcSegment(c, x, y, deltaShadow);
      default:
        // SEG_CLOSE: nothing (matches upstream's empty branch).
        return '';
    }
  }

  private renderCubicSegment(c: readonly number[], x: number, y: number, deltaShadow: number): string {
    this.ensureVisible(c[0]! + x + 2 * deltaShadow, c[1]! + y + 2 * deltaShadow);
    this.ensureVisible(c[2]! + x + 2 * deltaShadow, c[3]! + y + 2 * deltaShadow);
    this.ensureVisible(c[4]! + x + 2 * deltaShadow, c[5]! + y + 2 * deltaShadow);
    return (
      `C${this.format(c[0]! + x)},${this.format(c[1]! + y)} ` +
      `${this.format(c[2]! + x)},${this.format(c[3]! + y)} ` +
      `${this.format(c[4]! + x)},${this.format(c[5]! + y)} `
    );
  }

  // A25,25 0,0 5,395,40
  private renderArcSegment(c: readonly number[], x: number, y: number, deltaShadow: number): string {
    this.ensureVisible(c[5]! + c[0]! + x + 2 * deltaShadow, c[6]! + c[1]! + y + 2 * deltaShadow);
    return (
      `A${this.format(c[0]!)},${this.format(c[1]!)} ${this.format(c[2]!)} ` +
      `${this.formatBoolean(c[3]!)} ${this.formatBoolean(c[4]!)} ` +
      `${this.format(c[5]! + x)},${this.format(c[6]! + y)} `
    );
  }

  // Legacy path-builder API (upstream: newpath/moveto/lineto/closepath/
  // curveto/quadto/fill). `currentPath` is `null` until `newpath()` is
  // called, mirroring upstream's uninitialized `StringBuilder` field —
  // `.concat` (rather than template-literal interpolation, which would
  // silently stringify `null` to `"null"`) throws if a caller appends
  // before calling `newpath()`, the same failure mode as upstream's NPE.
  private currentPath: string | null = null;

  newpath(): void {
    this.currentPath = '';
  }

  moveto(x: number, y: number): void {
    this.currentPath = this.currentPath!.concat(`M${this.format(x)},${this.format(y)} `);
    this.ensureVisible(x, y);
  }

  lineto(x: number, y: number): void {
    this.currentPath = this.currentPath!.concat(`L${this.format(x)},${this.format(y)} `);
    this.ensureVisible(x, y);
  }

  closepath(): void {
    this.currentPath = this.currentPath!.concat('Z ');
  }

  curveto(...args: [number, number, number, number, number, number] | [Point2D, Point2D, Point2D]): void {
    if (args.length === 3) {
      const [p1, p2, p3] = args;
      this.curveto(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      return;
    }
    const [x1, y1, x2, y2, x3, y3] = args;
    this.currentPath = this.currentPath!.concat(
      `C${this.format(x1)},${this.format(y1)} ${this.format(x2)},${this.format(y2)} ${this.format(x3)},${this.format(y3)} `,
    );
    this.ensureVisible(x1, y1);
    this.ensureVisible(x2, y2);
    this.ensureVisible(x3, y3);
  }

  quadto(x1: number, y1: number, x2: number, y2: number): void {
    this.currentPath = this.currentPath!.concat(
      `Q${this.format(x1)},${this.format(y1)} ${this.format(x2)},${this.format(y2)} `,
    );
    this.ensureVisible(x1, y1);
    this.ensureVisible(x2, y2);
  }

  fill(_windingRule: number): void {
    if (!this.hidden) {
      const elt = this.document.createElement('path');
      elt.setAttribute('d', this.currentPath ?? '');
      this.fillMe(elt);
      this.getG().appendChild(elt);
    }
    this.currentPath = null;
  }
}
