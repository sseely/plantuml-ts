/**
 * SVG normalizer for the golden-SVG conformance harness.
 *
 * Ported near-verbatim from graphviz-ts's `test/golden/normalize.ts` (see
 * `.claude/catalog.md` / mission decision journal for provenance). Parses an
 * SVG string with `@xmldom/xmldom` and reduces it to a `NormalizedNode` tree:
 * attributes sorted alphabetically, numeric attribute/path/points/transform
 * values rounded to 6 significant figures, whitespace-only text nodes and
 * comment/processing-instruction nodes dropped.
 *
 * plantuml adaptations over the graphviz-ts source (see mission decision
 * journal for the full list):
 *   1. `style="k:v;..."` declarations are resolved into individual
 *      attributes (a style declaration wins over a same-named presentation
 *      attribute), then the `style` attribute itself is dropped.
 *   2. `data-*` attributes (e.g. `data-qualified-name`, `data-source-line`)
 *      are stripped entirely — they are plantuml.jar debug metadata, not
 *      rendered SVG.
 *   3. Comment nodes (`<!--entity X-->`) and processing instructions
 *      (`<?plantuml $version$?>`) are skipped at every depth, not just at
 *      the document root.
 */
import { DOMParser } from '@xmldom/xmldom';
import type { Node as XmlNode } from '@xmldom/xmldom';

// xmldom's Node interface does not export nodeType constants in all versions,
// so define them locally rather than referencing Node.ELEMENT_NODE etc.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const PROCESSING_INSTRUCTION_NODE = 7;

/** Numeric SVG attribute names whose values need normalization. */
const NUMERIC_ATTRS = new Set([
  'x', 'y', 'cx', 'cy', 'rx', 'ry',
  'width', 'height',
  'x1', 'y1', 'x2', 'y2',
  'dx', 'dy', 'r',
]);

/**
 * Normalize a single floating-point number to 6 significant figures.
 * Strips trailing zeros so `1.000000` becomes `1` and `1.50000` becomes `1.5`.
 */
function normalizeNumber(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  return parseFloat(n.toPrecision(6)).toString();
}

/**
 * Re-serialize all numeric tokens in an SVG path `d` attribute.
 * Non-numeric tokens (command letters) are preserved verbatim.
 */
function normalizePathD(d: string): string {
  return d.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, (m) =>
    normalizeNumber(m),
  );
}

/**
 * Normalize a `points` attribute (polygon/polyline) — space/comma-separated pairs.
 */
function normalizePoints(points: string): string {
  return points.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, (m) =>
    normalizeNumber(m),
  );
}

/**
 * Normalize a `transform` attribute — numeric parameters inside any function.
 */
function normalizeTransform(transform: string): string {
  return transform.replace(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g, (m) =>
    normalizeNumber(m),
  );
}

/**
 * Normalize an attribute value based on its name.
 */
function normalizeAttrValue(name: string, value: string): string {
  if (NUMERIC_ATTRS.has(name)) return normalizeNumber(value);
  if (name === 'd') return normalizePathD(value);
  if (name === 'points') return normalizePoints(value);
  if (name === 'viewBox') return normalizePoints(value);
  if (name === 'transform') return normalizeTransform(value);
  return value;
}

/**
 * plantuml adaptation #1: parse a CSS-style `style="k:v;k2:v2;"` attribute
 * into individual declarations. Malformed declarations (no `:`, empty key)
 * are skipped rather than throwing — plantuml.jar's own SVG emission is the
 * only producer, but the parser stays defensive against a hand-edited fixture.
 */
function parseStyleDeclarations(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const decl of style.split(';')) {
    const trimmed = decl.trim();
    if (trimmed === '') continue;
    const sep = trimmed.indexOf(':');
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    if (key === '') continue;
    result[key] = value;
  }
  return result;
}

export interface NormalizedNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>; // sorted alphabetically by key
  text?: string;
  children?: NormalizedNode[];
}

/**
 * Build the sorted, normalized attribute map for an element.
 *
 * plantuml adaptations #1 and #2 live here: `data-*` attributes are dropped
 * before sorting, and a `style` attribute (if present) is expanded into its
 * declarations — each declaration overwrites any same-named presentation
 * attribute — before `style` itself is discarded.
 */
