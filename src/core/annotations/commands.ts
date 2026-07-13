/**
 * `matchAnnotationCommand` — the line-oriented matcher parsers call at
 * their own command-dispatch position (decisions.md D3: extraction inside
 * each parser, never a textual pre-pass, so a `title`-shaped line inside a
 * `note ... end note` block is never stolen).
 *
 * Ports the 11 upstream `Command*` regexes from
 * `net/sourceforge/plantuml/command/Command{Title,MultilinesTitle,Caption,
 * MultilinesCaption,Legend,MultilinesLegend,Header,MultilinesHeader,
 * Footer,MultilinesFooter,Mainframe}.java`, tried in
 * `CommonCommands.addTitleCommands` registration order: Title, Mainframe,
 * Caption, MultilinesCaption, MultilinesTitle, MultilinesLegend, Legend,
 * Footer, MultilinesFooter, Header, MultilinesHeader.
 *
 * Regex-charset translation (`[%s]`/`[%g]`/`[%pLN]`), per the established
 * project idiom (see class-json-commands.ts / class-map-commands.ts /
 * state-commands-declarations.ts for the same choices already made
 * elsewhere in this port):
 *   - `%s` (Pattern2: normal or non-breaking space) -> `\s` here
 *     (non-breaking-space nuance dropped, matching the existing precedent
 *     in e.g. class-json-commands.ts's CODE/COLOR fragments).
 *   - `%g` (Pattern2: straight quote + curly quotes + invisible-quote
 *     marker) -> a bare straight double-quote, written as `\x22` (never a
 *     literal double-quote glyph anywhere in this file or its comments —
 *     an unescaped one desyncs the project's complexity-hook scanner).
 *   - `%pLN` (Unicode letter/digit) -> `\w` (ASCII word chars; the
 *     acknowledged Unicode-charset divergence already documented in
 *     state-transitions.ts and class-map-commands.ts).
 * All patterns are built from string concatenation + `new RegExp(p, 'i')`,
 * never a `/regex/` literal containing `{`/`<`/`>` — regex LITERALS with
 * those characters are known to desync the complexity hook's line-span
 * scanner on unrelated functions in the same file.
 *
 * @see ~/git/plantuml/.../command/CommandTitle.java
 * @see ~/git/plantuml/.../command/CommandMultilinesTitle.java
 * @see ~/git/plantuml/.../command/CommandCaption.java
 * @see ~/git/plantuml/.../command/CommandMultilinesCaption.java
 * @see ~/git/plantuml/.../command/CommandLegend.java
 * @see ~/git/plantuml/.../command/CommandMultilinesLegend.java
 * @see ~/git/plantuml/.../command/CommandHeader.java
 * @see ~/git/plantuml/.../command/CommandMultilinesHeader.java
 * @see ~/git/plantuml/.../command/CommandFooter.java
 * @see ~/git/plantuml/.../command/CommandMultilinesFooter.java
 * @see ~/git/plantuml/.../command/CommandMainframe.java
 * @see ~/git/plantuml/.../command/CommonCommands.java:109-124 (order)
 */

import { HorizontalAlignment } from '../klimt/geom/HorizontalAlignment.js';
import { VerticalAlignment } from '../klimt/geom/VerticalAlignment.js';
import {
  type DiagramAnnotations,
  horizontalAlignmentFromString,
  setCaption,
  setLegend,
  setMainFrame,
  setTitle,
  singleDisplayPositioned,
  updateFooter,
  updateHeader,
  verticalAlignmentFromString,
} from './model.js';

// ---------------------------------------------------------------------------
// Regex fragments
// ---------------------------------------------------------------------------

/** A literal double-quote, via unicode escape so this file contains zero
 *  raw double-quote glyphs (code or comments) -- see the file doc above. */
const DQUOTE = '\x22';

/** `(?:[%s]*:[%s]*|[%s]+)` -- colon form or one-or-more spaces. */
const SEP = '(?:\\s*:\\s*|\\s+)';

/** `[%g](.*)[%g]` | `(.*[%pLN_.].*)` -- quoted (group A, may be empty) or
 *  unquoted (group B, must contain a word/dot char) value. Two capture
 *  groups per use; callers pass in the 1-based index of the quoted group
 *  ({@link pickValueAt}). */
const VALUE = '(?:' + DQUOTE + '(.*)' + DQUOTE + '|(.*[\\w.].*))';

/** `(left|right|center)` -- header/footer/legend alignment word. */
const POSITION = '(left|right|center)';

function buildRegex(pattern: string): RegExp {
  return new RegExp(pattern, 'i');
}

