/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TFunctionArgument.java
 */

import type { TValue } from './expression/TValue.js';

export class TFunctionArgument {
  private readonly name: string;
  // Java `null` (no declared default value) -> `undefined`, per this
  // port's null/undefined convention.
  private readonly def: TValue | undefined;

  constructor(name: string, def: TValue | undefined) {
    this.name = name;
    this.def = def;
  }

  getName(): string {
    return this.name;
  }

  toString(): string {
    return `ARG:${this.name}`;
  }

  getOptionalDefaultValue(): TValue | undefined {
    return this.def;
  }
}
