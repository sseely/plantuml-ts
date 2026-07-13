/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunction.java
 */

import type { TValue } from './expression/TValue.js';
import type { StringLocated, LineLocation } from './StringLocated.js';
import type { TFunctionSignature } from './TFunctionSignature.js';
import type { TFunctionType } from './TFunctionType.js';
import type { TMemory } from './TMemory.js';
import type { Knowledge } from './expression/Knowledge.js';

/**
 * Narrow structural stand-in for `net.sourceforge.plantuml.warning.Warning`
 * -- only the shape `EaterOption` (`!option` directive) needs to construct
 * one to hand to `TContext#getPreprocessingArtifact().addWarning`. The real
 * `Warning` class (`net.sourceforge.plantuml.warning`) carries `equals`/
 * `hashCode`/`asSingleLine`; none of those are called from `tim/`, so they
 * are omitted per this package's don't-invent-unused-surface discipline.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/warning/Warning.java
 */
export interface TWarning {
  readonly message: readonly string[];
}

/**
 * Narrow structural stand-in for
 * `net.sourceforge.plantuml.preproc.ConfigurationStore<OptionKey>` -- only
 * the one member `EaterOption` calls (`define`).
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/ConfigurationStore.java
 */
export interface TPreprocessingOptionStore {
  define(key: string, value: string): void;
}

/**
 * Narrow structural stand-in for
 * `net.sourceforge.plantuml.preproc.PreprocessingArtifact` -- only the two
 * members `EaterOption` calls (`addWarning`, `getOption`). The real class
 * also implements `WarningHandler#getWarnings`; omitted (unused by `tim/`).
 * `Warning`/`OptionKey`/`PreprocessingArtifact`/`ConfigurationStore` belong
 * to the `preproc`/`warning` packages, entirely out of scope for this
 * mission (see `TContext#getPreprocessingArtifact` below) -- these are
 * intentionally minimal, `!option`-directive-shaped stand-ins, not a
 * partial port of those packages.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/PreprocessingArtifact.java
 */
export interface TPreprocessingArtifact {
  addWarning(warning: TWarning): void;
  getOption(): TPreprocessingOptionStore;
}

/**
 * Canonical stand-in for `net.sourceforge.plantuml.tim.TContext` for this
 * batch's OWN `tim/` write-set (`Eater`, `TFunctionImpl`, `VariableManager`,
 * `TMemory`) -- declares the members those files actually call:
 * `asKnowledge` (every `Eater#eatExpression*` call, transitively, via
 * `TokenStack#getResult`), `executeLines` (a function/procedure body's
 * evaluation), and `applyFunctionsAndVariables` (inline `$var`/call
 * substitution). The real class carries dozens of other members (a 36KB
 * file); omitted per this package's don't-invent-unused-surface
 * discipline.
 *
 * This is intentionally a DIFFERENT (wider) declaration than
 * `tim/expression/Knowledge.ts`'s own `TContext` (asKnowledge only) --
 * see that file's header for why the two are not merged into one shared
 * type (that package's 139-test suite duck-types against its narrower
 * shape). A value typed as THIS `TContext` is always assignable where
 * Knowledge.ts's narrower one is expected (structural subtyping,
 * wide -> narrow); a real `TContext` implementation (a future batch)
 * satisfies both, with zero adapter code.
 *
 * Batch SI5a-2b widening: `doesFunctionExist` (EaterIfdef/EaterIfndef,
 * mirroring `TContext#doesFunctionExist` -> `FunctionsSet#doesFunctionExist`)
 * and `getPreprocessingArtifact` (EaterOption's `!option` directive) are
 * added. Batch 4 (the real `TContext`) must implement both.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#asKnowledge
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#executeLines
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#applyFunctionsAndVariables
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#doesFunctionExist
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#getPreprocessingArtifact
 */
export interface TContext {
  asKnowledge(memory: TMemory, location: LineLocation | undefined): Knowledge;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeLines(
    memory: TMemory,
    body: readonly StringLocated[],
    type: TFunctionType,
    wantReturn: boolean,
  ): TValue | undefined;

  /**
   * Java `null` -> `undefined`, and the `undefined` is MEANINGFUL, not an
   * omission: upstream returns null precisely when the line turned out to
   * contain a PROCEDURE (or LEGACY_DEFINELONG) call, which consumes the whole
   * line -- the call's own output lines were appended to the result list
   * directly, and `pendingAdd` / `appendToLastResult` re-attach the text that
   * surrounded the call. `TContext#addPlain` keys off exactly this to emit
   * nothing more for the line. Batch SI5a-2a declared it `string` (the
   * procedure path did not exist yet); batch 4 widens it, since the real
   * `TContext` cannot express the splice otherwise.
   * @throws EaterException (thrown, not returned) on evaluation failure.
   */
  applyFunctionsAndVariables(memory: TMemory, location: StringLocated): string | undefined;

  /** @see ~/git/plantuml/.../tim/TContext.java#doesFunctionExist */
  doesFunctionExist(functionName: string): boolean;

  /** @see ~/git/plantuml/.../tim/TContext.java#getPreprocessingArtifact */
  getPreprocessingArtifact(): TPreprocessingArtifact;
}

/**
 * A declared or built-in TIM function/procedure.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunction.java
 */
export interface TFunction {
  getSignature(): TFunctionSignature;

  canCover(nbArg: number, namedArguments: ReadonlySet<string>): boolean;

  getFunctionType(): TFunctionType;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue;

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeProcedureInternal(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): void;

  isUnquoted(): boolean;
}
