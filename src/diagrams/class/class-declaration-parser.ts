/**
 * Classifier declaration line parsing for PlantUML class diagrams.
 *
 * Extracted from parser.ts (pure move, no behavior change) to keep
 * parser.ts under the repo's 500-line-per-file cap.
 */

import type { ClassifierKind, RelationshipType } from './ast.js';

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
  /** Parent ids from `extends A, B` (comma-separated; upstream CODES). */
  extendsIds: string[];
  /** Parent ids from `implements A, B` (comma-separated; upstream CODES). */
  implementsIds: string[];
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
const DESCRIPTIVE_LEAF_KEYWORDS = 'database|component|actor|rectangle';
/** `usecase` renders as an ellipse (LeafType.USECASE), not a rect. */
const USECASE_LEAF_KEYWORD = 'usecase';
/** All descriptive leaf keywords the class declaration parser accepts. */
export const ALL_DESCRIPTIVE_LEAF = `${DESCRIPTIVE_LEAF_KEYWORDS}|${USECASE_LEAF_KEYWORD}`;

const DECL_KIND_RE = new RegExp(
  // `abstract\s+class` must precede the bare `abstract` alternative — JS
  // regex alternation is leftmost-first, so `abstract class Foo` must try
  // (and succeed at) the two-word form before the bare keyword is offered.
  '^(abstract\\s+class|abstract|class|interface|enum|annotation|entity|circle|' +
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
  // EXTENDS/IMPLEMENTS sit to the right of COLOR/LINECOLOR in the grammar
  // (CommandCreateClass.java:99-108), so they must be stripped first — color
  // extraction is anchored to the current end of the remainder.
  const { rest: afterInheritance, extendsIds, implementsIds } =
    extractInheritance(body);
  const { rest, stereotype, color } = extractDecorations(afterInheritance);
  const { id, display, typeParams } = parseIdDisplay(rest);
  if (id === '' || display === '') return null;

  return {
    id,
    display,
    kind,
    typeParams,
    opensBody,
    inlineMembers,
    extendsIds,
    implementsIds,
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

/**
 * Trailing background/border-color spec on a classifier declaration: either a
 * bare `#colorname` or a compound `#part:color;part2;...` form built from the
 * `text|back|header|line|line.dashed|line.dotted|line.bold|shadowing`
 * keywords (each with an optional `:color`, `;`-separated) — e.g.
 * `#line:red;line.bold;text:red`. A `-`/`\`/`|`/`/` separator inside a color
 * name is PlantUML's two-color gradient syntax. This is `ColorParser`'s
 * `simpleColor(ColorType.BACK)` COLOR group — it never matches a doubled
 * `##`, which is the separate LINECOLOR group below.
 * @see ~/git/plantuml/.../klimt/color/ColorParser.java:43-46 (COLOR_REGEXP, PART2)
 */
const COLOR_RE = new RegExp(
  String.raw`(?:#(?:\w+[-\\|/]?\w+;)?(?:(?:text|back|header|line|line\.dashed|line\.dotted|line\.bold|shadowing)(?::\w+[-\\|/]?\w+)?(?:;|(?![\w;:.])))+|#\w+[-\\|/]?\w+)$`,
);

/**
 * Trailing `##[dotted|dashed|bold]colorname` line-color spec — a SEPARATE
 * optional grammar group from COLOR above, to its right (COLOR is checked
 * first, then LINECOLOR, then EXTENDS, then IMPLEMENTS — so callers must
 * strip LINECOLOR before COLOR when working back-to-front from the end of
 * the declaration).
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:99-102
 */
const LINECOLOR_RE = /##(?:\[(?:dotted|dashed|bold)\])?\w*$/;

/** Strip a `[[url]]`, a `<< stereotype >>`, and a trailing color spec (either
 *  or both of the `##linecolor` / `#color` forms) off a declaration
 *  remainder (the URL link carries no DOT structure). Must run on a
 *  remainder that has already had its trailing extends/implements clause
 *  removed (see {@link extractInheritance}) — those sit to the right of the
 *  color spec in the grammar. */
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
  const lineColorMatch = LINECOLOR_RE.exec(out);
  if (lineColorMatch !== null) {
    color = lineColorMatch[0];
    out = out.slice(0, -lineColorMatch[0].length).trimEnd();
  }
  const colorMatch = COLOR_RE.exec(out);
  if (colorMatch !== null) {
    color = color === undefined ? colorMatch[0] : `${colorMatch[0]} ${color}`;
    out = out.slice(0, -colorMatch[0].length).trimEnd();
  }
  return { rest: out, stereotype, color };
}

/**
 * A parent code: an optional namespace-separator-joined chain of
 * word/`$`/digit segments (mirrors upstream CODE — `Instruction$Visitor`,
 * `a.b.C` — CommandLinkClass.getSeparator() + `[%pLN_$]+` repeated).
 */
const INHERITANCE_CODE = String.raw`[\w$]+(?:(?:\.|::)[\w$]+)*`;
/** Comma-separated parent codes (upstream CommandCreateClassMultilines.CODES). */
const INHERITANCE_CODES = `${INHERITANCE_CODE}(?:\\s*,\\s*${INHERITANCE_CODE})*`;

/**
 * Match a trailing ` extends <codes>` / ` implements <codes>` clause, where
 * `<codes>` is either the comma-separated CODES list or a single quoted name.
 * `raw` is capture group 1 (unquoted CODES) or group 2 (quoted, unsplit).
 */
function buildInheritanceRe(keyword: 'extends' | 'implements'): RegExp {
  return new RegExp(
    `\\s+${keyword}\\s+(?:(${INHERITANCE_CODES})|"([^"]+)")\\s*$`,
    'i',
  );
}
const EXTENDS_RE = buildInheritanceRe('extends');
const IMPLEMENTS_RE = buildInheritanceRe('implements');

function splitCodes(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * Strip a trailing `extends <codes>` and/or `implements <codes>` clause off a
 * declaration remainder, leaving the plain `id [as alias]` for
 * {@link parseIdDisplay}. IMPLEMENTS is stripped first — it is the rightmost
 * clause in the source order (`... extends A implements B`), so removing it
 * first exposes the EXTENDS clause at the new end of the string.
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClass.java:103-108
 */
function extractInheritance(rest: string): {
  rest: string;
  extendsIds: string[];
  implementsIds: string[];
} {
  let out = rest;
  let implementsIds: string[] = [];
  let extendsIds: string[] = [];

  const implementsMatch = IMPLEMENTS_RE.exec(out);
  if (implementsMatch !== null) {
    implementsIds = splitCodes(implementsMatch[2] ?? implementsMatch[1]!);
    out = out.slice(0, implementsMatch.index).trimEnd();
  }
  const extendsMatch = EXTENDS_RE.exec(out);
  if (extendsMatch !== null) {
    extendsIds = splitCodes(extendsMatch[2] ?? extendsMatch[1]!);
    out = out.slice(0, extendsMatch.index).trimEnd();
  }
  return { rest: out, extendsIds, implementsIds };
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

  // A bare quoted name (`rectangle "foo3"`): the quotes are display syntax, not
  // part of the id — stripping them keeps the id clean for namespace qualification.
  const quoted = /^"([^"]+)"$/.exec(rest.trim());
  if (quoted !== null)
    return { display: quoted[1]!, id: quoted[1]!, typeParams: [] };

  return { display: rest.trim(), id: rest.trim(), typeParams: [] };
}

