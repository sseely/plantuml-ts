/**
 * Pure grammar-decoding helpers for the state parser's command bodies —
 * split out of `state-parse-state.ts` (which owns the scope-stack/mutation
 * machinery) purely to stay under the file-size cap; these functions touch
 * no `ParseState`.
 */

import type { Transition } from './ast.js';

/**
 * Extract display name and alias id from a regex match that uses the
 * alternation `(?:'([^']+)'\s+as\s+(\S+)|(\S+))`.
 *
 * When the quoted alternative matches, groups at `quotedDisplayGroup` and
 * `aliasGroup` are defined; when the bare-name alternative matches, the
 * group at `bareNameGroup` is defined. The regex guarantees exactly one
 * alternative matches, so the non-null assertions are safe.
 */
export function extractDisplayAndId(
  match: RegExpExecArray,
  quotedDisplayGroup: number,
  aliasGroup: number,
  bareNameGroup: number,
): { display: string; id: string } {
  const quotedDisplay = match[quotedDisplayGroup];
  if (quotedDisplay !== undefined) {
    return {
      display: quotedDisplay,
      id: match[aliasGroup]!,
    };
  }
  const bare = match[bareNameGroup]!;
  return { display: bare, id: bare };
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
