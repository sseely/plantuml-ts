/**
 * Link grammar for the descriptive-diagram parser — a faithful port of
 * `CommandLinkElement.java` (`net.sourceforge.plantuml.descdiagram.command`),
 * `LinkDecor.java` (`net.sourceforge.plantuml.decoration`), and
 * `StringUtils.getQueueDirection` (`net.sourceforge.plantuml`).
 *
 * Split out of parse-helpers.ts so both files stay under 500 lines.
 *
 * Line shape (CommandLinkElement.getRegexConcat, after tokenizing):
 *   ENT1 [FIRST_LABEL] HEAD1 BODY1 [STYLE1] [DIRECTION] [INSIDE] [STYLE2]
 *   BODY2 HEAD2 [SECOND_LABEL] ENT2 [#color] [<<stereotype>>] [: label]
 */

import type { USymbol } from '../../core/descriptive-keywords.js';
import type { DescriptiveLink, DescriptiveLinkStyle } from './ast.js';
import { extractLinkStereotype } from './parse-helpers.js';

const DECOR_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

function escapeDecorToken(token: string): string {
  return token.replace(DECOR_ESCAPE_RE, '\\$&');
}

/**
 * LinkDecor.buildRegexFromDecorKeys: longest-first alternation, so e.g. "<||"
 * wins over "<|" and "<". Tokens starting/ending with 'o' (AGGREGATION,
 * CIRCLE_CROWFOOT, CIRCLE_LINE, …) get a `\b` guard so "o" doesn't gobble
 * into an adjacent bare identifier.
 */
function buildDecorAlt(tokens: readonly string[]): string {
  return [...tokens]
    .sort((a, b) => b.length - a.length)
    .map((tok) => {
      const q = escapeDecorToken(tok);
      const startsO = tok.startsWith('o');
      const endsO = tok.endsWith('o');
      if (startsO && endsO) return `\\b${q}\\b`;
      if (startsO) return `\\b${q}`;
      if (endsO) return `${q}\\b`;
      return q;
    })
    .join('|');
}

// LinkDecor.java: every decors1()/decors2() call across all 20 enum entries.
const DECORS1_TOKENS = [
  '<|', '^', '*', 'o', 'x', '<||', '<|:', '}', '}o', '|o', '||', '}|',
  '<', '<_', '<<', '0', '@', '0)', ')', '#', '+',
];
const DECORS2_TOKENS = [
  '|>', '^', '*', 'o', 'x', '||>', ':|>', '{', 'o{', 'o|', '||', '|{',
  '>', '_>', '>>', '0', '@', '(0', '(', '#', '+', '\\\\', '//',
];

const DECORS1_ALT = buildDecorAlt(DECORS1_TOKENS);
const DECORS2_ALT = buildDecorAlt(DECORS2_TOKENS);

// CommandLinkElement.KEY1/KEY2/LINE_STYLE/LINE_STYLE_MULTIPLES.
const STYLE_KEY1 = 'dotted|dashed|plain|bold|hidden|norank|single|node|thickness=\\d+';
const STYLE_KEY2 = ',dotted|,dashed|,plain|,bold|,hidden|,norank|,single|,node|,thickness=\\d+';
const LINE_STYLE = `(?:#\\w+|${STYLE_KEY1})(?:,#\\w+|${STYLE_KEY2})*`;
const LINE_STYLE_MULTIPLES = `${LINE_STYLE}(?:;${LINE_STYLE})*`;

/**
 * CommandLinkElement.getGroup(): endpoint alternatives, in upstream order —
 * bare identifier first, then quoted string, then interface/actor/component/
 * usecase shorthand forms (with the business-variant trailing `/`).
 */
const LINK_ENT_ALT =
  '[\\p{L}\\p{N}_.]+' +
  '|"[^"]+"' +
  '|\\(\\)\\s*[\\p{L}\\p{N}_.]+' +
  '|\\(\\)\\s*"[^"]+"' +
  '|:[^:]+:/?' +
  '|(?!\\[\\*\\])\\[[^\\[\\]]+\\]' +
  '|\\((?!\\*\\))[^)]+\\)/?';

