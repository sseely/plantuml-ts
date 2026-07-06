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
  HideShowDirective,
  HideTarget,
  Member,
  NotePosition,
  Relationship,
  RelationshipType,
  Visibility,
} from './ast.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseClass call)
// ---------------------------------------------------------------------------

/**
 * A note block being accumulated until `end note`. Two shapes:
 *  - `attached`: `note <pos> of <Entity>` — has a host + position.
 *  - `freestanding`: `note as <alias>` — no host; the alias becomes the
 *    note's id so later relationship lines (e.g. `alias .> Something`) can
 *    reference it.
 */
type PendingNote =
  | { kind: 'attached'; target: string; position: NotePosition; textLines: string[] }
  | { kind: 'freestanding'; alias: string; textLines: string[] };

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
  /**
   * When non-null we are inside a multi-line note block (attached or
   * freestanding). Lines accumulate as note text until `end note`.
   */
  pendingNote: PendingNote | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultAST(): ClassDiagramAST {
  return {
    classifiers: [],
    relationships: [],
    namespaces: [],
    directives: [],
    notes: [],
  };
}

/** Append an attached (`note <pos> of <Entity>`) note with a generated layout id. */
function addNote(
  state: ParseState,
  position: NotePosition,
  target: string,
  text: string,
): void {
  state.ast.notes.push({
    id: `__note_${state.ast.notes.length}`,
    target: stripQuotes(target),
    position,
    text,
  });
}

/**
 * Append a freestanding (`note as <alias>`) note. Its id is the
 * user-declared alias — not the `__note_N` scheme used for attached notes —
 * so a later relationship line can resolve `alias` back to this note
 * instead of accidentally creating a phantom classifier for it.
 */
function addFreestandingNote(state: ParseState, alias: string, text: string): void {
  state.ast.notes.push({
    id: stripQuotes(alias),
    text,
  });
}

/** Close out the current pendingNote block (attached or freestanding). */
function finalizePendingNote(state: ParseState, note: PendingNote): void {
  const text = note.textLines.join('\n');
  if (note.kind === 'attached') {
    addNote(state, note.position, note.target, text);
  } else {
    addFreestandingNote(state, note.alias, text);
  }
}

