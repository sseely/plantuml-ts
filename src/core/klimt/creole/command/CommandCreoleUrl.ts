/**
 * CommandCreoleUrl — `[[url]]` / `[[url label]]` / `[[url {tooltip}]]` /
 * `[[url {tooltip} label]]` link atom-splitting: the jar draws the
 * resolved LABEL as its own text atom, in the hyperlink color (blue,
 * `SkinParamUtils.getFontHyperlinkColor` — `#0000FF` in every jar-verified
 * sample) with an underline, wrapped in an `<a href>` element.
 *
 * Upstream: klimt/creole/command/CommandCreoleUrl.java, built on
 * `UrlBuilder`/`Url` (`net/url/`) — NOT ported symbol-for-symbol (a whole
 * URL-mode/topurl-prefix subsystem, out of this iteration's directive-atom
 * charter); this command instead resolves the visible label directly
 * (strip an optional `{tooltip}`, first whitespace-run is the url, the
 * REST is the label, defaulting to the url itself when nothing follows —
 * `Url(String,String,String)`'s label-defaulting ctor, java) and applies
 * the jar's own OBSERVED text styling (jar-verified 2026-07-15,
 * `usecase/bivira-53-boja685`: `fill="#0000FF"` +
 * `text-decoration="underline"`).
 *
 * G2 N40: the `<a href>` SVG wrapper element itself LANDED (class-diagram
 * call site only, `renderer-classifier-box.ts#renderRowAtoms` -- see that
 * function's own doc comment) via `StripeBuilder#analyzeAndAddInlineWithUrl`
 * (`atom/Atom.ts#CreoleAtomUrl`, threaded onto the produced `'text'` atom(s)
 * rather than a NEW atom kind, so nested creole markup inside the label
 * keeps working exactly as before). `url`/`tooltip` resolution mirrors
 * `resolveLabel`'s own algorithm exactly (same tooltip-strip + first-
 * whitespace-run split, just keeping the PARTS `resolveLabel` throws away)
 * -- jar-verified `dasagu-52-vani172`'s classifier/member-level url grammar
 * is a SEPARATE mechanism (`class-url.ts#parseUrlBracket`'s full 5-way
 * `UrlBuilder` port); this file's own simplified grammar is intentionally
 * NOT unified with it (`core/klimt` must not depend on `diagrams/class`).
 * `entity-level `url of X is [[...]]` hyperlink wrapping remains a
 * SEPARATE, still-missing mechanism (`EntityImageDescription.ts`'s own
 * pre-existing "entity hyperlinks (Url) are not supported" gap) — out of
 * this directive's scope.
 */
import type { Command, StripeBuilder } from './Command.js';
import { FontStyle, type FontConfiguration } from '../../shape/UText.js';

// `UrlBuilder.getRegexp()`'s shape (bracket-delimited, no nested `]]`
// inside) — ported as a source string (never a regex literal, the `[`/`]`
// complexity-hook precedent already established by `creole-atoms.ts`).
const URL_TAG_SOURCE = '\\[\\[([^\\]]*(?:\\][^\\]]+)*)\\]\\]';

const HYPERLINK_COLOR = '#0000FF';

/** Upstream: `Url`'s label-defaulting ctor -- strip an optional
 *  `{tooltip}`, the first whitespace-run is the url, everything after is
 *  the label; falls back to the url itself when nothing remains. */
function resolveLabel(inner: string): string {
  const withoutTooltip = inner.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
  const spaceIdx = withoutTooltip.indexOf(' ');
  return spaceIdx === -1 ? withoutTooltip : withoutTooltip.slice(spaceIdx + 1).trim();
}

/** G2 N40: `resolveLabel`'s own tooltip-strip + first-whitespace-run split,
 *  keeping the url (part BEFORE the split) and tooltip (the `{...}`
 *  capture, defaulting to the url itself when absent -- `Url.java`'s own
 *  tooltip-defaulting ctor rule, same precedent `class-url.ts#buildUrl`
 *  already applies for the classifier-level grammar). */
function resolveUrlAndTooltip(inner: string): { url: string; tooltip: string } {
  const tooltipMatch = /\{([^}]*)\}/.exec(inner);
  const withoutTooltip = inner.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
  const spaceIdx = withoutTooltip.indexOf(' ');
  const url = spaceIdx === -1 ? withoutTooltip : withoutTooltip.slice(0, spaceIdx);
  return { url, tooltip: tooltipMatch?.[1] ?? url };
}

function applyHyperlinkStyleAndPush(
  label: string,
  url: string,
  tooltip: string,
  stripe: StripeBuilder,
): void {
  const saved: FontConfiguration = stripe.getActualFontConfiguration();
  stripe.setActualFontConfiguration({
    ...saved,
    color: HYPERLINK_COLOR,
    styles: new Set(saved.styles).add(FontStyle.UNDERLINE),
  });
  stripe.analyzeAndAddInlineWithUrl(label, url, tooltip);
  stripe.setActualFontConfiguration(saved);
}

/** Upstream: `CommandCreoleUrl.create()`. */
export function createUrlCommand(): Command {
  const re = new RegExp('^' + URL_TAG_SOURCE);
  return {
    starters: ['[['],
    matchingSize(line, pos) {
      const m = re.exec(line.slice(pos));
      return m === null ? 0 : m[0].length;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = re.exec(line.slice(pos));
      if (m === null) return 0;
      const inner = m[1]!;
      const { url, tooltip } = resolveUrlAndTooltip(inner);
      applyHyperlinkStyleAndPush(resolveLabel(inner), url, tooltip, stripe);
      return m[0].length;
    },
  };
}
