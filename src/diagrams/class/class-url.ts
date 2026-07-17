/**
 * `[[url]]` link grammar — G2 N15 (README item #7, deferred since N6).
 *
 * Byte-exact port of `url/UrlBuilder.java`'s 5-way STRICT-mode regex
 * grammar (`getUrl`, `UrlMode.STRICT` — `Matcher2#matches()`, the WHOLE
 * bracket text must match one alternative, no partial/`find()` fallback;
 * every class-diagram caller constructs `new UrlBuilder(topurl,
 * UrlMode.STRICT)`). Scope this iteration: CLASSIFIER-level urls only
 * (`class Foo [[url]]` inline on a declaration, and the standalone `url
 * [of|for] <Code> [is] [[url]]` statement, `classdiagram/command/
 * CommandUrl.java`) — member-line `[[[url]]]` (triple-bracket) urls are a
 * SEPARATE, not-yet-built mechanism (not named in this iteration's scope;
 * `class-member-parser.ts` already strips a member's `[[...]]`/`[[[...]]]`
 * suffix unparsed, N12).
 *
 * `%g` (upstream's quote-char class: `"`, U+201C, U+201D, plus an
 * invisible-quote codepoint) is narrowed to plain `"` here — matches this
 * port's existing quote-handling convention elsewhere (`class-notes.ts
 * #NOTE_TARGET`'s `"[^"]+"`, `stripQuotes`); smart quotes are an
 * unsupported, pre-existing gap in every other quoted-string grammar in
 * this file, not a new omission.
 *
 * @see ~/git/plantuml/.../url/UrlBuilder.java
 * @see ~/git/plantuml/.../url/Url.java (label/tooltip null-fallback rules)
 * @see ~/git/plantuml/.../classdiagram/command/CommandUrl.java (the
 *      standalone `url of X is [[...]]` statement grammar)
 */

export interface UrlInfo {
  readonly url: string;
  readonly tooltip: string;
  readonly label: string;
}

/** `Url.java`'s ctor: `tooltip` defaults to `url` when omitted; `label`
 *  defaults to `url` when omitted OR empty. */
function buildUrl(url: string, tooltip: string | undefined, label: string | undefined): UrlInfo {
  return {
    url,
    tooltip: tooltip ?? url,
    label: label !== undefined && label.length > 0 ? label : url,
  };
}

// `[[%s]*` / `[%s]*]]` -- START_PART / END_PART.
const START = String.raw`\[\[\s*`;
const END = String.raw`\s*\]\]`;

// 1. `[["quoted link"{tooltip} label]]` -- quoted link, optional tooltip,
//    optional label.
const QUOTED = new RegExp(`^${START}"([^"]+)"(?:\\s*\\{([^{}]*)\\})?(?:\\s([^\\s{}[\\]][^[\\]]*))?${END}$`);
// 2. `[[{tooltip}]]` -- tooltip only, url is empty.
const ONLY_TOOLTIP = new RegExp(`^${START}\\{(.*)\\}${END}$`);
// 3. `[[{tooltip} label]]` -- tooltip + label, url is empty.
const ONLY_TOOLTIP_AND_LABEL = new RegExp(
  `^${START}\\{([^{}]*)\\}\\s*([^\\s{}[\\]][^[\\]]*)${END}$`,
);
// 4. `[[link{tooltip}]]` -- bare (unquoted) link, mandatory tooltip, no label.
const LINK_TOOLTIP_NOLABEL = new RegExp(`^${START}([^\\s"{}[\\]]+?)\\s*\\{(.+)\\}${END}$`);
// 5. `[[link{tooltip} label]]` -- bare link, optional tooltip, optional label.
const LINK_WITH_OPTIONAL_TOOLTIP_WITH_OPTIONAL_LABEL = new RegExp(
  `^${START}([^\\s"[\\]]+?)(?:\\s*\\{([^{}]*)\\})?(?:\\s([^\\s{}[\\]][^[\\]]*))?${END}$`,
);

/**
 * Parses a `[[...]]` bracket (the FULL bracket text, including the double
 * brackets) into its `{url, tooltip, label}` triple, trying the 5
 * alternatives in upstream's exact order. Returns `undefined` when `raw`
 * matches none of them (malformed bracket content) -- mirrors `UrlBuilder
 * #getUrl` returning `null`.
 */
export function parseUrlBracket(raw: string): UrlInfo | undefined {
  let m = QUOTED.exec(raw);
  if (m !== null) return buildUrl(m[1]!, m[2], m[3]);

  m = ONLY_TOOLTIP.exec(raw);
  if (m !== null) return buildUrl('', m[1], undefined);

  m = ONLY_TOOLTIP_AND_LABEL.exec(raw);
  if (m !== null) return buildUrl('', m[1], m[2]);

  m = LINK_TOOLTIP_NOLABEL.exec(raw);
  if (m !== null) return buildUrl(m[1]!, m[2], undefined);

  m = LINK_WITH_OPTIONAL_TOOLTIP_WITH_OPTIONAL_LABEL.exec(raw);
  if (m !== null) return buildUrl(m[1]!, m[2], m[3]);

  return undefined;
}

/**
 * Matches a single `[[...]]` bracket occurrence anywhere in a string (no
 * nested-bracket awareness, matching this port's existing pre-N15
 * `extractDecorations` convention) -- callers extract the match text and
 * hand it to {@link parseUrlBracket}.
 */
export const URL_BRACKET_RE = /\[\[[^\]]*\]\]/;
