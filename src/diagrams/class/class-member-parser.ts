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
  if (
    line.startsWith('+') ||
    line.startsWith('-') ||
    line.startsWith('#') ||
    line.startsWith('~')
  ) {
    visibility = line[0] as Visibility;
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
    return {
      visibility,
      name,
      isStatic,
      isAbstract,
      params,
      ...(returnType !== undefined ? { type: returnType } : {}),
    };
  }

  // Attribute form: name: Type  or  name
  const attrMatch = /^(\w+)(?:\s*:\s*(\S+))?$/.exec(line);
  if (attrMatch !== null) {
    const name = attrMatch[1]!;
    const fieldType = attrMatch[2];
    return {
      visibility,
      name,
      isStatic,
      isAbstract,
      ...(fieldType !== undefined ? { type: fieldType } : {}),
    };
  }

  return null;
}
