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
 * Diagram-type style-selector names (`SName` values PlantUML's style engine
 * registers per diagram type, e.g. `classDiagram`/`componentDiagram` —
 * `net/sourceforge/plantuml/style/SName.java`) that a bare `<style>` block
 * may target directly (`classDiagram { BackGroundColor ... }`) or nest a
 * `document { ... }` selector under (`classDiagram { document { ... } }`).
 * Covers every diagram type this mission's DOT gate spans (G2 N7); the
 * `json`/`yaml`/`hcl` entries below predate this list and are kept as their
 * own tier for the same reason (untouched, no fixture forced reordering
 * them). G3/O2: also the recognized PREFIX for a diagram-type-nested
 * element bucket (`objectDiagram { object { ... } }` -> selector path
 * "objectdiagram.object") -- see {@link collectElementStyleBuckets}'s own
 * doc comment for the jar-verified mechanism.
 */
const DIAGRAM_TYPE_SELECTOR_NAMES = [
  'classdiagram',
  'componentdiagram',
  'usecasediagram',
  'statediagram',
  'objectdiagram',
] as const;

/**
 * Resolves a StyleMap selector path to the {@link ELEMENT_BUCKET_SNAMES}
 * bucket it feeds, or `undefined` if it targets neither a bare bucket name
 * nor a `<diagramType>.<bucket>` nesting. G3/O2: `EntityImageObject`'s own
 * StyleSignature chain is `root -> element -> objectDiagram -> object`
 * (`EntityImageObject#getStyleSignature`, upstream Java) -- a `<style>`
 * block may write the `object`/`map`/`json` bucket bare OR nested under its
 * owning diagram-type selector (`objectDiagram { object { BackgroundColor
 * ... } } }`), and both forms feed the SAME bucket. Jar-verified
 * `figeze-77-fozi735`: `objectDiagram { object { FontColor blue;
 * BackgroundColor yellow } }` wins over a `root { FontColor Red;
 * BackgroundColor palegreen }` block for every object-kind classifier's
 * fill/text color -- the nested form was previously unrecognized entirely
 * (fell through to `applyStyleMap`'s generic/class handling, which has no
 * rule for it either, so it was silently dropped).
 */
function resolveElementBucketSelector(selector: string): string | undefined {
  if (ELEMENT_BUCKET_SNAMES.has(selector)) return selector;
  for (const diagramType of DIAGRAM_TYPE_SELECTOR_NAMES) {
    const prefix = `${diagramType}.`;
    if (!selector.startsWith(prefix)) continue;
    const sname = selector.slice(prefix.length);
    if (ELEMENT_BUCKET_SNAMES.has(sname)) return sname;
  }
  return undefined;
}

/**
 * Collect per-element (SName) color/font-size buckets from element-scoped
 * style blocks (e.g. `database { BackgroundColor X }`, G1 I4b: `component {
 * FontSize N }` / `component { stereotype { FontSize N } }`). Color values
 * run through `parseColor` so a gradient becomes a
 * {@link import('./paint.js').Gradient} Paint, consistent with the
 * skinparam path (T4). Selectors are resolved via {@link
 * resolveElementBucketSelector} (bare bucket name, `<diagramType>.<bucket>`
 * nesting, or `<sname>.stereotype`); all others are left for
 * `applyStyleMap`'s existing generic/class handling.
 */
