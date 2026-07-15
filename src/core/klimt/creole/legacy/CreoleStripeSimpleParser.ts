/**
 * CreoleStripeSimpleParser — classifies ONE already-`\n`-split display line
 * into a `StripeStyleType` + its content, per upstream's regex cascade.
 *
 * Upstream: klimt/creole/legacy/CreoleStripeSimpleParser.java's constructor
 * (java :92-159) — tried IN ORDER: `SECTION_HEADER_PATTERN` (`^--([^-]*)--$`),
 * `SECTION_TITLE_PATTERN` (`^==([^=]*)==$`), `SECTION_SEPARATOR_PATTERN`
 * (`^===*==$`), `DOUBLE_DOT_DELIMITED_LINE` (`^\.\.([^.]*)\.\.$`),
 * [FULL-mode-only `*`/`#` bullet-list patterns — not ported, see
 * `StripeStyleType.ts`'s doc comment], `EQUALS_HEADING_PATTERN`
 * (`^(=+)(.+)$`), else NORMAL.
 *
 * G1 I9b's `classifySeparatorLine` (`EntityImageDescriptionSupport.ts`,
 * pre-E2r) already mirrored the FIRST FOUR patterns' EMPTY-capture case only
 * (a bare `----`/`====`/`....`, no text between the delimiters) — this
 * mission subsumes it: `classifyStripeLine` below reimplements those same
 * four patterns faithfully, INCLUDING the non-empty-capture case each one
 * also matches upstream (`--Header--`/`==Header==`/`..Header..`).
 *
 * Jar-verified finding (this iteration, `component/queue3` displayText
 * `"queue1\n--Header--\ntoto"`, `-DPLANTUML_DETERMINISTIC_TEXT=true`): a
 * non-empty-captured separator line is `StripeStyleType.HORIZONTAL_LINE`
 * upstream too (`CreoleHorizontalLine.create`'s label-drawing branch — TWO
 * short `<line>` elements flanking a plain, UNSTYLED "Header" `<text>`, NOT
 * struck-through or otherwise creole-processed, and NOT the bare single/
 * double `<line>` this port's `drawSeparatorLine` already draws for the
 * EMPTY-capture case). That embedded-label rendering is a NEW, still-
 * unported mechanism (out of L1's bold/italic/underline/wave/strike +
 * `==`-heading charter) — reported here, not built. Classified as `LITERAL`
 * below: content renders as ONE plain, unstyled text run, bypassing the
 * style-command engine entirely (matching this line's pre-E2r behavior,
 * which G1 I9b's own test suite pins — `entity-image-description-separator
 * .test.ts`, "a non-empty '--Header--' line is UNCHANGED"). This is
 * DELIBERATELY not routed through NORMAL: `--Header--` also happens to
 * satisfy the STRIKE creole syntax (`--...--`) as plain text, which would
 * incorrectly strike "Header" if reprocessed by the style engine — a
 * mismatch this jar capture rules out directly.
 *
 * A second jar-verified finding (`"queue1\n-----\ntoto"`, a 5-dash run that
 * matches NONE of the four separator patterns — `[^-]*`/`[^.]*` exclude the
 * delimiter character itself, so a run one dash too long never satisfies
 * the EMPTY-OR-labelled bracket shape) confirms upstream genuinely DOES
 * reach the style-command engine as ordinary `NORMAL` text for this case,
 * and the creole `--...--` STRIKE syntax partially matches it (`--` + `-`
 * + `--`, non-greedy) — jar output: a single struck-through `-` `<text>`
 * element, textLength 4.6375. `classifyStripeLine` reports this shape as
 * plain `NORMAL` (routes through the full style-command engine, correctly
 * producing that same struck-through "-"), NOT `LITERAL`.
 *
 * NEW in this mission (I4c mechanism 2/5): `EQUALS_HEADING_PATTERN`
 * (a single leading `=+` run with NO matching trailing `==`, e.g. `==P2`) —
 * previously entirely unclassified (fell through to NORMAL, `==` rendered
 * literally). Now reports `HEADING` with the `=` run's length-1 as `order`
 * and the remaining text (delimiter stripped) as content, matching upstream
 * exactly (`EQUALS_HEADING_PATTERN.matcher(line)`, `StringUtils.trin` applied
 * to the captured group — ported as a plain `.trim()`-equivalent below,
 * `trimHeadingContent`, since `StringUtils.trin` strips only `<= ' '`
 * characters, the same distinction `driver-text-svg.ts#trin` already
 * documents for an unrelated call site — NOT reused directly, that
 * function lives in a different layer and isn't exported).
 */

export type StripeClassification =
  | { readonly type: 'HORIZONTAL_LINE'; readonly style: '-' | '=' | '.' }
  | { readonly type: 'HEADING'; readonly content: string; readonly order: number }
  | { readonly type: 'NORMAL'; readonly content: string }
  | { readonly type: 'LITERAL'; readonly content: string };

const SECTION_HEADER_PATTERN = /^--([^-]*)--$/;
const SECTION_TITLE_PATTERN = /^==([^=]*)==$/;
const SECTION_SEPARATOR_PATTERN = /^=+$/;
const DOUBLE_DOT_PATTERN = /^\.\.([^.]*)\.\.$/;
const EQUALS_HEADING_PATTERN = /^(=+)(.+)$/;

/** Upstream: `StringUtils.trin` — trims only characters whose code point is
 *  <= U+0020, from both ends (NOT JS's `.trim()`, which also strips U+00A0
 *  NBSP — same distinction `driver-text-svg.ts#trin` documents; duplicated
 *  here rather than imported since that function is a different layer's
 *  private helper, and this one-liner is cheaper than threading a new
 *  cross-module dependency for it). */
function trimHeadingContent(text: string): string {
  let start = 0;
  let end = text.length - 1;
  while (start <= end && text.charCodeAt(start) <= 0x20) start++;
  while (end >= start && text.charCodeAt(end) <= 0x20) end--;
  return text.slice(start, end + 1);
}

/** Upstream classifies EVERY match of these four patterns as
 *  `HORIZONTAL_LINE` (empty OR non-empty capture alike) — but a non-empty
 *  capture needs the still-unported embedded-label atom (see module doc
 *  comment). `LITERAL` is this port's own scoped stand-in for that specific
 *  gap, not an upstream classification value. */
function bareOrLiteral(captured: string, style: '-' | '=' | '.', fullLine: string): StripeClassification {
  return captured === '' ? { type: 'HORIZONTAL_LINE', style } : { type: 'LITERAL', content: fullLine };
}

export function classifyStripeLine(line: string): StripeClassification {
  const header = SECTION_HEADER_PATTERN.exec(line);
  if (header !== null) return bareOrLiteral(header[1]!, '-', line);

  const title = SECTION_TITLE_PATTERN.exec(line);
  if (title !== null) return bareOrLiteral(title[1]!, '=', line);

  if (line.length >= 4 && SECTION_SEPARATOR_PATTERN.test(line)) return { type: 'HORIZONTAL_LINE', style: '=' };

  const dots = DOUBLE_DOT_PATTERN.exec(line);
  if (dots !== null) return bareOrLiteral(dots[1]!, '.', line);

  const heading = EQUALS_HEADING_PATTERN.exec(line);
  if (heading !== null) {
    return { type: 'HEADING', content: trimHeadingContent(heading[2]!), order: heading[1]!.length - 1 };
  }

  return { type: 'NORMAL', content: line };
}
