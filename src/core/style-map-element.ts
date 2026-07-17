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
  // #lizard forgives -- pre-existing (unchanged by G2 N7); two independent
  // bucket-collection branches (bare SName + `.stereotype` suffix) push this
  // over the CCN/NLOC threshold, not this iteration's change.
  return elements;
}

/**
 * Diagram-type style-selector names (`SName` values PlantUML's style engine
 * registers per diagram type, e.g. `classDiagram`/`componentDiagram` —
 * `net/sourceforge/plantuml/style/SName.java`) that a bare `<style>` block
 * may target directly (`classDiagram { BackGroundColor ... }`) or nest a
 * `document { ... }` selector under (`classDiagram { document { ... } }`).
 * Covers every diagram type this mission's DOT gate spans (G2 N7); the
 * `json`/`yaml`/`hcl` entries below predate this list and are kept as their
 * own tier for the same reason (untouched, no fixture forced reordering
 * them).
 */
const DIAGRAM_TYPE_SELECTOR_NAMES = [
  'classdiagram',
  'componentdiagram',
  'usecasediagram',
  'statediagram',
  'objectdiagram',
] as const;

/**
 * `document { BackgroundColor }` canvas-background selector precedence,
 * broadest first ("last wins" in `resolveDocumentBackground`'s scan) —
 * mirrors upstream's style-cascade specificity rule (a more-scoped selector
 * always outranks a broader one): bare `root` < bare `document` < a
 * diagram-type-scoped `document` variant < a bare diagram-type selector <
 * that diagram type's OWN nested `document` selector (jar-verified:
 * `bikuka-40-pezi068` — `classDiagram { BackGroundColor Green }` beats
 * `root { BackGroundColor Red }`; `cilaba-36-zogi212` — `classDiagram {
 * document { BackGroundColor Yellow } }` beats `classDiagram { BackGroundColor
 * Green }`, G2 N7).
 */
const DOCUMENT_BACKGROUND_SELECTOR_PRECEDENCE: readonly string[] = [
  'root',
  'document',
  'jsondiagram.document',
  'yamldiagram.document',
  'hcldiagram.document',
  ...DIAGRAM_TYPE_SELECTOR_NAMES,
  ...DIAGRAM_TYPE_SELECTOR_NAMES.map((name) => `${name}.document`),
];

/**
 * Resolve the `document { BackgroundColor }` canvas background from a
 * StyleMap. Checks the bare `document` selector then diagram-type-scoped
 * variants (last wins). Relocated verbatim from `applyStyleMap`; G2 N7
 * widened the precedence list from `document`/json`/yaml`/hcl only to also
 * cover a bare `root` selector and every DOT-gate diagram type's bare +
 * nested `document` selector (`bikuka-40-pezi068`/`cilaba-36-zogi212`).
 */
export function resolveDocumentBackground(
  styleMap: StyleMap,
): string | undefined {
  let documentBg: string | undefined;
  for (const sel of DOCUMENT_BACKGROUND_SELECTOR_PRECEDENCE) {
    const doc = styleMap.get(sel);
    if (doc !== undefined) {
      const bg = doc.get('backgroundcolor');
      if (bg !== undefined) documentBg = resolveColor(bg);
    }
  }
  return documentBg;
}

/**
 * Generic ancestor-cascade StyleMap resolver (G2 N36) — walks EVERY
 * declaration in `styleMap` (in parse/insertion order, i.e. textual source
 * order) and returns the value of `property` from the LAST declaration
 * whose own dot-path SName tokens are a SUBSET of `snames`.
 *
 * Mirrors upstream's real style-matching algorithm far more faithfully than
 * a fixed precedence array ({@link resolveDocumentBackground}'s own
 * `DOCUMENT_BACKGROUND_SELECTOR_PRECEDENCE`, G2 N7): `StyleSignatureBasic
 * #matchAllImpl` matches a declaration against an element's style signature
 * via `element.key.snames.containsAll(declaration.key.snames)` (a pure SET-
 * containment test, independent of nesting depth or declared order), and
 * `StyleStorage#computeMergedStyle` merges every matching declaration,
 * LAST-REGISTERED wins per property (`MergeStrategy.OVERWRITE_EXISTING_
 * VALUE`). Since `parseStyleBlock` stores a nested selector's OWN dot-joined
 * path as its map key (`classDiagram { class { header {...} } }` ->
 * "classdiagram.class.header") and a `Map`'s iteration order is insertion
 * (= textual encounter) order, splitting each selector key on `.` and
 * testing subset-membership against the caller's `snames` reproduces jar's
 * exact algorithm: a bare `classDiagram {}`/`root {}` block correctly
 * cascades DOWN to every more-specific element whose own signature includes
 * that SName (classifier boxes, badges via `root` alone, header text, edge
 * strokes, ...) exactly the way upstream's style engine does, without this
 * port needing to special-case "which selector counts as more specific" the
 * way {@link resolveDocumentBackground}'s own fixed list must.
 *
 * A `.tagname` stereotype sub-selector (`class { .a { BackgroundColor pink
 * } } }`) is a DIFFERENT, two-dimensional match (SName subset AND the
 * element's OWN resolved stereotype) this function does not attempt --
 * its dot-path segment (e.g. `""` from the double-dot join, or the bare tag
 * word `"a"`) is never a member of any real `snames` query set passed by a
 * caller, so it is silently and correctly excluded here rather than
 * mismatched (G2 N36 ledger: "near-total style-cascade absence for class",
 * the `.tagname` half is a separate, deferred subsystem).
 *
 * `property` values are returned RAW (e.g. `"Green"`, `"lightblue"`) --
 * callers resolve through
 * {@link import('./klimt/color/HColorSet.js').resolveColorToSvgHex}
 * themselves, matching the existing inline-override precedent
 * (`class-color-override.ts`).
 */
export function resolveStyleCascade(
  styleMap: StyleMap,
  snames: readonly string[],
  property: string,
): string | undefined {
  const querySet = new Set(snames);
  let result: string | undefined;
  for (const [selector, props] of styleMap.entries()) {
    const tokens = selector.split('.');
    if (!tokens.every((t) => querySet.has(t))) continue;
    const value = props.get(property);
    if (value !== undefined) result = value;
  }
  return result;
}
