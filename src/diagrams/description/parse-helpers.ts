/**
 * Pure, stateless helpers for the descriptive-diagram parser.
 *
 * Extracted so both modules stay under 500 lines and each function stays
 * under 30 NLOC. All regex literals that contain $, " or ' are pre-compiled
 * at module scope — Lizard 1.23.0 miscounts braces when those chars appear
 * inside /regex/ literals inside function bodies.
 */

import {
  KEYWORD_TO_SYMBOL,
  type USymbol,
} from '../../core/descriptive-keywords.js';
import type { DescriptiveNode } from './ast.js';

// ---------------------------------------------------------------------------
// Container symbols — exported so layout.ts and renderer.ts can import them.
// The 17 keywords upstream allows to open a `{` group: the SYMBOL alternation
// in descdiagram/command/CommandPackageWithUSymbol.java.
// ---------------------------------------------------------------------------

export const CONTAINER_SYMBOLS: ReadonlySet<USymbol> = new Set<USymbol>([
  'package',
  'rectangle',
  'hexagon',
  'node',
  'artifact',
  'folder',
  'file',
  'frame',
  'cloud',
  'action',
  'process',
  'database',
  'storage',
  'component',
  'card',
  'queue',
  'stack',
]);

// ---------------------------------------------------------------------------
// Named return-type interfaces (prevent Lizard brace-counting confusion)
// ---------------------------------------------------------------------------

export interface StereotypeResult {
  stereotype: string;
  remainder: string;
}

export interface ColorResult {
  color: string;
  remainder: string;
}

export interface LinkStereoResult {
  stereotype: string | undefined;
  label: string | undefined;
}

export interface TagsResult {
  tags: string[];
  remainder: string;
}

export interface NameSection {
  id: string;
  display: string;
  stereotype?: string;
  color?: string;
  tags?: string[];
}

interface IdDisplay {
  id: string;
  display: string;
}

// ---------------------------------------------------------------------------
// Module-level regex constants
// Lizard 1.23.0 miscounts brace depth when $, " or ' appear inside /regex/
// literals in function bodies, producing false NLOC attribution. Defining
// them here (outside any function) avoids the issue entirely.
// ---------------------------------------------------------------------------

// extractColor
// Color/style token (ColorParser.exp1): `#name`/`#RRGGBB`, optionally with
// `;`- and `:`-separated inline style directives (`#green;line:blue`,
// `#line:blue` style-only, `#red;line.dashed`), and gradients (`#c1\c2`,
// `#c1/c2`, `#c1|c2`, `#c1-c2` — the `[-\\|/]` separator in upstream
// ColorParser.COLOR_REGEXP). None add DOT structure — matched here only so the
// id/display parse cleanly (else the color leaks into the display and inflates
// the node width).
const RE_COLOR = /(#[\w:;.#\\/|-]+)\s*$/;

// extractTags — Stereotag.pattern() (net.sourceforge.plantuml.stereo
// .Stereotag:42-45): a whitespace-separated `$name` token, name excluding
// whitespace/braces/quotes/angle-brackets/'$' itself. Matched whole-token
// (not substring) so a `$var` reference embedded inside other syntax, e.g.
// `%get_json_type($json_object)`, is never mistaken for a tag — Stereotag
// only ever appears as its own token, never glued to surrounding text.
const RE_TAG_TOKEN = new RegExp('^\\$[^\\s{}"\'<>$]+$');

// parseAliasForms — quoted / paren / alias forms
// DISPLAY-quoted "as" branches (CommandCreateElementFull.java:87-94,
// DISPLAY2/CODE2): `new RegexLeaf("as")` has no leading spaceZeroOrMore —
// zero space before "as" is legal (`"Long Name"as LN`), only
// spaceOneOrMore AFTER "as" is required. \s* (not \s+) before "as" here.
const RE_DQ_AS_ALIAS = /^"([^"]+)"\s*as\s+(\S+)$/;
const RE_SQ_AS_ALIAS = /^'([^']+)'\s+as\s+(\S+)$/;
const RE_ID_AS_DQ   = /^(\S+)\s+as\s+"([^"]+)"$/;
const RE_ID_AS_SQ   = /^(\S+)\s+as\s+'([^']+)'$/;
const RE_PAREN_ALIAS = /^\(([^)]+)\)\s+as\s+(\S+|\([^)]+\)|:[^:]+:)$/;
const RE_DQ_AS_WRAPPED = /^"([^"]+)"\s*as\s+(\([^)]+\)|:[^:]+:|\[[^\]]+\])$/;
// CODE as :wrapped: — bare code, colon/paren/bracket-wrapped display
// (`Admin as :Main Admin:`). Display keeps its notation stripped by cleanId.
const RE_ID_AS_WRAPPED = /^(\S+)\s+as\s+(\([^)]+\)|:[^:]+:|\[[^\]]+\])$/;
const RE_PAREN_ONLY  = /^\(([^)]+)\)$/;
const RE_PLAIN_ALIAS = /^(\S+)\s+as\s+(\S+)$/;

