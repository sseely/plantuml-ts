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
import { cleanId, extractLinkStereotype } from './parse-helpers.js';

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

/**
 * Mirror maps: tail-vocabulary token (DECORS1, near entity1) <-> head-
 * vocabulary token (DECORS2, near entity2) for the SAME `LinkDecor`. Built
 * from `DECORS1_TOKENS`/`DECORS2_TOKENS` above, which are positionally
 * parallel for the first `DECORS1_TOKENS.length` entries (both arrays list
 * "every decors1()/decors2() call across all 20 enum entries" in the SAME
 * enum-declaration order — DECORS2_TOKENS' two trailing entries, `\\`/`//`,
 * are the HALF_ARROW_UP/DOWN decors2-only tokens with no decors1
 * counterpart, correctly excluded from the zip below).
 *
 * Needed by `resolveDecorPair` (below): upstream inverts a LEFT/UP-
 * direction link via `Link#getInv()` -> `LinkType#getInversed()`
 * (`decoration/LinkType.java:131-132`), which swaps the ALREADY-RESOLVED
 * `decor1`/`decor2` enum fields — a pure "which side" relabeling, since
 * `LinkDecor` is an abstract classification, not a raw character. This
 * port instead carries the RAW TOKEN through to `SvekEdge` for lookup
 * there (`renderer-edge.ts`'s doc comment), so swapping which entity a
 * decor sits nearest to must ALSO translate the token into the other
 * position's spelling: `'>'` is only a valid DECORS2/head-position token
 * (`lookupDecors1('>')` misses), so moving it verbatim into the tail
 * position silently drops the decor.
 */
const TAIL_TO_HEAD_TOKEN = new Map<string, string>();
const HEAD_TO_TAIL_TOKEN = new Map<string, string>();
for (let i = 0; i < DECORS1_TOKENS.length; i++) {
  const tail = DECORS1_TOKENS[i]!;
  const head = DECORS2_TOKENS[i]!;
  TAIL_TO_HEAD_TOKEN.set(tail, head);
  HEAD_TO_TAIL_TOKEN.set(head, tail);
}

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

/**
 * `ColorParser.simpleColor(ColorType.LINE)` (klimt/color/ColorParser.java:
 * 43-46) — the SAME color grammar as `#RRGGBB`/`#colorname` (`COLOR_REGEXP`)
 * OR the extended `#base;key:value;...` inline-style form (`PART2`,
 * `#coral;text:red`, `#line:green`, `#line.dashed:blue;text:coral`). The
 * bare `#\\w+` this group used before only consumed the leading token,
 * leaving `;text:red : label` unconsumed and failing the whole line's match
 * (the link — and its label — silently dropped: gekage-52-dato745,
 * rekisu-47-pesa949). The leading `#` is matched OUTSIDE this group (see
 * LINK_LINE_SOURCE below), so both alternatives below omit it.
 */
const COLOR_TOKEN = '\\w+[-\\\\|/]?\\w+';
const COLOR_KEY_ALT = 'text|back|header|line|line\\.dashed|line\\.dotted|line\\.bold|shadowing';
const COLOR_PART2 =
  `(?:${COLOR_TOKEN};)?(?:(?:${COLOR_KEY_ALT})(?::${COLOR_TOKEN})?(?:;|(?![\\w;:.])))+`;
const COLORS_BODY_ALT = `(?:${COLOR_PART2})|(?:${COLOR_TOKEN})`;

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
  `\\s*(?:#(?<color>${COLORS_BODY_ALT}))?\\s*(?<stereotype>(?:<<[^>]+>>\\s*)+)?` +
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
  const raw = g.label;
  if (raw === undefined) return;
  if (g.firstLabel === undefined && g.secondLabel === undefined) {
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
      return;
    }
  }
  // Labels.java's init() fallback (java:102): `return StringUtils
  // .eventuallyRemoveStartingAndEndingDoubleQuote(labelLink, "\"")` -- runs
  // regardless of whether firstLabel/secondLabel were already captured via a
  // SEPARATE pre-arrow quoted group (that `if` block in Java wraps only the
  // three embedded-qualifier branches above, not this final strip). A whole
  // label that is itself one quoted string (`: "stereotype bold"`) matches
  // none of the three embedded-qualifier regexes -- component/xenusu-76-
  // sabi405, xusuxe-62-guba767 -- so it fell through UNCHANGED (quotes
  // retained) before this fallback existed.
  g.label = stripOuterQuotes(raw);
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
  single: boolean;
  rawStyle: string | undefined;
  /** Set only when a bracket `dashed`/`dotted`/`bold` keyword occurred --
   *  overrides the queue-char-derived style (see `DescriptiveLink.style`'s
   *  doc comment). */
  style?: DescriptiveLinkStyle;
  thickness?: number;
  color?: string;
}

