/**
 * Construction-time seams for {@link TContext}. Both are plantuml-ts additions
 * with no upstream counterpart (upstream's `TContext` constructor takes a
 * `PathSystem` / `Defines` / `Charset` / `DefinitionsContainer` instead, none
 * of which a browser-safe, synchronous port can use).
 */

import type { StringLocated } from './StringLocated.js';
import type { TimEnvironment } from './builtin/TimEnvironment.js';

/**
 * Upstream emits a flat line list and lets the COMMAND layer parse `<style>`
 * blocks and `skinparam` lines out of it. plantuml-ts's `PreprocessorResult`
 * instead carries `styles` / `skinparam` as separate fields, extracted by the
 * preprocessor itself and -- critically -- extracted BEFORE macro/variable
 * substitution runs on the line (`tests/unit/preprocessor.test.ts`: "style
 * block content is collected verbatim (no define substitution)").
 * `TContext#addPlain` is the only point in the interpreter where a surviving
 * content line is seen raw: post-comment, post-conditional, pre-substitution.
 * Returning `true` consumes the line -- nothing is emitted for it.
 */
export type PlainLineFilter = (rawLine: StringLocated) => boolean;

export interface TContextOptions {
  /** Injected clock / RNG / file+stdlib lookups for the seam-backed builtins. */
  readonly env?: TimEnvironment;
  /** See {@link PlainLineFilter}. */
  readonly plainLineFilter?: PlainLineFilter;
}
