/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemoryGlobal.java
 */

import type { TValue } from './expression/TValue.js';
import type { StringLocated } from './StringLocated.js';
import { TVariableScope } from './TVariableScope.js';
import { EaterException } from './EaterException.js';
import { TrieImpl } from './TrieImpl.js';
import type { Trie } from './Trie.js';
import { ExecutionContexts, type TMemory } from './TMemory.js';
import { TMemoryLocal } from './TMemoryLocal.js';

/**
 * The single top-level `TMemory`: global (`!global $x = ...`) and
 * plain (`!$x = ...` outside any function) variables live here.
 * `TMemoryLocal` (a function/procedure call frame) always forks off one
 * of these.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemoryGlobal.java
 */
export class TMemoryGlobal extends ExecutionContexts implements TMemory {
  private readonly globalVariables = new Map<string, TValue>();
  private readonly variables = new TrieImpl();

  getVariable(varname: string): TValue | undefined {
    return this.globalVariables.get(varname);
  }

  dumpDebug(message: string): void {
    // The per-assignment `Log.info("[MemGlobal] Setting X")` trace calls
    // in `putVariable`/`removeVariable` below are deliberately NOT ported:
    // they have zero effect on diagram output (pure logging noise) and
    // this project's own logging.md rule ("do not log at DEBUG in
    // production paths by default") argues against an always-on port of
    // them, especially with no `Log`-level-gating framework in this
    // codebase to gate on. `dumpDebug` itself IS ported faithfully: it is
    // the public, directive-triggered (`!dump_memory`) diagnostic dump the
    // user explicitly asked for, not incidental tracing.
    console.info(`[MemGlobal] Start of memory_dump ${message}`);
    this.dumpMemoryInternal();
    console.info('[MemGlobal] End of memory_dump');
  }

  /** @see TMemoryGlobal#dumpMemoryInternal -- package-visible upstream (no leading underscore per this project's naming convention: TS uses the `private`/no-modifier split, not name-mangling). */
  dumpMemoryInternal(): void {
    console.info(`[MemGlobal] Number of variable(s) : ${this.globalVariables.size}`);
    for (const name of [...this.globalVariables.keys()].sort()) {
      console.info(`[MemGlobal] ${name} = ${this.globalVariables.get(name)!.toString()}`);
    }
  }

  putVariable(varname: string, value: TValue, scope: TVariableScope | undefined, location: StringLocated): void {
    if (scope === TVariableScope.LOCAL) throw new EaterException('Cannot use local variable here', location);

    this.globalVariables.set(varname, value);
    this.variables.add(varname);
  }

  removeVariable(varname: string): void {
    this.globalVariables.delete(varname);
    this.variables.remove(varname);
  }

  isEmpty(): boolean {
    return this.globalVariables.size === 0;
  }

  variablesNames(): ReadonlySet<string> {
    return new Set(this.globalVariables.keys());
  }

  variablesNames3(): Trie {
    return this.variables;
  }

  forkFromGlobal(input: ReadonlyMap<string, TValue>): TMemory {
    return new TMemoryLocal(this, input);
  }
}
