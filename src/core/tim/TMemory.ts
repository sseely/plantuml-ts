/**
 * The TIM variable-scoping contract (`TMemory`) plus the shared execution-
 * context stack (`ExecutionContexts`) that both `TMemoryGlobal` and
 * `TMemoryLocal` extend, plus the three `!if` / `!while` / `!foreach`
 * execution-context value classes themselves.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemory.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContexts.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextIf.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextWhile.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextForeach.java
 */

import type { TValue } from './expression/TValue.js';
import type { JsonValue } from './expression/Token.js';
import type { TokenStack } from './expression/TokenStack.js';
import type { StringLocated } from './StringLocated.js';
import type { TVariableScope } from './TVariableScope.js';
import type { Trie } from './Trie.js';
import type { TContext } from './TFunction.js';
import type { CodePosition } from './iterator/CodePosition.js';

/**
 * Batch SI5a-2a declared this as a narrow structural interface (only
 * `conditionIsOkHere`). Batch SI5a-2b widens it to the real upstream class:
 * `CodeIteratorIf` / `EaterIf` / `EaterElseIf` need the full `!if` /
 * `!elseif` / `!else` state machine (`enteringElseIf`, `nowInElse`,
 * `nowInSomeElseIf`, `hasBeenBurn`, `setHasBeenBurn`), which is now in
 * scope. Per the mission brief's write-set note ("only if not already in
 * TMemory.ts -- check first"): it already was, so the real implementation
 * is added here rather than in a new top-level `ExecutionContextIf.ts`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextIf.java
 */
export class ExecutionContextIf {
  private isTrueValue: boolean;
  private hasBeenBurnValue = false;

  private constructor(isTrue: boolean) {
    this.isTrueValue = isTrue;
    if (this.isTrueValue) this.hasBeenBurnValue = true;
  }

  static fromValue(isTrue: boolean): ExecutionContextIf {
    return new ExecutionContextIf(isTrue);
  }

  conditionIsOkHere(): boolean {
    return this.isTrueValue;
  }

  enteringElseIf(): void {
    this.isTrueValue = false;
  }

  nowInElse(): void {
    this.isTrueValue = !this.hasBeenBurnValue;
  }

  nowInSomeElseIf(): void {
    this.isTrueValue = true;
    this.hasBeenBurnValue = true;
  }

  hasBeenBurn(): boolean {
    return this.hasBeenBurnValue;
  }

  setHasBeenBurn(hasBeenBurn: boolean): void {
    this.hasBeenBurnValue = hasBeenBurn;
  }
}

/**
 * Batch SI5a-2a declared this as fully opaque (`unknown`). Batch SI5a-2b
 * widens it to the real upstream class: `CodeIteratorWhile` / `EaterWhile`
 * need `conditionValue` / `skipMe` / `isSkipMe` / `getStartWhile`, which
 * are now in scope (the `iterator/` chain that owns `CodePosition` is part
 * of this batch).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextWhile.java
 */
export class ExecutionContextWhile {
  private readonly whileExpression: TokenStack;
  private readonly codePosition: CodePosition;
  private skipMeValue = false;

  private constructor(whileExpression: TokenStack, codePosition: CodePosition) {
    this.whileExpression = whileExpression;
    this.codePosition = codePosition;
  }

  static fromValue(whileExpression: TokenStack, codePosition: CodePosition): ExecutionContextWhile {
    return new ExecutionContextWhile(whileExpression, codePosition);
  }

  toString(): string {
    return `${this.whileExpression.toString()} ${String(this.codePosition)}`;
  }

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  conditionValue(location: StringLocated, context: TContext, memory: TMemory): TValue {
    return this.whileExpression.getResult(location, context, memory);
  }

  skipMe(): void {
    this.skipMeValue = true;
  }

  isSkipMe(): boolean {
    return this.skipMeValue;
  }

  getStartWhile(): CodePosition {
    return this.codePosition;
  }
}

/**
 * `JsonValue`'s array/object size, per this port's plain-JS-value
 * representation of `net.sourceforge.plantuml.json.JsonValue` (see
 * `expression/Token.ts`'s file header). Local duplicate of the one-line
 * predicate `EaterForeach.ts` (a sibling batch-2b file, not this file's
 * write-set target) also needs independently -- see `Eater.ts`'s file
 * header for the established precedent of duplicating tiny predicates
 * rather than introducing a new shared module for them.
 * @see ~/git/plantuml/.../tim/EaterForeach.java#size
 */
function jsonSize(value: JsonValue): number {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === 'object') return Object.keys(value).length;

  throw new Error('IllegalArgumentException');
}

/**
 * Batch SI5a-2a declared this as fully opaque (`unknown`). Batch SI5a-2b
 * widens it to the real upstream class: `CodeIteratorForeach` / `EaterForeach`
 * need `skipMeNow` / `isSkipMe` / `getStartForeach` / `currentValue` / `inc`
 * / `getVarname` / `getJsonValue`, which are now in scope.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextForeach.java
 */
export class ExecutionContextForeach {
  private readonly varname: string;
  private readonly jsonValue: JsonValue;
  private readonly codePosition: CodePosition;
  private skipMeValue = false;
  private currentIndex = 0;

