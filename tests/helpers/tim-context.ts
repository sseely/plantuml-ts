/**
 * Lightweight `Eater*` unit-test helpers: a classified `StringLocated`
 * fixture builder and a mock `TContext`. Deliberately depends on nothing
 * under `src/core/tim/iterator/` -- the full working `TestTContext` +
 * `TestFunctionsSet` harness (which DOES need the iterator chain) lives in
 * `tim-iterator-context.ts` instead. This split mirrors the real source
 * dependency direction (`iterator/*.ts` imports `Eater*.ts` directly, not
 * the reverse), so `Eater*.test.ts` files depend only on this file and the
 * already-landed `Eater*.ts` + `TFunction.ts` + `StringLocated.ts`.
 */
import { StringLocated } from '../../src/core/tim/StringLocated.js';
import type { TContext } from '../../src/core/tim/TFunction.js';
import type { TMemory } from '../../src/core/tim/TMemory.js';
import type { TValue } from '../../src/core/tim/expression/TValue.js';

/** Assignable line-type tag for building test fixture bodies. */
export type FixtureLineType =
  | 'PLAIN'
  | 'IF'
  | 'IFDEF'
  | 'IFNDEF'
  | 'ELSE'
  | 'ELSEIF'
  | 'ENDIF'
  | 'WHILE'
  | 'ENDWHILE'
  | 'FOREACH'
  | 'ENDFOREACH'
  | 'DECLARE_RETURN_FUNCTION'
  | 'DECLARE_PROCEDURE'
  | 'END_FUNCTION'
  | 'RETURN'
  | 'LEGACY_DEFINE'
  | 'LEGACY_DEFINELONG'
  | 'STARTSUB'
  | 'ENDSUB'
  | 'INCLUDESUB'
  | 'LOG'
  | 'DUMP_MEMORY'
  | 'COMMENT_SIMPLE'
  | 'COMMENT_LONG_START'
  | 'AFFECTATION'
  | 'AFFECTATION_DEFINE'
  | 'ASSERT'
  | 'UNDEF';

/** Builds a classified `StringLocated` line for a test fixture body. */
export function line(text: string, type: FixtureLineType = 'PLAIN'): StringLocated {
  return new StringLocated(text, undefined, type);
}

/** Lightweight mock `TContext` for `Eater*` unit tests that don't need a
 * working expression evaluator or memory model -- just something that
 * satisfies the widened `TContext` shape. Mirrors the `fakeContext()`
 * helper already duplicated per-file in `Eater.test.ts` / `TFunctionImpl
 * .test.ts` / `VariableManager.test.ts` (batch 2a); centralized here for
 * batch 2b's new `Eater*` test files rather than re-duplicated six more
 * times. */
export function fakeContext(overrides: Partial<TContext> = {}): TContext {
  return {
    asKnowledge: (memory: TMemory) => ({
      getVariable: (name: string) => memory.getVariable(name) as TValue,
      getFunction: () => undefined,
    }),
    executeLines: () => undefined,
    applyFunctionsAndVariables: (_memory, located) => located.getString(),
    doesFunctionExist: () => false,
    getPreprocessingArtifact: () => ({
      addWarning: () => undefined,
      getOption: () => ({ define: () => undefined }),
    }),
    ...overrides,
  };
}