// parseNameSection — quoted-only form
const RE_DQ_ONLY = /^"([^"]+)"$/;

// ---------------------------------------------------------------------------
// Node factory
// ---------------------------------------------------------------------------

/** Build a DescriptiveNode, omitting optional fields when undefined. */
export function makeNode(
  id: string,
  display: string,
  symbol: USymbol,
  stereotype?: string,
  color?: string,
  tags?: string[],
): DescriptiveNode {
  const node: DescriptiveNode = { id, display, symbol, children: [] };
  if (stereotype !== undefined) node.stereotype = stereotype;
  if (color !== undefined) node.color = color;
  if (tags !== undefined) node.tags = tags;
  return node;
}

// ---------------------------------------------------------------------------
// cleanId — DescriptionDiagram.cleanId / CucaDiagram.cleanId
// ---------------------------------------------------------------------------

/**
 * `isDoubleQuote` (StringUtils.java:90-92): ASCII quote plus the curly and
 * guillemet variants PlantUML also accepts as quote delimiters.
 */
function isDoubleQuoteChar(c: string): boolean {
  return c === '"' || c === '“' || c === '”' || c === '«' || c === '»';
}

/**
 * `StringUtils.eventuallyRemoveStartingAndEndingDoubleQuote(String)`
 * (StringUtils.java:83-88), which delegates to the 2-arg overload
 * (:63-81) with the default `format` `"\"([:"`. Despite the name, this strips
 * ANY fully-wrapping delimiter pair from a string that both starts AND ends
 * with it — not just double quotes: `"x"`, `(x)`, `[x]`, and `:x:` all reduce
 * to `x`. This is `CucaDiagram.cleanId`'s entire body (net/atmp/CucaDiagram
 * .java:194-198) and is also applied (unconditionally) to every declaration's
 * final Display text in CommandCreateElementFull.executeArg.
 */
export function stripFullWrap(s: string): string {
  if (s.length > 1 && isDoubleQuoteChar(s.charAt(0)) && isDoubleQuoteChar(s.charAt(s.length - 1))) {
    return s.slice(1, -1);
  }
  if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) return s.slice(1, -1);
  if (s.startsWith(':') && s.endsWith(':')) return s.slice(1, -1);
  return s;
}

/**
 * `DescriptionDiagram.cleanId` (descdiagram/DescriptionDiagram.java:56-67).
 * Three special cases checked ahead of the generic {@link stripFullWrap}
 * fallback (`super.cleanId`): a leading `()` is always stripped (interface
 * shorthand — it usually doesn't *end* with a matching delimiter, so the
 * generic fallback wouldn't catch it), and the business-actor/business-
 * usecase trailing-slash forms (`:x:/`, `(x)/`) strip both the outer
 * delimiter and the slash in one step (the generic fallback can't catch
 * these either, since the string no longer ends with the bare delimiter
 * once the slash is appended).
 *
 * This is the single shared normalizer for every place upstream computes an
 * entity id from raw source text: a plain keyword declaration's CODE
 * (CommandCreateElementFull.executeArg:302), and a link endpoint's identifier
 * (CommandLinkElement.getDummy:347,358 and its ENT1/ENT2 clean check at
 * :298-299) — so a declaration and a link endpoint that name the same
 * notation MUST resolve to the identical id.
 */
export function cleanId(raw: string): string {
  let id = raw;
  if (id.startsWith('()')) id = id.slice(2).trim();
  if (id.startsWith(':') && id.endsWith(':/')) return id.slice(1, -2);
  if (id.startsWith('(') && id.endsWith(')/')) return id.slice(1, -2);
  return stripFullWrap(id);
}


