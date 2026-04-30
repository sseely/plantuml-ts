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

/**
 * Directives that may appear before the JSON body (mirrors Java StyleExtractor).
 * These are stripped and never passed to JSON.parse().
 */
const RE_DIRECTIVE = /^(?:title |skinparam |scale |skin |hide |!assume |!pragma )/i;

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
  let title: string | undefined;
  let inStyleBlock = false;

  for (const line of source.lines) {
    const trimmed = line.trim();

    // Skip empty lines before JSON body is started
    if (trimmed === '') {
      if (bodyLines.length > 0) bodyLines.push(line);
      continue;
    }

    // <style>...</style> blocks (matches Java StyleExtractor)
    if (trimmed === '<style>') { inStyleBlock = true; continue; }
    if (inStyleBlock) { if (trimmed === '</style>') inStyleBlock = false; continue; }

    if (line.startsWith(HIGHLIGHT_PREFIX)) {
      highlights.push(parseHighlightLine(line));
      continue;
    }

    // Directives before the JSON body — only recognised before body starts
    if (bodyLines.length === 0 && RE_DIRECTIVE.test(trimmed)) {
      if (/^title /i.test(trimmed)) {
        title = trimmed.slice('title '.length).trim();
      }
      // All other directives (skinparam, scale, hide…) are silently ignored
      continue;
    }

    bodyLines.push(line);
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

  return title !== undefined ? { root, highlights, title } : { root, highlights };
}
