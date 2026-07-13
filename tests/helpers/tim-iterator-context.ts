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
 * Batch SI5a-4: the local `TestFunctionsSet` + `TestEaterDeclareProcedure`
 * this file used to carry are gone -- `src/core/tim/FunctionsSet.ts` and
 * `EaterDeclareProcedure.ts` ARE the real upstream shapes now, so the harness
 * uses them directly.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java
 */
import {
  EaterAffectationDefine,
  EaterAssert,
  EaterDumpMemory,
  EaterLog,
  EaterReturn,
  EaterUndef,
  StringLocated,
  FunctionsSet,
  TFunctionType,
  TMemoryGlobal,
  VariableManager,
  type LineLocation,
  type TContext,
  type TFunction,
  type TFunctionSignature,
  type TMemory,
  type TPreprocessingArtifact,
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
  type Sub,
} from '../../src/core/tim/iterator/index.js';
export { line, type FixtureLineType, fakeContext } from './tim-context.js';

/**
 * A working `TContext` for iterator-chain integration tests: real variable
 * substitution (via `VariableManager`), real `Knowledge` (backed by
 * `memory` + `functionsSet`), and a real `executeLines` that builds and
 * drives the FULL decorator chain in upstream's exact order.
 */
export class TestTContext implements TContext {
  readonly functionsSet = new FunctionsSet();

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