// ---------------------------------------------------------------------------
// Text-escape resolution — I4c: text CONTENT bugs (textLength/x/y correctly
// derived for the WRONG string). Two independent, narrow escape mechanisms
// applied to a finalized display/stereotype string; NOT the full creole
// char-atom subsystem (E2-remainder) — see ledger.md I4c for what stays
// out of scope (`==` heading markers, multi-line note collapse, nested
// `<b>`/`<font>` creole markup).
// ---------------------------------------------------------------------------

/**
 * `<U+XXXX>`/`<U+XXXXX>` unicode-codepoint escapes and `&#NNN;` HTML numeric
 * character references, resolved to their literal glyph. Faithful (single-
 * pass, char-by-char) port of the two branches of `AtomText
 * .manageSpecialChars` (klimt/creole/legacy/AtomText.java:89-163) evidenced
 * by the I4c corpus (component/junoxu-15-gori632, lurupu-11-fubo915). That
 * Java method's other two branches — `~@start` (a literal `@start` escape,
 * only meaningful inside a diagram body's own text, never a node display)
 * and a bare `\t` (a SINGLE-character escape, distinct from the two-char
 * `\n`/`\r`/`\l` `resolveNewlineEscapes` below handles) — are not ported:
 * no I4c sample exercises either.
 */
export function resolveTextEscapes(s: string): string {
  let result = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '&') {
      const m = /^&#(\d+);/.exec(s.slice(i));
      if (m !== null) {
        result += String.fromCodePoint(Number.parseInt(m[1]!, 10));
        i += m[0].length;
        continue;
      }
    } else if (c === '<') {
      const m = /^<U\+([0-9a-fA-F]{4,5})>/.exec(s.slice(i));
      if (m !== null) {
        result += String.fromCodePoint(Number.parseInt(m[1]!, 16));
        i += m[0].length;
        continue;
      }
    }
    result += c;
    i++;
  }
  return result;
}

/**
 * Literal `\n`/`\r`/`\l` two-character escapes -> a real embedded newline,
 * mirroring the backslash-escape loop in `Display.getWithNewlines`
 * (klimt/creole/Display.java:259-343), restricted to the branch reachable
 * from raw declaration text (the `BLOCK_E1_*` internal sentinel characters
 * that method also handles are produced by an earlier creole-hiding pass
 * this port never invokes for entity/node display text, so they can't occur
 * here). `\r`/`\l` also carry a natural-horizontal-alignment side effect
 * upstream (RIGHT/LEFT) that this port has no per-entity-text-block wiring
 * for — not evidenced by any I4c corpus sample; only the newline-split
 * itself is reproduced. `\t` becomes a literal tab; a doubled `\\` collapses
 * to one backslash; any other `\`-led pair is copied through verbatim
 * (mirrors the Java `else` branch). Suppressed inside a `[[...]]` inline-
 * link span (`rawMode` upstream) — a `\n` embedded in a URL/label token
 * must survive verbatim for {@link resolveInlineLinks} to resolve later
 * (usecase/vivido-49-nisu863's `[[http://plantuml.com before ...]]`, whose
 * OWN `\n` sits BEFORE the `[[`, outside raw mode, and is correctly split).
 * `<math>`/`<latex>` raw-mode spans are not ported — unreached by any I4c
 * sample; a `<latex>`-bearing fixture is already a separate, deeper gap
 * (see ledger.md).
 */
