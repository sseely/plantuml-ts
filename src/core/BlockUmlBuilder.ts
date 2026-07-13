/**
 * `BlockUmlBuilder` -- the document -> blocks stage, and the reason it runs
 * BEFORE the preprocessor.
 *
 * Upstream's reader chain (`BlockUmlBuilder.java:91-100`) is
 *
 *     ReadLineReader -> UncommentReadLine -> preproc2.Preprocessor -> the loop
 *
 * and `preproc2.Preprocessor` is NOT the TIM preprocessor: it applies only
 * `ReadFilterAddConfig` (CLI `-config` lines, which this port has no equivalent
 * of) and `ReadFilterMergeLines` (backslash continuation). So `@start` / `@end`
 * are detected on NEAR-RAW lines, where a conditional structurally CANNOT
 * swallow them. TIM (`TContext`, `!ifdef`, ...) runs afterwards, per block, over
 * that block's own lines -- `BlockUml`'s constructor, which hands them to
 * `TimLoader#load`.
 *
 * plantuml-ts had this inverted (TIM over the whole document, then split), and
 * the inversion is load-bearing, not cosmetic: an unclosed `!ifdef` ate the
 * `@enduml`, no block survived, and a document the jar renders (forum.plantuml.
 * net/6808 -- pdiff `buveco-86-tibo673`) came out as the Welcome screen. This
 * module restores upstream's order.
 *
 * Consequences worth naming, all of them upstream's behavior:
 *  - the split sees COMMENTS (TIM strips them later, per block), so a line that
 *    reads `@enduml` inside a `/' ... '/` block comment closes the block, as it
 *    does in the jar;
 *  - each block gets its OWN `TContext`, so an unclosed conditional in one block
 *    cannot leak into the next;
 *  - lines OUTSIDE any block are not preprocessed at all -- upstream's loop
 *    collects nothing until a `@start` directive.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/BlockUmlBuilder.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/BlockUml.java
 */

import { finalizeBlock } from './block-extractor.js';
import type { UmlSource } from './block-extractor.js';
import { preprocessLinesOrError } from './preprocessor.js';
import type {
  PreprocessOptions,
  PreprocessorFailure,
  PreprocessorResult,
} from './preprocessor.js';
import { isEndDirective, isStartDirective } from './tim/StartUtils.js';
import { readLines } from './tim/ReadLineReader.js';
import type { StringLocated } from './tim/StringLocated.js';

/** The `@start<suffix>` word, lowercased -- `uml`, `json`, `mindmap`, ... */
function startSuffix(line: string): string {
  return RE_START_SUFFIX.exec(line)?.[1]?.toLowerCase() ?? '';
}

/**
 * Which word follows `@start`. Upstream reads it character by character
 * (`DiagramType#getTypes`), so `@startuml(id=X)` and `@startjcckit(800,600)` are
 * a `uml` and a `jcckit` block -- the trailing junk is the block's argument, not
 * part of the keyword.
 * @see ~/git/plantuml/.../core/DiagramType.java#getTypes
 */
const RE_START_SUFFIX = /^\s*[@\\]start(\w+)/i;

/** One `@start...@end` block, still RAW -- upstream's `BlockUml#rawSource`. */
interface RawBlock {
  readonly suffix: string;
  /** `@start` line, interior, `@end` line -- the block's own lines, unprocessed. */
  readonly lines: readonly StringLocated[];
}

interface BlockUmlBase {
  readonly suffix: string;
  /** The block's raw lines, `@start` and `@end` included (`BlockUml#rawSource`). */
  readonly rawSource: readonly StringLocated[];
}

/** A block the interpreter ran over cleanly. */
export interface BlockUmlOk extends BlockUmlBase {
  readonly ok: true;
  /** The preprocessed interior, typed -- upstream's `BlockUml#data`. */
  readonly source: UmlSource;
  /** The interpreter's other output for THIS block: theme, styles, skinparam. */
  readonly preprocessed: PreprocessorResult;
}

/** A block whose interpretation failed -- upstream's `preprocessorError` flag. */
export interface BlockUmlErr extends BlockUmlBase {
  readonly ok: false;
  readonly failure: PreprocessorFailure;
}

