/**
 * Evaluates a reverse-Polish-notation {@link TokenStack} (the
 * {@link ShuntingYard}'s output queue) to a single {@link TValue}.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/ReversePolishInterpretor.java
 */
import { TValue } from './TValue.js';
import { TokenType } from './TokenType.js';
import type { TokenStack } from './TokenStack.js';
import {
  EaterException,
  TFunctionSignature,
  type Knowledge,
  type StringLocated,
  type TContext,
  type TMemory,
} from './Knowledge.js';

/**
 * LIFO helpers over a plain array, matching the `Deque<TValue>` used as a
 * stack in the Java source. `removeFirst` throws on an empty stack,
 * mirroring `ArrayDeque#removeFirst`'s `NoSuchElementException` rather than
 * silently yielding `undefined` the way `Array#shift` would.
 */
function addFirst(stack: TValue[], value: TValue): void {
  stack.unshift(value);
}

function removeFirst(stack: TValue[]): TValue {
  const value = stack.shift();
  if (value === undefined) throw new Error('NoSuchElementException');
  return value;
}

export class ReversePolishInterpretor {
  private readonly result: TValue;

  constructor(location: StringLocated, queue: TokenStack, knowledge: Knowledge, memory: TMemory, context: TContext) {
    const named = new Map<string, TValue>();
    const stack: TValue[] = [];

    for (const it = queue.tokenIterator(); it.hasMoreTokens(); ) {
      // Guarded by hasMoreTokens() above, matching upstream's own
      // unchecked `it.nextToken()` call here.
      const token = it.nextToken()!;
      if (token.getTokenType() === TokenType.NUMBER) {
        addFirst(stack, TValue.fromNumber(token));
      } else if (token.getTokenType() === TokenType.QUOTED_STRING) {
        addFirst(stack, TValue.fromString(token));
      } else if (token.getTokenType() === TokenType.JSON_DATA) {
        addFirst(stack, TValue.fromJson(token.getJson()));
      } else if (token.getTokenType() === TokenType.AFFECTATION) {
        const v2 = removeFirst(stack);
        const v1 = removeFirst(stack);
        named.set(v1.toString(), v2);
      } else if (token.getTokenType() === TokenType.OPERATOR) {
        const v2 = removeFirst(stack);
        const v1 = removeFirst(stack);
        const op = token.getTokenOperator();
        if (op === undefined) throw new EaterException('bad op', location);

        addFirst(stack, op.operate(v1, v2));
      } else if (token.getTokenType() === TokenType.OPEN_PAREN_FUNC) {
        const nb = Number.parseInt(token.getSurface(), 10) - named.size;
        // Guarded implicitly by the shunting-yard's own invariant that an
        // OPEN_PAREN_FUNC is always immediately followed by a
        // FUNCTION_NAME (see ShuntingYard's PLAIN_TEXT/guessFunctions
        // handling) — upstream doesn't null-check `nextToken()` here
        // either.
        const token2 = it.nextToken()!;
        if (token2.getTokenType() !== TokenType.FUNCTION_NAME) throw new EaterException('rpn43', location);

        const fn = knowledge.getFunction(new TFunctionSignature(token2.getSurface(), nb));
        if (fn === undefined) throw new EaterException(`Unknown built-in function ${token2.getSurface()}`, location);

        if (!fn.canCover(nb, new Set())) {
          throw new EaterException(`Bad number of arguments for ${fn.getSignature().getFunctionName()}`, location);
        }

        const args: TValue[] = [];
        for (let i = 0; i < nb; i++) args.unshift(removeFirst(stack));

        // Upstream also checks `if (location == null) throw new
        // EaterException("rpn44", location)` here — a self-contradictory
        // branch (constructing EaterException itself requires a non-null
        // location) that is unreachable given this port's non-nullable
        // `StringLocated` parameter type. Omitted per code-principles.md
        // ("no null checks on values the type system... guarantees are
        // non-null"), not a fidelity gap: the branch could never fire
        // meaningfully in either language.
        const r = fn.executeReturnFunction(context, memory, location, args, named);
        named.clear();
        addFirst(stack, r);
      } else {
        throw new EaterException('rpn41', location);
      }
    }
    // #lizard forgives -- faithful port of ReversePolishInterpretor's
    // main dispatch loop, mirroring upstream's constructor verbatim.
    this.result = removeFirst(stack);
  }

  getResult(): TValue {
    return this.result;
  }
}
