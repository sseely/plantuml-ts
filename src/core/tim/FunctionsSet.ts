/**
 * The TIM function registry: every builtin, every `!procedure` / `!function`
 * / legacy `!define` / `!definelong`, plus the pending-function state machine
 * the `CodeIterator*` chain drives while collecting a multi-line body.
 *
 * Batch SI5a-4 REPLACEMENT (debt payment): this file previously held a narrow
 * procedure-name registry (`declare` / `names` / arity-keyed
 * `getFunctionSmart`) written for the pre-TIM flat-line-loop `preprocessor.ts`,
 * and `iterator/FunctionsSet.ts` held an INTERFACE describing upstream's real
 * shape, because batch 2b was forbidden from touching this file. Both are now
 * reconciled onto one class -- upstream's actual model, and the only one
 * `TContext` / the iterator chain can drive. The interface file is deleted;
 * the iterator chain now depends on this concrete class, exactly as upstream's
 * `CodeIteratorProcedure(..., FunctionsSet functionsSet, ...)` does.
 *
 * Map-key note: upstream keys `functions` by `TFunctionSignature`, whose
 * `equals`/`hashCode` deliberately ignore `namedArguments` (name + arity only
 * -- see `TFunctionSignature.ts`). JS `Map` keys by identity, so the same
 * equality is expressed as a `name/nbArg` string key. Not a behavior change:
 * it reproduces upstream's `equals` exactly.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/FunctionsSet.java
 */

import { EaterDeclareProcedure } from './EaterDeclareProcedure.js';
import { EaterDeclareReturnFunction } from './EaterDeclareReturnFunction.js';
import { EaterException } from './EaterException.js';
import { EaterLegacyDefine } from './EaterLegacyDefine.js';
import { EaterLegacyDefineLong } from './EaterLegacyDefineLong.js';
import type { StringLocated } from './StringLocated.js';
import type { TContext, TFunction } from './TFunction.js';
import type { TFunctionImpl } from './TFunctionImpl.js';
import type { TFunctionSignature } from './TFunctionSignature.js';
import { TFunctionType } from './TFunctionType.js';
import type { TMemory } from './TMemory.js';
import type { Trie } from './Trie.js';
import { TrieImpl } from './TrieImpl.js';

