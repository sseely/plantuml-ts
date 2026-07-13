/**
 * Barrel for the TIM expression evaluator — the engine behind `!if`
 * conditions, `!$var` assignment, `!function` return values, and TIM
 * built-in function calls.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/
 */

export { TValue } from './TValue.js';

export { Token, type JsonValue } from './Token.js';

export { TokenType, eatOneToken, type Eater } from './TokenType.js';

export type { TokenIterator } from './TokenIterator.js';

export { TokenStack } from './TokenStack.js';

export { TokenOperator, COMMERCIAL_MINUS_SIGN } from './TokenOperator.js';

export { ShuntingYard } from './ShuntingYard.js';

export { ReversePolishInterpretor } from './ReversePolishInterpretor.js';

export {
  EaterException,
  TFunctionSignature,
  type Knowledge,
  type LineLocation,
  type StringLocated,
  type TContext,
  type TMemory,
  type TFunction,
} from './Knowledge.js';

export { Expression } from './Expression.js';
