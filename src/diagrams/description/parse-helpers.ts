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
// `#line:blue` style-only, `#red;line.dashed`). None add DOT structure —
// matched here only so the id/display parse cleanly.
const RE_COLOR = /(#[\w:;.#]+)\s*$/;

// extractTags — Stereotag.pattern() (net.sourceforge.plantuml.stereo
// .Stereotag:42-45): a whitespace-separated `$name` token, name excluding
// whitespace/braces/quotes/angle-brackets/'$' itself. Matched whole-token
// (not substring) so a `$var` reference embedded inside other syntax, e.g.
// `%get_json_type($json_object)`, is never mistaken for a tag — Stereotag
// only ever appears as its own token, never glued to surrounding text.
const RE_TAG_TOKEN = new RegExp('^\\$[^\\s{}"\'<>$]+$');

// parseAliasForms — quoted / paren / alias forms
const RE_DQ_AS_ALIAS = /^"([^"]+)"\s+as\s+(\S+)$/;
const RE_SQ_AS_ALIAS = /^'([^']+)'\s+as\s+(\S+)$/;
const RE_ID_AS_DQ   = /^(\S+)\s+as\s+"([^"]+)"$/;
const RE_ID_AS_SQ   = /^(\S+)\s+as\s+'([^']+)'$/;
const RE_PAREN_ALIAS = /^\(([^)]+)\)\s+as\s+(\S+|\([^)]+\)|:[^:]+:)$/;
const RE_DQ_AS_WRAPPED = /^"([^"]+)"\s+as\s+(\([^)]+\)|:[^:]+:|\[[^\]]+\])$/;
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
// Stereotype and color helpers
// ---------------------------------------------------------------------------

/** Extract angle-bracket stereotype from a node-declaration remainder. */
export function extractNodeStereotype(rest: string): StereotypeResult | undefined {
  const m = /<<\s*(.+?)\s*>>/.exec(rest);
  if (m === null) return undefined;
  const stereotype = m[1]!;
  const before = rest.slice(0, m.index).trimEnd();
  const after = rest.slice(m.index + m[0].length).trimStart();
  // A bare concatenation would fuse adjacent tokens when both sides are
  // non-empty (e.g. a trailing `$tag` after the stereotype getting glued to
  // a leading `#color` before it) — join with a single space in that case.
  const remainder = before.length > 0 && after.length > 0 ? `${before} ${after}` : before + after;
  return { stereotype, remainder };
}

/** Extract trailing color token from a declaration remainder. */
/** Strip a `[[url]]` / `[[url label]]` hyperlink token (UrlBuilder.OPTIONAL
 *  in CommandCreateElementFull) — it annotates the element but adds no DOT
 *  structure. Returns the remainder with the URL removed. */
export function stripUrl(rest: string): string {
  return rest.replace(/\[\[[^\]]*(?:\][^\]]+)*\]\]/g, '').replace(/\s+/g, ' ').trim();
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
  let remainder = stripUrl(rest.trim());
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
    return buildNameSection(cleanId(aliases.id), aliases.display, stereotype, color, tags);
  }

  const mq = RE_DQ_ONLY.exec(remainder);
  if (mq !== null) {
    return buildNameSection(mq[1]!, mq[1]!, stereotype, color, tags);
  }

  const id = cleanId(remainder.trim());
  return buildNameSection(id, id, stereotype, color, tags);
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
