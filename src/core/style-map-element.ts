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

/**
 * Collect per-element (SName) color buckets from element-scoped style blocks
 * (e.g. `database { BackgroundColor X }`). Color values run through
 * `parseColor` so a gradient becomes a {@link import('./paint.js').Gradient}
 * Paint, consistent with the skinparam path (T4). Only selectors that are known
 * bucket SNames are collected; all others are left for `applyStyleMap`'s
 * existing generic/class handling.
 */
export function collectElementStyleBuckets(
  styleMap: StyleMap,
): Record<string, ElementColors> {
  const elements: Record<string, ElementColors> = {};
  for (const [selector, props] of styleMap.entries()) {
    if (!ELEMENT_BUCKET_SNAMES.has(selector)) continue;
    const bucket: ElementColors = {};
    const bg = props.get('backgroundcolor');
    if (bg !== undefined) bucket.background = parseColor(bg);
    const bd = props.get('bordercolor');
    if (bd !== undefined) bucket.border = parseColor(bd);
    const fc = props.get('fontcolor');
    if (fc !== undefined) bucket.font = parseColor(fc);
    if (Object.keys(bucket).length > 0) elements[selector] = bucket;
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
