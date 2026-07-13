/**
 * A minimal but REAL `TContext` + `FunctionsSet` implementation for
 * `tim/iterator/` integration tests -- proves the `CodeIterator` decorator
 * chain actually composes (nested `!if` / `!foreach` / `!while` /
 * `!procedure` / `!function`), not just that each piece works in isolation
 * against a mock.
 *
 * This mirrors `TContext.java#buildCodeIterator` / `#executeLines` /
 * `#executeOneLineNotSafe`'s dispatch order faithfully, but is
 * deliberately narrower than the real (Batch 4) `TContext`: it only
 * handles the `TLineType`s these tests exercise (PLAIN, RETURN,
 * AFFECTATION_DEFINE, ASSERT, DUMP_MEMORY, UNDEF, LOG) -- includes,
 * imports, themes, and options are out of scope for a control-flow-nesting
 * test harness. It is NOT a preview of the real `TContext` (Batch 4 owns
 * that); it exists solely to give this batch's tests a working `TContext`
 * to drive the iterator chain with.
 *
 * Split out from `tim-context.ts` (which stays iterator-free) because this
 * file needs the `iterator/` chain -- see that file's header.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java
 */
import {
  Eater,
  EaterAffectationDefine,
  EaterAssert,
  EaterDeclareReturnFunction,
  EaterDumpMemory,
  EaterException,
  EaterLegacyDefine,
  EaterLegacyDefineLong,
  EaterLog,
  EaterReturn,
  EaterUndef,
  StringLocated,
  TFunctionType,
  TMemoryGlobal,
  TrieImpl,
  VariableManager,
  type LineLocation,
  type TContext,
  type TFunction,
  type TFunctionImpl,
  type TFunctionSignature,
  type TMemory,
  type TPreprocessingArtifact,
  type Trie,
} from '../../src/core/tim/index.js';
import { TValue, type JsonValue, type Knowledge } from '../../src/core/tim/expression/index.js';
import {
  CodeIteratorAffectation,
  CodeIteratorForeach,
  CodeIteratorIf,
  CodeIteratorImpl,
  CodeIteratorInnerComment,
  CodeIteratorLegacyDefine,
  CodeIteratorLongComment,
  CodeIteratorProcedure,
  CodeIteratorReturnFunction,
  CodeIteratorShortComment,
  CodeIteratorSub,
  CodeIteratorWhile,
  type CodeIterator,
  type FunctionsSet,
  type Sub,
} from '../../src/core/tim/iterator/index.js';
export { line, type FixtureLineType, fakeContext } from './tim-context.js';

/**
 * Test-only local port of `net.sourceforge.plantuml.tim.EaterDeclareProcedure`
 * -- the REAL upstream `!procedure` header parser (constructs a
 * `TFunctionImpl` via `Eater#eatDeclareProcedure`), distinct from and NOT a
 * modification of the existing (pre-mission-SI5a, do-not-touch)
 * `src/core/tim/EaterDeclareProcedure.ts` header-regex parser. Needed here
 * because `TestFunctionsSet#executeDeclareProcedure` below (mirroring
 * upstream `FunctionsSet#executeDeclareProcedure`) must call it; it is not
 * part of `src/` and carries no production weight.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterDeclareProcedure.java
 */
class TestEaterDeclareProcedure extends Eater {
  private function: TFunctionImpl | undefined;
  private readonly location: StringLocated;
  private finalFlag = false;

  constructor(s: StringLocated) {
    super(s.getTrimmed());
    this.location = s;
  }

  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!');
    let unquoted = false;
    while (this.peekUnquoted() || this.peekFinal()) {
      if (this.peekUnquoted()) {
        this.checkAndEatChar('unquoted');
        this.skipSpaces();
        unquoted = true;
      } else if (this.peekFinal()) {
        this.checkAndEatChar('final');
        this.skipSpaces();
        this.finalFlag = true;
      }
    }
    this.checkAndEatChar('procedure');
    this.skipSpaces();
    this.function = this.eatDeclareProcedure(context, memory, unquoted, this.location);
  }

  private peekUnquoted(): boolean {
    return this.peekChar() === 'u';
  }

  private peekFinal(): boolean {
    return this.peekChar() === 'f' && this.peekCharN2() === 'i';
  }

  getFunction(): TFunctionImpl {
    return this.function as TFunctionImpl;
  }

  getFinalFlag(): boolean {
    return this.finalFlag;
  }
}

/**
 * Test-only, faithful-shape port of `net.sourceforge.plantuml.tim.FunctionsSet`.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/FunctionsSet.java
 */
