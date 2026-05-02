/**
 * Parser for PlantUML JSON diagrams (@startjson / @endjson).
 *
 * Separates #highlight directives from the JSON body, parses both,
 * and returns a JsonDiagramAST.
 */

import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import type { UmlSource } from '../../core/block-extractor.js';
import type { HighlightDirective, JsonDiagramAST } from './ast.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGHLIGHT_PREFIX = '#highlight ';

/** Matches a trailing <<stereotype>> annotation, capturing the class name. */
const RE_STEREOTYPE_SUFFIX = /\s*<<([^>]*)>>\s*$/u;

/**
 * Directives that may appear before the JSON body (mirrors Java StyleExtractor).
 * These are stripped and never passed to JSON.parse().
 */
const RE_DIRECTIVE = /^(?:title |skinparam |scale |skin |hide |!assume |!pragma )/i;

// ---------------------------------------------------------------------------
// Highlight line parsing
// ---------------------------------------------------------------------------

/**
 * Parses a single #highlight line into a HighlightDirective.
 *
 * Input (after stripping the "#highlight " prefix):
 *   `"a" / "b" / "c" <<h1>>`
 * Output:
 *   `{ path: ['a', 'b', 'c'], styleClass: 'h1' }`
 */
function parseHighlightLine(raw: string): HighlightDirective {
  // Strip prefix
  const body = raw.slice(HIGHLIGHT_PREFIX.length);

  // Capture optional trailing <<stereotype>>
  const stereotypeMatch = RE_STEREOTYPE_SUFFIX.exec(body);
  const styleClass = stereotypeMatch ? stereotypeMatch[1]!.trim().toLowerCase() : '';
  const withoutStereotype = stereotypeMatch
    ? body.slice(0, body.length - stereotypeMatch[0].length)
    : body;

  // Split on " / " (quote-space-slash-space-quote boundary)
  const segments = withoutStereotype.split('" / "');

  const path = segments.map((seg) => seg.trim().replace(/^"|"$/gu, ''));
  return { path, styleClass };
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
  const highlights: HighlightDirective[] = [];
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

    // <style>...</style> blocks — stripped by preprocessor before reaching here;
    // this guard handles any that slip through (e.g. in unit tests).
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
  let parseError = false;
  if (jsonText.trim() !== '') {
    const errors: ParseError[] = [];
    root = parseJsonc(jsonText, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
      parseError = true;
      root = null;
    }
  }

  return title !== undefined
    ? { root, parseError, highlights, title }
    : { root, parseError, highlights };
}