/** `WithLinkType.applyOneStyle`'s recognized keywords (`decoration/
 *  WithLinkType.java:143-164`), case-insensitive -- everything else is a
 *  color token (grammar-guaranteed to carry a leading `#`, see
 *  `DescriptiveLink.colorOverride`'s doc comment). `plain`/`node` are
 *  matched (so they are never misclassified as a color) but otherwise
 *  produce no effect, mirroring upstream's own no-op branches. */
const STYLE_KEYWORDS = new Set([
  'dashed', 'dotted', 'bold', 'plain', 'hidden', 'norank', 'single', 'node',
]);
const THICKNESS_TOKEN_RE = /^thickness=(\d+)$/i;

/**
 * `WithLinkType.applyStyle`/`applyOneStyle` (`decoration/WithLinkType.java:
 * 126-166`): tokenize the raw bracket text by `;` (segments -- upstream's
 * per-segment color index `i`, only segment 0/the primary color is wired,
 * see `DescriptiveLink.colorOverride`'s doc comment) then by `,` within
 * each segment, and apply every token IN ORDER. `dashed`/`dotted`/`bold`
 * each construct a fresh `LinkStyle` upstream (`decoration/LinkType.java:
 * 115-129`), which is why they reset `thickness` to `undefined` here --
 * `goThickness` (`thickness=N`) does not touch the style category, only
 * the running thickness value. `single` is a link-ADD-time dedup flag
 * (see `DescriptiveLink.single` in ast.ts), not a render style.
 */