function pickValueAt(m: RegExpMatchArray, quotedIndex: number, unquotedIndex: number): string {
  const quoted = m[quotedIndex];
  if (quoted !== undefined) return quoted;
  // The VALUE regex is a two-branch alternation (quoted | unquoted); if the
  // overall match succeeded and the quoted group is undefined, the unquoted
  // group is guaranteed to have matched instead.
  return m[unquotedIndex]!;
}

// Single-line command regexes.
const TITLE_RE = buildRegex('^title' + SEP + VALUE + '$');
const CAPTION_RE = buildRegex('^caption' + SEP + VALUE + '$');
const LEGEND_RE = buildRegex('^legend' + SEP + VALUE + '$');
const HEADER_RE = buildRegex('^(?:' + POSITION + ')?\\s*header' + SEP + VALUE + '$');
const FOOTER_RE = buildRegex('^(?:' + POSITION + ')?\\s*footer' + SEP + VALUE + '$');
const MAINFRAME_RE = buildRegex('^mainframe' + SEP + '(.*[\\w.].*)$');

// Multiline start/end regexes.
const TITLE_START_RE = buildRegex('^title$');
const TITLE_END_RE = buildRegex('^end\\s?title$');
const CAPTION_START_RE = buildRegex('^caption$');
const CAPTION_END_RE = buildRegex('^end\\s?caption$');
const LEGEND_START_RE = buildRegex('^legend(?:\\s+(top|bottom))?(?:\\s+(left|right|center))?$');
const LEGEND_END_RE = buildRegex('^end\\s?legend$');
const HEADER_START_RE = buildRegex('^(?:' + POSITION + '?\\s*)header$');
const HEADER_END_RE = buildRegex('^end\\s?header$');
const FOOTER_START_RE = buildRegex('^(?:' + POSITION + '?\\s*)footer$');
const FOOTER_END_RE = buildRegex('^end\\s?footer$');

// ---------------------------------------------------------------------------
// Display-line splitting (single-line values) and body processing
// (multiline bodies) -- see model.ts's file doc for the Display-as-raw-
// string[] scope reduction this belongs to.
// ---------------------------------------------------------------------------

/**
 * Scope-reduced port of `Display.getWithNewlines` (the `getWithNewlines3`
 * shape specifically: backslash-n/t/backslash only). NOT ported: Pragma
 * warnings, `<math>`/`<latex>`/`[[ ]]` raw-mode suppression, and the
 * `\r`/`\l` natural-horizontal-alignment capture -- all downstream of
 * creole rendering, out of scope per the T1 spec: creole is parsed later,
 * at draw time.
 * @see ~/git/plantuml/.../klimt/creole/Display.java:230-255 (getWithNewlines3)
 */
