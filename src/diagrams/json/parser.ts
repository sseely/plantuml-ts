/**
 * Parser for PlantUML JSON diagrams (@startjson / @endjson).
 *
 * Separates #highlight directives from the JSON body, parses both,
 * and returns a JsonDiagramAST.
 */

import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import { createSpriteRegistry, matchSpriteCommand } from '../../core/sprite-commands.js';
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
 * These are stripped and never passed to JSON.parse(). `title ` is handled by
 * the shared annotation matcher (mission G0b/T8) before this regex is ever
 * consulted, so it never matches a title line in practice -- kept in the
 * alternation for parity with the upstream StyleExtractor directive set.
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
export function parseJson(source: UmlSource): JsonDiagramAST {
  const highlights: HighlightDirective[] = [];
  const bodyLines: string[] = [];
  let inStyleBlock = false;
  const annotations = createAnnotations();
  const sprites = createSpriteRegistry();
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

    // title/caption/legend/header/footer/mainframe (mission G0b/T8) — same
    // before-body-only scope as the RE_DIRECTIVE strip below. Title used to
    // be excluded here and captured into a bespoke `title` field (T6); T8
    // migrated it onto `annotations.title` like the other five, so this is
    // now an unconditional matcher try.
    if (bodyLines.length === 0) {
      const annotationMatch = matchAnnotationCommand(lines, i, annotations);
      if (annotationMatch !== null) {
        i += annotationMatch.consumed - 1;
        continue;
      }
      // `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4):
      // same before-body-only scope as the chrome matcher above, tried
      // immediately after it.
      const spriteMatch = matchSpriteCommand(lines, i, sprites);
      if (spriteMatch !== null) {
        i += spriteMatch.consumed - 1;
        continue;
      }
    }

    // Directives before the JSON body — only recognised before body starts.
    // `title ` no longer reaches here (consumed by the matcher above); the
    // remaining directives (skinparam, scale, hide…) are silently ignored.
    if (bodyLines.length === 0 && RE_DIRECTIVE.test(trimmed)) {
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
  // annotation-matcher check; T8 removed the bespoke title field/branch but
  // did not reduce the function below threshold).
  return { root, parseError, highlights, annotations, sprites };
}
