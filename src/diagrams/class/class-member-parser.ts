/**
 * Member (attribute/method) line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { Member, Visibility } from './ast.js';

// ---------------------------------------------------------------------------
// Member parsing helpers
// ---------------------------------------------------------------------------

/** Attach `visibilityExplicit: true` only when the raw member line carried
 *  an explicit leading visibility char -- omitted (not `false`) otherwise,
 *  mirroring `class-object-commands.ts#withVisibilityFlag`'s EXACT pattern
 *  (kept as a second, class-member-local copy rather than a shared import:
 *  that module's own version returns `Omit<Member, 'visibilityExplicit'>`
 *  input, a signature difference not worth threading a shared helper
 *  through for one field assignment). Vitest's `toEqual` treats a missing
 *  key and an `undefined`-valued key the same, but NOT a missing key and a
 *  `false`-valued key -- pre-existing member-literal equality assertions
 *  written before this field existed keep passing. */
function withVisibilityFlag(member: Omit<Member, 'visibilityExplicit'>, explicit: boolean): Member {
  return explicit ? { ...member, visibilityExplicit: true } : member;
}

/**
 * Parse a raw member string.
 * Returns a Member or null if the string cannot be parsed as a member.
 */
export function parseMemberLine(rawLine: string): Member | null {
  let line = rawLine.trim();
  if (line === '') return null;

  // Strip modifier prefixes: {static} and/or {abstract}
  let isStatic = false;
  let isAbstract = false;
  const modifierRe = /^\{(static|abstract)\}\s*/i;
  let modMatch = modifierRe.exec(line);
  while (modMatch !== null) {
    const mod = modMatch[1]!.toLowerCase();
    if (mod === 'static') isStatic = true;
    if (mod === 'abstract') isAbstract = true;
    line = line.slice(modMatch[0].length);
    modMatch = modifierRe.exec(line);
  }

  // Parse optional visibility character
  let visibility: Visibility = '+';
  // G2 N4: whether a visibility char was ACTUALLY present on the source
  // line, as opposed to `visibility`'s implicit '+' default -- feeds
  // `visibilityExplicit` (`class-layout-helpers.ts`'s icon-reservation
  // gate; jar draws NO visibility icon at all for a member with no
  // explicit char, e.g. `jobuco-44-zife032`'s bare "Bar" field --
  // `plans/g2-class-svg/ledger.md` N4).
  let visibilityExplicit = false;
  if (
    line.startsWith('+') ||
    line.startsWith('-') ||
    line.startsWith('#') ||
    line.startsWith('~')
  ) {
    visibility = line[0] as Visibility;
    visibilityExplicit = true;
    line = line.slice(1).trimStart();
  }

  if (line === '') return null;

  // Detect method vs attribute by presence of parentheses.
  // Method form: name(params): ReturnType  or  name(params)
  const methodMatch = /^(\w+)\(([^)]*)\)(?:\s*:\s*(\S+))?$/.exec(line);
  if (methodMatch !== null) {
    const name = methodMatch[1]!;
    const rawParams = methodMatch[2]!.trim();
    const returnType = methodMatch[3];
    const params =
      rawParams === ''
        ? []
        : rawParams.split(',').map((p) => p.trim()).filter((p) => p !== '');
    return withVisibilityFlag({
      visibility,
      name,
      isStatic,
      isAbstract,
      params,
      ...(returnType !== undefined ? { type: returnType } : {}),
    }, visibilityExplicit);
  }

  // Attribute form: name: Type  or  name
  const attrMatch = /^(\w+)(?:\s*:\s*(\S+))?$/.exec(line);
  if (attrMatch !== null) {
    const name = attrMatch[1]!;
    const fieldType = attrMatch[2];
    return withVisibilityFlag({
      visibility,
      name,
      isStatic,
      isAbstract,
      ...(fieldType !== undefined ? { type: fieldType } : {}),
    }, visibilityExplicit);
  }

  return null;
}
