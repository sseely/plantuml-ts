/**
 * renderer-url.ts — G2 N15 (README item #7): the classifier-level `[[url]]`
 * `<a>`-wrap render decision. Split out of `renderer.ts` (already over the
 * project's 500-line file cap — CLAUDE.md's own engineering-constraints
 * note: "new code goes in its own modules") — mirrors the existing
 * `renderer-arrowhead.ts`/`renderer-group.ts`/`renderer-note.ts` split
 * precedent for a renderer sub-concern.
 *
 * A classifier's own `[[url]]` wraps its content in `<a>` runs
 * (`EntityImageClass#drawU`'s `startUrl`/`closeUrl` around the whole
 * `drawInternal` call, but `SvgGraphics#startGroup`/`closeGroup` flush the
 * ACTIVE link on every nested group boundary -- `klimt/drawing/svg/
 * SvgGraphics.java:1192-1263`). G2 N16 generalizes N15's classifier-only
 * whole-box wrap to the real per-primitive rule: every drawn primitive
 * (the header rect/badge/name bundle, each divider line, each member row)
 * has an EFFECTIVE url (that row's OWN `[[[url]]]` if set, else the
 * classifier's `[[url]]` fallback, else none); consecutive primitives with
 * the SAME effective url merge into ONE `<a>` run, any url CHANGE (or a
 * transition to/from "no url") starts a new run -- jar-verified byte-exact
 * against `fugexa-12-zoti674` (`tegoxa-17-kudo421`/`gavimi-70-nuju057`'s
 * simpler whole-box case is the DEGENERATE single-run case of this same
 * algorithm: every primitive has the SAME classifier-fallback url, so the
 * whole box merges into one `<a>`, unchanged from N15's own behavior).
 *
 * SCOPED (N16, unchanged from N15's own scoping note): a row with an
 * explicit visibility icon is NOT modeled -- its `<g data-visibility-
 * modifier>` wrapper is a REAL structural `<g>` that forces its own
 * link-flush boundary in `SvgGraphics`, and this port has no jar sample
 * combining a visibility icon with an active classifier/member url to
 * derive the exact split from. When ANY row shows an icon, the WHOLE
 * classifier draws unwrapped (no `<a>` at all) rather than emitting a
 * plausible-looking but structurally wrong merge (jar-verified via
 * `fugexa-12-zoti674`/`gukuda-51-fuju086`'s childCount mismatch when this
 * guard was missing, N15).
 * @see ~/git/plantuml/.../svek/image/EntityImageClass.java:141-159
 * @see ~/git/plantuml/.../klimt/drawing/svg/SvgGraphics.java:1238-1263
 */
import type { ClassifierGeo } from './layout.js';
import type { UrlInfo } from './class-url.js';
import { linkWrap } from '../../core/svg.js';

/** One drawn primitive in a classifier box's top-to-bottom draw order,
 *  tagged with its EFFECTIVE url (own row url, classifier fallback, or
 *  `undefined`) -- see module doc comment for the run-merge algorithm this
 *  feeds. */
export interface UrlTaggedPrimitive {
  readonly url: UrlInfo | undefined;
  readonly body: string;
  /**
   * G2 N21: true when `body` is ALREADY fully formed (its own url-wrap, if
   * any, baked in by the caller — e.g. a visibility icon's `<g
   * data-visibility-modifier>` wrapper, which must contain its OWN nested
   * `<a>` rather than being wrapped BY one). A `preWrapped` primitive is
   * emitted verbatim as its own single-item run: never merged with an
   * adjacent primitive (even one sharing the same `url`) and never passed
   * through {@link linkWrap} again.
   */
  readonly preWrapped?: boolean;
}

/** Structural equality on the THREE `UrlInfo` fields (not just `url`) --
 *  two adjacent runs sharing the same href but a DIFFERENT tooltip/label
 *  are still two separate upstream `Url` values (`Url.java`'s own
 *  3-field ctor), which would emit byte-DIFFERENT (if otherwise
 *  identical-looking) adjacent `<a>` tags rather than one merged run --
 *  matching jar's real splitting behavior requires the SAME full-value
 *  comparison a naive href-only check would silently coarsen. */
function urlsEqual(a: UrlInfo | undefined, b: UrlInfo | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.url === b.url && a.tooltip === b.tooltip && a.label === b.label;
}

/**
 * Merges `primitives` (already tagged with their effective url) into `<a>`
 * runs per the module doc comment's algorithm, or returns them concatenated
 * unwrapped when any row carries a visibility icon (see module doc
 * comment's scoping note).
 */
export function wrapClassifierBody(_geo: ClassifierGeo, primitives: readonly UrlTaggedPrimitive[]): string {
  const runs: string[] = [];
  let i = 0;
  while (i < primitives.length) {
    if (primitives[i]!.preWrapped === true) {
      runs.push(primitives[i]!.body);
      i++;
      continue;
    }
    const url = primitives[i]!.url;
    let body = '';
    while (
      i < primitives.length &&
      primitives[i]!.preWrapped !== true &&
      urlsEqual(primitives[i]!.url, url)
    ) {
      body += primitives[i]!.body;
      i++;
    }
    runs.push(url !== undefined ? linkWrap(body, url) : body);
  }
  return runs.join('');
}
