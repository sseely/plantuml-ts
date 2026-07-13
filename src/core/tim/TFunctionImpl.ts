/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionImpl.java
 */

import { TValue } from './expression/TValue.js';
import { StringLocated, type LineLocation } from './StringLocated.js';
import type { TMemory } from './TMemory.js';
import type { TContext, TFunction } from './TFunction.js';
import { TFunctionSignature } from './TFunctionSignature.js';
import { TFunctionType } from './TFunctionType.js';
import type { TFunctionArgument } from './TFunctionArgument.js';
import { EaterException } from './EaterException.js';

/**
 * A user-declared `!procedure` / `!function` / legacy `!define`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionImpl.java
 */
export class TFunctionImpl implements TFunction {
  private readonly signature: TFunctionSignature;
  private readonly args: readonly TFunctionArgument[];
  private readonly body: StringLocated[] = [];
  private readonly unquoted: boolean;
  // Not `readonly`: `finalizeEnddefinelong` mutates it from
  // LEGACY_DEFINELONG to LEGACY_DEFINE once the definelong body collapses
  // to a single line, matching upstream's non-final `functionType` field.
  private functionType: TFunctionType;
  private legacyDefinition: string | undefined;
  private containsReturn = false;

  constructor(functionName: string, args: readonly TFunctionArgument[], unquoted: boolean, functionType: TFunctionType) {
    const names = new Set(args.map((a) => a.getName()));
    this.signature = new TFunctionSignature(functionName, args.length, names);
    this.args = args;
    this.unquoted = unquoted;
    this.functionType = functionType;
  }

  canCover(nbArg: number, namedArguments: ReadonlySet<string>): boolean {
    for (const n of namedArguments) if (!this.signature.getNamedArguments().has(n)) return false;

    if (nbArg > this.args.length) return false;

    let neededArgument = 0;
    for (const arg of this.args) {
      if (namedArguments.has(arg.getName())) continue;
      if (arg.getOptionalDefaultValue() === undefined) neededArgument++;
    }
    if (nbArg < neededArgument) return false;

    return true;
  }

  private getNewMemory(
    memory: TMemory,
    values: readonly TValue[],
    namedArguments: ReadonlyMap<string, TValue>,
  ): TMemory {
    const result = new Map<string, TValue>();
    let ivalue = 0;
    for (const arg of this.args) {
      let value: TValue | undefined;
      if (namedArguments.has(arg.getName())) {
        value = namedArguments.get(arg.getName());
      } else if (ivalue < values.length) {
        value = values[ivalue];
        ivalue++;
      } else {
        value = arg.getOptionalDefaultValue();
      }
      if (value === undefined) throw new Error('IllegalStateException');

      result.set(arg.getName(), value);
    }
    return memory.forkFromGlobal(result);
  }

  toString(): string {
    return `FUNCTION ${this.signature.toString()} ${this.args.map((a) => a.toString()).join(',')}`;
  }

  /** @throws EaterException (thrown, not returned) if a procedure declares `!return`. */
  addBody(s: StringLocated): void {
    this.body.push(s);
    if (s.getType() === 'RETURN') {
      this.containsReturn = true;
      if (this.functionType === TFunctionType.PROCEDURE)
        throw new EaterException(
          'A procedure cannot have !return directive. Declare it as a function instead ?',
          s,
        );
    }
  }

  /** @throws EaterException (thrown, not returned) if not a PROCEDURE/LEGACY_DEFINELONG. */
  executeProcedureInternal(
    context: TContext,
    memory: TMemory,
    _location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): void {
    if (this.functionType !== TFunctionType.PROCEDURE && this.functionType !== TFunctionType.LEGACY_DEFINELONG)
      throw new Error('IllegalStateException');

    const copy = this.getNewMemory(memory, args, named);
    context.executeLines(copy, this.body, TFunctionType.PROCEDURE, false);
  }

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  executeReturnFunction(
    context: TContext,
    memory: TMemory,
    location: StringLocated,
    args: readonly TValue[],
    named: ReadonlyMap<string, TValue>,
  ): TValue {
    if (this.functionType === TFunctionType.LEGACY_DEFINE)
      return this.executeReturnLegacyDefine(location.getLocation(), context, memory, args);

    if (this.functionType !== TFunctionType.RETURN_FUNCTION)
      throw new EaterException('Illegal call here. Is there a return directive in your function?', location);

    const copy = this.getNewMemory(memory, args, named);
    const result = context.executeLines(copy, this.body, TFunctionType.RETURN_FUNCTION, true);
    if (result === undefined) throw new EaterException('No return directive found in your function', location);

    return result;
  }

  /** @throws EaterException (thrown, not returned) on evaluation failure. */
  private executeReturnLegacyDefine(
    location: LineLocation,
    context: TContext,
    memory: TMemory,
    args: readonly TValue[],
  ): TValue {
    if (this.legacyDefinition === undefined) throw new Error('IllegalStateException');

    const copy = this.getNewMemory(memory, args, new Map());
    const tmp = context.applyFunctionsAndVariables(copy, new StringLocated(this.legacyDefinition, location));
    if (tmp === undefined) return TValue.fromString('');

    return TValue.fromString(tmp);
  }

  getFunctionType(): TFunctionType {
    return this.functionType;
  }

  getSignature(): TFunctionSignature {
    return this.signature;
  }

  setLegacyDefinition(legacyDefinition: string): void {
    this.legacyDefinition = legacyDefinition;
  }

  isUnquoted(): boolean {
    return this.unquoted;
  }

  hasBody(): boolean {
    return this.body.length > 0;
  }

  finalizeEnddefinelong(): void {
    if (this.functionType !== TFunctionType.LEGACY_DEFINELONG) throw new Error('UnsupportedOperationException');

    if (this.body.length === 1) {
      this.functionType = TFunctionType.LEGACY_DEFINE;
      this.legacyDefinition = this.body[0]!.getString();
    }
  }

  doesContainReturn(): boolean {
    return this.containsReturn;
  }
}
