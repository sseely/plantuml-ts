/**
 * svg-graphics-shadow.ts — the `<filter>` def machinery for drop
 * shadows and text-backcolor filters. Split boundary #2 of 4 for
 * SvgGraphics.java — see `svg-graphics-core.ts`'s doc comment for the
 * full split rationale.
 *
 * Upstream: klimt/drawing/svg/SvgGraphics.java's shadow/filter section
 * (`manageShadow`, `addFilterShadowId`, `addFilter`,
 * `getIdFilterBackColor`, `getFilterBackColor`, plus the `withShadow`
 * and `filterBackColor` fields). None of these are read by the
 * constructor — only by the shape-drawing methods in
 * `svg-graphics-elements.ts` — so this slice sits safely between
 * `SvgGraphicsCore` and `SvgGraphicsElements` in the inheritance chain.
 */

import { SvgGraphicsCore } from './svg-graphics-core.js';
import type { XmlNode } from './xml-writer.js';

const SHADOW_COLOR_MATRIX_VALUES = '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0';

/**
 * SvgGraphicsShadow — see the module doc comment above.
 *
 * Upstream: `SvgGraphics.java`. Ported in full: `manageShadow`,
 * `addFilterShadowId`, `addFilter`, `getIdFilterBackColor`,
 * `getFilterBackColor`. `manageShadow`'s filter-element construction is
 * factored into `buildShadowFilter` (a private helper upstream does not
 * have) purely to stay under this port's per-function NLOC budget — the
 * filter markup produced is identical.
 */
export class SvgGraphicsShadow extends SvgGraphicsCore {
  private withShadow = false;
  private readonly filterBackColor = new Map<string, string>();

  protected addFilterShadowId(elt: XmlNode, deltaShadow: number): void {
    if (deltaShadow > 0) elt.setAttribute('filter', `url(#${this.shadowId})`);
  }

  protected manageShadow(deltaShadow: number): void {
    if (deltaShadow === 0) return;
    if (!this.withShadow) this.defs.appendChild(this.buildShadowFilter());
    this.withShadow = true;
  }

  // <filter id="f1" x="0" y="0" width="120%" height="120%">
  private buildShadowFilter(): XmlNode {
    const filter = this.document.createElement('filter');
    filter.setAttribute('id', this.shadowId);
    filter.setAttribute('x', '-1');
    filter.setAttribute('y', '-1');
    filter.setAttribute('width', '300%');
    filter.setAttribute('height', '300%');
    this.addFilter(filter, 'feGaussianBlur', ['result', 'blurOut', 'stdDeviation', this.format(2)]);
    this.addFilter(filter, 'feColorMatrix', [
      'type', 'matrix', 'in', 'blurOut', 'result', 'blurOut2', 'values', SHADOW_COLOR_MATRIX_VALUES,
    ]);
    this.addFilter(filter, 'feOffset', [
      'result', 'blurOut3', 'in', 'blurOut2', 'dx', this.format(4), 'dy', this.format(4),
    ]);
    this.addFilter(filter, 'feBlend', ['in', 'SourceGraphic', 'in2', 'blurOut3', 'mode', 'normal']);
    return filter;
  }

  private addFilter(filter: XmlNode, name: string, data: readonly string[]): void {
    const elt = this.document.createElement(name);
    for (let i = 0; i < data.length; i += 2) elt.setAttribute(data[i]!, data[i + 1]!);
    filter.appendChild(elt);
  }

  private getIdFilterBackColor(color: string): string {
    let result = this.filterBackColor.get(color);
    if (result === undefined) {
      result = this.filterUid + this.filterBackColor.size;
      this.filterBackColor.set(color, result);
    }
    return result;
  }

  /** Text background-color filter (`feFlood` + `feComposite`), used by
   * `text()` for `textBackColor`. */
  protected getFilterBackColor(color: string): string {
    const existing = this.filterBackColor.get(color);
    if (existing !== undefined) return existing;

    const id = this.getIdFilterBackColor(color);
    const filter = this.document.createElement('filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '1');
    filter.setAttribute('height', '1');
    this.addFilter(filter, 'feFlood', ['flood-color', color, 'result', 'flood']);
    this.addFilter(filter, 'feComposite', ['in', 'SourceGraphic', 'in2', 'flood', 'operator', 'over']);
    this.defs.appendChild(filter);
    return id;
  }
}
