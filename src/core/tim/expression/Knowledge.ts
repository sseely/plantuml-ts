/**
 * The memory-lookup contract the expression evaluator depends on:
 * resolving a bare identifier to a value, and resolving a call signature to
 * a built-in/user function.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Knowledge.java
 *
 * Boundary note: `Knowledge.java` — and, transitively, `ShuntingYard`,
 * `ReversePolishInterpretor`, and `TokenStack#getResult` — reference several
 * types that live outside `tim/expression/`:
 * `net.sourceforge.plantuml.tim.{EaterException, TContext, TMemory,
 * TFunction, TFunctionSignature}` and `net.sourceforge.plantuml.text.
 * StringLocated` (itself carrying a `net.sourceforge.plantuml.utils.
 * LineLocation`). None of those packages are ported yet. Rather than block
 * this package on porting all of `tim/`, this file declares the minimal
 * structural contract this package actually calls into. A real port of each
 * type (in its own file, in `tim/` or `text/`, by a future agent) will
 * satisfy these interfaces structurally with zero adapter code, since
 * TypeScript structural typing only requires a matching shape, not
 * identity. `EaterException` and `TFunctionSignature` are given real (not
 * just type-level) implementations here, because this package constructs
 * and throws/uses them directly; when the canonical `tim/EaterException.ts`
 * / `tim/TFunctionSignature.ts` exist, this declaration should be
 * superseded by (or re-export from) those.
 */
import type { TValue } from './TValue.js';

/**
 * Stand-in for `net.sourceforge.plantuml.utils.LineLocation` — opaque to
 * this package; forwarded untouched to `TContext#asKnowledge`.
 */
export type LineLocation = unknown;

/**
 * Stand-in for `net.sourceforge.plantuml.text.StringLocated` — only the
 * member this package calls (`getLocation`) is declared.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/text/StringLocated.java
 */
export interface StringLocated {
  getLocation(): LineLocation;
}

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterException.java */
export class EaterException extends Error {
  private readonly location: StringLocated;

  constructor(message: string, location: StringLocated) {
    super(message);
    this.name = 'EaterException';
    this.location = location;
  }

  getMessage(): string {
    return this.message;
  }

  getLocation(): StringLocated {
    return this.location;
  }
}

/**
 * Stand-in for `net.sourceforge.plantuml.tim.TMemory` — opaque to this
 * package. Every call site here only forwards the reference (to
 * `TContext#asKnowledge` and `TFunction#executeReturnFunction`); nothing in
 * `tim/expression/` calls a `TMemory` method directly.
 */
export type TMemory = unknown;

/**
 * Stand-in for `net.sourceforge.plantuml.tim.TContext` — only the member
 * `TokenStack#getResult` calls (`asKnowledge`) is declared.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#asKnowledge
 */
export interface TContext {
  asKnowledge(memory: TMemory, location: LineLocation): Knowledge;
}

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionSignature.java */
export class TFunctionSignature {
  private readonly functionName: string;
  private readonly nbArg: number;
  private readonly namedArguments: ReadonlySet<string>;

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

/**
 * Stand-in for `net.sourceforge.plantuml.tim.TFunction` — declares only the
 * members `ReversePolishInterpretor` calls (`getSignature`, `canCover`,
 * `executeReturnFunction`). The real interface also has `getFunctionType`,
 * `executeProcedureInternal`, and `isUnquoted`; none of those are called
 * from `tim/expression/`, so they are omitted here rather than stubbed, per
 * this package's don't-invent-unused-surface discipline. A real
 * `TFunction` implementation satisfies this narrower interface
 * structurally.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunction.java
 */
export interface TFunction {
  getSignature(): TFunctionSignature;

  canCover(nbArg: number, namedArguments: ReadonlySet<string>): boolean;

  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue;
}

/** @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/expression/Knowledge.java */
export interface Knowledge {
  getVariable(name: string): TValue;

  getFunction(signature: TFunctionSignature): TFunction | undefined;
}