const LINK_LINE_SOURCE =
  `^(?<ent1>${LINK_ENT_ALT})` +
  '\\s*(?:"(?<firstLabel>[^"]+)")?\\s*' +
  `(?<head1>${DECORS1_ALT})?` +
  '(?<body1>[-=.~]+)' +
  `(?:\\[(?<style1>${LINE_STYLE_MULTIPLES})\\])?` +
  '(?:(?<direction>left|right|up|down|le?|ri?|up?|do?)(?=[-=.~0()\\[]))?' +
  '(?:(?<inside>0|\\(0\\)|\\(0|0\\))(?=[-=.~]))?' +
  `(?:\\[(?<style2>${LINE_STYLE})\\])?` +
  '(?<body2>[-=.~]*)' +
  `(?<head2>${DECORS2_ALT})?` +
  '\\s*(?:"(?<secondLabel>[^"]+)")?\\s*' +
  `(?<ent2>${LINK_ENT_ALT})` +
  '\\s*(?:#(?<color>\\w+))?\\s*(?:<<(?<stereotype>[^>]+)>>)?' +
  '(?:\\s*:\\s*(?<label>.+))?$';

/**
 * CommandLinkElement.getRegexConcat() — the full link-line grammar. Upstream
 * compiles every command pattern with Pattern.CASE_INSENSITIVE
 * (regex/Pattern2.java:compileInternal), hence the 'i' flag; 'u' enables the
 * \p{L}/\p{N} Unicode property classes in the bare-identifier alternative.
 */
export const LINK_LINE_RE = new RegExp(LINK_LINE_SOURCE, 'iu');

/**
 * Named groups captured by {@link LINK_LINE_RE}. TypeScript's built-in
 * `RegExpExecArray['groups']` types every key as plain `string` even though a
 * non-participating optional group is `undefined` at runtime — this interface
 * corrects that for the groups this module reads.
 */
