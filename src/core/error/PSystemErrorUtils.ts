/**
 * Factory + merge helpers for the error diagram.
 *
 * `merge` exists because upstream hands the same source to several diagram
 * factories in turn; each may fail, and the error shown is the one that got
 * FURTHEST (highest `score()` — most lines consumed before failing). This port
 * dispatches through `registry.resolve` (one plugin, chosen up front) rather
 * than by trial parsing, so `merge` has one caller today: `renderAll`, which
 * per-block picks the best error when a block fails. It is ported whole
 * regardless — the scoring rule IS the behavior.
 *
 * `checkBasicError` (the `@startuml` + `digraph`/`ditaa`/`salt`/`nwdiag`
 * "you meant `@startdot`" hints) is NOT ported: it keys off
 * `DiagramType.UNKNOWN` and a `Collection<DiagramType>` of candidate parsers,
 * neither of which this port's dispatcher produces. Recorded as a gap, not a
 * decision — a later mission that ports upstream's multi-factory probe should
 * bring it across.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/error/PSystemErrorUtils.java
 */

import type { StringLocated } from '../tim/StringLocated.js';
import type { ErrorUml } from './ErrorUml.js';
import type { PSystemError } from './PSystemError.js';
import { PSystemErrorV2 } from './PSystemErrorV2.js';

/** @see ~/git/plantuml/.../error/PSystemErrorUtils.java#buildV2 */
export function buildV2(
  source: readonly StringLocated[],
  singleError: ErrorUml,
  list: readonly StringLocated[],
  rootCause?: unknown,
): PSystemError {
  return new PSystemErrorV2(source, list, singleError, rootCause);
}

/**
 * The error that got furthest wins.
 * @see ~/git/plantuml/.../error/PSystemErrorUtils.java#merge
 */
export function merge(ps: readonly PSystemError[]): PSystemError {
  if (ps.length === 0) throw new Error('PSystemErrorUtils.merge: no error to merge');

  let result: PSystemError | undefined;
  for (const err of ps) if (result === undefined || result.score() < err.score()) result = err;

  return result!;
}
