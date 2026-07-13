/**
 * The TIM interpreter: owns the function registry (`FunctionsSet`), builds the
 * `CodeIterator` decorator chain, executes one line at a time, and performs
 * inline `$variable` / `%function()` substitution.
 *
 * Batch SI5a-4 REPLACEMENT: this file previously held `expandProcedureCalls`,
 * a recursive text expander written for the pre-TIM flat-line-loop
 * `preprocessor.ts`. It is replaced by the real upstream class; the old
 * expander is deleted, not kept alongside (its only caller was that loop,
 * which this batch also replaces).
 *
 * Divergences from `TContext.java` -- all deliberate, all pinned by an existing
 * test, each marked `PLANTUML-TS DIVERGENCE <n>` at its site:
 *   1. `!include` / `!includesub` / `!includedef` / `!import` pass through
 *      untouched (the sync include seam is batch 5; passing through is what the
 *      pre-TIM preprocessor did).
 *   2. `!theme` records the theme NAME (this port resolves themes by name in
 *      `src/core/theme.ts`) instead of executing the theme's own source.
 *   3. A call to a KNOWN function name that no overload's arity can cover
 *      passes through as literal text instead of throwing "Function not found".
 *   4. Ambient I/O and non-determinism reach the builtins only through the
 *      injected `TimEnvironment` seam.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java
 */

import { EaterAffectationDefine } from './EaterAffectationDefine.js';
import { EaterAssert } from './EaterAssert.js';
import { EaterDumpMemory } from './EaterDumpMemory.js';
import { EaterException } from './EaterException.js';
import { EaterFunctionCall } from './EaterFunctionCall.js';
import { EaterLog } from './EaterLog.js';
import { EaterOption } from './EaterOption.js';
import { EaterReturn } from './EaterReturn.js';
import { EaterTheme } from './EaterTheme.js';
import { EaterUndef } from './EaterUndef.js';
import { FunctionsSet } from './FunctionsSet.js';
import { PreprocessingArtifact } from './PreprocessingArtifact.js';
import { StringLocated, type LineLocation, type TLineType } from './StringLocated.js';
import type { TContext as TContextInterface, TFunction, TPreprocessingArtifact } from './TFunction.js';
import { TFunctionSignature } from './TFunctionSignature.js';
import { TFunctionType } from './TFunctionType.js';
import { isLetterOrEmojiOrUnderscoreOrDigit } from './TLineType.js';
import type { PlainLineFilter, TContextOptions } from './TContextOptions.js';
import type { TMemory } from './TMemory.js';
import { VariableManager } from './VariableManager.js';
import { createStandardFunctions } from './builtin/index.js';
import { BLOCK_E1_NEWLINE } from './builtin/jaws-constants.js';
import { createDefaultTimEnvironment, type TimEnvironment } from './builtin/TimEnvironment.js';
import type { Knowledge } from './expression/Knowledge.js';
import type { JsonValue } from './expression/Token.js';
import { TValue } from './expression/TValue.js';
import { buildCodeIterator } from './iterator/buildCodeIterator.js';
import type { CodeIterator } from './iterator/CodeIterator.js';
import type { Sub } from './iterator/Sub.js';

export type { PlainLineFilter, TContextOptions } from './TContextOptions.js';

/** @see ~/git/plantuml/.../tim/TContext.java#ONLY_WHITESPACE_NON_EMPTY */
const ONLY_WHITESPACE_NON_EMPTY = /^\s+$/u;

/** `!undef` or its plantuml-ts alias `!undefine` -- see `TLineType.ts#PATTERN_UNDEF`. */
const RE_UNDEF_KEYWORD = /^!undef(ine)?/u;

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java */
export class TContext implements TContextInterface {
  private readonly resultList: StringLocated[] = [];
  private readonly debug: StringLocated[] = [];

  readonly functionsSet = new FunctionsSet();

  private readonly subs = new Map<string, Sub>();
  private readonly preprocessingArtifact = new PreprocessingArtifact();
  private readonly plainLineFilter: PlainLineFilter | undefined;

  private pendingAdd: string | undefined;
  private themeName: string | undefined;