function splitDisplayLine(raw: string): string[] {
  const result: string[] = [];
  let current = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\' && i < raw.length - 1) {
      const c2 = raw[i + 1];
      i++;
      if (c2 === 'n') {
        result.push(current);
        current = '';
      } else if (c2 === 't') {
        current += '\t';
      } else if (c2 === '\\') {
        current += c2;
      } else {
        current += c;
        current += c2;
      }
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

/** `Display.replaceBackslashT`: literal `\t` (backslash + t) -> real tab,
 *  per line. Title/Caption/Legend multiline bodies only -- Header/Footer
 *  multiline does NOT call this upstream (see {@link matchHeaderMultiline}
 *  doc). @see ~/git/plantuml/.../klimt/creole/Display.java:146-154 */
function replaceBackslashT(line: string): string {
  return line.split('\\t').join('\t');
}

/** `BlocLines.removeEmptyColumns`: strips the leading whitespace column
 *  common to every non-empty line, one column at a time, as long as one
 *  remains. Title/Caption/Legend multiline bodies (not Header/Footer).
 * @see ~/git/plantuml/.../utils/BlocLines.java:234-263 */
function removeEmptyColumns(bodyLines: readonly string[]): string[] {
  let lines: string[] = [...bodyLines];
  while (isFirstColumnRemovable(lines)) {
    lines = lines.map((l) => (l.length > 0 ? l.slice(1) : l));
  }
  return lines;
}

function isFirstColumnRemovable(lines: readonly string[]): boolean {
  let allEmpty = true;
  for (const l of lines) {
    if (l.length === 0) continue;
    allEmpty = false;
    const c = l[0];
    if (c !== ' ' && c !== '\t') return false;
  }
  return !allEmpty;
}

// ---------------------------------------------------------------------------
// Single-line matchers
// ---------------------------------------------------------------------------

function matchTitle(line: string, i: number, a: DiagramAnnotations): { consumed: number } | null {
  const m = TITLE_RE.exec(line);
  if (!m) return null;
  const display = splitDisplayLine(pickValueAt(m, 1, 2));
  setTitle(a, singleDisplayPositioned(display, HorizontalAlignment.CENTER, VerticalAlignment.TOP, i));
  return { consumed: 1 };
}

function matchCaption(line: string, i: number, a: DiagramAnnotations): { consumed: number } | null {
  const m = CAPTION_RE.exec(line);
  if (!m) return null;
  const display = splitDisplayLine(pickValueAt(m, 1, 2));
  setCaption(a, singleDisplayPositioned(display, HorizontalAlignment.CENTER, VerticalAlignment.BOTTOM, i));
  return { consumed: 1 };
}

/** Single-line legend: always CENTER/BOTTOM, no options (unlike the
 *  `legend ... end legend` block form). @see CommandLegend.java:80-86 */
function matchLegend(line: string, i: number, a: DiagramAnnotations): { consumed: number } | null {
  const m = LEGEND_RE.exec(line);
  if (!m) return null;
  const display = splitDisplayLine(pickValueAt(m, 1, 2));
  setLegend(a, singleDisplayPositioned(display, HorizontalAlignment.CENTER, VerticalAlignment.BOTTOM, i));
  return { consumed: 1 };
}

function matchHeader(line: string, i: number, a: DiagramAnnotations): { consumed: number } | null {
  const m = HEADER_RE.exec(line);
  if (!m) return null;
  const position = m[1];
  const ha = position !== undefined ? horizontalAlignmentFromString(position) : null;
  const display = splitDisplayLine(pickValueAt(m, 2, 3));
  updateHeader(a, i, display, ha);
  return { consumed: 1 };
}

function matchFooter(line: string, i: number, a: DiagramAnnotations): { consumed: number } | null {
  const m = FOOTER_RE.exec(line);
  if (!m) return null;
  const position = m[1];
  const ha = position !== undefined ? horizontalAlignmentFromString(position) : null;
  const display = splitDisplayLine(pickValueAt(m, 2, 3));
  updateFooter(a, i, display, ha);
  return { consumed: 1 };
}

/** Unquoted-only (no `[%g]` alternative upstream, unlike the other five
 *  commands), and both alignments are `null` (drawn as a frame, not text
 *  aligned within a band). @see CommandMainframe.java:57-64,76-81 */
function matchMainframe(line: string, i: number, a: DiagramAnnotations): { consumed: number } | null {
  const m = MAINFRAME_RE.exec(line);
  if (!m) return null;
  // MAINFRAME_RE's LABEL group is mandatory (not inside a RegexOptional), so
  // it is always defined once the overall match succeeds.
  const display = splitDisplayLine(m[1]!);
  setMainFrame(a, singleDisplayPositioned(display, null, null, i));
  return { consumed: 1 };
}

// ---------------------------------------------------------------------------
// Multiline matchers
// ---------------------------------------------------------------------------

interface MultilineBlock {
  readonly body: readonly string[];
  readonly consumed: number;
  readonly startMatch: RegExpMatchArray;
}

/** Shared block scanner: matches `startRe` against the (trimmed) line at
 *  `i` -- mirroring upstream matching the start/end pattern against
 *  `getTrimmed()` lines, not raw ones -- then scans forward for the first
 *  (trimmed) line matching `endRe`. Returns `null` (not a match at all) if
 *  no end marker is ever found before EOF: this port has no partial-match
 *  accumulation state machine (upstream's `CommandControl.OK_PARTIAL`), so
 *  an unterminated block falls through to being tried as a single-line
 *  command instead of silently swallowing the rest of the file -- a
 *  deliberate, documented simplification. */
function scanMultilineBlock(
  lines: readonly string[],
  i: number,
  startRe: RegExp,
  endRe: RegExp,
): MultilineBlock | null {
  const startMatch = startRe.exec((lines[i] ?? '').trim());
  if (!startMatch) return null;
  for (let j = i + 1; j < lines.length; j++) {
    // j is bounded by the loop condition above, so lines[j] is always defined.
    if (endRe.test(lines[j]!.trim())) {
      return { body: lines.slice(i + 1, j), consumed: j - i + 1, startMatch };
    }
  }
  return null;
}

function matchTitleMultiline(
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
): { consumed: number } | null {
  const block = scanMultilineBlock(lines, i, TITLE_START_RE, TITLE_END_RE);
  if (!block) return null;
  const body = removeEmptyColumns(block.body);
  if (body.length > 0) {
    setTitle(
      a,
      singleDisplayPositioned(body.map(replaceBackslashT), HorizontalAlignment.CENTER, VerticalAlignment.TOP, i),
    );
  }
  return { consumed: block.consumed };
}

function matchCaptionMultiline(
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
): { consumed: number } | null {
  const block = scanMultilineBlock(lines, i, CAPTION_START_RE, CAPTION_END_RE);
  if (!block) return null;
  const body = removeEmptyColumns(block.body);
  if (body.length > 0) {
    setCaption(
      a,
      singleDisplayPositioned(body.map(replaceBackslashT), HorizontalAlignment.CENTER, VerticalAlignment.BOTTOM, i),
    );
  }
  return { consumed: block.consumed };
}

/** VALIGN (top|bottom, default BOTTOM) before ALIGN (left|right|center,
 *  default CENTER) -- both optional, in that order, on the opening line.
 * @see CommandMultilinesLegend.java:65-78,111-132 */
function matchLegendMultiline(
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
): { consumed: number } | null {
  const block = scanMultilineBlock(lines, i, LEGEND_START_RE, LEGEND_END_RE);
  if (!block) return null;
  const body = removeEmptyColumns(block.body);
  if (body.length > 0) {
    const valign = verticalAlignmentFromString(block.startMatch[1]);
    const align = horizontalAlignmentFromString(block.startMatch[2]) ?? HorizontalAlignment.CENTER;
    setLegend(a, singleDisplayPositioned(body.map(replaceBackslashT), align, valign, i));
  }
  return { consumed: block.consumed };
}

/** Unlike Title/Caption/Legend, upstream's `CommandMultilinesHeader`
 *  calls `BlocLines.trim()` (each line individually stripped of leading
 *  AND trailing whitespace, destroying relative indentation) and never
 *  calls `removeEmptyColumns`/`replaceBackslashT` at all -- ported as the
 *  documented asymmetry it is, not normalized to match Title/Caption/
 *  Legend's behavior.
 * @see CommandMultilinesHeader.java:85-106 */
function matchHeaderMultiline(
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
): { consumed: number } | null {
  const block = scanMultilineBlock(lines, i, HEADER_START_RE, HEADER_END_RE);
  if (!block) return null;
  const body = block.body.map((l) => l.trim());
  if (body.length > 0) {
    const position = block.startMatch[1];
    const ha = position !== undefined ? horizontalAlignmentFromString(position) : null;
    updateHeader(a, i, body, ha);
  }
  return { consumed: block.consumed };
}

/** @see CommandMultilinesFooter.java:85-106 (same asymmetry as header) */
function matchFooterMultiline(
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
): { consumed: number } | null {
  const block = scanMultilineBlock(lines, i, FOOTER_START_RE, FOOTER_END_RE);
  if (!block) return null;
  const body = block.body.map((l) => l.trim());
  if (body.length > 0) {
    const position = block.startMatch[1];
    const ha = position !== undefined ? horizontalAlignmentFromString(position) : null;
    updateFooter(a, i, body, ha);
  }
  return { consumed: block.consumed };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** A single command family's matcher, normalized to the same shape so
 *  {@link matchAnnotationCommand} can iterate a plain ordered list instead
 *  of a long chained-`??` expression (the chain form measured CCN 25 on a
 *  single function -- the project's complexity hook treats each `??` as
 *  two branch points -- despite being a flat, unconditional priority
 *  list; a loop over data is both lower-complexity and easier to extend). */
type AnnotationMatcher = (
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
) => { consumed: number } | null;

/** Registration order mirrors `CommonCommands.addTitleCommands` exactly:
 *  Title, Mainframe, Caption, MultilinesCaption, MultilinesTitle,
 *  MultilinesLegend, Legend, Footer, MultilinesFooter, Header,
 *  MultilinesHeader.
 * @see ~/git/plantuml/.../command/CommonCommands.java:109-124 */
const ORDERED_MATCHERS: readonly AnnotationMatcher[] = [
  (lines, i, a) => matchTitle(lines[i] ?? '', i, a),
  (lines, i, a) => matchMainframe(lines[i] ?? '', i, a),
  (lines, i, a) => matchCaption(lines[i] ?? '', i, a),
  matchCaptionMultiline,
  matchTitleMultiline,
  matchLegendMultiline,
  (lines, i, a) => matchLegend(lines[i] ?? '', i, a),
  (lines, i, a) => matchFooter(lines[i] ?? '', i, a),
  matchFooterMultiline,
  (lines, i, a) => matchHeader(lines[i] ?? '', i, a),
  matchHeaderMultiline,
];

/**
 * Tries every annotation command at line `i`, in upstream's
 * `CommonCommands.addTitleCommands` registration order, mutating `a` in
 * place on a match (see model.ts's file doc for the mutation contract).
 * Returns `null` (no mutation) if line `i` matches none of them.
 */
export function matchAnnotationCommand(
  lines: readonly string[],
  i: number,
  a: DiagramAnnotations,
): { consumed: number } | null {
  for (const matcher of ORDERED_MATCHERS) {
    const result = matcher(lines, i, a);
    if (result !== null) return result;
  }
  return null;
}
