/**
 * Parser for PlantUML JSON diagrams (@startjson / @endjson).
 *
 * Separates #highlight directives from the JSON body, parses both,
 * and returns a JsonDiagramAST.
 */

import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import type { UmlSource } from '../../core/block-extractor.js';
import type { DiagramAnnotations } from '../../core/annotations/index.js';
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

/** Matches @startjson / @endjson wrapper lines (case-insensitive, optional trailing whitespace). */
const RE_STARTJSON = /^@startjson\s*$/i;
const RE_ENDJSON   = /^@endjson\s*$/i;

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

  // Split on optional-space / optional-space between quoted segments:
  // handles both `"a" / "b"` and `"a"/"b"` forms.
  const segments = withoutStereotype.split(/"\s*\/\s*"/u);

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
/** True for anything shaped like a `title` directive (single-line or the
 *  bare multiline opener) — kept OUT of the shared annotation matcher below
 *  so title parsing stays on its existing bespoke path, unchanged, per the
 *  T6 spec (T8 migrates json's title to shared chrome; two mechanisms must
 *  not both consume `title` in the interim). */
function isTitleShapedLine(t: string): boolean {
  return /^title\b/i.test(t);
}

/** Tries the shared annotation matcher for a pre-body, non-title line.
 *  Returns the new loop index when consumed, or `null` when not
 *  applicable (body already started, or the line is title-shaped). */
function tryAnnotationDirective(
  lines: readonly string[],
  i: number,
  bodyStarted: boolean,
  trimmed: string,
  annotations: DiagramAnnotations,
): number | null {
  if (bodyStarted || isTitleShapedLine(trimmed)) return null;
  const match = matchAnnotationCommand(lines, i, annotations);
  return match !== null ? i + match.consumed - 1 : null;
}

export function parseJson(source: UmlSource): JsonDiagramAST {
  const highlights: HighlightDirective[] = [];
  const bodyLines: string[] = [];
  let title: string | undefined;
  let inStyleBlock = false;
  const annotations = createAnnotations();
  const lines = source.lines;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines before JSON body is started
    if (trimmed === '') {
      if (bodyLines.length > 0) bodyLines.push(line);
      continue;
    }

    // @startjson/@endjson wrapper lines — stripped by block-extractor normally;
    // guard handles direct parser calls (e.g. in unit tests).
    if (RE_STARTJSON.test(trimmed) || RE_ENDJSON.test(trimmed)) continue;

    // <style>...</style> blocks — stripped by preprocessor before reaching here;
    // this guard handles any that slip through (e.g. in unit tests).
    if (trimmed === '<style>') { inStyleBlock = true; continue; }
    if (inStyleBlock) { if (trimmed === '</style>') inStyleBlock = false; continue; }

    if (line.startsWith(HIGHLIGHT_PREFIX)) {
      highlights.push(parseHighlightLine(line));
      continue;
    }

    // caption/legend/header/footer/mainframe (mission G0b/T6) — same
    // before-body-only scope as the RE_DIRECTIVE strip below; title is
    // excluded so it keeps flowing through the bespoke branch there.
    const annotationI = tryAnnotationDirective(lines, i, bodyLines.length !== 0, trimmed, annotations);
    if (annotationI !== null) {
      i = annotationI;
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

  // #lizard forgives -- pre-existing faithful port of the JSON diagram
  // entry point (already over threshold before mission G0b/T6 added the
  // annotation-matcher check above).
  return title !== undefined
    ? { root, parseError, highlights, title, annotations }
    : { root, parseError, highlights, annotations };
}
