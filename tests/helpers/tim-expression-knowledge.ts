/**
 * Minimal `Knowledge` / `TContext` / `TFunction` test doubles for
 * `tim/expression/` tests — a variable table and a function table, both
 * backed by plain `Map`s, satisfying the structural boundary interfaces
 * declared in `src/core/tim/expression/Knowledge.ts`.
 */
import {
  type Knowledge,
  type TContext,
  type TFunction,
  TFunctionSignature,
  type TValue,
} from '../../src/core/tim/expression/index.js';
import { TFunctionType } from '../../src/core/tim/TFunctionType.js';

export class FakeKnowledge implements Knowledge {
  constructor(
    private readonly variables = new Map<string, TValue>(),
    // Keyed by function name only (not name+arity): a real Knowledge
    // implementation searches its function set by name and lets
    // `TFunction#canCover` decide whether a given call's argument count
    // fits, so this fake mirrors that rather than doing an exact-arity
    // key match (which would make the "bad argument count" path
    // unreachable in tests).
    private readonly functions = new Map<string, TFunction>(),
  ) {}

  getVariable(name: string): TValue {
    return this.variables.get(name) as TValue;
  }

  getFunction(signature: TFunctionSignature): TFunction | undefined {
    return this.functions.get(signature.getFunctionName());
  }

  setVariable(name: string, value: TValue): void {
    this.variables.set(name, value);
  }

  setFunction(name: string, fn: TFunction): void {
    this.functions.set(name, fn);
  }
}

/**
 * Builds a `TFunction` test double from a plain evaluation function.
 *
 * Batch SI5a-4: `TFunction` here is now the REAL `src/core/tim/TFunction.ts`
 * interface (the narrow 3-member stand-in `expression/Knowledge.ts` used to
 * declare is retired), so the double implements all six members. The three the
 * expression evaluator never calls throw / return a fixed value rather than
 * being omitted.
 */
export function fakeFunction(name: string, nbArg: number, execute: (args: readonly TValue[]) => TValue): TFunction {
  const signature = new TFunctionSignature(name, nbArg);
  return {
    getSignature: () => signature,
    canCover: (nb) => nb === nbArg,
    getFunctionType: () => TFunctionType.RETURN_FUNCTION,
    executeProcedureInternal: () => {
      throw new Error('UnsupportedOperationException');
    },
    isUnquoted: () => false,
    executeReturnFunction: (_context, _memory, _location, args) => execute(args),
  };
}

/** A `TContext` double over a fixed `Knowledge`. Only `asKnowledge` is
 * exercised by `tim/expression/`; the rest satisfy the real interface. */
export function fakeContext(knowledge: Knowledge): TContext {
  return {
    asKnowledge: () => knowledge,
    executeLines: () => undefined,
    applyFunctionsAndVariables: (_memory, located) => located.getString(),
    doesFunctionExist: () => false,
    getPreprocessingArtifact: () => ({
      addWarning: () => undefined,
      getOption: () => ({ define: () => undefined }),
    }),
  };
}