export function resolveNewlineEscapes(s: string): string {
  let result = '';
  let rawMode = false;
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('[[', i)) rawMode = true;
    else if (s.startsWith(']]', i)) rawMode = false;
    const c = s[i]!;
    if (!rawMode && c === '\\' && i < s.length - 1) {
      const c2 = s[i + 1]!;
      if (c2 === 'n' || c2 === 'r' || c2 === 'l') { result += '\n'; i += 2; continue; }
      if (c2 === 't') { result += '\t'; i += 2; continue; }
      if (c2 === '\\') { result += '\\'; i += 2; continue; }
      result += c;
      i++;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

/**
 * Final unconditional post-processing applied to every entity DISPLAY,
 * regardless of which declaration alternative captured it —
 * `CommandCreateElementFull.executeArg:311`
 * (`display = StringUtils.eventuallyRemoveStartingAndEndingDoubleQuote
 * (display)`, unconditional, run AFTER alias-form matching) followed by
 * `Display.getWithNewlines` (java:321/324, the newline-escape split) and,
 * at draw time, `AtomText`'s own unicode/entity-escape resolution
 * ({@link resolveTextEscapes} above). Centralized here (parse time) since
 * this port measures/renders `display` directly rather than through a full
 * Display/Atom pipeline — a single origin point keeps measurement and
 * rendering consistent automatically. Deliberately NOT applied to `id`
 * (upstream's `quark.getName()` is a separately-cleaned value that never
 * passes through `Display.getWithNewlines` — see
 * tests/unit/description/parse-helpers.test.ts's vivido-49-nisu863 case,
 * where `id` keeps its literal `\n` but `display` does not).
 */
function finalizeDisplay(display: string): string {
  return resolveTextEscapes(resolveNewlineEscapes(stripFullWrap(display)));
}

// ---------------------------------------------------------------------------
// Stereotype and color helpers
// ---------------------------------------------------------------------------

/**
 * Extract angle-bracket stereotype(s) from a node-declaration remainder.
 *
 * `CommandCreateElementFull.java`'s single `StereotypePattern.optional
 * ("STEREOTYPE")` (:110) is anchored against `RegexLeaf.end()` (:115), so
 * regex backtracking lets its non-greedy `.+?` span PAST intervening
 * `>> <<` text and swallow a whole run of consecutive `<<..>>` blocks —
 * `component 3 <<1>> <<2>> <<3>>` only matches AT ALL because nothing may
 * remain unconsumed after STEREOTYPE (oracle then stacks each tag as its
 * own line, growing the entity's HEIGHT only — a text-metric detail, see
 * D1). Matching just the FIRST `<<..>>` occurrence left the rest glued
 * onto the id/display, so a later bare reference to the real id missed it
 * and auto-created a phantom entity instead (mamase-39-buto560). The
 * returned `stereotype` is the FIRST tag's inner content (preserves the
 * single-stereotype callers' existing behavior); the WHOLE run is consumed
 * from the remainder regardless of tag count.
 */
export function extractNodeStereotype(rest: string): StereotypeResult | undefined {
  const run = /(?:<<\s*.+?\s*>>\s*)+/.exec(rest);
  if (run === null) return undefined;
  const first = /<<\s*(.+?)\s*>>/.exec(run[0])!;
  const stereotype = first[1]!;
  const before = rest.slice(0, run.index).trimEnd();
  const after = rest.slice(run.index + run[0].length).trimStart();
  // A bare concatenation would fuse adjacent tokens when both sides are
  // non-empty (e.g. a trailing `$tag` after the stereotype getting glued to
  // a leading `#color` before it) — join with a single space in that case.
  const remainder = before.length > 0 && after.length > 0 ? `${before} ${after}` : before + after;
  return { stereotype: resolveTextEscapes(stereotype), remainder };
}

/** Extract trailing color token from a declaration remainder. */
/** Strip a `[[url]]` / `[[url label]]` hyperlink token (UrlBuilder.OPTIONAL
 *  in CommandCreateElementFull) — it annotates the element but adds no DOT
 *  structure. Returns the remainder with the URL removed. */
export function stripUrl(rest: string): string {
  return rest.replace(/\[\[[^\]]*(?:\][^\]]+)*\]\]/g, '').replace(/\s+/g, ' ').trim();
}

interface LeadingQuoteSplit {
  quoted: string;
  tail: string;
}

/**
 * Splits `rest` into a leading quoted span (delimiters + content, BOTH
 * untouched) and everything after it. `undefined` when `rest` does not
 * start with `"` or `'`.
 *
 * `CommandCreateElementFull`'s `CODE_WITH_QUOTE`/`DISPLAY` alternatives are a
 * single lazy-quoted match (`[%g].+?[%g]`) consumed whole as the entity's
 * CODE/DISPLAY text; `UrlBuilder.OPTIONAL` (the top-level `[[url]]`
 * attachment `stripUrl` exists to remove) is positioned strictly AFTER that
 * whole alternation in the regex concat (getRegexConcat, CODE_WITH_QUOTE
 * then TAGS/STEREOTYPE/UrlBuilder.OPTIONAL) -- it can only ever match text
 * OUTSIDE the quotes, never inside them. An inline `[[...]]` link embedded
 * WITHIN the quotes (e.g. `rectangle "text[[url label]]"`) is part of the
 * display/code text itself, resolved later via inline creole
 * (`resolveInlineLinks`) -- it must survive here verbatim, or two labels
 * differing only inside their embedded link collapse to the same entity
 * CODE (`plans/si5b-stdlib/batch-4/overview.md` T9, vivido-49-nisu863).
 */
