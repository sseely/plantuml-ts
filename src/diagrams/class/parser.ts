/**
 * Parser for PlantUML class diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type {
  ClassDiagramAST,
  Classifier,
  ClassifierKind,
  Member,
  Relationship,
  RelationshipType,
  Visibility,
} from './ast.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseClass call)
// ---------------------------------------------------------------------------

interface ParseState {
  ast: ClassDiagramAST;
  /** Map from classifier id to its index in ast.classifiers. */
  classifierIndex: Map<string, number>;
  /**
   * When non-null we are inside an open brace body for this classifier id.
   * Lines are parsed as member definitions until `}` closes it.
   */
  pendingBodyId: string | null;
  /**
   * When non-null we are inside a namespace block.
   * New classifiers get this namespace assigned.
   */
  activeNamespace: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultAST(): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
  };
}

/** Ensure a classifier exists with the given id; create if absent. */
function ensureClassifier(
  state: ParseState,
  id: string,
  kind: ClassifierKind = 'class',
  display?: string,
): Classifier {
  const existing = state.classifierIndex.get(id);
  if (existing !== undefined) {
    return state.ast.classifiers[existing]!;
  }
  const classifier: Classifier = {
    id,
    display: display ?? id,
    kind,
    typeParams: [],
    members: [],
    ...(state.activeNamespace !== null
      ? { namespace: state.activeNamespace }
      : {}),
  };
  const idx = state.ast.classifiers.length;
  state.ast.classifiers.push(classifier);
  state.classifierIndex.set(id, idx);

  // Register with active namespace if present
  if (state.activeNamespace !== null) {
    const ns = state.ast.namespaces.find(
      (n) => n.id === state.activeNamespace,
    );
    if (ns !== undefined) {
      ns.classifiers.push(id);
    }
  }

  return classifier;
}

// ---------------------------------------------------------------------------
// Member parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a raw member string.
 * Returns a Member or null if the string cannot be parsed as a member.
 */
