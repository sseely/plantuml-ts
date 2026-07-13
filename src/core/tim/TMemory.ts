/**
 * The TIM variable-scoping contract (`TMemory`) plus the shared execution-
 * context stack (`ExecutionContexts`) that both `TMemoryGlobal` and
 * `TMemoryLocal` extend.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemory.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContexts.java
 */

import type { TValue } from './expression/TValue.js';
import type { StringLocated } from './StringLocated.js';
import type { TVariableScope } from './TVariableScope.js';
import type { Trie } from './Trie.js';
import type { TContext } from './TFunction.js';

/**
 * Narrow structural stand-in for
 * `net.sourceforge.plantuml.tim.ExecutionContextIf` -- only the member
 * `ExecutionContexts#areAllIfOk` (below) actually calls
 * (`conditionIsOkHere`). The real class also carries `fromValue`,
 * `enteringElseIf`, `nowInElse`, `nowInSomeElseIf`, `hasBeenBurn`,
 * `setHasBeenBurn` -- all consumed only by the `!if`/`!elseif`/`!else`
 * iterator chain (`EaterIf`, `EaterElseIf`, ...), which is out of this
 * batch's scope (see mission write-set). A real `ExecutionContextIf` port
 * satisfies this interface structurally with zero adapter code.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextIf.java
 */
export interface ExecutionContextIf {
  conditionIsOkHere(): boolean;
}

/**
 * Fully opaque stand-in for
 * `net.sourceforge.plantuml.tim.ExecutionContextWhile`. Every `TMemory`
 * member that touches it (`addWhile`/`pollWhile`/`peekWhile`) only stores
 * or forwards the reference -- nothing in this batch's write-set calls a
 * method on it. It also carries a dependency
 * (`net.sourceforge.plantuml.tim.iterator.CodePosition`) that belongs to
 * the `iterator/` chain, out of scope here.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextWhile.java
 */
export type ExecutionContextWhile = unknown;

/**
 * Fully opaque stand-in for
 * `net.sourceforge.plantuml.tim.ExecutionContextForeach`, for the same
 * reason as {@link ExecutionContextWhile} (also depends on
 * `iterator.CodePosition` and the `EaterForeach`/`Json` machinery, both
 * out of scope).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/ExecutionContextForeach.java
 */
export type ExecutionContextForeach = unknown;

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

  peekWhile(): ExecutionContextWhile {
    return this.allWhiles.at(-1);
  }

  peekForeach(): ExecutionContextForeach {
    return this.allForeachs.at(-1);
  }

  pollIf(): ExecutionContextIf | undefined {
    return this.allIfs.pop();
  }

  pollWhile(): ExecutionContextWhile {
    return this.allWhiles.pop();
  }

  pollForeach(): ExecutionContextForeach {
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

  pollWhile(): ExecutionContextWhile;

  peekWhile(): ExecutionContextWhile;

  pollForeach(): ExecutionContextForeach;

  peekForeach(): ExecutionContextForeach;

  dumpDebug(message: string): void;
}