/** A resolved `extends`/`implements` parent: the id to create (if missing) and
 *  the relationship to link it with, back to the classifier under construction. */
export interface InheritanceParent {
  id: string;
  kind: ClassifierKind;
  relType: RelationshipType;
}

/**
 * Resolve a declaration's `extends`/`implements` clauses into the parent
 * classifiers to create-or-reuse plus the relationship type linking each back
 * to the child. Mirrors `CommandCreateClassMultilines#manageExtends`: EXTENDS
 * forces the parent to `class` unless the child is itself an `interface` (an
 * interface can only extend another interface), in which case the parent
 * follows as `interface` too — both cases render a solid triangle
 * ('extension'). IMPLEMENTS always forces the parent to `interface`; the
 * triangle is dashed ('implementation') unless the child is itself an
 * `interface` (interface-implements-interface renders solid, like EXTENDS).
 * @see ~/git/plantuml/.../classdiagram/command/CommandCreateClassMultilines.java:333-365
 */
export function resolveInheritance(
  childKind: ClassifierKind,
  extendsIds: readonly string[],
  implementsIds: readonly string[],
): InheritanceParent[] {
  const parents: InheritanceParent[] = [];
  for (const id of extendsIds) {
    const kind: ClassifierKind = childKind === 'interface' ? 'interface' : 'class';
    parents.push({ id, kind, relType: 'extension' });
  }
  for (const id of implementsIds) {
    const dashed = childKind !== 'interface';
    parents.push({ id, kind: 'interface', relType: dashed ? 'implementation' : 'extension' });
  }
  return parents;
}