interface LinkGroups {
  ent1: string;
  ent2: string;
  body1: string;
  body2: string;
  firstLabel?: string;
  secondLabel?: string;
  head1?: string;
  head2?: string;
  style1?: string;
  style2?: string;
  direction?: string;
  stereotype?: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Labels.init (descdiagram/command/Labels.java) — when no explicit quoted
// qualifier labels surround the arrow, quoted segments embedded in the
// post-colon label text become the first/second qualifiers:
//   : "1" uses "many"  → first="1", label="uses", second="many"
//   : "1" uses         → first="1", label="uses"
//   : uses "many"      → label="uses", second="many"
// ---------------------------------------------------------------------------

const RE_BOTH_LABELS = new RegExp('^"([^"]+)"([^"]+)"([^"]+)"$');
const RE_FIRST_LABEL_ONLY = new RegExp('^"([^"]+)"([^"]+)$');
const RE_SECOND_LABEL_ONLY = new RegExp('^([^"]+)"([^"]+)"$');

const stripOuterQuotes = (s: string): string => {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') && t.length >= 2 ? t.slice(1, -1) : t;
};

function applyEmbeddedQualifiers(g: LinkGroups): void {
  if (g.firstLabel !== undefined || g.secondLabel !== undefined) return;
  const raw = g.label;
  if (raw === undefined) return;
  const m1 = RE_BOTH_LABELS.exec(raw);
  if (m1 !== null) {
    g.firstLabel = m1[1]!;
    g.label = stripOuterQuotes(m1[2]!.trim());
    g.secondLabel = m1[3]!;
    return;
  }
  const m2 = RE_FIRST_LABEL_ONLY.exec(raw);
  if (m2 !== null) {
    g.firstLabel = m2[1]!;
    g.label = stripOuterQuotes(m2[2]!.trim());
    return;
  }
  const m3 = RE_SECOND_LABEL_ONLY.exec(raw);
  if (m3 !== null) {
    g.label = stripOuterQuotes(m3[1]!.trim());
    g.secondLabel = m3[2]!;
  }
}

// ---------------------------------------------------------------------------
// StringUtils.getQueueDirection — direction resolution
// ---------------------------------------------------------------------------

type LinkDirection = 'left' | 'right' | 'up' | 'down';

/**
 * StringUtils.getQueueDirection: explicit word substrings first, then
 * single-letter abbreviations, then a length-based default (a bare queue of
 * `-=.~` characters has no letters at all, so it always falls through here).
 */
function queueDirection(raw: string): LinkDirection {
  const s = raw.toLowerCase();
  if (s.includes('left')) return 'left';
  if (s.includes('right')) return 'right';
  if (s.includes('up')) return 'up';
  if (s.includes('down')) return 'down';
  if (s.includes('l')) return 'left';
  if (s.includes('r')) return 'right';
  if (s.includes('u')) return 'up';
  if (s.includes('d')) return 'down';
  return s.length === 1 ? 'right' : 'down';
}

/**
 * CommandLinkElement.executeArg: direction resolution + the length/inversion
 * pair it drives. `queue` (BODY1+BODY2) always feeds the style/queue-length
 * checks; `length` is queue.length except LEFT/RIGHT collapse it to 1 (the
 * upstream `queue = "-"` override — minlen 0 on those edges).
 */
interface DirectionInfo { inverted: boolean; length: number; queue: string }

function resolveDirectionInfo(g: LinkGroups): DirectionInfo {
  const queue = g.body1 + g.body2;
  const direction = queueDirection(g.direction ?? queue);
  const inverted = direction === 'left' || direction === 'up';
  const isHorizontal = direction === 'left' || direction === 'right';
  return { inverted, length: isHorizontal ? 1 : queue.length, queue };
}

// ---------------------------------------------------------------------------
// Decor → arrowHead classification (LinkDecor.ARROW / ARROW_TRIANGLE)
// ---------------------------------------------------------------------------

const ARROW_OPEN_TOKENS = new Set(['<', '<_', '>', '_>']);
const ARROW_FILLED_TOKENS = new Set(['<<', '>>']);

/**
 * Every other LinkDecor (diamond/crowfoot/circle/square/plus/…) renders as a
 * shape rather than an arrowhead; visual decor rendering is out of scope this
 * iteration, so they classify as 'none' (the raw token is preserved
 * separately on the link as tailDecor/headDecor).
 */
function decorArrowKind(token: string): 'open' | 'filled' | 'none' {
  if (token === '') return 'none';
  const t = token.toLowerCase();
  if (ARROW_FILLED_TOKENS.has(t)) return 'filled';
  if (ARROW_OPEN_TOKENS.has(t)) return 'open';
  return 'none';
}

/** The head-side decor wins when it maps to an arrow; otherwise fall back to
 *  the tail-side decor (e.g. plain `<--`: head2 is empty, head1 is ARROW). */
function resolveArrowHead(decors: { tail: string; head: string }): 'open' | 'filled' | 'none' {
  const head = decorArrowKind(decors.head);
  return head !== 'none' ? head : decorArrowKind(decors.tail);
}

// ---------------------------------------------------------------------------
// ARROW_STYLE1/2 bracket — hidden/norank flags + raw style string
// ---------------------------------------------------------------------------

interface StyleFlags {
  hidden: boolean;
  norank: boolean;
  rawStyle: string | undefined;
}

/**
 * Record hidden/norank plus the raw bracket text. Every other keyword
 * (dotted/dashed/bold/plain/single/node/thickness=N/#color) is render-only
 * (upstream Link.applyStyle) and out of scope this iteration.
 */
function parseStyleFlags(style1: string | undefined, style2: string | undefined): StyleFlags {
  const rawStyle = style1 ?? style2;
  if (rawStyle === undefined) return { hidden: false, norank: false, rawStyle: undefined };
  const tokens = rawStyle.split(/[,;]/).map((t) => t.trim().toLowerCase());
  return { hidden: tokens.includes('hidden'), norank: tokens.includes('norank'), rawStyle };
}

// ---------------------------------------------------------------------------
// Endpoint shape classification (CommandLinkElement.getDummy) — used both to
// resolve a link endpoint's plain id and, for auto-created endpoints, the
// USymbol shape to create it with.
// ---------------------------------------------------------------------------

const RE_EP_BRACKET = /^\[([^\]]+)\]$/;
const RE_EP_IFACE = /^\(\)\s*(.+)$/;
const RE_EP_USECASE = /^\(([^)]+)\)\/?$/;
const RE_EP_ACTOR = /^:([^:]+):\/?$/;
const RE_EP_QUOTED = /^"([^"]+)"$/;