export type BlockUml = BlockUmlOk | BlockUmlErr;

/**
 * Read a document, split it into `@start...@end` blocks, and run the
 * preprocessor over each block on its own.
 *
 * A block left unclosed at EOF is DISCARDED, as upstream's loop discards it (it
 * only ever appends a block on an `@end` directive). The jar's apparent
 * tolerance of an unclosed block lives in its CLI (`Pipe#readSingleDiagram`
 * synthesizes the missing `@end`), not in the library.
 */
export function buildBlockUmls(source: string, options?: PreprocessOptions): BlockUml[] {
  return splitRawBlocks(readLines(source)).map((raw) => buildBlockUml(raw, options));
}

/**
 * Upstream's reader loop, verbatim in shape: open a block on a `@start`
 * directive, accumulate every line into it, close it on an `@end` directive.
 * (`@pause` / `@unpause` / `@append` / `!exit` are not ported -- no caller.)
 * @see ~/git/plantuml/.../BlockUmlBuilder.java
 */
function splitRawBlocks(lines: readonly StringLocated[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: StringLocated[] | undefined;
  let suffix = '';

  for (const s of lines) {
    const line = s.getString();
    if (isStartDirective(line)) {
      current = [];
      suffix = startSuffix(line);
    }
    if (current === undefined) continue;

    current.push(s);
    if (isEndDirective(line)) {
      blocks.push({ suffix, lines: current });
      current = undefined;
    }
  }
  return blocks;
}

/** @see ~/git/plantuml/.../BlockUml.java#BlockUml -- the `TimLoader` branch. */
function buildBlockUml(raw: RawBlock, options?: PreprocessOptions): BlockUml {
  const outcome = preprocessLinesOrError(raw.lines, undefined, options);
  if (!outcome.ok)
    return { ok: false, suffix: raw.suffix, rawSource: raw.lines, failure: outcome.failure };

  return {
    ok: true,
    suffix: raw.suffix,
    rawSource: raw.lines,
    source: finalizeBlock(raw.suffix, interiorOf(outcome.result.lines)),
    preprocessed: outcome.result,
  };
}

/**
 * The interpreter runs over the WHOLE block, `@start` / `@end` lines included
 * (upstream: `timLoader.load(this.rawSource)`, and they survive into
 * `BlockUml#data` -- `PSystemBuilder` reads `data.get(0)` to type the diagram,
 * and the command iterator stops at the `@end`). This port's `UmlSource` carries
 * the interior alone, so the two directives are dropped here.
 *
 * The `@end` may legitimately be MISSING from the result: an unclosed `!ifdef`
 * inside the block swallows it (`buveco-86-tibo673`). Upstream's iterator simply
 * runs out of lines in that case; so does this slice.
 */
function interiorOf(lines: readonly string[]): readonly string[] {
  let from = 0;
  let to = lines.length;
  if (from < to && isStartDirective(lines[from]!)) from++;
  if (to > from && isEndDirective(lines[to - 1]!)) to--;
  return lines.slice(from, to);
}

/**
 * "The diagram says nothing" -- upstream's `UmlSource#isEmpty`, the test
 * `PSystemCommandFactory#createSystem` makes before it builds anything
 * (`buildEmptyError`: *Empty description*).
 *
 * Upstream tests the block's post-TIM lines for a single non-blank,
 * non-comment line. This port's preprocessor has already dropped blanks and
 * comments, and has additionally CONSUMED `skinparam` lines and `<style>`
 * blocks into `PreprocessorResult` (upstream leaves those in the line stream
 * and its command layer eats them) -- so those two are checked here as well.
 * `@startuml` + `skinparam handwritten true` + `@enduml` is NOT empty upstream,
 * and must not be empty here.
 *
 * @see ~/git/plantuml/.../core/UmlSource.java#isEmpty
 * @see ~/git/plantuml/.../command/PSystemCommandFactory.java#createSystem
 */
export function isBlockEmpty(block: BlockUmlOk): boolean {
  return (
    block.source.lines.length === 0 &&
    block.preprocessed.styles.length === 0 &&
    block.preprocessed.skinparam.size === 0
  );
}
