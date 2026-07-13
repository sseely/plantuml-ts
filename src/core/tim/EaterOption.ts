/**
 * `!option <key> [<value>]`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterOption.java
 */

import { Eater } from './Eater.js';
import type { StringLocated } from './StringLocated.js';
import { EaterException } from './EaterException.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';
import type { TValue } from './expression/TValue.js';

/**
 * Minimal port of `net.sourceforge.plantuml.preproc.OptionKey` -- a small,
 * self-contained enum with default values for two of its six members. Not
 * part of `tim/` upstream (lives in `preproc/`, out of this mission's
 * write-set); kept local here since `EaterOption` is its only caller in
 * this batch's scope. `Warning` / `PreprocessingArtifact` /
 * `ConfigurationStore` (also `preproc`/`warning`-package, also out of
 * scope) are represented via the narrow `TWarning` /
 * `TPreprocessingArtifact` stand-ins this batch added to `TFunction.ts`'s
 * widened `TContext` -- see that file's header.
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/preproc/OptionKey.java
 */
export enum OptionKey {
  LANGUAGE = 'LANGUAGE',
  USE_DESCRIPTIVE_NAMES = 'USE_DESCRIPTIVE_NAMES',
  HANDWRITTEN = 'HANDWRITTEN',
  DEBUG = 'DEBUG',
  SVG_DESC = 'SVG_DESC',
  SVG_TITLE = 'SVG_TITLE',
}

const OPTION_KEY_DEFAULT_VALUE: ReadonlyMap<OptionKey, string> = new Map([
  [OptionKey.HANDWRITTEN, 'true'],
  [OptionKey.DEBUG, 'true'],
]);

/** @see ~/git/plantuml/.../preproc/OptionKey.java#getDefaultValue */
export function optionKeyDefaultValue(key: OptionKey): string | undefined {
  return OPTION_KEY_DEFAULT_VALUE.get(key);
}

/** @see ~/git/plantuml/.../preproc/OptionKey.java#simplify */
function simplify(s: string): string {
  let result = '';
  for (const c of s) if (/[A-Za-z]/u.test(c)) result += c.toLowerCase();

  return result;
}

/**
 * Java `null` (no matching key) -> `undefined`.
 * @see ~/git/plantuml/.../preproc/OptionKey.java#lazyFrom
 */
function lazyFrom(s: string): OptionKey | undefined {
  for (const key of Object.values(OptionKey)) if (simplify(s) === simplify(key)) return key;

  return undefined;
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterOption.java
 */
export class EaterOption extends Eater {
  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!option');
    this.skipSpaces();
    const key = this.eatAndGetVarname();
    this.skipSpaces();
    let value: TValue | undefined;
    try {
      value = this.eatExpression(context, memory);
    } catch (e) {
      // Sorry, not great... (upstream's own comment, preserved verbatim)
      if (!(e instanceof EaterException)) throw e;

      value = undefined;
    }
    this.skipSpaces();
    const optionKey = lazyFrom(key);
    const artifact = context.getPreprocessingArtifact();
    if (optionKey === undefined) {
      artifact.addWarning({ message: [`No such !option ${key}`] });
    } else if (value === undefined && optionKeyDefaultValue(optionKey) === undefined) {
      artifact.addWarning({ message: [`No default value for ${key}`] });
    } else if (value === undefined) {
      artifact.getOption().define(optionKey, optionKeyDefaultValue(optionKey) as string);
    } else {
      artifact.getOption().define(optionKey, value.toString());
    }
  }
}