export function collectElementStyleBuckets(
  styleMap: StyleMap,
): Record<string, ElementColors> {
  const elements: Record<string, ElementColors> = {};
  for (const [selector, props] of styleMap.entries()) {
    const bucketName = resolveElementBucketSelector(selector);
    if (bucketName !== undefined) {
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
        elements[bucketName] = { ...elements[bucketName], ...bucket };
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
  // bucket-collection branches (bare/nested SName + `.stereotype` suffix)
  // push this over the CCN/NLOC threshold, not this iteration's change.
  return elements;
}

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
 * `StyleSignatureBasic#clean` (java): lowercase every char, DROPPING `_`
 * and `.` entirely (not just case-folding) -- upstream's own stereotype-
 * token normalization, applied to BOTH a `.tagname` selector's own token
 * and the element's resolved stereotype label(s) before comparing, so
 * `.MyStyle`/`<<my_style>>`/`<<My.Style>>` all normalize to the SAME
 * comparable key (`"mystyle"`). G2 N37.
 */
export function cleanStereotypeToken(name: string): string {
  let out = '';
  for (const ch of name) {
    if (ch !== '_' && ch !== '.') out += ch.toLowerCase();
  }
  return out;
}

/**
 * Parses a StyleMap selector PATH (the flattened, dot-joined map key --
 * NOT a single stack segment) for a trailing `.tagname` stereotype
 * sub-selector -- G2 N37. `parseStyleBlock`'s selector-open regex captures
 * a dot-led token WITH its leading dot intact (`.mystyle`), so when the
 * parser's stack is joined with `.`, a NESTED tag selector produces a
 * DOUBLE dot right before the tag segment (`classdiagram..mystyle` for
 * `classDiagram { .mystyle {...} } }`), while a TOP-LEVEL bare tag selector
 * is just the lone dot-led token itself (`.mystyle` for a bare `.mystyle {
 * ... }` at the document root, `fexuta-62-piko653`). Nesting depth is
 * capped at 2 (`parseStyleBlock`'s own doc comment), so the tag segment --
 * when present -- is always the LAST one; this does not attempt to parse a
 * tag selector nested under ANOTHER tag selector (no corpus sample needs
 * it). Returns `undefined` for every non-tag selector (including the
 * top-level bare-declarations key `""`).
 */
function parseTagSelector(path: string): { snamePath: string; tag: string } | undefined {
  if (path.startsWith('.')) {
    return { snamePath: '', tag: cleanStereotypeToken(path.slice(1)) };
  }
  const idx = path.indexOf('..');
  if (idx === -1) return undefined;
  return { snamePath: path.slice(0, idx), tag: cleanStereotypeToken(path.slice(idx + 2)) };
}

/**
 * Every DISTINCT `.tagname` token appearing ANYWHERE in `styleMap`
 * (CLEANED, deduplicated) -- G2 N37. Used to enumerate which per-tag
 * cascade entries are worth precomputing at Theme-build time
 * (`style-cascade-class.ts#computeClassStyleCascadeOverrides`'s
 * `classTagCascade`, this module's own `computeNoteStyleTagCascade`) --
 * a tag with no class/note-relevant declaration simply resolves every
 * property to `undefined` and is dropped, so no snames-scoping filter is
 * needed here.
 */
export function collectStyleTagNames(styleMap: StyleMap): ReadonlySet<string> {
  const tags = new Set<string>();
  for (const selector of styleMap.keys()) {
    const parsed = parseTagSelector(selector);
    if (parsed !== undefined) tags.add(parsed.tag);
  }
  return tags;
}

/**
 * Generic ancestor-cascade StyleMap resolver (G2 N36; `.tagname` stereotype
 * sub-selector support added G2 N37) — walks EVERY declaration in
 * `styleMap` (in parse/insertion order, i.e. textual source order) and
 * returns the value of `property` from the LAST declaration that matches
 * BOTH the caller's `snames` query AND (when the declaration itself is a
 * `.tagname` sub-selector) the caller's `stereotypeTags`.
 *
 * Mirrors upstream's real style-matching algorithm far more faithfully than
 * a fixed precedence array ({@link resolveDocumentBackground}'s own
 * `DOCUMENT_BACKGROUND_SELECTOR_PRECEDENCE`, G2 N7): `StyleSignatureBasic
 * #matchAllImpl` runs TWO independent subset tests -- SName
 * (`element.key.snames.containsAll(declaration.key.snames)`) AND
 * stereotype (`element.stereotypes.containsAll(declaration.stereotypes)`,
 * where the element side is built one-label-at-a-time via
 * `withTOBECHANGED`, so a declaration's tag matches when it equals ANY ONE
 * of the element's own stereotype labels) -- and `StyleStorage
 * #computeMergedStyle` merges every matching declaration, LAST-REGISTERED
 * wins per property (`MergeStrategy.OVERWRITE_EXISTING_VALUE`), with NO
 * specificity-based reordering (a plain `LinkedHashMap` walk). Since
 * `parseStyleBlock` stores a nested selector's OWN dot-joined path as its
 * map key and a `Map`'s iteration order is insertion (= textual encounter)
 * order, {@link parseTagSelector} recovers a `.tagname` declaration's own
 * ancestor SName path + tag token from that SAME flattened key, letting
 * this ONE pass reproduce jar's exact two-dimensional algorithm: a bare
 * `classDiagram {}`/`root {}` block cascades DOWN to every more-specific
 * element (unconditionally), while a `.tagname` sub-selector (nested or
 * top-level bare) additionally requires the element to carry that
 * stereotype -- both kinds interleave in ONE registration-order merge, so a
 * more-specific tag declaration naturally overrides a less-specific
 * ancestor declaration whenever it is registered later (every sampled
 * corpus fixture nests its `.tagname` block INSIDE the ancestor it
 * overrides, so this is always the case in practice -- G2 N37 ledger).
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
  // G2 N37: the element's OWN resolved stereotype label(s) -- raw or
  // pre-cleaned, cleaned internally via `cleanStereotypeToken`. Defaults to
  // empty, which makes every `.tagname` selector fail the tag-membership
  // test exactly as before this parameter existed -- 100% backward-
  // compatible for every pre-existing call site.
  stereotypeTags: readonly string[] = [],
): string | undefined {
  const querySet = new Set(snames);
  const tagSet = new Set(stereotypeTags.map(cleanStereotypeToken));
  let result: string | undefined;
  for (const [selector, props] of styleMap.entries()) {
    const tag = parseTagSelector(selector);
    if (tag !== undefined) {
      if (!tagSet.has(tag.tag)) continue;
      const ancestorTokens = tag.snamePath === '' ? [] : tag.snamePath.split('.');
      if (!ancestorTokens.every((t) => querySet.has(t))) continue;
    } else {
      const tokens = selector.split('.');
      if (!tokens.every((t) => querySet.has(t))) continue;
    }
    const value = props.get(property);
    if (value !== undefined) result = value;
  }
  return result;
}

/**
 * G2 N37: the `.tagname` cascade applied to the NOTE bucket (`note {
 * .faint { BackgroundColor red } } }`) -- mirrors `style-cascade-class.ts
 * #computeClassStyleCascadeOverrides`'s `classTagCascade` precedent but
 * scoped to `note` alone (no corpus sample exercises a bare root-level
 * `.tag {}` reaching a note the way `rakici-44-tivo701` does for
 * classifiers, so this does not add `root`/`element` to the query set --
 * narrower by design, not by oversight). Returns only the properties each
 * tag actually sets (empty entries are dropped).
 */
export function computeNoteStyleTagCascade(
  styleMap: StyleMap,
): Readonly<Record<string, ElementColors>> {
  const result: Record<string, ElementColors> = {};
  for (const tag of collectStyleTagNames(styleMap)) {
    const bg = resolveStyleCascade(styleMap, ['note'], 'backgroundcolor', [tag]);
    if (bg === undefined) continue;
    result[tag] = { background: parseColor(bg) };
  }
  return result;
}
