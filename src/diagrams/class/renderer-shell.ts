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
import { group } from '../../core/svg.js';
import { assembleDocumentShell } from '../../core/klimt/document-shell.js';

/** `net.sourceforge.plantuml.core.DiagramType#CLASS` — verified against
 *  every cached jar class-diagram fixture's `data-diagram-type` root
 *  attribute (e.g. `test-results/dot-cache/class/bajotu-30-soku184/in.svg`). */
const DIAGRAM_TYPE_CLASS = 'CLASS';

export function assembleClassShell(fragment: RenderFragment): string {
  const body = fragment.bodyWrapped === true ? fragment.body : group(fragment.body);
  return assembleDocumentShell({ ...fragment, body }, DIAGRAM_TYPE_CLASS);
}
