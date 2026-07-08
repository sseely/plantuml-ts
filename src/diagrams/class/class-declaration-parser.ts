/**
 * Classifier declaration line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { ClassifierKind } from './ast.js';

// ---------------------------------------------------------------------------
// Classifier declaration parser
// ---------------------------------------------------------------------------

export interface ClassifierDecl {
  id: string;
  display: string;
  kind: ClassifierKind;
  typeParams: string[];
  stereotype?: string;
  color?: string;
  /**
   * True if the line ended with `{` with no inline closing `}`.
   * Indicates that subsequent lines until `}` are member definitions.
   */
  opensBody: boolean;
  /** Members found on the same line as the brace: class Foo { +bar(): int } */
  inlineMembers: string[];
}

/**
 * Parse a classifier declaration line.
 *
 * Handles:
 *   class Foo
 *   abstract class Base
 *   interface IFoo<T, U>
 *   enum Color
 *   annotation MyAnnotation
 *   class "My Class" as MC
 *   class Foo << Stereotype >>
 *   class Foo #pink
 *   class Foo {
 *   class Foo { +bar(): String }    <- inline single-line body
 */
export function parseClassifierDecl(line: string): ClassifierDecl | null {
  const kindMatch =
    /^(abstract\s+class|class|interface|enum|annotation|entity|circle)\s+(.+)$/i.exec(
      line,
    );
  if (kindMatch === null) return null;

  const rawKind = kindMatch[1]!.replace(/\s+/, ' ').toLowerCase();
  const kind: ClassifierKind =
    rawKind === 'abstract class' ? 'abstract' : (rawKind as ClassifierKind);

  let rest = kindMatch[2]!.trim();

  // Detect and extract inline body: "{ ... }" on the same line.
  let inlineMembers: string[] = [];
  let opensBody = false;

  const inlineBodyMatch = /\{([^}]*)\}\s*$/.exec(rest);
  if (inlineBodyMatch !== null) {
    // Single-line body: class Foo { +bar(): String }
    const bodyContent = inlineBodyMatch[1]!.trim();
    if (bodyContent.length > 0) {
      inlineMembers = bodyContent
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    }
    rest = rest.slice(0, inlineBodyMatch.index).trimEnd();
  } else if (rest.endsWith('{')) {
    // Opening brace with no closing brace: class Foo {
    opensBody = true;
    rest = rest.slice(0, -1).trimEnd();
  }

  // Extract stereotype: << Stereotype >>
  let stereotype: string | undefined;
  const stereoMatch = /<<\s*(.+?)\s*>>/.exec(rest);
  if (stereoMatch !== null) {
    stereotype = stereoMatch[1]!;
    rest =
      rest.slice(0, stereoMatch.index) +
      rest.slice(stereoMatch.index + stereoMatch[0].length);
    rest = rest.trim();
  }

  // Extract color: #colorname or #RRGGBB
  let color: string | undefined;
  const colorMatch = /(#\w+)$/.exec(rest);
  if (colorMatch !== null) {
    color = colorMatch[1]!;
    rest = rest.slice(0, -colorMatch[0].length).trimEnd();
  }

  // Parse id / display and extract generic type params.
  let id: string;
  let display: string;
  let typeParams: string[] = [];

  const quotedAlias = /^"([^"]+)"\s+as\s+(\S+)$/.exec(rest);
  if (quotedAlias !== null) {
    display = quotedAlias[1]!;
    id = quotedAlias[2]!;
  } else {
    const unquotedAlias = /^(\S+)\s+as\s+(\S+)$/.exec(rest);
    if (unquotedAlias !== null) {
      display = unquotedAlias[1]!;
      id = unquotedAlias[2]!;
    } else {
      // May contain generic params: Foo<T, U>
      const genericMatch = /^(\w+)<([^>]+)>$/.exec(rest.trim());
      if (genericMatch !== null) {
        display = genericMatch[1]!;
        id = display;
        typeParams = genericMatch[2]!
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p !== '');
      } else {
        display = rest.trim();
        id = display;
      }
    }
  }

  if (id === '' || display === '') return null;

  return {
    id,
    display,
    kind,
    typeParams,
    opensBody,
    inlineMembers,
    ...(stereotype !== undefined ? { stereotype } : {}),
    ...(color !== undefined ? { color } : {}),
  };
}