export interface EndpointShape {
  id: string;
  symbol: USymbol;
  /** Bare/quoted identifier — upstream LeafType.STILL_UNKNOWN. Resolved at
   *  the end of parseDescription per DescriptionDiagram.makeDiagramReady:
   *  actor when the diagram has any usecase/actor leaf, else interface. */
  stillUnknown?: true;
}

/**
 * CommandLinkElement.getDummy(): `()x` → interface, `(x)`/`(x)/` → usecase /
 * business usecase, `:x:`/`:x:/` → actor / business actor, `[x]` → component.
 * A bare or quoted identifier is upstream `LeafType.STILL_UNKNOWN` (no
 * USymbol) — flagged stillUnknown and resolved at the end of the parse
 * (DescriptionDiagram.makeDiagramReady:81-88: actor if isUsecase(), else
 * INTERFACE — which then gets the shielded plaintext svek shape).
 */
export function classifyEndpointShape(token: string): EndpointShape {
  const t = token.trim();
  const bracket = RE_EP_BRACKET.exec(t);
  if (bracket !== null) return { id: bracket[1]!.trim(), symbol: 'component' };
  if (t.startsWith('()')) {
    const m = RE_EP_IFACE.exec(t);
    return { id: (m?.[1] ?? '').trim(), symbol: 'interface' };
  }
  const usecase = RE_EP_USECASE.exec(t);
  if (usecase !== null) {
    return { id: usecase[1]!.trim(), symbol: t.endsWith('/') ? 'usecase-business' : 'usecase' };
  }
  const actor = RE_EP_ACTOR.exec(t);
  if (actor !== null) {
    return { id: actor[1]!.trim(), symbol: t.endsWith('/') ? 'actor-business' : 'actor' };
  }
  const quoted = RE_EP_QUOTED.exec(t);
  return {
    id: quoted !== null ? quoted[1]!.trim() : t,
    symbol: 'rectangle',
    stillUnknown: true,
  };
}

interface EndpointPair { from: EndpointShape; to: EndpointShape }

/** Inversion (LEFT/UP direction) swaps which raw ENT token is "from". */
function resolveEndpoints(g: LinkGroups, inverted: boolean): EndpointPair {
  return {
    from: classifyEndpointShape(inverted ? g.ent2 : g.ent1),
    to: classifyEndpointShape(inverted ? g.ent1 : g.ent2),
  };
}

// ---------------------------------------------------------------------------
// Match → DescriptiveLink assembly (CommandLinkElement.executeArg)
// ---------------------------------------------------------------------------

interface DecorPair { tail: string; head: string }

/** Inversion (LEFT/UP direction) swaps from/to and, symmetrically, which
 *  decor sits at the tail vs the head. */
function resolveDecorPair(head1: string, head2: string, inverted: boolean): DecorPair {
  return inverted ? { tail: head2, head: head1 } : { tail: head1, head: head2 };
}

interface LabelPair { first: string | undefined; second: string | undefined }

function resolveLabelPair(g: LinkGroups, inverted: boolean): LabelPair {
  return inverted
    ? { first: g.secondLabel, second: g.firstLabel }
    : { first: g.firstLabel, second: g.secondLabel };
}

/** LinkType queue check (getLinkType): '.' → dashed, '~' → dotted, '=' →
 *  bold, mutually exclusive in that order; matches upstream's `else if`. */
