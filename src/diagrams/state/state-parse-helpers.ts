/**
 * Pure grammar-decoding helpers for the state parser's command bodies —
 * split out of `state-parse-state.ts` (which owns the scope-stack/mutation
 * machinery) purely to stay under the file-size cap; these functions touch
 * no `ParseState`.
 */

import type { Transition } from './ast.js';

/**
 * Extract display name and id from a regex match built from `ID_ALT`
 * (`state-commands-declarations.ts`) — the 4-group alternation mirroring
 * `CommandCreateState`'s CODE1-4/DISPLAY1-2 grammar: `id as "quoted"`,
 * `"quoted" as id`, bare `id` alone, or bare `"quoted"` alone.
 *
 * Exactly one of `bareIdGroup`/`quotedGroup` is ever defined (the two
 * top-level alternatives are mutually exclusive by leading character); each
 * side's own trailing `as` clause is independently optional, so the
 * matching side's OTHER group may or may not be defined too:
 *   - `bareIdGroup` defined, `bareIdDisplayGroup` defined  → `id as "disp"`
 *   - `bareIdGroup` defined, `bareIdDisplayGroup` undefined → bare `id` alone
 *     (display defaults to the id itself, mirroring upstream's
 *     `quark.getName()` fallback when `DISPLAY` is null)
 *   - `quotedGroup` defined, `quotedIdGroup` defined  → `"disp" as id`
 *   - `quotedGroup` defined, `quotedIdGroup` undefined → bare `"text"` alone
 *     (the quoted text becomes BOTH the id and the display — same
 *     `quark.getName()` fallback, applied to the quoted text as CODE)
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:84-98 (CODE1-4/DISPLAY1-2)
 * @see ~/git/plantuml/.../statediagram/command/CommandCreateState.java:176-182 (idShort/display resolution)
 */
export function extractDisplayAndId(
  match: RegExpExecArray,
  bareIdGroup: number,
  bareIdDisplayGroup: number,
  quotedGroup: number,
  quotedIdGroup: number,
): { display: string; id: string } {
  const bareId = match[bareIdGroup];
  if (bareId !== undefined) {
    const display = match[bareIdDisplayGroup];
    return { display: display ?? bareId, id: bareId };
  }
  const quoted = match[quotedGroup]!;
  const quotedId = match[quotedIdGroup];
  return { display: quoted, id: quotedId ?? quoted };
}

/**
 * Parse a transition label into guard / action / label fields.
 *
 * Formats:
 *   [guard] / action   → guard + action (label = raw text)
 *   [guard]            → guard only
 *   / action           → action only
 *   anything else      → label only
 */
export function parseLabel(raw: string): Pick<Transition, 'guard' | 'action' | 'label'> {
  const trimmed = raw.trim();
  if (trimmed === '') return {};

  // Try to extract [guard] at the start.
  const guardMatch = /^\[([^\]]*)\](.*)$/.exec(trimmed);
  if (guardMatch !== null) {
    const guard = guardMatch[1]!.trim();
    const rest = guardMatch[2]!.trim();
    // After guard, optional "/ action"
    const actionMatch = /^\/\s*(.*)$/.exec(rest);
    if (actionMatch !== null) {
      const action = actionMatch[1]!.trim();
      return {
        guard: guard !== '' ? guard : undefined,
        action: action !== '' ? action : undefined,
        label: trimmed,
      } as Pick<Transition, 'guard' | 'action' | 'label'>;
    }
    // Guard only — carry rest as label when non-empty.
    return {
      ...(guard !== '' ? { guard } : {}),
      ...(rest !== '' ? { label: trimmed } : {}),
    };
  }

  // Try "/ action" with no guard.
  const bareAction = /^\/\s*(.+)$/.exec(trimmed);
  if (bareAction !== null) {
    const action = bareAction[1]!.trim();
    return { action, label: trimmed };
  }

  // Plain label.
  return { label: trimmed };
}
