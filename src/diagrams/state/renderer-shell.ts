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
 * NO `documentBackgroundRect`/`diagramBorderColor` splice need — a plain
 * `group(fragment.body)` wrap (mirroring `assembleClassShell`'s own Part B
 * "exactly one top-level `<g>`" guarantee for both the annotated and
 * unannotated case) is the whole job.
 *
 * @see plans/g4-state-svg/ledger.md (S1, mechanism 1)
 */

import type { RenderFragment } from '../../core/dispatcher.js';
import { group } from '../../core/svg.js';
import { assembleDocumentShell } from '../../core/klimt/document-shell.js';

/** `net.sourceforge.plantuml.core.DiagramType#STATE` — verified against
 *  every cached jar state-diagram fixture's `data-diagram-type` root
 *  attribute (e.g. `test-results/dot-cache/state/jocela-05-niba392/in.svg`). */
const DIAGRAM_TYPE_STATE = 'STATE';

export function assembleStateShell(fragment: RenderFragment): string {
  const body = fragment.bodyWrapped === true ? fragment.body : group(fragment.body);
  return assembleDocumentShell({ ...fragment, body }, DIAGRAM_TYPE_STATE);
}
