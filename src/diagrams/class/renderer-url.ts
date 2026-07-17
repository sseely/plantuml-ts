/**
 * renderer-url.ts — G2 N15 (README item #7): the classifier-level `[[url]]`
 * `<a>`-wrap render decision. Split out of `renderer.ts` (already over the
 * project's 500-line file cap — CLAUDE.md's own engineering-constraints
 * note: "new code goes in its own modules") — mirrors the existing
 * `renderer-arrowhead.ts`/`renderer-group.ts`/`renderer-note.ts` split
 * precedent for a renderer sub-concern.
 *
 * A classifier's own `[[url]]` wraps its ENTIRE drawn content in ONE `<a>`
 * (`EntityImageClass#drawU`'s `startUrl`/`closeUrl` around the whole
 * `drawInternal` call — jar-verified byte-exact against `tegoxa-17-
 * kudo421`'s empty-body classifier and `gavimi-70-nuju057`). SCOPED to
 * classifier-level urls only (this iteration's named grammar) — a member
 * row with its OWN (unmodeled) `[[[url]]]` override, or an explicit
 * visibility icon (whose `<g data-visibility-modifier>` wrapper forces the
 * jar's real SVG builder to split the link into several `<a>` runs instead
 * of one, per `SvgGraphics#startGroup`/`closeGroup`'s unconditional
 * link-flush — that module's own doc comment), is NOT modeled — this
 * function deliberately returns the body UNWRAPPED in either case rather
 * than emitting a plausible-looking but structurally wrong single merge
 * (jar-verified via `fugexa-12-zoti674`/`gukuda-51-fuju086`'s childCount
 * mismatch when this guard was missing; `plans/g2-class-svg/ledger.md` N15
 * names both sub-cases as remainders).
 * @see ~/git/plantuml/.../svek/image/EntityImageClass.java:141-159
 * @see ~/git/plantuml/.../klimt/drawing/svg/SvgGraphics.java:1238-1263
 */
import type { ClassifierGeo } from './layout.js';
import { linkWrap } from '../../core/svg.js';

/**
 * Wraps `body` (the classifier's already-rendered box content) in `<a>`
 * when `geo.url` is set and no row needs its own per-row split (see module
 * doc comment) — otherwise returns `body` unchanged.
 */
export function wrapClassifierUrl(geo: ClassifierGeo, body: string): string {
  if (geo.url === undefined) return body;
  const needsPerRowSplit = geo.rows.some((r) => r.visibilityIcon !== undefined || r.hasUrl === true);
  if (needsPerRowSplit) return body;
  return linkWrap(body, geo.url);
}
