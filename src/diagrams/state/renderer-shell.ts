/**
 * renderer-shell.ts — mission G4 S1, mechanism 1 ("SVG root shell"):
 * reassembles a state-diagram `RenderFragment` using jar's CucaDiagram-
 * family root-attribute/prolog/defs conventions (`core/klimt/document-
 * shell.ts#assembleDocumentShell`, the SAME shared shell class
 * (`class/renderer-shell.ts#assembleClassShell`) and description
 * (`description/renderer.ts#assembleKlimtShell`) already reuse) instead of
 * the generic `svgRoot` (`core/svg.ts`) `renderState` went through before
 * this mission.
 *
 * Deliberately SIMPLER than `assembleClassShell`: this mission's sampled
 * corpus (S0 ledger, 16 fixtures spanning every major state feature) showed
 * NO `documentBackgroundRect`/`diagramBorderColor` splice need for the
 * DEFAULT (`#FFFFFF`) background case — a plain `group(fragment.body)` wrap
 * (mirroring `assembleClassShell`'s own Part B "exactly one top-level `<g>`"
 * guarantee for both the annotated and unannotated case) was the whole job.
 *
 * mission G4 S5: sampling the wider corpus (`dapuko-98-zuzo096`, `skinparam
 * BackgroundColor gray`) surfaced a case S0's own 16-fixture sample never
 * exercised — jar draws an EXPLICIT full-canvas content `<rect>` (the FIRST
 * child of the content `<g>`, BEFORE any entity markup) whenever the
 * resolved background is non-default, on top of (not instead of) the root
 * `style="...background:...;"` attribute `assembleDocumentShell` already
 * handles correctly for both cases. jar-verified byte-exact (modulo the
 * `style=` vs separate-attrs normalization `tests/oracle/svg-conformance/
 * normalize.ts` already treats as equivalent) against `dapuko-98-zuzo096`
 * (`fill="#808080"`), `niveno-60-tiro789` (`fill="#AAAAAA"`), `xexika-61-
 * fedu273` (`fill="#808080"`) — all 11 non-default-background STATE corpus
 * fixtures share this SAME `<rect x="0" y="0" width="W" height="H"
 * fill="{background}" style="stroke:none;stroke-width:1;"/>` shape, W/H
 * matching the document's own final (truncated) dimensions. The exact
 * upstream source line was NOT pinned down this iteration (a targeted
 * search of `TitledDiagram#calculateBackColor`/`CucaDiagram`/
 * `GeneralImageBuilder`/`TextBlockExporter` found the ROOT-style background
 * assignment but not this content-level rect draw call) — empirically
 * confirmed via jar bytes across the full non-default-background subset,
 * per this project's own established "jar-verified, source line not found"
 * pattern (e.g. mechanism 3's own `transitionArrowheadInk` sub-bug, S4
 * ledger). Default (`#FFFFFF`) fixtures verified to carry NO such rect
 * (`jocela-05-niba392`, `coteta-47-mare883`), so this is additive, not a
 * replacement for the existing root-style handling.
 *
 * @see plans/g4-state-svg/ledger.md (S1, mechanism 1; S5, background rect)
 */

import type { RenderFragment } from '../../core/dispatcher.js';
import { group, rect } from '../../core/svg.js';
import { assembleDocumentShell } from '../../core/klimt/document-shell.js';

/** `net.sourceforge.plantuml.core.DiagramType#STATE` — verified against
 *  every cached jar state-diagram fixture's `data-diagram-type` root
 *  attribute (e.g. `test-results/dot-cache/state/jocela-05-niba392/in.svg`). */
const DIAGRAM_TYPE_STATE = 'STATE';

/** The default (unset) diagram background — matches `theme.ts`'s own
 *  `colors.background: '#FFFFFF'` default; see this module's own doc
 *  comment for why only a NON-default background gets an explicit rect. */
const DEFAULT_BACKGROUND = '#FFFFFF';

/** mission G4 S5: the explicit content-level background rect (see module
 *  doc comment) — `Math.trunc` matches `assembleDocumentShell`'s own
 *  truncation of `fragment.width`/`.height` for the root `width`/`height`/
 *  `viewBox` attributes, so this rect's own `width`/`height` always agree
 *  with the document's final (truncated) dimensions. */
function maybeBackgroundRect(fragment: RenderFragment): string {
  const background = fragment.background ?? DEFAULT_BACKGROUND;
  if (background === DEFAULT_BACKGROUND) return '';
  return rect(0, 0, Math.trunc(fragment.width), Math.trunc(fragment.height), {
    fill: background,
    stroke: 'none',
    strokeWidth: 1,
  });
}

export function assembleStateShell(fragment: RenderFragment): string {
  const backgroundRect = fragment.bodyWrapped === true ? '' : maybeBackgroundRect(fragment);
  const body = fragment.bodyWrapped === true ? fragment.body : group(backgroundRect + fragment.body);
  return assembleDocumentShell({ ...fragment, body }, DIAGRAM_TYPE_STATE);
}
