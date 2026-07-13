/**
 * Preprocessor -- a thin wrapper over the TIM interpreter (`src/core/tim/`).
 *
 * Batch SI5a-4 CUTOVER (locked decision #1 of `plans/si5a-tim/README.md`): the
 * flat line-loop that used to live here is replaced by `TContext` + the
 * `CodeIterator` decorator chain, which is how upstream expresses nested
 * `!if` / `!foreach` / `!while` / `!procedure`. The old loop structurally could
 * not: it tracked a single conditional stack and had no execution-context
 * stack at all. The public surface is unchanged -- same `preprocess(source,
 * defines?)` signature, same `PreprocessorResult` shape -- so no caller moves.
 *
 * What stays here (and NOT in `TContext`, because none of it is a TIM concept
 * upstream): the `<style>` block collector, the `skinparam` line/block
 * collector, and the `%n()` / BLOCK_E1 newline line-splitting. Upstream leaves
 * all three to layers this port does not have (the command layer and the
 * Jaws/Creole display layer). See `TContextOptions.ts#PlainLineFilter`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java
 */

import { StringLocated } from './tim/StringLocated.js';
import { TContext } from './tim/TContext.js';
import { TMemoryGlobal } from './tim/TMemoryGlobal.js';
import { TValue } from './tim/expression/TValue.js';
import { TVariableScope } from './tim/TVariableScope.js';

export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
  readonly styles: readonly string[];
  readonly skinparam: ReadonlyMap<string, string>;
}

