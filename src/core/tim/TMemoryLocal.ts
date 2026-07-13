/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemoryLocal.java
 */

import type { TValue } from './expression/TValue.js';
import type { StringLocated } from './StringLocated.js';
import { TVariableScope } from './TVariableScope.js';
import { TrieImpl } from './TrieImpl.js';
import type { Trie } from './Trie.js';
import { ExecutionContexts, type TMemory } from './TMemory.js';
import type { TMemoryGlobal } from './TMemoryGlobal.js';

/**
 * A function/procedure call frame: parameters + locally-declared variables,
 * layered in front of (and able to shadow, or fall through to) the single
 * shared `TMemoryGlobal`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TMemoryLocal.java
 */
export class TMemoryLocal extends ExecutionContexts implements TMemory {
  private readonly memoryGlobal: TMemoryGlobal;
  // Lazily built on first `variablesNames3()` call, matching upstream's
  // own lazy `overridenVariables00` field.
  private overridenVariables00: TrieImpl | undefined;
  private readonly overridenVariables01 = new Map<string, TValue>();
  private readonly localVariables00 = new TrieImpl();
  private readonly localVariables01 = new Map<string, TValue>();

  constructor(global: TMemoryGlobal, input: ReadonlyMap<string, TValue>) {
    super();
    this.memoryGlobal = global;
    for (const [key, value] of input) this.overridenVariables01.set(key, value);
  }

  dumpDebug(message: string): void {
    // Per-assignment tracing intentionally not ported -- see
    // TMemoryGlobal#dumpDebug's comment for the rationale. `dumpDebug`
    // itself (the `!dump_memory`-triggered diagnostic) is ported
    // faithfully.
    console.info(`[MemLocal] Start of memory_dump ${message}`);
    this.memoryGlobal.dumpMemoryInternal();
    console.info(`[MemLocal] Number of overridden variable(s) : ${this.overridenVariables01.size}`);
    for (const name of [...this.overridenVariables01.keys()].sort()) {
      console.info(`[MemLocal] ${name} = ${this.overridenVariables01.get(name)!.toString()}`);
    }
    console.info(`[MemLocal] Number of local variable(s) : ${this.localVariables01.size}`);
    for (const name of [...this.localVariables01.keys()].sort()) {
      console.info(`[MemLocal] ${name} = ${this.localVariables01.get(name)!.toString()}`);
    }
    console.info('[MemGlobal] End of memory_dump');
  }

  putVariable(varname: string, value: TValue, scope: TVariableScope | undefined, location: StringLocated): void {
    if (scope === TVariableScope.GLOBAL) {
      this.memoryGlobal.putVariable(varname, value, scope, location);
      return;
    }
    if (scope === TVariableScope.LOCAL || this.overridenVariables01.has(varname)) {
      this.overridenVariables01.set(varname, value);
      this.overridenVariables00?.add(varname);
    } else if (this.memoryGlobal.getVariable(varname) !== undefined) {
      this.memoryGlobal.putVariable(varname, value, scope, location);
    } else {
      this.localVariables01.set(varname, value);
      this.localVariables00.add(varname);
    }
  }

  removeVariable(varname: string): void {
    if (this.overridenVariables01.has(varname)) {
      this.overridenVariables01.delete(varname);
      this.overridenVariables00?.remove(varname);
    } else if (this.memoryGlobal.getVariable(varname) !== undefined) {
      this.memoryGlobal.removeVariable(varname);
    } else {
      this.localVariables01.delete(varname);
      this.localVariables00.remove(varname);
    }
  }

  getVariable(varname: string): TValue | undefined {
    const overridden = this.overridenVariables01.get(varname);
    if (overridden !== undefined) return overridden;

    const global = this.memoryGlobal.getVariable(varname);
    if (global !== undefined) return global;

    return this.localVariables01.get(varname);
  }

  variablesNames3(): Trie {
    if (this.overridenVariables00 === undefined) {
      this.overridenVariables00 = new TrieImpl();
      for (const name of this.overridenVariables01.keys()) this.overridenVariables00.add(name);
    }
    const overridden = this.overridenVariables00;
    const local = this.localVariables00;
    const global = this.memoryGlobal;
    return {
      add(_s: string): void {
        throw new Error('UnsupportedOperationException');
      },
      getLonguestMatchStartingIn(s: string, pos: number): string {
        const s1 = global.variablesNames3().getLonguestMatchStartingIn(s, pos);
        const s2 = overridden.getLonguestMatchStartingIn(s, pos);
        const s3 = local.getLonguestMatchStartingIn(s, pos);

        if (s1.length >= s2.length && s1.length >= s3.length) return s1;
        if (s2.length >= s3.length && s2.length >= s1.length) return s2;
        return s3;
      },
    };
  }

  isEmpty(): boolean {
    return this.memoryGlobal.isEmpty() && this.localVariables01.size === 0 && this.overridenVariables01.size === 0;
  }

  variablesNames(): ReadonlySet<string> {
    throw new Error('UnsupportedOperationException');
  }

  forkFromGlobal(input: ReadonlyMap<string, TValue>): TMemory {
    return new TMemoryLocal(this.memoryGlobal, input);
  }
}