function linkStyleFromQueue(queue: string): DescriptiveLinkStyle {
  if (queue.includes('.')) return 'dashed';
  if (queue.includes('~')) return 'dotted';
  if (queue.includes('=')) return 'bold';
  return 'solid';
}

/**
 * Upstream captures STEREOTYPE before the `: label` colon; this codebase's
 * existing convention (see extractLinkStereotype call sites) also allows a
 * stereotype embedded after the colon (`: <<include>>` / `: text <<foo>>`).
 * Prefer the explicit pre-colon capture; fall back to extracting from the
 * post-colon label text otherwise.
 */
function resolveStereotypeAndLabel(g: LinkGroups): { stereotype?: string; label?: string } {
  if (g.stereotype !== undefined) {
    const label = g.label?.trim();
    return label !== undefined && label.length > 0
      ? { stereotype: g.stereotype.trim(), label }
      : { stereotype: g.stereotype.trim() };
  }
  const extracted = extractLinkStereotype((g.label ?? '').trim());
  const result: { stereotype?: string; label?: string } = {};
  if (extracted.stereotype !== undefined) result.stereotype = extracted.stereotype;
  if (extracted.label !== undefined) result.label = extracted.label;
  return result;
}

interface LinkBuildArgs {
  from: string;
  to: string;
  style: DescriptiveLinkStyle;
  arrowHead: 'open' | 'filled' | 'none';
  length: number;
  firstLabel: string | undefined;
  secondLabel: string | undefined;
  tailDecor: string;
  headDecor: string;
  hidden: boolean;
  norank: boolean;
  rawStyle: string | undefined;
  stereotype: string | undefined;
  label: string | undefined;
}

function buildLinkFromArgs(a: LinkBuildArgs): DescriptiveLink {
  const link: DescriptiveLink = {
    from: a.from, to: a.to, style: a.style, arrowHead: a.arrowHead, length: a.length,
  };
  if (a.firstLabel !== undefined) link.firstLabel = a.firstLabel;
  if (a.secondLabel !== undefined) link.secondLabel = a.secondLabel;
  if (a.tailDecor !== '') link.tailDecor = a.tailDecor;
  if (a.headDecor !== '') link.headDecor = a.headDecor;
  if (a.hidden) link.hidden = true;
  if (a.norank) link.norank = true;
  if (a.rawStyle !== undefined) link.rawStyle = a.rawStyle;
  if (a.stereotype !== undefined) link.stereotype = a.stereotype;
  if (a.label !== undefined) link.label = a.label;
  return link;
}

export interface ParsedLink {
  from: EndpointShape;
  to: EndpointShape;
  link: DescriptiveLink;
}

/**
 * CommandLinkElement.executeArg — assemble a DescriptiveLink (plus endpoint
 * shape info for auto-create) from a {@link LINK_LINE_RE} match's named
 * groups. `groups` is always defined at the call site: LINK_LINE_RE always
 * carries named capture groups, so `RegExpExecArray.groups` is never
 * undefined when the pattern matches (TS's built-in typing just can't
 * express that).
 */
export function parseLinkLine(groups: Record<string, string>): ParsedLink {
  const g = groups as unknown as LinkGroups;
  applyEmbeddedQualifiers(g);
  const { inverted, length, queue } = resolveDirectionInfo(g);
  const { from, to } = resolveEndpoints(g, inverted);
  const decors = resolveDecorPair(g.head1 ?? '', g.head2 ?? '', inverted);
  const labels = resolveLabelPair(g, inverted);
  const arrowHead = resolveArrowHead(decors);
  const { hidden, norank, rawStyle } = parseStyleFlags(g.style1, g.style2);
  const { stereotype, label } = resolveStereotypeAndLabel(g);

  const link = buildLinkFromArgs({
    from: from.id, to: to.id, style: linkStyleFromQueue(queue), arrowHead, length,
    firstLabel: labels.first, secondLabel: labels.second,
    tailDecor: decors.tail, headDecor: decors.head,
    hidden, norank, rawStyle, stereotype, label,
  });
  return { from, to, link };
}