  constructor(options: TContextOptions = {}) {
    this.plainLineFilter = options.plainLineFilter;
    this.addStandardFunctions(options.env ?? createDefaultTimEnvironment());
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#addStandardFunctions */
  private addStandardFunctions(env: TimEnvironment): void {
    for (const func of createStandardFunctions(env)) this.functionsSet.addFunction(func);
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#asKnowledge */
  asKnowledge(memory: TMemory, location: LineLocation): Knowledge {
    return {
      getVariable: (name: string): TValue => {
        if (name.includes('.') || name.includes('[')) return this.fromJson(memory, name, location);

        // Upstream returns `memory.getVariable(name)` directly -- null for an
        // unknown name, which `ReversePolishInterpretor` relies on to decide
        // the identifier is not a variable.
        return memory.getVariable(name) as TValue;
      },
      getFunction: (name: TFunctionSignature): TFunction | undefined => this.functionsSet.getFunctionSmart(name),
    };
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#fromJson */
  private fromJson(memory: TMemory, name: string, location: LineLocation): TValue {
    const result = this.applyFunctionsAndVariables(memory, new StringLocated(name, location)) ?? '';
    try {
      return TValue.fromJson(JSON.parse(result) as JsonValue);
    } catch {
      return TValue.fromString(result);
    }
  }

  /** @throws EaterException (thrown, not returned) on evaluation failure.
   * @see ~/git/plantuml/.../tim/TContext.java#executeLines */
  executeLines(
    memory: TMemory,
    body: readonly StringLocated[],
    ftype: TFunctionType | undefined,
    modeSpecial: boolean,
  ): TValue | undefined {
    // @see `iterator/buildCodeIterator.ts` -- the chain, and why its order matters.
    const it: CodeIterator = buildCodeIterator(body, {
      context: this,
      memory,
      functionsSet: this.functionsSet,
      subs: this.subs,
      debug: this.debug,
    });

    let s: StringLocated | null;
    while ((s = it.peek()) !== null) {
      const result = this.executeOneLineSafe(memory, s, ftype, modeSpecial);
      if (result !== undefined) return result;

      it.next();
    }
    return undefined;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#executeOneLineSafe */
  private executeOneLineSafe(
    memory: TMemory,
    s: StringLocated,
    ftype: TFunctionType | undefined,
    modeSpecial: boolean,
  ): TValue | undefined {
    try {
      this.debug.push(s);
      return this.executeOneLineNotSafe(memory, s, ftype, modeSpecial);
    } catch (e) {
      if (e instanceof EaterException) throw e;

      throw new EaterException('Fatal parsing error', s);
    }
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#executeOneLineNotSafe */
  private executeOneLineNotSafe(
    memory: TMemory,
    s: StringLocated,
    ftype: TFunctionType | undefined,
    modeSpecial: boolean,
  ): TValue | undefined {
    const type = s.getType();

    if (this.executeSideEffectDirective(memory, s, type)) return undefined;

    if (ftype !== TFunctionType.RETURN_FUNCTION && type === 'PLAIN') {
      this.addPlain(memory, s);
      return undefined;
    }
    if (ftype === TFunctionType.RETURN_FUNCTION && type === 'RETURN') {
      if (!modeSpecial) return undefined; // Actually, ignore because we are in a if.

      const eaterReturn = new EaterReturn(s);
      eaterReturn.analyze(this, memory);
      return eaterReturn.getValue2();
    }
    if (ftype === TFunctionType.RETURN_FUNCTION && type === 'PLAIN') {
      this.simulatePlain(memory, s);
      return undefined;
    }
    if (type === 'AFFECTATION_DEFINE') {
      new EaterAffectationDefine(s).analyze(this, memory);
      return undefined;
    }
    // Upstream builds a `CommandExecutionResult.error("error endfunc")` here
    // and drops it on the floor: a stray `!endfunction` is silently ignored.
    if (ftype === undefined && type === 'END_FUNCTION') return undefined;

    if (ONLY_WHITESPACE_NON_EMPTY.test(s.getString())) return undefined;

    throw new EaterException(`Compile Error ${String(ftype)} ${type}`, s);
  }

  /**
   * The leading half of `executeOneLineNotSafe`'s dispatch: the directives that
   * are pure side effects and always yield `null` upstream. Split out (same
   * branches, same order) only to satisfy this repo's complexity gate.
   */
  private executeSideEffectDirective(memory: TMemory, s: StringLocated, type: TLineType): boolean {
    // PLANTUML-TS DIVERGENCE 1 (see file header): includes/imports are not
    // resolved here; `addPlain` re-emits the directive line untouched, exactly
    // as the pre-TIM preprocessor did. `include-resolver.ts` (batch 5) owns the
    // real seam.
    if (type === 'INCLUDESUB' || type === 'INCLUDE' || type === 'INCLUDE_DEF' || type === 'IMPORT') {
      this.addPlain(memory, s);
      return true;
    }
    if (type === 'THEME') {
      this.executeTheme(memory, s);
      return true;
    }
    if (type === 'DUMP_MEMORY') {
      new EaterDumpMemory(s.getTrimmed()).analyze(this, memory);
      return true;
    }
    if (type === 'ASSERT') {
      new EaterAssert(s.getTrimmed()).analyze(this, memory);
      return true;
    }
    if (type === 'OPTION') {
      new EaterOption(s.getTrimmed()).analyze(this, memory);
      return true;
    }
    if (type === 'UNDEF') {
      this.executeUndef(memory, s);
      return true;
    }
    if (type === 'LOG') {
      new EaterLog(s.getTrimmed()).analyze(this, memory);
      return true;
    }
    return false;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#addPlain */
  private addPlain(memory: TMemory, s: StringLocated): void {
    if (this.plainLineFilter?.(s) === true) return;

    const tmp = this.applyFunctionsAndVariablesInternal(memory, s);
    if (tmp === undefined) return;

    if (this.pendingAdd !== undefined) {
      tmp[0] = new StringLocated(this.pendingAdd + tmp[0]!.getString(), tmp[0]!.getLocation());
      this.pendingAdd = undefined;
    }
    for (const line of tmp) this.resultList.push(line);
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#simulatePlain */
  private simulatePlain(memory: TMemory, s: StringLocated): void {
    this.applyFunctionsAndVariablesInternal(memory, s);
  }

  /**
   * PLANTUML-TS DIVERGENCE 4: `EaterUndef` (a faithful port) eats the literal
   * token `!undef`; plantuml-ts also accepts `!undefine`, which its pre-TIM
   * preprocessor recognized and `tests/unit/preprocessor.test.ts` pins (see
   * `TLineType.ts#PATTERN_UNDEF`). Normalizing the alias here leaves the ported
   * `EaterUndef` untouched.
   */
  private executeUndef(memory: TMemory, s: StringLocated): void {
    const trimmed = s.getTrimmed().getString();
    const name = trimmed.replace(RE_UNDEF_KEYWORD, '').trim();
    const normalized = new StringLocated(`!undef ${name}`, s.getLocation(), 'UNDEF');
    new EaterUndef(normalized).analyze(this, memory);
    // PLANTUML-TS DIVERGENCE 5: also drop a like-named macro -- see
    // `FunctionsSet#removeFunctionsByName` for why.
    this.functionsSet.removeFunctionsByName(name);
  }

  /**
   * PLANTUML-TS DIVERGENCE 2 (see file header): upstream loads the theme file
   * and executes its lines. This port resolves themes by name in
   * `src/core/theme.ts`, so the interpreter only records the name;
   * `preprocess()` surfaces it as `PreprocessorResult.theme`.
   */
  private executeTheme(memory: TMemory, s: StringLocated): void {
    const eater = new EaterTheme(s.getTrimmed());
    eater.analyze(this, memory);
    this.themeName = eater.getRealName();
  }

  /** The `!theme` name seen, if any. @see #executeTheme */
  getThemeName(): string | undefined {
    return this.themeName;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#applyFunctionsAndVariablesInternal */
  private applyFunctionsAndVariablesInternal(memory: TMemory, located: StringLocated): StringLocated[] | undefined {
    if (memory.isEmpty() && this.functionsSet.size() === 0) return [located];

    const result = this.applyFunctionsAndVariables(memory, located);
    if (result === undefined) return undefined;

    // Upstream gates this split on `Pragma.legacyReplaceBackslashNByNewline()`.
    // plantuml-ts always splits: `PreprocessorResult.lines` is a flat list of
    // single lines with no Jaws/Creole layer downstream, and the pre-TIM
    // preprocessor split substituted newlines the same way.
    if (!result.includes('\n')) return [new StringLocated(result, located.getLocation())];

    return result.split('\n').map((part) => new StringLocated(part, located.getLocation()));
  }

  /**
   * Inline substitution of every `%function(...)` call and `$variable` in one
   * line. Returns `undefined` when the line contained a PROCEDURE (or
   * LEGACY_DEFINELONG) call: that call already appended its own output lines to
   * `resultList`, so nothing is left to emit for this line. Text BEFORE the
   * call is stashed in `pendingAdd` (the next `addPlain` prepends it); text
   * AFTER it is appended to the last produced line.
   * @throws EaterException (thrown, not returned) on evaluation failure.
   * @see ~/git/plantuml/.../tim/TContext.java#applyFunctionsAndVariables
   */
  applyFunctionsAndVariables(memory: TMemory, str: StringLocated): string | undefined {
    if (memory.isEmpty() && this.functionsSet.size() === 0) return str.getString();

    const result = { value: '' };
    for (let i = 0; i < str.length(); i++) {
      const presentFunction = this.getFunctionNameAt(str.getString(), i);
      if (presentFunction !== undefined) {
        const consumed = this.applyOneFunction(memory, str, i, presentFunction, result);
        if (consumed === undefined) return undefined;

        i = consumed;
      } else if (new VariableManager(this, memory, str).getVarnameAt(str.getString(), i) !== undefined) {
        i = new VariableManager(this, memory, str).replaceVariables(str.getString(), i, result);
      } else {
        result.value += str.charAt(i);
      }
    }
    return result.value;
  }

  /**
   * One call site inside `applyFunctionsAndVariables`. Returns the new cursor
   * position, or `undefined` when the call consumed the rest of the line (a
   * PROCEDURE / LEGACY_DEFINELONG call -- see that method's contract).
   */
  private applyOneFunction(
    memory: TMemory,
    str: StringLocated,
    i: number,
    presentFunction: string,
    result: { value: string },
  ): number | undefined {
    const sub = str.getString().substring(i);
    const call = new EaterFunctionCall(
      new StringLocated(sub, str.getLocation()),
      this.isLegacyDefine(presentFunction),
      this.isUnquoted(presentFunction),
    );
    call.analyze(this, memory);
    const signature = new TFunctionSignature(
      presentFunction,
      call.getValues().length,
      new Set(call.getNamedArguments().keys()),
    );
    const func = this.functionsSet.getFunctionSmart(signature);
    if (func === undefined) {
      // PLANTUML-TS DIVERGENCE 3 (see file header): upstream throws
      // EaterException("Function not found " + name), which the jar renders as
      // an error diagram (live-oracle-verified). This port has no error-diagram
      // path -- the exception would escape `renderSync` -- and its pre-TIM
      // preprocessor left an uncoverable call site as literal text
      // (`tests/unit/preprocessor.test.ts`: "wrong arg count leaves call-site
      // unchanged"). Emitting this one char and rescanning reproduces that: the
      // name only re-matches where it really starts, so the call text survives
      // verbatim.
      result.value += str.charAt(i);
      return i;
    }

    if (func.getFunctionType() === TFunctionType.PROCEDURE) {
      this.pendingAdd = result.value;
      this.executeVoid3(str, memory, func, call);
      const remaining = str.getString().substring(i + call.getCurrentPosition());
      if (remaining.length > 0) this.appendToLastResult(remaining);

      return undefined;
    }
    if (func.getFunctionType() === TFunctionType.LEGACY_DEFINELONG) {
      this.pendingAdd = str.getString().substring(0, i);
      this.executeVoid3(str, memory, func, call);
      return undefined;
    }

    const functionReturn = func.executeReturnFunction(this, memory, str, call.getValues(), call.getNamedArguments());
    result.value += functionReturn.toString();
    return i + call.getCurrentPosition() - 1;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#appendToLastResult */
  private appendToLastResult(remaining: string): void {
    const idx = this.resultList.length - 1;
    if (idx < 0) {
      // Upstream would throw IndexOutOfBounds: a procedure whose body emitted
      // nothing has no last line to append to. Stash it for the next addPlain
      // instead of crashing -- the text is still emitted, in order.
      this.pendingAdd = (this.pendingAdd ?? '') + remaining;
      return;
    }
    this.resultList[idx] = this.resultList[idx]!.append(remaining);
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#executeVoid3 */
  private executeVoid3(location: StringLocated, memory: TMemory, func: TFunction, call: EaterFunctionCall): void {
    func.executeProcedureInternal(this, memory, location, call.getValues(), call.getNamedArguments());
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#isLegacyDefine */
  isLegacyDefine(functionName: string): boolean {
    for (const func of this.functionsSet.getFunctionsByName(functionName))
      if (
        func.getFunctionType() === TFunctionType.LEGACY_DEFINE ||
        func.getFunctionType() === TFunctionType.LEGACY_DEFINELONG
      )
        return true;

    return false;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#isUnquoted */
  isUnquoted(functionName: string): boolean {
    for (const func of this.functionsSet.getFunctionsByName(functionName)) if (func.isUnquoted()) return true;

    return false;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#doesFunctionExist */
  doesFunctionExist(functionName: string): boolean {
    return this.functionsSet.doesFunctionExist(functionName);
  }

  /** Java `null` -> `undefined`. @see ~/git/plantuml/.../tim/TContext.java#getFunctionNameAt */
  private getFunctionNameAt(s: string, pos: number): string | undefined {
    const justAfterALetter =
      pos > 0 && isLetterOrEmojiOrUnderscoreOrDigit(s.charAt(pos - 1)) && !VariableManager.justAfterBackslashN(s, pos);
    if (justAfterALetter && s.charAt(pos) !== '%' && s.charAt(pos) !== '$') return undefined;

    const fname = this.functionsSet.getLonguestMatchStartingIn(s, pos);
    if (fname.length === 0) return undefined;

    return fname.substring(0, fname.length - 1);
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#getResultList */
  getResultList(): readonly StringLocated[] {
    return this.resultList;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#getDebug */
  getDebug(): readonly StringLocated[] {
    return this.debug;
  }

  /**
   * Removes every result line from index `n1` on and returns them joined --
   * `%retrieve_procedure`'s capture. Upstream joins with `Jaws.BLOCK_E1_NEWLINE`
   * (a private-use sentinel its Display/Creole layer decodes later); this port
   * has no such layer, so `preprocess()` decodes the sentinel into a line split
   * at the end of the pipeline, where the pre-TIM preprocessor did it too.
   * @see ~/git/plantuml/.../tim/TContext.java#extractFromResultList
   */
  extractFromResultList(n1: number): string {
    let sb = '';
    while (this.resultList.length > n1) {
      sb += this.resultList[n1]!.getString();
      this.resultList.splice(n1, 1);
      if (this.resultList.length > n1) sb += BLOCK_E1_NEWLINE;
    }
    return sb;
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#appendEndOfLine */
  appendEndOfLine(endOfLine: string): void {
    if (endOfLine.length > 0) this.appendToLastResult(endOfLine);
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#getFunctionSmart */
  getFunctionSmart(signature: TFunctionSignature): TFunction | undefined {
    return this.functionsSet.getFunctionSmart(signature);
  }

  /** Data given after `@startuml`. Java `Optional<String>` -> `string | undefined`.
   * @see ~/git/plantuml/.../tim/TContext.java#getXargs */
  getXargs(): string | undefined {
    const first = this.resultList[0];
    if (first === undefined) return undefined;

    const idx = first.getString().indexOf(' ');
    if (idx === -1) return undefined;

    return first.getString().substring(idx + 1).trim();
  }

  /** @see ~/git/plantuml/.../tim/TContext.java#getPreprocessingArtifact */
  getPreprocessingArtifact(): TPreprocessingArtifact {
    return this.preprocessingArtifact;
  }
}