function splitLeadingQuote(rest: string): LeadingQuoteSplit | undefined {
  const quoteChar = rest[0];
  if (quoteChar !== '"' && quoteChar !== "'") return undefined;
  const close = rest.indexOf(quoteChar, 1);
  if (close === -1) return undefined;
  return { quoted: rest.slice(0, close + 1), tail: rest.slice(close + 1) };
}

/** `stripTrailingUrl`'s bracket/whitespace regexes -- module-level per the
 *  file doc's lizard brace-counting workaround (a `$` anchor inside a
 *  function-body regex literal trips it the same way `$`/`"`/`'` do). */
const RE_INLINE_URL_TOKEN = /\[\[[^\]]*(?:\][^\]]+)*\]\]/g;
const RE_WHITESPACE_RUN = /\s+/g;
const RE_TRAILING_WHITESPACE = /\s+$/;

/**
 * `stripUrl` for a quote's TAIL specifically: removes the `[[url]]` token
 * and collapses internal whitespace runs like `stripUrl`, but trims only
 * the TRAILING edge, never the leading one. A single leading space in the
 * tail is the boundary `RE_SQ_AS_ALIAS`'s `\s+` (single-quote forms
 * require at least one space before `as`) depends on -- `stripUrl`'s full
 * `.trim()` would erase it and re-glue the quote to `as` with zero spaces,
 * which only the DOUBLE-quote alias regexes (`\s*as`) tolerate.
 */
function stripTrailingUrl(tail: string): string {
  return tail.replace(RE_INLINE_URL_TOKEN, '').replace(RE_WHITESPACE_RUN, ' ').replace(RE_TRAILING_WHITESPACE, '');
}

/** UrlBuilder.getRegexp()'s optional tooltip group, `{...}` -- built from a
 *  string (not a `/{...}/` literal) per the lizard brace-counting
 *  workaround used throughout this engine (see buildDecorAlt in
 *  link-grammar.ts). */
const RE_TOOLTIP_BRACES = new RegExp('\\{[^{}]*\\}');

/**
 * Resolve a single `[[...]]` token's INNER text (the part between the
 * double brackets) to its visible label, per `Url.java`'s label-defaulting
 * constructor (`UrlBuilder.getUrl`, `net/sourceforge/plantuml/url/`):
 * an optional `{tooltip}` is stripped first -- it only ever feeds
 * `getTooltip()`, never the visible label -- then, of what remains, the
 * FIRST whitespace-separated run is the url and everything after it is the
 * label; if nothing remains after the url, the label defaults to the url
 * itself (`Url(String url, String tooltip, String label)`:
 * `if (label == null || label.length() == 0) this.label = url;`).
 * Not ported: `UrlBuilder`'s quoted-url grammar (S_QUOTED -- a
 * bracket-wrapped, quote-delimited literal URL) -- no corpus fixture's
 * link/arrow label exercises it; documented scope line, same precedent as
 * I1b's unported `sep==null` global-merge semantic.
 */
function resolveUrlToken(inner: string): string {
  const withoutTooltip = inner.replace(RE_TOOLTIP_BRACES, '').replace(/\s+/g, ' ').trim();
  const spaceIdx = withoutTooltip.indexOf(' ');
  return spaceIdx === -1 ? withoutTooltip : withoutTooltip.slice(spaceIdx + 1).trim();
}

/**
 * Replace every inline `[[...]]` hyperlink token embedded within `text`
 * with its resolved visible label. `CommandCreoleUrl` (klimt/creole/
 * command/CommandCreoleUrl.java) registers `[[` as a creole atom starter
 * and renders a `TextLink` atom whose visible glyphs are `url.getLabel()`
 * (`TextLink.java:50-52`), never the raw markup (brackets and URL
 * included) -- creole processing is generic, applying to ANY rendered
 * text, not just link/arrow labels. Used wherever link/arrow label text is
 * measured for DOT graph-spacing / label-table dimensions
 * (link-edge-attrs.ts) -- the raw markup has no on-diagram width, only the
 * resolved text does.
 */
export function resolveInlineLinks(text: string): string {
  return text.replace(/\[\[([^\]]*(?:\][^\]]+)*)\]\]/g, (_match, inner: string) => resolveUrlToken(inner));
}

