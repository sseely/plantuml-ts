/**
 * Element-scoped `<style>` block routing — decision D4.
 *
 * Split out of `style-map-theme.ts` (which is at the module-size limit): this
 * holds the per-element bucket collection (T5) plus the document-background
 * resolver relocated from `applyStyleMap` to make room. Both are pure
 * functions over a {@link StyleMap}.
 */

import type { ElementColors } from './theme.js';
import type { StyleMap } from './skinparam.js';
import { resolveColor, ELEMENT_BUCKET_SNAMES } from './skinparam.js';
import { parseColor } from './paint.js';

/** `<sname>.stereotype` selector suffix (`<style> <sname> { stereotype {
 *  FontSize N } } }`) — G1 I4b. A per-stereotype-NAME sub-selector
 *  (`.bar { FontSize N }` nested one level deeper) is a separate, deferred
 *  mechanism — see `ledger.md` I4b, not handled here. */
const STEREOTYPE_SELECTOR_SUFFIX = '.stereotype';

/**
 * Collect per-element (SName) color/font-size buckets from element-scoped
 * style blocks (e.g. `database { BackgroundColor X }`, G1 I4b: `component {
 * FontSize N }` / `component { stereotype { FontSize N } }`). Color values
 * run through `parseColor` so a gradient becomes a
 * {@link import('./paint.js').Gradient} Paint, consistent with the
 * skinparam path (T4). Only selectors that are known bucket SNames (bare, or
 * `<sname>.stereotype`) are collected; all others are left for
 * `applyStyleMap`'s existing generic/class handling.
 */
export function collectElementStyleBuckets(
  styleMap: StyleMap,
): Record<string, ElementColors> {
  const elements: Record<string, ElementColors> = {};
  for (const [selector, props] of styleMap.entries()) {
    if (ELEMENT_BUCKET_SNAMES.has(selector)) {
      const bucket: ElementColors = {};
      const bg = props.get('backgroundcolor');
      if (bg !== undefined) bucket.background = parseColor(bg);
      const bd = props.get('bordercolor');
      if (bd !== undefined) bucket.border = parseColor(bd);
      const fc = props.get('fontcolor');
      if (fc !== undefined) bucket.font = parseColor(fc);
      const fs = props.get('fontsize');
      if (fs !== undefined) {
        const size = Number(fs);
        if (Number.isFinite(size)) bucket.fontSize = size;
      }
      if (Object.keys(bucket).length > 0) {
        elements[selector] = { ...elements[selector], ...bucket };
      }
      continue;
    }

    if (selector.endsWith(STEREOTYPE_SELECTOR_SUFFIX)) {
      const sname = selector.slice(0, -STEREOTYPE_SELECTOR_SUFFIX.length);
      if (!ELEMENT_BUCKET_SNAMES.has(sname)) continue;
      const fs = props.get('fontsize');
      if (fs === undefined) continue;
      const size = Number(fs);
      if (!Number.isFinite(size)) continue;
      elements[sname] = { ...elements[sname], stereotypeFontSize: size };
    }
  }
  return elements;
}

/**
 * Resolve the `document { BackgroundColor }` canvas background from a
 * StyleMap. Checks the bare `document` selector then diagram-type-scoped
 * variants (last wins). Relocated verbatim from `applyStyleMap`.
 */
export function resolveDocumentBackground(
  styleMap: StyleMap,
): string | undefined {
  let documentBg: string | undefined;
  for (const sel of [
    'document',
    'jsondiagram.document',
    'yamldiagram.document',
    'hcldiagram.document',
  ]) {
    const doc = styleMap.get(sel);
    if (doc !== undefined) {
      const bg = doc.get('backgroundcolor');
      if (bg !== undefined) documentBg = resolveColor(bg);
    }
  }
  return documentBg;
}
