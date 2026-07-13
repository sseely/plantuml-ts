/**
 * `!theme <name>` (optionally `from <path>`).
 *
 * Scope note: upstream's `getTheme()` performs the actual theme LOAD --
 * `ThemeUtils.loadTheme(pathSystem, realName, from, ...)`, which needs
 * `net.sourceforge.plantuml.theme.{Theme, ThemeUtils}` and
 * `net.sourceforge.plantuml.nio.PathSystem` (a real file-system
 * abstraction, none of which exist anywhere in this codebase). That whole
 * loading mechanism is NOT part of `tim/` upstream and is out of scope for
 * this mission -- theme resolution in this port already happens via
 * `themes-builtin.ts` / `style-map-theme.ts`, a different, pre-existing
 * mechanism entirely. Only the pure text-parsing half of `EaterTheme`
 * (extracting `name` and the optional `from` clause, applying
 * functions/variables to each) is ported here; `getTheme()` itself is
 * omitted. A future batch wiring `!theme` into the preprocessor rewrite
 * should read `getName()` / `getRealName()` / `getFrom()` here and resolve
 * the theme via the EXISTING `themes-builtin.ts` mechanism, not by
 * porting `Theme`/`ThemeUtils`/`PathSystem`.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterTheme.java
 */

import { Eater } from './Eater.js';
import { StringLocated } from './StringLocated.js';
import type { TContext } from './TFunction.js';
import type { TMemory } from './TMemory.js';

const FROM_MARKER = ' from ';

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/EaterTheme.java
 */
export class EaterTheme extends Eater {
  private realName = '';
  private name = '';
  private from: string | undefined;

  constructor(s: StringLocated) {
    super(s);
  }

  /** @throws EaterException (thrown, not returned) on a malformed directive. */
  analyze(context: TContext, memory: TMemory): void {
    this.skipSpaces();
    this.checkAndEatChar('!theme');
    this.skipSpaces();
    this.name = this.eatAllToEnd();

    const x = this.name.toLowerCase().indexOf(FROM_MARKER);
    if (x !== -1) {
      const fromTmp = this.name.slice(x + FROM_MARKER.length).trim();
      this.from = context.applyFunctionsAndVariables(memory, new StringLocated(fromTmp, this.getLineLocation()));
      this.name = this.name.slice(0, x).trim();
    }

    this.realName = context.applyFunctionsAndVariables(memory, new StringLocated(this.name, this.getLineLocation()));
  }

  getName(): string {
    return this.name;
  }

  getRealName(): string {
    return this.realName;
  }

  getFrom(): string | undefined {
    return this.from;
  }
}
