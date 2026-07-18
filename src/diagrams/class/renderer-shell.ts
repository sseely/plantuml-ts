/**
 * renderer-shell.ts — mission G2 N1, mechanism 2 ("SVG root shell"),
 * part A+B: reassembles a class-diagram `RenderFragment` using jar's own
 * class-diagram root-attribute/prolog/defs conventions (the SAME literal
 * shape `description/renderer.ts#assembleKlimtShell` uses — both delegate
 * to `core/klimt/document-shell.ts#assembleDocumentShell`) instead of the
 * generic `svgRoot` (`core/svg.ts`) `renderClass` went through before this
 * mission.
 *
 * Split out of `class/renderer.ts` (which already sits close to this
 * project's 500-line file cap) rather than inlined there, mirroring
 * `description/renderer.ts`'s own separation of `assembleKlimtShell` from
 * its main render function.
 *
 * Part B (single wrapping `<g>`): unlike description, class has no
 * `CompleteSvg`/klimt escape hatch — `renderClass` always returns a
 * `RenderFragment`, so this function (not a separate raw-klimt-document
 * code path) is the ONE place that must guarantee jar's "exactly one
 * top-level `<g>`" shape for BOTH the annotated and unannotated case.
 * `core/annotations/chrome.ts#applyChrome` already adds its own single
 * bare `<g>` wrap when annotations decorate the fragment (`bodyWrapped:
 * true` on its return, G2 N1) — this function wraps `fragment.body`
 * itself ONLY when that has NOT already happened, so annotated and
 * unannotated class diagrams both end up with exactly one content `<g>`,
 * never zero, never two.
 *
 * @see plans/g2-class-svg/ledger.md (N1, mechanism 2)
 */

import type { RenderFragment } from '../../core/dispatcher.js';
import { group, rect } from '../../core/svg.js';
import { assembleDocumentShell } from '../../core/klimt/document-shell.js';

/** `net.sourceforge.plantuml.core.DiagramType#CLASS` — verified against
 *  every cached jar class-diagram fixture's `data-diagram-type` root
 *  attribute (e.g. `test-results/dot-cache/class/bajotu-30-soku184/in.svg`). */
const DIAGRAM_TYPE_CLASS = 'CLASS';

/**
 * G2 N48: `fragment.documentBackgroundRect`'s full-FINAL-canvas `<rect>`,
 * spliced in as the outer `<g>`'s FIRST child -- both `group(fragment.body)`
 * (no chrome) and `applyChrome`'s own bare wrap (`bodyWrapped: true`)
 * produce a body string starting with the literal, attribute-less `<g>`
 * (`chrome.ts#applyChrome`'s `group(block.body)` one-arg call) -- splicing
 * right after that fixed 3-character prefix is equivalent to, but avoids
 * re-parsing/re-serializing, a full XML insert. `width`/`height` are
 * already the FINAL (post-chrome, post-document-margin) canvas dims by the
 * time this runs (`index.ts#assembleSvg` calls this AFTER
 * `applyAnnotationChrome`) -- jar-verified `xalaco-64-vuzu312`: the rect
 * spans 0,0 to the full `viewBox` width/height, including the title strip.
 */
function withDocumentBackgroundRect(
  body: string,
  fill: string,
  width: number,
  height: number,
): string {
  const marker = '<g>';
  const bgRect = rect(0, 0, width, height, { fill, stroke: 'none', strokeWidth: 1 });
  return body.startsWith(marker) ? marker + bgRect + body.slice(marker.length) : body;
}

export function assembleClassShell(fragment: RenderFragment): string {
  const body = fragment.bodyWrapped === true ? fragment.body : group(fragment.body);
  const withRect =
    fragment.documentBackgroundRect !== undefined
      ? withDocumentBackgroundRect(body, fragment.documentBackgroundRect, fragment.width, fragment.height)
      : body;
  return assembleDocumentShell({ ...fragment, body: withRect }, DIAGRAM_TYPE_CLASS);
}