const RE_STYLE_OPEN = /^<style>$/i;
const RE_STYLE_CLOSE = /^<\/style>$/i;
const RE_SKINPARAM_LINE = /^skinparam\s+(\w+)\s+(.+)$/;
const RE_SKINPARAM_BLOCK_OPEN = /^skinparam\s*\{$/;
/** Selector-scoped block, e.g. `skinparam component {` -- inner entries are
 *  keyed `<selector><name>` (upstream sugar: `component { Style X }` is
 *  `skinparam componentStyle X`). */
const RE_SKINPARAM_SELECTOR_BLOCK_OPEN = /^skinparam\s+(\w+)\s*\{$/;
const RE_SKINPARAM_BLOCK_ENTRY = /^\s*(\w+)\s+(.+)$/;
const RE_SKINPARAM_BLOCK_CLOSE = /^\s*\}\s*$/;

/**
 * `%n()` / `%newline()` written in any case OTHER than all-lowercase. The
 * lowercase spellings are real TIM builtins (`NewlineShort` / `Newline`) and
 * are already expanded to {@link BLOCK_E1_NEWLINE} by the interpreter; the trie
 * that finds call sites is case-sensitive, exactly as upstream's is (the jar
 * renders `%N()` literally -- live-oracle-verified). plantuml-ts's pre-TIM
 * preprocessor matched them case-INSENSITIVELY, and
 * `tests/unit/preprocessor.test.ts` ("`%n()` is case-insensitive") pins that,
 * so the case-folded alias is preserved here as a deliberate divergence rather
 * than silently dropped in the cutover.
 */
const RE_NEWLINE_CALL_ANY_CASE = /%n\(\)|%newline\(\)/gi;

/**
 * The `<style>` / `skinparam` collector: a {@link PlainLineFilter} that sees
 * every surviving content line RAW -- after comments and conditionals, before
 * macro/variable substitution -- and consumes the ones that are not diagram
 * content. Faithful to the pre-TIM loop's own ordering and regexes (including
 * "style block content is collected verbatim, no define substitution").
 */
class StyleAndSkinparamCollector {
  readonly styles: string[] = [];
  readonly skinparam = new Map<string, string>();

  private inStyleBlock = false;
  private readonly styleBuffer: string[] = [];
  private inSkinparamBlock = false;
  private skinparamBlockSelector = '';

  /** True when the line was consumed (nothing is emitted for it). */
  accept(line: StringLocated): boolean {
    const raw = line.getString();
    const trimmed = raw.trim();

    if (this.inStyleBlock) return this.collectStyleLine(raw, trimmed);

    if (this.inSkinparamBlock) return this.collectSkinparamBlockEntry(trimmed);

    if (RE_STYLE_OPEN.test(trimmed)) {
      this.inStyleBlock = true;
      return true;
    }
    return this.openSkinparam(trimmed);
  }

  private collectStyleLine(raw: string, trimmed: string): boolean {
    if (RE_STYLE_CLOSE.test(trimmed)) {
      this.styles.push(this.styleBuffer.join('\n'));
      this.styleBuffer.length = 0;
      this.inStyleBlock = false;
    } else {
      this.styleBuffer.push(raw);
    }
    return true;
  }

  private collectSkinparamBlockEntry(trimmed: string): boolean {
    if (RE_SKINPARAM_BLOCK_CLOSE.test(trimmed)) {
      this.inSkinparamBlock = false;
      this.skinparamBlockSelector = '';
      return true;
    }
    const entry = RE_SKINPARAM_BLOCK_ENTRY.exec(trimmed);
    if (entry !== null)
      this.skinparam.set((this.skinparamBlockSelector + entry[1]!.trim()).toLowerCase(), entry[2]!.trim());

    return true;
  }

  /** Block-open forms are tested before the single-line form, which would
   *  otherwise capture `{` as the parameter name. */
  private openSkinparam(trimmed: string): boolean {
    if (RE_SKINPARAM_BLOCK_OPEN.test(trimmed)) {
      this.inSkinparamBlock = true;
      this.skinparamBlockSelector = '';
      return true;
    }
    const selectorBlock = RE_SKINPARAM_SELECTOR_BLOCK_OPEN.exec(trimmed);
    if (selectorBlock !== null) {
      this.inSkinparamBlock = true;
      this.skinparamBlockSelector = selectorBlock[1]!.trim().toLowerCase();
      return true;
    }
    const single = RE_SKINPARAM_LINE.exec(trimmed);
    if (single !== null) {
      this.skinparam.set(single[1]!.trim().toLowerCase(), single[2]!.trim());
      return true;
    }
    return false;
  }
}

/**
 * `ReadLineReader.java:99-102`: strip a leading BOM and normalize the en-dash
 * (U+2013) to a hyphen on every line, before any parsing.
 */
function readLines(source: string): StringLocated[] {
  return source
    .replace(/\u2013/gu, '-')
    .replace(/^\uFEFF/u, '')
    .split('\n')
    .map((text, i) => new StringLocated(text, i));
}

/**
 * Interpreter result lines -> `PreprocessorResult.lines`.
 *
 * Two decodings, and the difference between them is load-bearing:
 *
 *  - `Jaws.BLOCK_E1_NEWLINE` survives here only from
 *    `TContext#extractFromResultList` (`%retrieve_procedure`'s multi-line
 *    capture), where upstream uses it as an IN-LINE separator, NOT a line
 *    break. It is left in place: splitting on it would turn a captured class
 *    body inside a `note` into loose top-level source lines, and the jar does
 *    not (roputo-88-fuxo199 -- the jar emits one note node; splitting invents
 *    junk nodes, and even an embedded real newline breaks the block/line
 *    parsers downstream). FOLLOW-UP: decoding the sentinel into a label line
 *    break is the Jaws/Creole display layer's job, which this port does not
 *    have yet -- until then such a label renders on one line.
 *  - `%n()` / `%newline()` DO split the line into separate source lines. The
 *    lowercase spellings already produced a real newline in the interpreter
 *    (see `jaws-constants.ts#USE_BLOCK_E1_IN_NEWLINE_FUNCTION`) and were split
 *    by `TContext#applyFunctionsAndVariablesInternal`; only the case-folded
 *    alias (pinned by `tests/unit/preprocessor.test.ts`) reaches this far, and
 *    it is split here.
 *
 * Then: right-trim each line, drop blanks. That tail is unchanged from the
 * pre-TIM loop.
 */
function flatten(resultList: readonly StringLocated[]): string[] {
  const lines: string[] = [];
  for (const located of resultList) {
    for (const segment of located.getString().split(RE_NEWLINE_CALL_ANY_CASE)) {
      const finalLine = segment.trimEnd();
      if (finalLine.length > 0) lines.push(finalLine);
    }
  }
  return lines;
}

/**
 * Process raw PlantUML source.
 *
 * @param source  - Raw multi-line string (the full document, not pre-split).
 * @param defines - Optional pre-seeded defines (for testing and include chaining).
 *                  Seeded as global TIM variables, which is what a `!define
 *                  NAME value` line produces (`EaterAffectationDefine`).
 * @throws EaterException on a malformed TIM directive.
 */
export function preprocess(source: string, defines?: ReadonlyMap<string, string>): PreprocessorResult {
  if (source === '') return { lines: [], theme: null, styles: [], skinparam: new Map() };

  const collector = new StyleAndSkinparamCollector();
  const context = new TContext({ plainLineFilter: (line) => collector.accept(line) });
  const memory = new TMemoryGlobal();

  if (defines !== undefined)
    for (const [name, value] of defines)
      memory.putVariable(name, TValue.fromString(value), TVariableScope.GLOBAL, new StringLocated(name, undefined));

  context.executeLines(memory, readLines(source), undefined, false);

  return {
    lines: flatten(context.getResultList()),
    theme: context.getThemeName() ?? null,
    styles: collector.styles,
    skinparam: collector.skinparam,
  };
}
