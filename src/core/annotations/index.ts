/**
 * Public surface of the annotation model + command matcher (mission G0b).
 * Parsers (T4/T5) call {@link matchAnnotationCommand} at their own
 * command-dispatch position and store the resulting {@link
 * DiagramAnnotations} on their AST (decisions.md D3). The chrome pipeline
 * (T5-T9) reads it back via {@link isEmpty} to skip chrome entirely for
 * annotation-free diagrams (decisions.md D5, byte-stability).
 */

export type { DisplayPositioned, DiagramAnnotations } from './model.js';
export {
  createAnnotations,
  horizontalAlignmentFromString,
  horizontalAlignmentFromStringOrDefault,
  isDisplayPositionedNull,
  isEmpty,
  noneDisplayPositioned,
  setCaption,
  setLegend,
  setMainFrame,
  setTitle,
  singleDisplayPositioned,
  updateFooter,
  updateHeader,
  verticalAlignmentFromString,
  withDisplay,
  withHorizontalAlignment,
  withLocation,
} from './model.js';
export { matchAnnotationCommand } from './commands.js';

// ---------------------------------------------------------------------------
// T4 — chrome geometry + block builders (chrome.ts / blocks.ts)
// ---------------------------------------------------------------------------

export type { AnnotationBlock } from './blocks.js';
export { buildAnnotationBlock } from './blocks.js';
export type { AnnotationStyles } from './chrome.js';
export { applyChrome, getTextX, mergeTB } from './chrome.js';
