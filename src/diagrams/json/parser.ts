/**
 * Parser for PlantUML JSON diagrams (@startjson / @endjson).
 *
 * Separates #highlight directives from the JSON body, parses both,
 * and returns a JsonDiagramAST.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { JsonDiagramAST } from './ast.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGHLIGHT_PREFIX = '#highlight ';

/** Matches a trailing <<stereotype>> annotation, including surrounding whitespace. */
const RE_STEREOTYPE_SUFFIX = /\s*<<[^>]*>>\s*$/u;

// ---------------------------------------------------------------------------
// Highlight line parsing
// ---------------------------------------------------------------------------

/**
 * Parses a single #highlight line into a path array.
 *
 * Input (after stripping the "#highlight " prefix):
 *   `"a" / "b" / "c" <<stereotype>>`
 * Output:
 *   `['a', 'b', 'c']`
 */
function parseHighlightLine(raw: string): readonly string[] {
  // Strip prefix
  const body = raw.slice(HIGHLIGHT_PREFIX.length);

  // Strip trailing <<stereotype>>
  const withoutStereotype = body.replace(RE_STEREOTYPE_SUFFIX, '');

  // Split on " / " (quote-space-slash-space-quote boundary)
  const segments = withoutStereotype.split('" / "');

  return segments.map((seg) => seg.trim().replace(/^"|"$/gu, ''));
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses a JSON diagram source into a JsonDiagramAST.
 *
 * Lines starting with "#highlight " are treated as highlight directives;
 * all other non-empty lines form the JSON body. The body is joined with
 * newlines and passed to JSON.parse. A SyntaxError yields root = null.
 */
export function parseJson(source: UmlSource): JsonDiagramAST {
  const highlights: (readonly string[])[] = [];
  const bodyLines: string[] = [];

  for (const line of source.lines) {
    if (line.startsWith(HIGHLIGHT_PREFIX)) {
      highlights.push(parseHighlightLine(line));
    } else {
      bodyLines.push(line);
    }
  }

  const jsonText = bodyLines.join('\n');

  let root: unknown = null;
  if (jsonText.trim() !== '') {
    try {
      root = JSON.parse(jsonText) as unknown;
    } catch (err) {
      if (err instanceof SyntaxError) {
        root = null;
      } else {
        throw err;
      }
    }
  }

  return { root, highlights };
}