/** `TFunctionSignature#equals`/`#hashCode` -- name + arity, named args ignored. */
function signatureKey(signature: TFunctionSignature): string {
  return `${signature.getFunctionName()}/${signature.getNbArg()}`;
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/FunctionsSet.java
 */
export class FunctionsSet {
  private readonly functions = new Map<string, TFunction>();
  private readonly functionsByName = new Map<string, Map<string, TFunction>>();
  private readonly functionsFinal = new Set<string>();
  private functions3: Trie = new TrieImpl();
  /** Java `null` (no function currently being declared) -> `undefined`. */
  private pending: TFunctionImpl | undefined;

  /** @see FunctionsSet#getFunctionSmart */
  getFunctionSmart(searched: TFunctionSignature): TFunction | undefined {
    const func = this.functions.get(signatureKey(searched));
    if (func !== undefined) return func;

    for (const candidate of this.functions.values()) {
      if (!candidate.getSignature().sameFunctionNameAs(searched)) continue;

      if (candidate.canCover(searched.getNbArg(), searched.getNamedArguments())) return candidate;
    }
    return undefined;
  }

  size(): number {
    return this.functions.size;
  }

  getLonguestMatchStartingIn(s: string, pos: number): string {
    return this.functions3.getLonguestMatchStartingIn(s, pos);
  }

  pendingFunction(): TFunctionImpl | undefined {
    return this.pending;
  }

  addFunction(func: TFunction): void {
    if (func.getFunctionType() === TFunctionType.LEGACY_DEFINELONG) (func as TFunctionImpl).finalizeEnddefinelong();

    this.functions.set(signatureKey(func.getSignature()), func);
    this.functions3.add(`${func.getSignature().getFunctionName()}(`);
    this.updateFunctionsByName(func);
  }

  private updateFunctionsByName(func: TFunction): void {
    const name = func.getSignature().getFunctionName();
    const map = this.functionsByName.get(name) ?? new Map<string, TFunction>();
    map.set(signatureKey(func.getSignature()), func);
    this.functionsByName.set(name, map);
  }

  /** True if at least one function with the given name exists. */
  doesFunctionExist(functionName: string): boolean {
    return this.functionsByName.has(functionName);
  }

  /** The functions matching the given name, or an empty collection. */
  getFunctionsByName(functionName: string): Iterable<TFunction> {
    const map = this.functionsByName.get(functionName);
    if (map === undefined) return [];

    return map.values();
  }

  /**
   * PLANTUML-TS ADDITION (no upstream counterpart): upstream's `!undef` removes
   * a VARIABLE only -- `FunctionsSet` has no removal path at all. plantuml-ts's
   * pre-TIM preprocessor kept simple and parametric `!define`s in one map, so
   * `!undefine NAME` removed a macro too, and `tests/unit/preprocessor.test.ts`
   * ("!undefine removes a parametric macro") pins that. `TContext#executeUndef`
   * calls this after `EaterUndef` has removed the variable.
   *
   * SI6 -- the removal must reach the `functions3` TRIE too. It used to leave
   * the `NAME(` entry there, on the reasoning that a later `NAME(...)` call site
   * would still match the trie, fail to resolve to any overload, and be emitted
   * as literal text. That reasoning depended on the "function not found"
   * PASSTHROUGH, which was itself a divergence and is now gone: a name the trie
   * still matches but no overload covers is an ERROR (upstream: `Function not
   * found NAME`). So an undefined macro has to actually leave the trie, or
   * calling it would raise an error for a function the document explicitly
   * removed. `Trie` has no removal path (nor does upstream's), so the trie is
   * rebuilt from the surviving functions -- correct by construction, and this
   * runs only on an `!undefine`.
   */
  removeFunctionsByName(functionName: string): void {
    const map = this.functionsByName.get(functionName);
    if (map === undefined) return;

    for (const signature of map.keys()) {
      this.functions.delete(signature);
      this.functionsFinal.delete(signature);
    }
    this.functionsByName.delete(functionName);
    this.rebuildTrie();
  }

  /** Re-derive the name trie from the functions that remain. */
  private rebuildTrie(): void {
    this.functions3 = new TrieImpl();
    for (const func of this.functions.values())
      this.functions3.add(`${func.getSignature().getFunctionName()}(`);
  }

  executeEndfunction(): void {
    this.addFunction(this.pending as TFunctionImpl);
    this.pending = undefined;
  }

  /** @throws EaterException (thrown, not returned) if a function is already pending. */
  executeLegacyDefine(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0048', s);

    const legacyDefine = new EaterLegacyDefine(s);
    legacyDefine.analyze(context, memory);
    const func = legacyDefine.getFunction();
    // Upstream deliberately inlines the three `addFunction` steps here rather
    // than calling `addFunction` -- a LEGACY_DEFINE must NOT go through
    // `finalizeEnddefinelong`. Preserved verbatim.
    this.functions.set(signatureKey(func.getSignature()), func);
    this.functions3.add(`${func.getSignature().getFunctionName()}(`);
    this.updateFunctionsByName(func);
  }

  /** @throws EaterException (thrown, not returned) if a function is already pending. */
  executeLegacyDefineLong(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0068', s);

    const legacyDefineLong = new EaterLegacyDefineLong(s);
    legacyDefineLong.analyze(context, memory);
    this.pending = legacyDefineLong.getFunction();
  }

  /** @throws EaterException (thrown, not returned) if a function is already pending, or redeclaring a `final` function. */
  executeDeclareReturnFunction(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0068', s);

    const declareFunction = new EaterDeclareReturnFunction(s);
    declareFunction.analyze(context, memory);
    this.declare(declareFunction.getFunction(), declareFunction.getFinalFlag(), s);
  }

  /** @throws EaterException (thrown, not returned) if a function is already pending, or redeclaring a `final` procedure. */
  executeDeclareProcedure(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0068', s);

    const declareFunction = new EaterDeclareProcedure(s);
    declareFunction.analyze(context, memory);
    this.declare(declareFunction.getFunction(), declareFunction.getFinalFlag(), s);
  }

  /** The shared tail of `executeDeclareReturnFunction` / `executeDeclareProcedure`
   * -- upstream duplicates it verbatim in both methods. */
  private declare(func: TFunctionImpl, finalFlag: boolean, s: StringLocated): void {
    const declaredSignature = signatureKey(func.getSignature());
    const previous = this.functions.get(declaredSignature);
    if (previous !== undefined && (finalFlag || this.functionsFinal.has(declaredSignature)))
      throw new EaterException('This function is already defined', s);

    if (finalFlag) this.functionsFinal.add(declaredSignature);

    if (func.hasBody()) this.addFunction(func);
    else this.pending = func;
  }
}