export function extractColor(rest: string): ColorResult | undefined {
  const m = RE_COLOR.exec(rest);
  if (m === null) return undefined;
  return { color: m[1]!, remainder: rest.slice(0, m.index).trimEnd() };
}

/**
 * Extract every `$tag` token (Stereotag.pattern()) from a node-declaration
 * remainder, wherever it sits (TAGS1 before STEREOTYPE, TAGS2 after —
 * CommandCreateElementFull.getRegexConcat:109-111). Tokenizes on whitespace
 * so only a WHOLE token matching the Stereotag shape is treated as a tag —
 * see {@link RE_TAG_TOKEN}.
 */
export function extractTags(rest: string): TagsResult {
  const tags: string[] = [];
  const remainder: string[] = [];
  for (const tok of rest.split(/\s+/).filter((t) => t.length > 0)) {
    if (RE_TAG_TOKEN.test(tok)) tags.push(tok.slice(1));
    else remainder.push(tok);
  }
  return { tags, remainder: remainder.join(' ') };
}

/** Extract angle-bracket stereotype from a link label string. */
export function extractLinkStereotype(raw: string): LinkStereoResult {
  const m = /<<([^>]+)>>/.exec(raw);
  if (m === null) {
    const t = raw.trim();
    return { stereotype: undefined, label: t.length > 0 ? t : undefined };
  }
  const stereotype = m[1]!.trim();
  const remaining = raw.replace(/<<[^>]+>>/, '').trim();
  return { stereotype, label: remaining.length > 0 ? remaining : undefined };
}

// ---------------------------------------------------------------------------
// Name-section parsing — split across two functions to stay under 30 NLOC
// ---------------------------------------------------------------------------

/** Try every quoted / paren / plain alias form; return id+display or undefined. */
function parseAliasForms(remainder: string): IdDisplay | undefined {
  const m1 = RE_DQ_AS_ALIAS.exec(remainder);
  if (m1 !== null) return { id: m1[2]!, display: m1[1]! };

  const m2 = RE_SQ_AS_ALIAS.exec(remainder);
  if (m2 !== null) return { id: m2[2]!, display: m2[1]! };

  const m3 = RE_ID_AS_DQ.exec(remainder);
  if (m3 !== null) return { id: m3[1]!, display: m3[2]! };

  const m4 = RE_ID_AS_SQ.exec(remainder);
  if (m4 !== null) return { id: m4[1]!, display: m4[2]! };

  const m5 = RE_PAREN_ALIAS.exec(remainder);
  if (m5 !== null) return { id: cleanId(m5[2]!), display: m5[1]!.trim() };

  const m5b = RE_DQ_AS_WRAPPED.exec(remainder);
  if (m5b !== null) return { id: cleanId(m5b[2]!), display: m5b[1]! };

  const m5c = RE_ID_AS_WRAPPED.exec(remainder);
  if (m5c !== null) return { id: m5c[1]!, display: cleanId(m5c[2]!) };

  const m6 = RE_PAREN_ONLY.exec(remainder);
  if (m6 !== null) { const n = m6[1]!.trim(); return { id: n, display: n }; }

  const m7 = RE_PLAIN_ALIAS.exec(remainder);
  if (m7 !== null) return { id: cleanId(m7[2]!), display: m7[1]! };

  return undefined;
}

/**
 * Build a NameSection from parsed id/display and optional stereotype/color.
 * Uses imperative assignment to satisfy exactOptionalPropertyTypes — spreading
 * `{ stereotype: undefined }` is not allowed for `stereotype?: string`.
 */
function buildNameSection(
  id: string,
  display: string,
  stereotype: string | undefined,
  color: string | undefined,
  tags: string[] | undefined,
): NameSection {
  const section: NameSection = { id, display };
  if (stereotype !== undefined) section.stereotype = stereotype;
  if (color !== undefined) section.color = color;
  if (tags !== undefined && tags.length > 0) section.tags = tags;
  return section;
}

/**
 * Parse the name/alias/color/stereotype section of a keyword declaration.
 * Delegates alias matching to parseAliasForms to stay under 30 NLOC.
 *
 * The final id — whichever branch produces it — is always run through
 * {@link cleanId}, mirroring `CommandCreateElementFull.executeArg:302`
 * (`diagram.quarkInContext(false, diagram.cleanId(codeRaw))`), which applies
 * regardless of which CODE alternative (bare, or the alias-form CODE2/3/4)
 * matched.
 */
