/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionSignature.java
 */

/**
 * Java `String#hashCode()`'s well-known 32-bit polynomial algorithm
 * (`s[0]*31^(n-1) + ... + s[n-1]`), reproduced via `Math.imul` for
 * faithful 32-bit overflow behavior. Only consumer: `hashCode` below.
 */
function javaStringHashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;

  return h;
}

/**
 * A function/procedure's identity for overload resolution: name + arity +
 * the set of named (keyword) argument names it accepts.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionSignature.java
 */
export class TFunctionSignature {
  private readonly functionName: string;
  private readonly nbArg: number;
  private readonly namedArguments: ReadonlySet<string>;
  // Upstream caches into an `AtomicInteger` (concurrency-safe under the
  // JVM's memory model); TS/JS is single-threaded, so a plain nullable
  // field is a faithful, simpler equivalent -- not a behavior change.
  private cachedHashCode: number | undefined;

  /**
   * Upstream overloads `TFunctionSignature(String, int)` and
   * `TFunctionSignature(String, int, Set<String>)`; TS has no constructor
   * overloading, so both collapse into a single constructor with a
   * default value, per this port's `Token`/`TValue` precedent.
   */
  constructor(functionName: string, nbArg: number, namedArguments: ReadonlySet<string> = new Set()) {
    this.functionName = functionName;
    this.nbArg = nbArg;
    this.namedArguments = namedArguments;
  }

  sameFunctionNameAs(other: TFunctionSignature): boolean {
    return this.getFunctionName() === other.getFunctionName();
  }

  toString(): string {
    return `${this.functionName}/${this.nbArg} [${[...this.namedArguments].join(', ')}]`;
  }

  /**
   * Deliberately ignores `namedArguments`, matching upstream's own
   * `hashCode` (which hashes only `functionName` + `nbArg`) -- consistent
   * with `equals` below doing the same.
   */
  hashCode(): number {
    if (this.cachedHashCode !== undefined) return this.cachedHashCode;

    const prime = 31;
    let result = 1;
    result = (Math.imul(prime, result) + javaStringHashCode(this.functionName)) | 0;
    result = (Math.imul(prime, result) + this.nbArg) | 0;
    this.cachedHashCode = result;
    return result;
  }

  equals(other: TFunctionSignature): boolean {
    return this.functionName === other.functionName && this.nbArg === other.nbArg;
  }

  getFunctionName(): string {
    return this.functionName;
  }

  getNbArg(): number {
    return this.nbArg;
  }

  getNamedArguments(): ReadonlySet<string> {
    return this.namedArguments;
  }
}