function parseArrowStyle(style1: string | undefined, style2: string | undefined): StyleFlags {
  const rawStyle = style1 ?? style2;
  const result: StyleFlags = { hidden: false, norank: false, single: false, rawStyle };
  if (rawStyle === undefined) return result;
  const segments = rawStyle.split(';');
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    for (const rawToken of segments[segIdx]!.split(',')) {
      const token = rawToken.trim();
      if (token.length === 0) continue;
      const lower = token.toLowerCase();
      if (lower === 'dashed') { result.style = 'dashed'; delete result.thickness; }
      else if (lower === 'dotted') { result.style = 'dotted'; delete result.thickness; }
      else if (lower === 'bold') { result.style = 'bold'; delete result.thickness; }
      else if (lower === 'hidden') { result.hidden = true; }
      else if (lower === 'norank') { result.norank = true; }
      else if (lower === 'single') { result.single = true; }
      else if (STYLE_KEYWORDS.has(lower)) { /* plain/node: upstream no-op */ }
      else {
        const m = THICKNESS_TOKEN_RE.exec(lower);
        if (m !== null) {
          result.thickness = Number(m[1]);
        } else if (segIdx === 0) {
          // Grammar-mandatory leading `#` (LINE_STYLE's `#\w+` alternative
          // is the only way a non-keyword token reaches this branch) --
          // strip it, matching `renderer-entity.ts#parseColorOverride`'s
          // established convention.
          result.color = token.startsWith('#') ? token.slice(1) : token;
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Endpoint shape classification (CommandLinkElement.getDummy) — used both to
// resolve a link endpoint's plain id and, for auto-created endpoints, the
// USymbol shape to create it with.
// ---------------------------------------------------------------------------

const RE_EP_BRACKET = /^\[([^\]]+)\]$/;
const RE_EP_IFACE = /^\(\)/;
const RE_EP_USECASE = /^\([^)]+\)\/?$/;
const RE_EP_ACTOR = /^:[^:]+:\/?$/;
const RE_EP_QUOTED = /^"[^"]+"$/;

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
 *
 * The id is always `cleanId(token)` (getDummy:347,358 — every branch cleans
 * the raw ident before creating/looking up the quark), the same normalizer a
 * plain keyword declaration's CODE goes through
 * (CommandCreateElementFull.executeArg:302 via parseNameSection). Symbol
 * classification is a separate, RAW-token character sniff (getDummy's
 * `codeChar`) that runs *before* cleaning — a declaration and a link endpoint
 * for the same notation therefore always resolve to the identical id.
 */
export function classifyEndpointShape(token: string): EndpointShape {
  const t = token.trim();
  if (RE_EP_BRACKET.test(t)) return { id: cleanId(t), symbol: 'component' };
  if (RE_EP_IFACE.test(t)) return { id: cleanId(t), symbol: 'interface' };
  if (RE_EP_USECASE.test(t)) {
    return { id: cleanId(t), symbol: t.endsWith('/') ? 'usecase-business' : 'usecase' };
  }
  if (RE_EP_ACTOR.test(t)) {
    return { id: cleanId(t), symbol: t.endsWith('/') ? 'actor-business' : 'actor' };
  }
  return {
    id: RE_EP_QUOTED.test(t) ? cleanId(t) : t,
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

/**
 * Inversion (LEFT/UP direction) swaps from/to and, symmetrically, which
 * decor sits at the tail vs the head — mirroring the raw token into the
 * new position's vocabulary (see `TAIL_TO_HEAD_TOKEN`/`HEAD_TO_TAIL_TOKEN`
 * above), not just relabeling the same string. A token with no mirror
 * entry (the two decors2-only HALF_ARROW tokens) passes through verbatim
 * — best-effort for that narrow, not-yet-diagnosed case; no worse than
 * before this fix.
 */
function resolveDecorPair(head1: string, head2: string, inverted: boolean): DecorPair {
  if (!inverted) return { tail: head1, head: head2 };
  return {
    tail: head2 === '' ? '' : (HEAD_TO_TAIL_TOKEN.get(head2) ?? head2),
    head: head1 === '' ? '' : (TAIL_TO_HEAD_TOKEN.get(head1) ?? head1),
  };
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
 * Upstream captures STEREOTYPE before the `: label` colon (LINK_LINE_RE's
 * `(?:<<[^>]+>>\s*)+` group, mirroring `CommandLinkElement.getRegexConcat`'s
 * `StereotypePattern.optional("STEREOTYPE")`); this codebase's existing
 * convention (see extractLinkStereotype call sites) also allows a stereotype
 * embedded after the colon (`: <<include>>` / `: text <<foo>>`). Prefer the
 * explicit pre-colon capture; fall back to extracting from the post-colon
 * label text otherwise.
 *
 * G1 I5e: these are NOT interchangeable render-wise, despite sharing one
 * `DescriptiveLink.stereotype` field. `CommandLinkElement.executeArg`
 * (java:331-333) unconditionally calls `link.setStereotype(...)` on the
 * PRE-colon capture, but that value feeds ONLY
 * `getDefaultStyleDefinition(stereotype)` (arrow style-selector resolution)
 * and `Link.isRemoved()`'s stereotype-removal match -- `Labels.java` (which
 * builds the link's real, drawn text) never reads the `STEREOTYPE` group at
 * all, so the pre-colon form is NEVER drawn as edge text upstream. The
 * POST-colon-embedded form (`extractLinkStereotype`, this port's own
 * convention layered onto `Labels.java`'s label text) IS the visible
 * `«tag»` guillemet case (jar-verified usecase/cevuji-49-bile305). This
 * port previously drew BOTH unconditionally (`SvekEdge.ts#drawLabels`),
 * misrendering the pre-colon/auto-create-endpoint case as if it were the
 * link's own visible label (`component/minulo-12-bare186` et al.) --
 * `stereotypeIsLinkLabel` (returned below, threaded through
 * `DescriptiveLink`/`DescriptionEdgeGeo`/`SvekEdgeInput`) is the
 * discriminator that keeps drawing the post-colon case while suppressing
 * the pre-colon one.
 *
 * The pre-colon `stereotype` group captures the RAW bracketed run verbatim
 * -- strip to the FIRST tag's inner content, the SAME "first tag, whole run
 * consumed" convention already used for node declarations
 * (`extractNodeStereotype`, parse-helpers.ts:206-221). Bracket-free is the
 * required representation: upstream `Stereotype#getMultipleLabels()`
 * (stereo/Stereotype.java:123-133) strips the `<<>>` before comparison, and
 * `HideOrShow.isApplyableStereotype` (HideOrShow.java:88-97, `remove
 * <<pattern>>`) matches against that bracket-free label -- keeping the
 * brackets here would make every pre-colon-stereotyped link unmatchable by
 * `remove <<stereotype>>` (element-grammar.ts#removeMatchingLinks). Regex
 * is guaranteed to match: `g.stereotype` is only ever set from that same
 * capturing group.
 */
function resolveStereotypeAndLabel(
  g: LinkGroups,
): { stereotype?: string; label?: string; stereotypeIsLinkLabel: boolean } {
  if (g.stereotype !== undefined) {
    // Pre-colon form -- style-selector/`remove` input only, NEVER drawn as
    // edge text (see `DescriptiveLink.stereotypeIsLinkLabel`'s doc comment).
    const stereotype = /<<\s*(.+?)\s*>>/.exec(g.stereotype)![1]!;
    const label = g.label?.trim();
    return label !== undefined && label.length > 0
      ? { stereotype, label, stereotypeIsLinkLabel: false }
      : { stereotype, stereotypeIsLinkLabel: false };
  }
  // Post-colon-embedded form -- the ONE shape the jar draws as a visible
  // `«tag»` guillemet edge label (jar-verified usecase/cevuji-49-bile305).
  const extracted = extractLinkStereotype((g.label ?? '').trim());
  const result: { stereotype?: string; label?: string; stereotypeIsLinkLabel: boolean } = {
    stereotypeIsLinkLabel: extracted.stereotype !== undefined,
  };
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
  single: boolean;
  rawStyle: string | undefined;
  thicknessOverride: number | undefined;
  colorOverride: string | undefined;
  stereotype: string | undefined;
  stereotypeIsLinkLabel: boolean;
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
  if (a.single) link.single = true;
  if (a.rawStyle !== undefined) link.rawStyle = a.rawStyle;
  if (a.thicknessOverride !== undefined) link.thicknessOverride = a.thicknessOverride;
  if (a.colorOverride !== undefined) link.colorOverride = a.colorOverride;
  if (a.stereotype !== undefined) link.stereotype = a.stereotype;
  if (a.stereotypeIsLinkLabel) link.stereotypeIsLinkLabel = true;
  if (a.label !== undefined) link.label = a.label;
  return link;
}

export interface ParsedLink {
  from: EndpointShape;
  to: EndpointShape;
  link: DescriptiveLink;
  /** I3b write-set expansion (journaled): LEFT/UP direction -- true when
   *  `resolveDirectionInfo` swapped `from`/`to` to their post-inversion
   *  order. `command-table.ts`'s link-execute handler needs this to
   *  (a) auto-create endpoints in RAW ent1-then-ent2 order regardless of
   *  inversion (`CommandLinkElement.executeArg:317-318`: `getDummy(ent1)`
   *  then `getDummy(ent2)` run BEFORE the `link.getInv()` swap) and
   *  (b) burn one extra shared-counter value for the discarded
   *  pre-inversion `Link` (`Link#getInv()`, `abel/Link.java:145-147`) --
   *  see `DescriptiveLink.creationIndex`'s doc comment. */
  inverted: boolean;
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
  const arrowStyle = parseArrowStyle(g.style1, g.style2);
  const { hidden, norank, single, rawStyle, thickness, color } = arrowStyle;
  const { stereotype, label, stereotypeIsLinkLabel } = resolveStereotypeAndLabel(g);

  const link = buildLinkFromArgs({
    from: from.id, to: to.id,
    // A bracket dashed/dotted/bold keyword OVERRIDES the queue-char style --
    // upstream applies `applyStyle` strictly after `getLinkType`
    // (`CommandLinkElement.executeArg:301,330`).
    style: arrowStyle.style ?? linkStyleFromQueue(queue), arrowHead, length,
    firstLabel: labels.first, secondLabel: labels.second,
    tailDecor: decors.tail, headDecor: decors.head,
    hidden, norank, single, rawStyle,
    thicknessOverride: thickness, colorOverride: color,
    stereotype, stereotypeIsLinkLabel, label,
  });
  return { from, to, link, inverted };
}
