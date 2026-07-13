/**
 * Shared fixtures for the TIM builtin test suite
 * (`tests/unit/core/tim/builtin/*.test.ts`).
 */

import { vi } from 'vitest';
import { StringLocated } from '../../src/core/tim/StringLocated.js';
import type { TValue } from '../../src/core/tim/expression/TValue.js';
import type { TContext } from '../../src/core/tim/TFunction.js';
import type { TMemory } from '../../src/core/tim/TMemory.js';

/** A generic source location for builtins that take one but don't inspect it. */
export const LOC = new StringLocated('test', undefined);

/** An empty named-argument map -- every builtin in this suite is called positionally. */
export const NO_NAMED = new Map<string, TValue>();

/**
 * A placeholder `TMemory` for builtins whose `memory` parameter is typed
 * (rather than `unknown`) but is never actually read in the scenario under
 * test (e.g. `CallUserFunction` only forwards it to a mocked target;
 * `Eval`'s pure-arithmetic expressions never touch memory).
 */
export const NO_MEMORY = undefined as unknown as TMemory;

/**
 * A stub `TContext` satisfying every member the current `TContext` interface
 * declares (`../../src/core/tim/TFunction.ts`), plus room for the
 * builtin-specific extensions declared in `src/core/tim/builtin/context-ext.ts`
 * (`getFunctionSmart`, `getXargs`) via `overrides`.
 */
export function fakeContext(overrides: Record<string, unknown> = {}): TContext {
  return {
    asKnowledge: vi.fn(),
    executeLines: vi.fn(),
    applyFunctionsAndVariables: vi.fn(),
    doesFunctionExist: vi.fn().mockReturnValue(false),
    getPreprocessingArtifact: vi.fn().mockReturnValue({
      addWarning: vi.fn(),
      getOption: vi.fn().mockReturnValue({ define: vi.fn() }),
    }),
    ...overrides,
  };
}