/** True if `id` refers to an already-parsed note (attached or freestanding). */
function isNoteId(state: ParseState, id: string): boolean {
  return state.ast.notes.some((n) => n.id === id);
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
 * Recognised arrow tokens, longest-alternative-first within each prefix
 * family so the alternation naturally prefers the more specific token
 * (`<|--` over `<--`, `...>` over `..>` over `.>` over `..`, etc.).
 *
 * Regex groups produced by REL_RE:
 *   1: left identifier (may include `.ns` segments and a `::port` suffix)
 *   2: optional left qualifier (`[Qualifier]`)
 *   3: optional left multiplicity (quoted)
 *   4: the arrow token
 *   5: optional right multiplicity (quoted)
 *   6: optional right qualifier (`[Qualifier]`)
 *   7: right identifier
 *   8: optional label after ':'
 */
const CLASS_ID = String.raw`\w+(?:\.\w+)*(?:::\w+)?|"[^"]+"`;
// Arrow BODY length is arbitrary in upstream PlantUML (any run of `-`
// or `.` characters — see CommandLinkClass's `ARROW_BODY` = `[-=.]+`);
// body length never changes the relationship TYPE, only decor chars do.
// So each alternative below allows a repeated body (`-+` / `\.+`) and
// resolveArrow() canonicalises any run down to a single body char before
// the ARROW_INFO lookup, rather than enumerating every body length.
const REL_ARROW = String.raw`<\|-+|<-+|<\|\.+|<\.+|-+\|>|\.+\|>|-+\*|-+o|\*-+|o-+|-+>|\.+>|\.+|-+`;

const REL_RE = new RegExp(
  String.raw`^(${CLASS_ID})` +
    String.raw`\s*(?:\[([^[\]]+)\])?` +
    String.raw`\s*(?:"([^"]*)")?` +
    String.raw`\s*(${REL_ARROW})` +
    String.raw`\s*(?:"([^"]*)")?` +
    String.raw`\s*(?:\[([^[\]]+)\])?` +
    String.raw`\s*(${CLASS_ID})` +
    String.raw`\s*(?::\s*(.+))?$`,
);

/**
 * Non-capturing dispatch-only variant of REL_RE, used by the COMMANDS table
 * to decide whether a line is a relationship line before running the full
 * (capturing) parseRelationshipLine.
 */
const REL_DISPATCH_RE = new RegExp(
  String.raw`^(?:${CLASS_ID})` +
    String.raw`\s*(?:\[[^[\]]+\])?` +
    String.raw`\s*(?:"[^"]*")?` +
    String.raw`\s*(?:${REL_ARROW})` +
    String.raw`\s*(?:"[^"]*")?` +
    String.raw`\s*(?:\[[^[\]]+\])?` +
    String.raw`\s*(?:${CLASS_ID})` +
    String.raw`(?:\s*:\s*.+)?$`,
);

/** A classifier id with an optional `::port` member-name suffix split off. */
function splitEndpointPort(raw: string): { id: string; port?: string } {
  if (raw.startsWith('"')) return { id: stripQuotes(raw) };
  const sepIdx = raw.indexOf('::');
  if (sepIdx === -1) return { id: raw };
  return { id: raw.slice(0, sepIdx), port: raw.slice(sepIdx + 2) };
}

/** Resolve a (from, to) pair given whether the arrow points left. */
function pickDirectional<T>(
  swapDirection: boolean,
  leftVal: T,
  rightVal: T,
): { from: T; to: T } {
  return swapDirection ? { from: rightVal, to: leftVal } : { from: leftVal, to: rightVal };
}

/** Assemble a Relationship, omitting undefined/empty optional fields. */
function withOptionalFields(
  base: Pick<Relationship, 'from' | 'to' | 'type'>,
  optional: {
    fromMultiplicity?: string | undefined;
    toMultiplicity?: string | undefined;
    label?: string | undefined;
    fromPort?: string | undefined;
    toPort?: string | undefined;
    qualifier?: string | undefined;
  },
): Relationship {
  const rel: Relationship = { ...base };
  if (optional.fromMultiplicity !== undefined) rel.fromMultiplicity = optional.fromMultiplicity;
  if (optional.toMultiplicity !== undefined) rel.toMultiplicity = optional.toMultiplicity;
  if (optional.label !== undefined && optional.label !== '') rel.label = optional.label;
  if (optional.fromPort !== undefined) rel.fromPort = optional.fromPort;
  if (optional.toPort !== undefined) rel.toPort = optional.toPort;
  if (optional.qualifier !== undefined) rel.qualifier = optional.qualifier;
  return rel;
}

function parseRelationshipLine(line: string): Relationship | null {
  const m = REL_RE.exec(line);
  if (m === null) return null;

  const arrow = m[4]!;
  const info = resolveArrow(arrow);
  if (info === null) return null;

  const left = splitEndpointPort(m[1]!);
  const right = splitEndpointPort(m[7]!);

  const id = pickDirectional(info.swapDirection, left.id, right.id);
  const mult = pickDirectional(info.swapDirection, m[3], m[5]);
  const port = pickDirectional(info.swapDirection, left.port, right.port);
  const qualifier = m[2] ?? m[6];
  const label = m[8]?.trim();

  return withOptionalFields(
    { from: id.from, to: id.to, type: info.type },
    {
      fromMultiplicity: mult.from,
      toMultiplicity: mult.to,
      label,
      fromPort: port.from,
      toPort: port.to,
      qualifier,
    },
  );
}

function stripQuotes(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Map a raw arrow token (after body-length canonicalisation — see REL_ARROW's
 * comment) to semantic type and direction. Left-pointing arrows have
 * swapDirection=true (left side = "to"); right-pointing and neutral arrows
 * have swapDirection=false.
 */
const ARROW_INFO: Record<string, ArrowInfo> = {
  // Left-pointing: right side is the "from", left side is the "to"
  '<|-': { type: 'extension',      swapDirection: true },
  '<-':  { type: 'association',    swapDirection: true },
  '<|.': { type: 'implementation', swapDirection: true },
  '<.':  { type: 'dependency',     swapDirection: true },
  // Right-pointing: left side is "from", right side is "to"
  '-|>': { type: 'extension',      swapDirection: false },
  '.|>': { type: 'implementation', swapDirection: false },
  '-*':  { type: 'composition',    swapDirection: false },
  '-o':  { type: 'aggregation',    swapDirection: false },
  // *-- / o--: left side is the "whole" (from), right is part (to)
  '*-':  { type: 'composition',    swapDirection: false },
  'o-':  { type: 'aggregation',    swapDirection: false },
  '->':  { type: 'association',    swapDirection: false },
  '.>':  { type: 'dependency',     swapDirection: false },
  '.':   { type: 'usage',          swapDirection: false },
  // Plain solid connector: a bare association (no arrowheads, no direction).
  '-':   { type: 'association',    swapDirection: false },
};

/** Collapse a run of `-` or `.` body characters to a single char (body
 *  length never changes relationship type — see REL_ARROW's comment). */
function canonicalizeArrow(rawArrow: string): string {
  return rawArrow.replace(/-+/g, '-').replace(/\.+/g, '.');
}

function resolveArrow(rawArrow: string): ArrowInfo | null {
  return ARROW_INFO[canonicalizeArrow(rawArrow)] ?? null;
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
// Hide/show directive parsing
// ---------------------------------------------------------------------------

/**
 * Map from the lowercase target string to the canonical HideTarget value.
 * Only the supported global targets are listed here.
 */
const HIDE_TARGET_MAP: Record<string, HideTarget> = {
  'empty members': 'empty members',
  'members':       'members',
  'circle':        'circle',
  'empty fields':  'empty fields',
  'empty methods': 'empty methods',
};

/**
 * Parse a hide/show directive line.
 * Returns null if the line is not a recognised directive.
 *
 * Matches lines of the form:
 *   hide empty members
 *   hide members
 *   hide circle
 *   hide empty fields
 *   hide empty methods
 *   show <same targets>
 */
function parseHideShowDirective(line: string): HideShowDirective | null {
  const m = /^(hide|show)\s+(.+)$/i.exec(line);
  if (m === null) return null;

  const action = m[1]!.toLowerCase() as 'hide' | 'show';
  const targetStr = m[2]!.trim().toLowerCase();
  const target = HIDE_TARGET_MAP[targetStr];
  if (target === undefined) return null;

  return { kind: 'hideshow', action, target };
}

// ---------------------------------------------------------------------------
// Post-processing: apply directives to the AST
// ---------------------------------------------------------------------------

/**
 * Apply the accumulated hide/show directives to classifiers and their members.
 * Later directives (higher index in the array) override earlier ones because
 * show/hide are additive and last-writer-wins per target.
 *
 * Effective state is determined by scanning directives in order; for each
 * target the last action seen wins.
 *
 * Note on hide empty fields / hide empty methods:
 *   These directives affect the divider/section visibility, which is computed in
 *   layout (layoutClass reads ast.directives directly). No per-member flag is
 *   needed here — the directives are already stored in ast.directives for layout.
 */
function applyDirectives(ast: ClassDiagramAST): void {
  if (ast.directives.length === 0) return;

  // Resolve the final effective action for each target (last wins).
  const effectiveAction = new Map<HideTarget, 'hide' | 'show'>();
  for (const directive of ast.directives) {
    effectiveAction.set(directive.target, directive.action);
  }

  const hideMembers = effectiveAction.get('members') === 'hide';
  const hideCircle  = effectiveAction.get('circle')  === 'hide';

  for (const classifier of ast.classifiers) {
    // hide circle — suppress the C/I/A/E badge in the renderer
    if (hideCircle) {
      classifier.hideCircle = true;
    }

    // hide members — mark every member as hidden regardless of type
    if (hideMembers) {
      for (const member of classifier.members) {
        member.hidden = true;
      }
    }
  }
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

  // 2. Ignore: skinparam and title lines
  {
    pattern: /^(skinparam|title\s)/i,
    execute() { /* no-op */ },
  },

  // 3. hide/show directives — parse and store; unrecognised targets are ignored
  {
    pattern: /^(hide|show)\s/i,
    execute(state, match) {
      const directive = parseHideShowDirective(match.input);
      if (directive !== null) {
        state.ast.directives.push(directive);
      }
    },
  },

  // 4. Closing brace — ends a pending body or namespace block
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

  // 5. Namespace block: namespace com.example {
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

  // 6. Classifier declarations.
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

  // 6b. Single-line note on entity: note <pos> of <Entity> : text
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*:\s*(.+)$/i,
    execute(state, match) {
      addNote(
        state,
        match[1]!.toLowerCase() as NotePosition,
        match[2]!,
        match[3]!.trim(),
      );
    },
  },

  // 6c. Multi-line note on entity opener: note <pos> of <Entity>  (… end note)
  {
    pattern: /^note\s+(left|right|top|bottom)\s+of\s+(\w+|"[^"]+")\s*$/i,
    execute(state, match) {
      state.pendingNote = {
        kind: 'attached',
        position: match[1]!.toLowerCase() as NotePosition,
        target: match[2]!,
        textLines: [],
      };
    },
  },

  // 6d. Multi-line freestanding note opener: note as <alias>  (… end note)
  //     Unattached: no host entity, no position. Referenced later by a
  //     plain relationship line, e.g. `N4 .> DrawableAdapter`.
  {
    pattern: /^note\s+as\s+(\w+|"[^"]+")\s*$/i,
    execute(state, match) {
      state.pendingNote = {
        kind: 'freestanding',
        alias: match[1]!,
        textLines: [],
      };
    },
  },

  // 7. Standalone member: ClassName : +member
  //    Must come before relationship detection to avoid colon ambiguity.
  //    Negative lookahead `(?!:)` on the colon keeps this from swallowing
  //    `Class::member` port syntax (`ClassB::b <-- pack.ClassA::a`) — that
  //    double-colon belongs to rule 8's relationship parsing, not here.
  {
    pattern: /^(\w+)\s*:(?!:)\s*(.+)$/,
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

  // 8. Relationship lines.
  //    The dispatch pattern mirrors REL_RE's endpoint/qualifier/arrow
  //    alternatives (built from the same CLASS_ID/REL_ARROW fragments) so
  //    that only genuine relationship lines reach parseRelationshipLine.
  {
    pattern: REL_DISPATCH_RE,
    execute(state, match) {
      // match.input is always a string on a successful RegExp match
      const rel = parseRelationshipLine(match.input);
      if (rel === null) return;
      // A note-referencing endpoint (e.g. `N4 .> DrawableAdapter`) must not
      // spawn a phantom classifier for the note's alias.
      if (!isNoteId(state, rel.from)) ensureClassifier(state, rel.from);
      if (!isNoteId(state, rel.to)) ensureClassifier(state, rel.to);
      state.ast.relationships.push(rel);
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
    pendingNote: null,
  };

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    // If we are inside a multi-line note block, accumulate text until `end note`.
    if (state.pendingNote !== null) {
      if (/^end\s*note\s*$/i.test(line)) {
        finalizePendingNote(state, state.pendingNote);
        state.pendingNote = null;
      } else {
        state.pendingNote.textLines.push(line);
      }
      continue;
    }

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

  // Post-processing: apply all hide/show directives to the AST
  applyDirectives(state.ast);

  return state.ast;
}