export function parseNameSection(rest: string): NameSection {
  const trimmedRest = rest.trim();
  const leading = splitLeadingQuote(trimmedRest);
  let remainder = leading === undefined ? stripUrl(trimmedRest) : leading.quoted + stripTrailingUrl(leading.tail);
  let stereotype: string | undefined;
  let color: string | undefined;

  const sr = extractNodeStereotype(remainder);
  if (sr !== undefined) { stereotype = sr.stereotype; remainder = sr.remainder.trim(); }

  const tr = extractTags(remainder);
  const tags = tr.tags.length > 0 ? tr.tags : undefined;
  remainder = tr.remainder;

  const cr = extractColor(remainder);
  if (cr !== undefined) { color = cr.color; remainder = cr.remainder.trim(); }

  const aliases = parseAliasForms(remainder);
  if (aliases !== undefined) {
    return buildNameSection(cleanId(aliases.id), finalizeDisplay(aliases.display), stereotype, color, tags);
  }

  const mq = RE_DQ_ONLY.exec(remainder);
  if (mq !== null) {
    return buildNameSection(mq[1]!, finalizeDisplay(mq[1]!), stereotype, color, tags);
  }

  const id = cleanId(remainder.trim());
  return buildNameSection(id, finalizeDisplay(id), stereotype, color, tags);
}

// ---------------------------------------------------------------------------
// Inline body parser (for single-line container blocks)
// ---------------------------------------------------------------------------

/**
 * Parse the body of a single-line container block such as { (A) [B] }.
 * Recognises: [Name] component, () Name interface, (Name) usecase, :Name: actor.
 */
export function parseInlineBody(body: string): DescriptiveNode[] {
  const nodes: DescriptiveNode[] = [];
  let m: RegExpExecArray | null;

  const compRe = /\[([^\]]+)\]/g;
  while ((m = compRe.exec(body)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'component'));
  }

  const noBrackets = body.replace(/\[[^\]]*\]/g, '');

  const ifaceRe = /\(\)\s*(\S+)/g;
  while ((m = ifaceRe.exec(noBrackets)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'interface'));
  }

  const noIface = noBrackets.replace(/\(\)\s*\S+/g, '');

  const parenRe = /\(([^)]+)\)/g;
  while ((m = parenRe.exec(noIface)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'usecase'));
  }

  const colonRe = /:([^:]+):/g;
  const noParens = noIface.replace(/\([^)]*\)/g, '');
  while ((m = colonRe.exec(noParens)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'actor'));
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Dynamic regexes derived from KEYWORD_TO_SYMBOL (single source of truth)
// ---------------------------------------------------------------------------

const CONTAINER_KW_ALT = [...CONTAINER_SYMBOLS].join('|');

const ALL_KW_ALT = [...KEYWORD_TO_SYMBOL.keys()]
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/** Container keyword + inline body: package P { [A] [B] } */
export const CONTAINER_INLINE_RE = new RegExp(
  `^(${CONTAINER_KW_ALT})\\s+(.*?)\\s*\\{([^}]*)\\}\\s*$`,
  'i',
);

/** Container keyword opening a multi-line block: package P { */
export const CONTAINER_OPEN_RE = new RegExp(
  `^(${CONTAINER_KW_ALT})\\s+(.*?)\\s*\\{\\s*$`,
  'i',
);

/** Any keyword followed by at least one space and a name rest. */
export const KEYWORD_RE = new RegExp(`^(${ALL_KW_ALT})\\s+(.+)$`, 'i');

/** CommandCreateElementMultilines TYPE1: `<keyword> <code> [stereo][url]
 *  [#color] [` opening a multi-line `[ … ]` description block. The line ends
 *  with `[` and (crucially) no matching `]`; the body is closed by a line
 *  ending in `]`. Captures the keyword and the bare code only — the
 *  description text is label content (tolerant metric), not DOT structure. */
export const ELEMENT_MULTILINE_OPEN_RE = new RegExp(
  `^(${ALL_KW_ALT})\\s+([\\p{L}\\p{N}_.]+)` +
    '(?:\\s*(?:<<[^>]+>>|\\[\\[[^\\]]*\\]\\]|#\\w+))*' +
    '\\s*\\[[^\\[]*$',
  'iu',
);
