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
import {
  applyClassDocumentMargin,
  computeClassBorderRectDims,
} from './layout-ink-extent.js';

/** `net.sourceforge.plantuml.core.DiagramType#CLASS` — verified against
 *  every cached jar class-diagram fixture's `data-diagram-type` root
 *  attribute (e.g. `test-results/dot-cache/class/bajotu-30-soku184/in.svg`). */
const DIAGRAM_TYPE_CLASS = 'CLASS';

/** `UStroke.simple()`'s default thickness -- jar's `TextBlockExporter
 *  #maybeDrawBorder` falls back to this whenever `LineParam.diagramBorder`
 *  has no explicit override, which is every corpus fixture found so far
 *  (`theme.ts#diagramBorderColor`'s own doc comment). */
const DIAGRAM_BORDER_THICKNESS = 1;

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

/**
 * G2 N66 (near-zero harvest, `vinujo-78-kapo329`): `fragment
 * .diagramBorderColor`'s whole-canvas `<rect fill="none">` border, spliced
 * in as the outer `<g>`'s FIRST child -- BEFORE {@link
 * withDocumentBackgroundRect}'s own splice, matching jar's `TextBlock
 * Exporter#maybeDrawBorder` running OUTSIDE/BEFORE the diagram's own draw
 * (which includes ITS OWN `documentBackgroundRect`, an entirely separate,
 * class-diagram-local mechanism, N48) -- `assembleClassShell` below calls
 * this SECOND (after `withDocumentBackgroundRect`) so the border rect ends
 * up spliced closest to `<g>`, i.e. drawn FIRST.
 *
 * Requires `fragment.width`/`fragment.height` (FINAL, post-chrome) to
 * exactly equal what {@link applyClassDocumentMargin} computes from
 * `fragment.preChromeWidth`/`preChromeHeight` (the class body's OWN raw ink
 * dims, `ClassGeometry.rawWidth`'s own doc comment) -- i.e., chrome did NOT
 * inflate the canvas beyond the class body's own bounds. A chrome-present
 * (title/caption/legend/header/footer) fixture combined with `skinparam
 * diagramBorderColor` has ZERO corpus reach and would need the CHROME-
 * INCLUSIVE raw dims (not currently threaded anywhere) to compute jar's
 * exact PRE-FLOOR border-rect formula correctly ({@link
 * computeClassBorderRectDims}'s own doc comment) -- rather than draw a
 * possibly-wrong-sized rect, this guard silently no-ops for that case,
 * matching this mission's "don't guess beyond verified need" discipline.
 * Also NOT monochrome-aware (`class-monochrome.ts#applyMonochromeToFragment`
 * already ran, over `fragment.body`, before this function's own caller even
 * receives the fragment) -- zero corpus reach for a `skinparam monochrome`
 * + `diagramBorderColor` combination either.
 */
function withDiagramBorderRect(body: string, fragment: RenderFragment, colorHex: string): string {
  if (fragment.preChromeWidth === undefined || fragment.preChromeHeight === undefined) return body;
  const rawDims = { width: fragment.preChromeWidth, height: fragment.preChromeHeight };
  const expectedFinal = applyClassDocumentMargin(rawDims);
  if (expectedFinal.width !== fragment.width || expectedFinal.height !== fragment.height) return body;
  const rectDims = computeClassBorderRectDims(rawDims, DIAGRAM_BORDER_THICKNESS);
  const marker = '<g>';
  const borderRect = rect(0, 0, rectDims.width, rectDims.height, {
    fill: 'none', stroke: colorHex, strokeWidth: DIAGRAM_BORDER_THICKNESS,
  });
  return body.startsWith(marker) ? marker + borderRect + body.slice(marker.length) : body;
}

export function assembleClassShell(fragment: RenderFragment): string {
  const body = fragment.bodyWrapped === true ? fragment.body : group(fragment.body);
  const withRect =
    fragment.documentBackgroundRect !== undefined
      ? withDocumentBackgroundRect(body, fragment.documentBackgroundRect, fragment.width, fragment.height)
      : body;
  const withBorder =
    fragment.diagramBorderColor !== undefined
      ? withDiagramBorderRect(withRect, fragment, fragment.diagramBorderColor)
      : withRect;
  return assembleDocumentShell({ ...fragment, body: withBorder }, DIAGRAM_TYPE_CLASS);
}