export class TestFunctionsSet implements FunctionsSet {
  private readonly functions = new Map<string, TFunction>();
  private readonly functionsByName = new Map<string, Map<string, TFunction>>();
  private readonly functionsFinal = new Set<string>();
  private readonly functions3: Trie = new TrieImpl();
  private pending: TFunctionImpl | undefined;

  private key(sig: TFunctionSignature): string {
    return `${sig.getFunctionName()}/${sig.getNbArg()}`;
  }

  getFunctionSmart(searched: TFunctionSignature): TFunction | undefined {
    const direct = this.functions.get(this.key(searched));
    if (direct !== undefined) return direct;

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

    this.functions.set(this.key(func.getSignature()), func);
    this.functions3.add(`${func.getSignature().getFunctionName()}(`);
    this.updateFunctionsByName(func);
  }

  private updateFunctionsByName(func: TFunction): void {
    const name = func.getSignature().getFunctionName();
    const map = this.functionsByName.get(name) ?? new Map<string, TFunction>();
    map.set(this.key(func.getSignature()), func);
    this.functionsByName.set(name, map);
  }

  doesFunctionExist(functionName: string): boolean {
    return this.functionsByName.has(functionName);
  }

  getFunctionsByName(functionName: string): Iterable<TFunction> {
    return this.functionsByName.get(functionName)?.values() ?? [];
  }

  executeEndfunction(): void {
    this.addFunction(this.pending as TFunctionImpl);
    this.pending = undefined;
  }

  executeLegacyDefine(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0048', s);

    const eater = new EaterLegacyDefine(s);
    eater.analyze(context, memory);
    const func = eater.getFunction();
    this.functions.set(this.key(func.getSignature()), func);
    this.functions3.add(`${func.getSignature().getFunctionName()}(`);
    this.updateFunctionsByName(func);
  }

  executeLegacyDefineLong(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0068', s);

    const eater = new EaterLegacyDefineLong(s);
    eater.analyze(context, memory);
    this.pending = eater.getFunction();
  }

  executeDeclareReturnFunction(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0068', s);

    const declare = new EaterDeclareReturnFunction(s);
    declare.analyze(context, memory);
    const finalFlag = declare.getFinalFlag();
    const declaredSignature = declare.getFunction().getSignature();
    const previous = this.functions.get(this.key(declaredSignature));
    if (previous !== undefined && (finalFlag || this.functionsFinal.has(this.key(declaredSignature))))
      throw new EaterException('This function is already defined', s);

    if (finalFlag) this.functionsFinal.add(this.key(declaredSignature));

    if (declare.getFunction().hasBody()) this.addFunction(declare.getFunction());
    else this.pending = declare.getFunction();
  }

  executeDeclareProcedure(context: TContext, memory: TMemory, s: StringLocated): void {
    if (this.pending !== undefined) throw new EaterException('already0068', s);

    const declare = new TestEaterDeclareProcedure(s);
    declare.analyze(context, memory);
    const finalFlag = declare.getFinalFlag();
    const declaredSignature = declare.getFunction().getSignature();
    const previous = this.functions.get(this.key(declaredSignature));
    if (previous !== undefined && (finalFlag || this.functionsFinal.has(this.key(declaredSignature))))
      throw new EaterException('This function is already defined', s);

    if (finalFlag) this.functionsFinal.add(this.key(declaredSignature));

    if (declare.getFunction().hasBody()) this.addFunction(declare.getFunction());
    else this.pending = declare.getFunction();
  }
}

/**
 * A working `TContext` for iterator-chain integration tests: real variable
 * substitution (via `VariableManager`), real `Knowledge` (backed by
 * `memory` + `functionsSet`), and a real `executeLines` that builds and
 * drives the FULL decorator chain in upstream's exact order.
 */
export class TestTContext implements TContext {
  readonly functionsSet = new TestFunctionsSet();

  asKnowledge(memory: TMemory, location: LineLocation): Knowledge {
    const functionsSet = this.functionsSet;
    return {
      getVariable: (name: string): TValue => {
        if (name.includes('.') || name.includes('[')) {
          const result = this.applyFunctionsAndVariables(memory, new StringLocated(name, location));
          try {
            return TValue.fromJson(JSON.parse(result) as JsonValue);
          } catch {
            return TValue.fromString(result);
          }
        }
        return memory.getVariable(name) as TValue;
      },
      getFunction: (signature: TFunctionSignature): TFunction | undefined => functionsSet.getFunctionSmart(signature),
    };
  }

