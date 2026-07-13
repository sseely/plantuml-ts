/**
 * https://en.wikipedia.org/wiki/Shunting-yard_algorithm
 * https://en.cppreference.com/w/c/language/operator_precedence
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/ShuntingYard.java
 */
import { Token } from './Token.js';
import { TokenType } from './TokenType.js';
import { TokenStack } from './TokenStack.js';
import type { TokenIterator } from './TokenIterator.js';
import { EaterException, type Knowledge, type StringLocated } from './Knowledge.js';

/**
 * LIFO helpers over a plain array, matching the `Deque<Token>` used as a
 * stack (`addFirst`/`removeFirst`/`peekFirst`) in the Java source.
 * `removeFirst` throws on an empty stack, mirroring
 * `ArrayDeque#removeFirst`'s `NoSuchElementException` rather than silently
 * yielding `undefined` the way `Array#shift` would.
 */
function addFirst(stack: Token[], token: Token): void {
  stack.unshift(token);
}

function removeFirst(stack: Token[]): Token {
  const token = stack.shift();
  if (token === undefined) throw new Error('NoSuchElementException');
  return token;
}

function peekFirst(stack: Token[]): Token | undefined {
  return stack[0];
}

const VARIABLE_NAME_PATTERN = /^[a-zA-Z0-9.$_]+$/;

export class ShuntingYard {
  // Upstream misspells this field "ouputQueue" (missing the second 'p') —
  // preserved verbatim.
  private readonly ouputQueue = new TokenStack();
  private readonly operatorStack: Token[] = [];

  constructor(it: TokenIterator, knowledge: Knowledge, location: StringLocated) {
    while (it.hasMoreTokens()) {
      // Guarded by hasMoreTokens() above, matching upstream's own
      // unchecked `it.nextToken()` call here.
      const token = it.nextToken()!;
      if (token.getTokenType() === TokenType.NUMBER || token.getTokenType() === TokenType.QUOTED_STRING) {
        this.ouputQueue.add(token);
      } else if (token.getTokenType() === TokenType.FUNCTION_NAME) {
        addFirst(this.operatorStack, token);
      } else if (token.getTokenType() === TokenType.PLAIN_TEXT) {
        const name = token.getSurface();
        const variable = knowledge.getVariable(name);
        if (variable === undefined) {
          if (!ShuntingYard.isVariableName(name))
            throw new EaterException(`Parsing syntax error about ${name}`, location);

          this.ouputQueue.add(new Token(name, TokenType.QUOTED_STRING, undefined));
        } else {
          this.ouputQueue.add(variable.toToken());
        }
      } else if (this.isOperatorOrAffectation(token)) {
        while (
          (this.thereIsAFunctionAtTheTopOfTheOperatorStack() ||
            this.thereIsAnOperatorAtTheTopOfTheOperatorStackWithGreaterPrecedence(token) ||
            this.theOperatorAtTheTopOfTheOperatorStackHasEqualPrecedenceAndIsLeftAssociative(token)) &&
          this.theOperatorAtTheTopOfTheOperatorStackIsNotALeftParenthesis(token)
        ) {
          this.ouputQueue.add(removeFirst(this.operatorStack));
        }

        // push it onto the operator stack.
        addFirst(this.operatorStack, token);
      } else if (token.getTokenType() === TokenType.OPEN_PAREN_FUNC) {
        addFirst(this.operatorStack, token);
      } else if (token.getTokenType() === TokenType.OPEN_PAREN_MATH) {
        addFirst(this.operatorStack, token);
      } else if (token.getTokenType() === TokenType.CLOSE_PAREN_FUNC) {
        while (
          peekFirst(this.operatorStack) !== undefined &&
          peekFirst(this.operatorStack)!.getTokenType() !== TokenType.OPEN_PAREN_FUNC
        )
          this.ouputQueue.add(removeFirst(this.operatorStack));

        const first = removeFirst(this.operatorStack);
        this.ouputQueue.add(first);
      } else if (token.getTokenType() === TokenType.CLOSE_PAREN_MATH) {
        // Upstream doesn't null-guard `peekFirst()` in this loop either —
        // preserved: malformed input (unbalanced parens) crashes here, same
        // as the Java NullPointerException it would produce.
        while (peekFirst(this.operatorStack)!.getTokenType() !== TokenType.OPEN_PAREN_MATH)
          this.ouputQueue.add(removeFirst(this.operatorStack));

        if (peekFirst(this.operatorStack)!.getTokenType() === TokenType.OPEN_PAREN_MATH)
          removeFirst(this.operatorStack);
      } else if (token.getTokenType() === TokenType.COMMA) {
        while (
          peekFirst(this.operatorStack) !== undefined &&
          peekFirst(this.operatorStack)!.getTokenType() !== TokenType.OPEN_PAREN_FUNC
        )
          this.ouputQueue.add(removeFirst(this.operatorStack));
      } else {
        throw new Error(`UnsupportedOperationException: ${token.toString()}`);
      }
    }

    while (this.operatorStack.length !== 0) {
      const token = removeFirst(this.operatorStack);
      this.ouputQueue.add(token);
    }
    // #lizard forgives -- faithful port of ShuntingYard's main dispatch
    // loop, mirroring upstream ShuntingYard.java's constructor verbatim.
  }

  private static isVariableName(name: string): boolean {
    return VARIABLE_NAME_PATTERN.test(name);
  }

  private thereIsAFunctionAtTheTopOfTheOperatorStack(): boolean {
    const top = peekFirst(this.operatorStack);
    return top !== undefined && top.getTokenType() === TokenType.FUNCTION_NAME;
  }

  private thereIsAnOperatorAtTheTopOfTheOperatorStackWithGreaterPrecedence(token: Token): boolean {
    const top = peekFirst(this.operatorStack);
    if (top !== undefined && this.isOperatorOrAffectation(top) && top.getPrecedence() > token.getPrecedence())
      return true;

    return false;
  }

  private theOperatorAtTheTopOfTheOperatorStackHasEqualPrecedenceAndIsLeftAssociative(token: Token): boolean {
    const top = peekFirst(this.operatorStack);
    if (
      top !== undefined &&
      this.isOperatorOrAffectation(top) &&
      top.getLeftAssociativity() &&
      top.getPrecedence() === token.getPrecedence()
    )
      return true;

    return false;
  }

  private isOperatorOrAffectation(token: Token): boolean {
    return token.getTokenType() === TokenType.OPERATOR || token.getTokenType() === TokenType.AFFECTATION;
  }

  /**
   * Upstream's own implementation always returns `true` regardless of the
   * top-of-stack check — both the `if` branch and the fallthrough return
   * `true`, so this condition has no observable effect on the
   * shunting-yard loop above (the standard algorithm is supposed to stop
   * popping at a left parenthesis; this doesn't). This looks like a latent
   * upstream bug, but per this port's fidelity discipline it is preserved
   * exactly rather than "fixed" — see CLAUDE.md's porting-discipline notes
   * on not correcting apparent upstream bugs case-by-case.
   */
  private theOperatorAtTheTopOfTheOperatorStackIsNotALeftParenthesis(_token: Token): boolean {
    const top = peekFirst(this.operatorStack);
    if (top !== undefined && top.getTokenType() === TokenType.OPEN_PAREN_MATH) return true;

    return true;
  }

  getQueue(): TokenStack {
    return this.ouputQueue;
  }
}
