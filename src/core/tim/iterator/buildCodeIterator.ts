/**
 * `TContext#buildCodeIterator` -- the `CodeIterator` decorator chain, in
 * upstream's exact order. Extracted to its own module (upstream keeps it as a
 * private method on `TContext`) purely to keep `TContext.ts` under this repo's
 * per-file size gate; it takes every collaborator it needs as a parameter and
 * holds no state of its own.
 *
 * The ORDER IS THE SEMANTICS: `CodeIteratorProcedure` sits INSIDE
 * `CodeIteratorIf`, so a `!procedure` declared inside a false `!ifdef` is still
 * registered (pinned by `tests/unit/core/preprocessor-procedure.test.ts`),
 * while `CodeIteratorLegacyDefine` sits OUTSIDE it, so a `!define` in a false
 * branch is not. Do not reorder.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#buildCodeIterator
 */

import type { FunctionsSet } from '../FunctionsSet.js';
import type { StringLocated } from '../StringLocated.js';
import type { TContext } from '../TFunction.js';
import type { TMemory } from '../TMemory.js';
import type { CodeIterator } from './CodeIterator.js';
import { CodeIteratorAffectation } from './CodeIteratorAffectation.js';
import { CodeIteratorForeach } from './CodeIteratorForeach.js';
import { CodeIteratorIf } from './CodeIteratorIf.js';
import { CodeIteratorImpl } from './CodeIteratorImpl.js';
import { CodeIteratorInnerComment } from './CodeIteratorInnerComment.js';
import { CodeIteratorLegacyDefine } from './CodeIteratorLegacyDefine.js';
import { CodeIteratorLongComment } from './CodeIteratorLongComment.js';
import { CodeIteratorProcedure } from './CodeIteratorProcedure.js';
import { CodeIteratorReturnFunction } from './CodeIteratorReturnFunction.js';
import { CodeIteratorShortComment } from './CodeIteratorShortComment.js';
import { CodeIteratorSub } from './CodeIteratorSub.js';
import { CodeIteratorWhile } from './CodeIteratorWhile.js';
import type { Sub } from './Sub.js';

export interface CodeIteratorChainDeps {
  readonly context: TContext;
  readonly memory: TMemory;
  readonly functionsSet: FunctionsSet;
  readonly subs: Map<string, Sub>;
  readonly debug: StringLocated[];
}

export function buildCodeIterator(body: readonly StringLocated[], deps: CodeIteratorChainDeps): CodeIterator {
  const { context, memory, functionsSet, subs, debug } = deps;
  const it10 = new CodeIteratorImpl(body);
  const it20 = new CodeIteratorLongComment(it10, debug);
  const it30 = new CodeIteratorShortComment(it20, debug);
  const it40 = new CodeIteratorInnerComment(it30);
  const it50 = new CodeIteratorSub(it40, subs, context, memory);
  const it60 = new CodeIteratorReturnFunction(it50, context, memory, functionsSet, debug);
  const it61 = new CodeIteratorProcedure(it60, context, memory, functionsSet, debug);
  const it70 = new CodeIteratorIf(it61, context, memory, debug);
  const it80 = new CodeIteratorLegacyDefine(it70, context, memory, functionsSet, debug);
  const it90 = new CodeIteratorWhile(it80, context, memory, debug);
  const it100 = new CodeIteratorForeach(it90, context, memory, debug);
  return new CodeIteratorAffectation(it100, context, memory, debug);
}
