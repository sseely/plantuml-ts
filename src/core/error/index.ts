/**
 * The error diagram — upstream's `net/sourceforge/plantuml/error/` (plus the
 * Welcome screen it stacks on top, from `eggs/PSystemWelcome`).
 *
 * PlantUML never throws at its caller: a malformed document still produces an
 * SVG. `src/index.ts`'s `renderSync` / `render` / `renderAll` catch blocks
 * build one of these and draw it.
 *
 * `PSystemUnsupported` is ported but not yet dispatched to: it triggers on
 * upstream's `DiagramType.UNKNOWN` (an `@start<something>` this build does not
 * know), a concept this port's dispatcher does not yet produce — `block-extractor`
 * maps an unrecognized suffix onto the same `'unknown'` type that `@startuml`
 * content-probing produces when it cannot tell, and the two must not be
 * conflated. It arrives with the rest of the package rather than being left for
 * a later archaeology pass; the day the dispatcher grows upstream's UNKNOWN
 * signal (`PSystemErrorUtils#checkBasicError`), the render is already here.
 */

export { ErrorUml } from './ErrorUml.js';
export type { ErrorUmlType } from './ErrorUml.js';
export { PSystemError } from './PSystemError.js';
export { PSystemErrorEmpty } from './PSystemErrorEmpty.js';
export { PSystemErrorPreprocessor } from './PSystemErrorPreprocessor.js';
export { PSystemErrorV2 } from './PSystemErrorV2.js';
export { PSystemUnsupported } from './PSystemUnsupported.js';
export { PSystemWelcome } from './PSystemWelcome.js';
export { buildV2, merge } from './PSystemErrorUtils.js';
export { umlSourceOf } from './UmlSource.js';
export {
  renderPSystemError,
  renderPSystemUnsupported,
  renderPSystemWelcome,
} from './error-renderer.js';