function parseMemberLine(rawLine: string): Member | null {
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

// ---------------------------------------------------------------------------
// Relationship arrow parsing
// ---------------------------------------------------------------------------

/**
 * Direction and type info for a parsed arrow.
 * `swapDirection = true` means the left operand is semantically `to`
 * and the right operand is `from` (i.e. the arrow points left).
 */
interface ArrowInfo {
  type: RelationshipType;
  swapDirection: boolean;
}

/**
 * Attempt to parse a relationship line.
 * Returns null if the line does not match any known arrow pattern.
 *
 * Recognised arrow tokens (both left- and right-pointing):
 *   <|--  <|..  *--  o--  -->  ..>  ..
 *   --|>  ..|>  --*  --o  -->  ..>  ..
 *
 * Regex groups:
 *   1: left identifier (unquoted word or "quoted")
 *   2: optional left multiplicity (quoted)
 *   3: the arrow token  (longest alternative wins — order matters)
 *   4: optional right multiplicity (quoted)
 *   5: right identifier
 *   6: optional label after ':'
 */
const REL_RE =
  /^(\w+|"[^"]+")\s*(?:"([^"]*)")?\s*(<\|--|<\|\.\.|--\|>|\.\.\|>|--\*|--o|\*--|o--|-->|\.\.>|\.\.)\s*(?:"([^"]*)")?\s*(\w+|"[^"]+")\s*(?::\s*(.+))?$/;

function parseRelationshipLine(line: string): Relationship | null {
  const m = REL_RE.exec(line);
  if (m === null) return null;

  const leftId = stripQuotes(m[1]!);
  const leftMult = m[2];
  const arrow = m[3]!;
  const rightMult = m[4];
  const rightId = stripQuotes(m[5]!);
  const label = m[6]?.trim();

  const info = resolveArrow(arrow);
  if (info === null) return null;

  // swapDirection = true: arrow points left → left is "to", right is "from"
  const from = info.swapDirection ? rightId : leftId;
  const to = info.swapDirection ? leftId : rightId;
  const fromMult = info.swapDirection ? rightMult : leftMult;
  const toMult = info.swapDirection ? leftMult : rightMult;

  return {
    from,
    to,
    type: info.type,
    ...(fromMult !== undefined ? { fromMultiplicity: fromMult } : {}),
    ...(toMult !== undefined ? { toMultiplicity: toMult } : {}),
    ...(label !== undefined && label !== '' ? { label } : {}),
  };
}

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Map a raw arrow token to semantic type and direction.
 * Left-pointing arrows have swapDirection=true (left side = "to").
 * Right-pointing and neutral arrows have swapDirection=false.
 */
function resolveArrow(arrow: string): ArrowInfo | null {
  switch (arrow) {
    // Left-pointing: right side is the "from", left side is the "to"
    case '<|--': return { type: 'extension',      swapDirection: true };
    case '<|..': return { type: 'implementation', swapDirection: true };
    // Right-pointing: left side is "from", right side is "to"
    case '--|>': return { type: 'extension',      swapDirection: false };
    case '..|>': return { type: 'implementation', swapDirection: false };
    case '--*':  return { type: 'composition',    swapDirection: false };
    case '--o':  return { type: 'aggregation',    swapDirection: false };
    // *-- / o--: left side is the "whole" (from), right is part (to)
    case '*--':  return { type: 'composition',    swapDirection: false };
    case 'o--':  return { type: 'aggregation',    swapDirection: false };
    case '-->':  return { type: 'association',    swapDirection: false };
    case '..>':  return { type: 'dependency',     swapDirection: false };
    case '..':   return { type: 'usage',          swapDirection: false };
    default:     return null;
  }
}

// ---------------------------------------------------------------------------
// Classifier declaration parser
// ---------------------------------------------------------------------------

interface ClassifierDecl {
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
function parseClassifierDecl(line: string): ClassifierDecl | null {
  const kindMatch =
    /^(abstract\s+class|class|interface|enum|annotation)\s+(.+)$/i.exec(line);
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

// ---------------------------------------------------------------------------
// Command dispatch table
// ---------------------------------------------------------------------------

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

/**
 * Order matters: patterns are tested top-to-bottom; first match wins.
 */
const COMMANDS: readonly Command[] = [
  // 1. Ignore: comments starting with '
  {
    pattern: /^'/,
    execute() { /* no-op */ },
  },

  // 2. Ignore: skinparam, hide, show, title lines
  {
    pattern: /^(skinparam|hide\s|show\s|title\s)/i,
    execute() { /* no-op */ },
  },

  // 3. Closing brace — ends a pending body or namespace block
  {
    pattern: /^\}\s*$/,
    execute(state) {
      if (state.pendingBodyId !== null) {
        state.pendingBodyId = null;
      } else if (state.activeNamespace !== null) {
        state.activeNamespace = null;
      }
    },
  },

  // 4. Namespace block: namespace com.example {
  {
    pattern: /^namespace\s+(\S+)\s*\{?\s*$/i,
    execute(state, match) {
      const nsId = match[1]!;
      state.activeNamespace = nsId;
      const existing = state.ast.namespaces.find((n) => n.id === nsId);
      if (existing === undefined) {
        state.ast.namespaces.push({
          id: nsId,
          display: nsId,
          classifiers: [],
        });
      }
    },
  },

  // 5. Classifier declarations.
  //    Must come before relationship detection because "class Foo {" could
  //    otherwise partially match arrow patterns.
  {
    pattern: /^(?:abstract\s+class|class|interface|enum|annotation)\s+/i,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const decl = parseClassifierDecl(match.input);
      if (decl === null) return;

      const classifier = ensureClassifier(
        state,
        decl.id,
        decl.kind,
        decl.display,
      );
      classifier.kind = decl.kind;
      if (decl.typeParams.length > 0) {
        classifier.typeParams = decl.typeParams;
      }
      if (decl.stereotype !== undefined) {
        classifier.stereotype = decl.stereotype;
      }
      if (decl.color !== undefined) {
        classifier.color = decl.color;
      }

      // Handle inline members from single-line body: class Foo { +bar() }
      for (const memberStr of decl.inlineMembers) {
        const member = parseMemberLine(memberStr);
        if (member !== null) {
          classifier.members.push(member);
        }
      }

      if (decl.opensBody) {
        state.pendingBodyId = decl.id;
      }
    },
  },

  // 6. Standalone member: ClassName : +member
  //    Must come before relationship detection to avoid colon ambiguity.
  {
    pattern: /^(\w+)\s*:\s*(.+)$/,
    execute(state, match) {
      const classId = match[1]!;
      const memberStr = match[2]!.trim();
      const classifier = ensureClassifier(state, classId);
      const member = parseMemberLine(memberStr);
      if (member !== null) {
        classifier.members.push(member);
      }
    },
  },

  // 7. Relationship lines.
  //    The dispatch pattern mirrors REL_RE's arrow alternatives so that
  //    only genuine relationship lines reach parseRelationshipLine.
  {
    pattern:
      /^(?:\w+|"[^"]+")\s*(?:"[^"]*")?\s*(?:<\|--|<\|\.\.|--\|>|\.\.\|>|--\*|--o|\*--|o--|-->|\.\.>|\.\.)\s*(?:"[^"]*")?\s*(?:\w+|"[^"]+")(?:\s*:\s*.+)?$/,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const rel = parseRelationshipLine(match.input);
      if (rel !== null) {
        ensureClassifier(state, rel.from);
        ensureClassifier(state, rel.to);
        state.ast.relationships.push(rel);
      }
    },
  },
];

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a preprocessed PlantUML class diagram block into an AST.
 */
export function parseClass(block: UmlSource): ClassDiagramAST {
  const state: ParseState = {
    ast: makeDefaultAST(),
    classifierIndex: new Map(),
    pendingBodyId: null,
    activeNamespace: null,
  };

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    // If we are inside a multi-line body, treat lines as member defs
    if (state.pendingBodyId !== null) {
      if (/^\}\s*$/.test(line)) {
        state.pendingBodyId = null;
        continue;
      }
      const idx = state.classifierIndex.get(state.pendingBodyId);
      if (idx !== undefined) {
        const classifier = state.ast.classifiers[idx];
        if (classifier !== undefined) {
          const member = parseMemberLine(line);
          if (member !== null) {
            classifier.members.push(member);
          }
        }
      }
      continue;
    }

    // Normal command dispatch
    for (const cmd of COMMANDS) {
      const match = cmd.pattern.exec(line);
      if (match !== null) {
        cmd.execute(state, match);
        break;
      }
    }
  }

  return state.ast;
}