function buildAttrs(el: Element): Record<string, string> {
  const raw: Record<string, string> = {};
  const rawAttrs = el.attributes;
  for (let i = 0; i < rawAttrs.length; i++) {
    const attr = rawAttrs.item(i);
    // item(i) for i < rawAttrs.length never returns null per the DOM
    // NamedNodeMap contract; required only by its `Attr | null` typing.
    /* v8 ignore next */
    if (attr === null) continue;
    const name = attr.name;
    if (name.startsWith('data-')) continue; // adaptation #2: strip data-*
    // getAttribute(name) for a name just enumerated from this element's own
    // attributes always returns a string (possibly ""), never null;
    // `?? ''` is required only by getAttribute's `string | null` typing.
    /* v8 ignore next */
    raw[name] = el.getAttribute(name) ?? '';
  }

  // adaptation #1: style declarations win over same-named presentation attrs
  const styleValue = raw['style'];
  if (styleValue !== undefined) {
    const styleDecls = parseStyleDeclarations(styleValue);
    for (const [key, value] of Object.entries(styleDecls)) {
      raw[key] = value;
    }
    delete raw['style'];
  }

  const sortedNames = Object.keys(raw).sort();
  const attrs: Record<string, string> = {};
  for (const name of sortedNames) {
    // sortedNames is Object.keys(raw), so raw[name] is always defined here;
    // `?? ''` is required only by noUncheckedIndexedAccess.
    /* v8 ignore next */
    attrs[name] = normalizeAttrValue(name, raw[name] ?? '');
  }
  return attrs;
}

/**
 * Recursively convert a DOM Node (xmldom) to a NormalizedNode tree.
 * Comment nodes and processing instruction nodes are skipped (adaptation #3
 * extends this: it already applied at every depth in the ported source, so
 * `<!--entity X-->` markers and `<?plantuml ...?>` instructions nested deep
 * inside `<g>` elements are dropped just like top-level ones).
 * Text node whitespace is collapsed.
 */
function convertNode(node: XmlNode): NormalizedNode | null {
  const nodeType = node.nodeType;

  if (nodeType === COMMENT_NODE || nodeType === PROCESSING_INSTRUCTION_NODE) {
    return null;
  }

  if (nodeType === TEXT_NODE) {
    // A real TEXT_NODE from xmldom always has a non-null nodeValue;
    // `?? ''` is required only by the DOM `nodeValue: string | null` typing.
    /* v8 ignore next */
    const raw = node.nodeValue ?? '';
    const normalized = raw.replace(/\s+/g, ' ').trim();
    if (normalized === '') return null; // skip whitespace-only text nodes
    return { type: 'text', text: normalized };
  }

  if (nodeType === ELEMENT_NODE) {
    // xmldom Element extends Node; cast to access Element-specific properties.
    const el = node as unknown as Element;
    const tag = el.tagName;
    const attrs = buildAttrs(el);

    // Recurse into children
    const children: NormalizedNode[] = [];
    const childNodes = el.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      const child = childNodes.item(i);
      if (child !== null) {
        // xmldom NodeList.item() returns Node (the xmldom Node type)
        const converted = convertNode(child as unknown as XmlNode);
        if (converted !== null) {
          children.push(converted);
        }
      }
    }

    return { type: 'element', tag, attrs, children };
  }

  // Skip any other node type (DOCTYPE, CDATA, etc.)
  return null;
}

/**
 * Parse an SVG string and return a normalized tree rooted at the `<svg>` element.
 *
 * - Strips `<?xml ...?>` and other processing instructions (e.g. plantuml.jar's
 *   `<?plantuml $version$?>` / `<?plantuml-src ...?>` markers), at any depth
 * - Removes XML comment nodes, at any depth
 * - Resolves `style="k:v;..."` into individual attributes (plantuml adaptation #1)
 * - Strips `data-*` attributes (plantuml adaptation #2)
 * - Sorts attributes alphabetically
 * - Collapses whitespace in text nodes
 * - Normalizes numeric attribute values to 6 significant figures
 */
export function normalizeSvg(svgString: string): NormalizedNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  // Find the root element (SVG), skipping processing instructions and comments
  const childNodes = doc.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes.item(i);
    if (child !== null && child.nodeType === ELEMENT_NODE) {
      const result = convertNode(child);
      if (result !== null) return result;
    }
  }

  /* v8 ignore start */
  // Unreachable in practice: xmldom's own parser raises a fatal error for
  // any input lacking a root element before this loop ever runs (see
  // normalize.test.ts). Kept only to satisfy TypeScript's requirement that
  // every path through a non-void function return a value.
  throw new Error('normalizeSvg: no root element found in SVG string');
  /* v8 ignore stop */
}