  /** Real (not mocked) `$var` substitution via `VariableManager`, matching
   * `TContext#applyFunctionsAndVariables`'s per-character scan loop, minus
   * inline function-call (`%func()`) expansion -- no fixture in this
   * batch's tests calls a builtin, so that half is out of scope here. */
  applyFunctionsAndVariables(memory: TMemory, located: StringLocated): string {
    const str = located.getString();
    const vm = new VariableManager(this, memory, located);
    const result = { value: '' };
    let i = 0;
    while (i < str.length) {
      if (vm.getVarnameAt(str, i) !== undefined) {
        i = vm.replaceVariables(str, i, result) + 1;
      } else {
        result.value += str.charAt(i);
        i++;
      }
    }
    return result.value;
  }

  doesFunctionExist(functionName: string): boolean {
    return this.functionsSet.doesFunctionExist(functionName);
  }

  getPreprocessingArtifact(): TPreprocessingArtifact {
    throw new Error('getPreprocessingArtifact is not exercised by this test harness');
  }

  private buildCodeIterator(memory: TMemory, body: readonly StringLocated[]): CodeIterator {
    const debug: StringLocated[] = [];
    const it10 = new CodeIteratorImpl(body);
    const it20 = new CodeIteratorLongComment(it10, debug);
    const it30 = new CodeIteratorShortComment(it20, debug);
    const it40 = new CodeIteratorInnerComment(it30);
    const it50 = new CodeIteratorSub(it40, new Map<string, Sub>(), this, memory);
    const it60 = new CodeIteratorReturnFunction(it50, this, memory, this.functionsSet, debug);
    const it61 = new CodeIteratorProcedure(it60, this, memory, this.functionsSet, debug);
    const it70 = new CodeIteratorIf(it61, this, memory, debug);
    const it80 = new CodeIteratorLegacyDefine(it70, this, memory, this.functionsSet, debug);
    const it90 = new CodeIteratorWhile(it80, this, memory, debug);
    const it100 = new CodeIteratorForeach(it90, this, memory, debug);
    return new CodeIteratorAffectation(it100, this, memory, debug);
  }

  /** Mirrors `TContext#executeLines` + the subset of
   * `#executeOneLineNotSafe`'s dispatch this harness's tests exercise. */
  executeLines(
    memory: TMemory,
    body: readonly StringLocated[],
    ftype: TFunctionType,
    wantReturn: boolean,
  ): TValue | undefined {
    const it = this.buildCodeIterator(memory, [...body]);
    let s: StringLocated | null;
    while ((s = it.peek()) !== null) {
      const result = this.executeOneLine(memory, s, ftype, wantReturn);
      if (result !== undefined) return result;
      it.next();
    }
    return undefined;
  }

  private executeOneLine(
    memory: TMemory,
    s: StringLocated,
    ftype: TFunctionType,
    wantReturn: boolean,
  ): TValue | undefined {
    const type = s.getType();
    if (type === 'DUMP_MEMORY') {
      new EaterDumpMemory(s.getTrimmed()).analyze(this, memory);
    } else if (type === 'ASSERT') {
      new EaterAssert(s.getTrimmed()).analyze(this, memory);
    } else if (type === 'UNDEF') {
      new EaterUndef(s).analyze(this, memory);
    } else if (type === 'LOG') {
      new EaterLog(s).analyze(this, memory);
    } else if (ftype !== TFunctionType.RETURN_FUNCTION && type === 'PLAIN') {
      // addPlain: this harness doesn't capture output text, only side
      // effects and control flow; matching upstream's own "return null"
      // (no early-return value) for this branch.
    } else if (ftype === TFunctionType.RETURN_FUNCTION && type === 'RETURN') {
      if (wantReturn) {
        const eaterReturn = new EaterReturn(s);
        eaterReturn.analyze(this, memory);
        return eaterReturn.getValue2();
      }
      // Actually, ignore because we are in a nested `!if` that discarded
      // this branch (matches upstream's own comment).
    } else if (ftype === TFunctionType.RETURN_FUNCTION && type === 'PLAIN') {
      // simulatePlain: no-op here, output text not captured.
    } else if (type === 'AFFECTATION_DEFINE') {
      new EaterAffectationDefine(s).analyze(this, memory);
    }
    return undefined;
  }
}

/** Convenience: run `body` through a fresh `TestTContext` + `TMemoryGlobal`,
 * returning the (possibly `undefined`) result and the memory used, so tests
 * can assert on both control flow AND resulting variable state. */
export function runBody(
  body: readonly StringLocated[],
  ftype: TFunctionType = TFunctionType.PROCEDURE,
  wantReturn = false,
): { context: TestTContext; memory: TMemoryGlobal; result: TValue | undefined } {
  const context = new TestTContext();
  const memory = new TMemoryGlobal();
  const result = context.executeLines(memory, body, ftype, wantReturn);
  return { context, memory, result };
}