  private constructor(varname: string, jsonValue: JsonValue, codePosition: CodePosition) {
    this.varname = varname;
    this.jsonValue = jsonValue;
    this.codePosition = codePosition;
  }

  static fromValue(varname: string, jsonValue: JsonValue, codePosition: CodePosition): ExecutionContextForeach {
    return new ExecutionContextForeach(varname, jsonValue, codePosition);
  }

  skipMeNow(): void {
    this.skipMeValue = true;
  }

  isSkipMe(): boolean {
    return this.skipMeValue;
  }

  getStartForeach(): CodePosition {
    return this.codePosition;
  }

  /**
   * Array source: the element at the current index. Object source: the
   * FIELD NAME at the current index, wrapped as a JSON string value --
   * `!foreach $k in $someObject` binds `$k` to each key, not each value,
   * matching upstream's `Json.value(tmp.names().get(currentIndex))`.
   */
  currentValue(): JsonValue {
    if (Array.isArray(this.jsonValue)) return this.jsonValue[this.currentIndex] ?? null;
    if (this.jsonValue !== null && typeof this.jsonValue === 'object')
      return Object.keys(this.jsonValue)[this.currentIndex] ?? null;

    throw new Error('IllegalStateException');
  }

  inc(): void {
    this.currentIndex++;
    if (this.currentIndex >= jsonSize(this.jsonValue)) this.skipMeValue = true;
  }

  getVarname(): string {
    return this.varname;
  }

  getJsonValue(): JsonValue {
    return this.jsonValue;
  }
}

/**
 * Shared LIFO stack of `!if` / `!while` / `!foreach` execution contexts.
 * `TMemoryGlobal` and `TMemoryLocal` both extend this in upstream; ported
 * here (rather than its own file) since it is a required, in-scope
 * dependency of both classes and is not itself named in the write-set as
 * a standalone file.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContexts.java
 */
export abstract class ExecutionContexts {
  private readonly allIfs: ExecutionContextIf[] = [];
  private readonly allWhiles: ExecutionContextWhile[] = [];
  private readonly allForeachs: ExecutionContextForeach[] = [];

  addIf(value: ExecutionContextIf): void {
    this.allIfs.push(value);
  }

  addWhile(value: ExecutionContextWhile): void {
    this.allWhiles.push(value);
  }

  addForeach(value: ExecutionContextForeach): void {
    this.allForeachs.push(value);
  }

  peekIf(): ExecutionContextIf | undefined {
    return this.allIfs.at(-1);
  }

  peekWhile(): ExecutionContextWhile | undefined {
    return this.allWhiles.at(-1);
  }

  peekForeach(): ExecutionContextForeach | undefined {
    return this.allForeachs.at(-1);
  }

  pollIf(): ExecutionContextIf | undefined {
    return this.allIfs.pop();
  }

  pollWhile(): ExecutionContextWhile | undefined {
    return this.allWhiles.pop();
  }

  pollForeach(): ExecutionContextForeach | undefined {
    return this.allForeachs.pop();
  }

  /**
   * Upstream declares `context`/`memory` params (and a `throws
   * EaterException`) for interface-level generality, but the current
   * implementation never calls a method on either -- only on each stacked
   * `ExecutionContextIf`. Preserved verbatim (unused params and all),
   * matching this port's don't-refactor-while-porting discipline.
   */
  areAllIfOk(_context: TContext, _memory: TMemory): boolean {
    for (const conditionalContext of this.allIfs) if (!conditionalContext.conditionIsOkHere()) return false;

    return true;
  }
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemory.java
 */
export interface TMemory {
  getVariable(varname: string): TValue | undefined;

  /**
   * `scope` is nullable: upstream callers pass `TVariableScope.lazzyParse
   * (varname)`'s result directly, which is `null` when the assignment used
   * neither `!local` nor `!global` (plain `!$x = ...`) -- that `undefined`
   * case is meaningful, not an omission, and drives the fallthrough
   * resolution order in `TMemoryLocal#putVariable`.
   * @throws EaterException (thrown, not returned) when the scope is invalid.
   */
  putVariable(varname: string, value: TValue, scope: TVariableScope | undefined, location: StringLocated): void;

  removeVariable(varname: string): void;

  isEmpty(): boolean;

  variablesNames(): ReadonlySet<string>;

  variablesNames3(): Trie;

  forkFromGlobal(input: ReadonlyMap<string, TValue>): TMemory;

  peekIf(): ExecutionContextIf | undefined;

  /** @throws EaterException (thrown, not returned) -- see {@link ExecutionContexts#areAllIfOk}. */
  areAllIfOk(context: TContext, memory: TMemory): boolean;

  addIf(context: ExecutionContextIf): void;

  addWhile(value: ExecutionContextWhile): void;

  addForeach(value: ExecutionContextForeach): void;

  pollIf(): ExecutionContextIf | undefined;

  pollWhile(): ExecutionContextWhile | undefined;

  peekWhile(): ExecutionContextWhile | undefined;

  pollForeach(): ExecutionContextForeach | undefined;

  peekForeach(): ExecutionContextForeach | undefined;

  dumpDebug(message: string): void;
}
