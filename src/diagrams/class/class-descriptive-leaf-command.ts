/**
 * Descriptive-element leaf declaration command (`database X`, `mix_actor Y`).
 *
 * Split out of class-commands.ts purely to keep that file under the repo's
 * 500-line-per-file cap (mirrors class-object-commands.ts / class-map-
 * commands.ts's own "split out of a capped file, behavior unchanged"
 * precedent) — pure move, no behavior change. Was rule 9 in class-commands.ts's
 * numbering: AFTER the member rule so a class NAMED like a keyword with
 * members is a member line, not a descriptive element. Only the leaf form
 * reaches here (no container `{`). `mix_` prefix = CommandCreateElementFull2's
 * unconditional Mode.WITH_MIX_PREFIX registration (no allowmixing gate).
 *
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateElementFull2.java
 */

import {
  applyClassifierDecl,
  parseClassifierDecl,
} from './class-declaration-parser.js';
import { ALL_DESCRIPTIVE_LEAF } from './class-descriptive-leaf-keywords.js';
import type { ParseState } from './parser.js';

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

export const DESCRIPTIVE_LEAF_COMMANDS: readonly Command[] = [
  {
    pattern: new RegExp('^(?:mix_)?(?:' + ALL_DESCRIPTIVE_LEAF + ')\\s+\\S', 'i'),
    execute(state, match) {
      const decl = parseClassifierDecl(match.input);
      if (decl !== null) applyClassifierDecl(state, decl, false);
    },
  },
];
