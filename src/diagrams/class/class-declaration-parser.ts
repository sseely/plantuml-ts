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
  /** Source keyword for `kind: 'descriptive'` (database/node/…), else absent. */
  usymbol?: string;
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
/**
 * Descriptive-element leaf keywords (upstream `CommandCreateElementFull2`) that
 * render as a plain rect. Used under `allowmixing`; the container form (with a
 * `{` body) is handled by the container command, so only the leaf form reaches
 * here. Mapped to `kind: 'descriptive'` with the keyword kept as `usymbol`.
 */
// Verified against the corpus (database/component/actor leaves + usecase→ellipse).
// The full CommandCreateElementFull2 leaf set is faithful (ADR-4) but broadening
// it collides with `file`/`node`/… used inside `{{…}}` creole bodies and as class
// members, so it is added incrementally as fixtures exercise each keyword.
const DESCRIPTIVE_LEAF_KEYWORDS = 'database|component|actor';
/** `usecase` renders as an ellipse (LeafType.USECASE), not a rect. */
const USECASE_LEAF_KEYWORD = 'usecase';
/** All descriptive leaf keywords the class declaration parser accepts. */
export const ALL_DESCRIPTIVE_LEAF = `${DESCRIPTIVE_LEAF_KEYWORDS}|${USECASE_LEAF_KEYWORD}`;

const DECL_KIND_RE = new RegExp(
  '^(abstract\\s+class|class|interface|enum|annotation|entity|circle|' +
    ALL_DESCRIPTIVE_LEAF +
    ')\\s+(.+)$',
  'i',
);
const DESCRIPTIVE_LEAF_RE = new RegExp(`^(?:${DESCRIPTIVE_LEAF_KEYWORDS})$`, 'i');

/** Map a matched keyword to its ClassifierKind + optional descriptive usymbol. */
function resolveDeclKind(rawKind: string): {
  kind: ClassifierKind;
  usymbol?: string;
} {
  if (rawKind === USECASE_LEAF_KEYWORD) return { kind: 'usecase' };
  if (DESCRIPTIVE_LEAF_RE.test(rawKind))
    return { kind: 'descriptive', usymbol: rawKind };
  if (rawKind === 'abstract class') return { kind: 'abstract' };
  return { kind: rawKind as ClassifierKind };
}

export function parseClassifierDecl(line: string): ClassifierDecl | null {
  const kindMatch = DECL_KIND_RE.exec(line);
  if (kindMatch === null) return null;

  const rawKind = kindMatch[1]!.replace(/\s+/, ' ').toLowerCase();
  const { kind, usymbol } = resolveDeclKind(rawKind);

  const { inlineMembers, opensBody, rest: body } = extractBody(
    kindMatch[2]!.trim(),
  );
  const { rest, stereotype, color } = extractDecorations(body);
  const { id, display, typeParams } = parseIdDisplay(rest);
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
    ...(usymbol !== undefined ? { usymbol } : {}),
  };
}

/** Extract a same-line `{ … }` inline body or a trailing `{` opener. */
function extractBody(rest: string): {
  rest: string;
  inlineMembers: string[];
  opensBody: boolean;
} {
  const inlineBodyMatch = /\{([^}]*)\}\s*$/.exec(rest);
  if (inlineBodyMatch !== null) {
    const bodyContent = inlineBodyMatch[1]!.trim();
    const inlineMembers =
      bodyContent.length > 0
        ? bodyContent.split(';').map((s) => s.trim()).filter((s) => s !== '')
        : [];
    return {
      rest: rest.slice(0, inlineBodyMatch.index).trimEnd(),
      inlineMembers,
      opensBody: false,
    };
  }
  if (rest.endsWith('{'))
    return { rest: rest.slice(0, -1).trimEnd(), inlineMembers: [], opensBody: true };
  return { rest, inlineMembers: [], opensBody: false };
}

/** Strip a `[[url]]`, a `<< stereotype >>`, and a trailing `#color` off a
 *  declaration remainder (the URL link carries no DOT structure). */
function extractDecorations(rest: string): {
  rest: string;
  stereotype: string | undefined;
  color: string | undefined;
} {
  let out = rest.replace(/\s*\[\[[^\]]*\]\]/g, '').trim();
  let stereotype: string | undefined;
  const stereoMatch = /<<\s*(.+?)\s*>>/.exec(out);
  if (stereoMatch !== null) {
    stereotype = stereoMatch[1]!;
    out = (
      out.slice(0, stereoMatch.index) +
      out.slice(stereoMatch.index + stereoMatch[0].length)
    ).trim();
  }
  let color: string | undefined;
  const colorMatch = /(#\w+)$/.exec(out);
  if (colorMatch !== null) {
    color = colorMatch[1]!;
    out = out.slice(0, -colorMatch[0].length).trimEnd();
  }
  return { rest: out, stereotype, color };
}

/** Parse the trailing `id / display [as alias] [<generics>]` of a declaration. */
function parseIdDisplay(rest: string): {
  id: string;
  display: string;
  typeParams: string[];
} {
  const quotedAlias = /^"([^"]+)"\s+as\s+(\S+)$/.exec(rest);
  if (quotedAlias !== null)
    return { display: quotedAlias[1]!, id: quotedAlias[2]!, typeParams: [] };

  const unquotedAlias = /^(\S+)\s+as\s+(\S+)$/.exec(rest);
  if (unquotedAlias !== null)
    return { display: unquotedAlias[1]!, id: unquotedAlias[2]!, typeParams: [] };

  const genericMatch = /^(\w+)<([^>]+)>$/.exec(rest.trim());
  if (genericMatch !== null) {
    const typeParams = genericMatch[2]!
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '');
    return { display: genericMatch[1]!, id: genericMatch[1]!, typeParams };
  }

  return { display: rest.trim(), id: rest.trim(), typeParams: [] };
}
