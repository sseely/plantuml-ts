/**
 * Parser for PlantUML object diagrams.
 *
 * Produces a ClassDiagramAST with classifiers of kind 'object'.
 * Members are stored as field = value pairs (name → type field).
 * Relationship syntax is identical to class diagrams.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type {
  ClassDiagramAST,
  Classifier,
  Member,
  Relationship,
  RelationshipType,
} from '../class/ast.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultAST(): ClassDiagramAST {
  return { classifiers: [], relationships: [], namespaces: [], directives: [], notes: [] };
}

function ensureClassifier(
  ast: ClassDiagramAST,
  index: Map<string, number>,
  id: string,
  display?: string,
): Classifier {
  const existing = index.get(id);
  if (existing !== undefined) return ast.classifiers[existing]!;
  const c: Classifier = {
    id,
    display: display ?? id,
    kind: 'object',
    typeParams: [],
    members: [],
  };
  index.set(id, ast.classifiers.length);
  ast.classifiers.push(c);
  return c;
}

/** Parse a "fieldName = value" or bare "fieldName" line. */
function parseField(line: string): Member | null {
  const trimmed = line.trim();
  const eqMatch = /^(\w+)\s*=\s*(.+)$/.exec(trimmed);
  if (eqMatch !== null) {
    return {
      visibility: '+',
      name: eqMatch[1]!,
      type: eqMatch[2]!.trim(),
      isStatic: false,
      isAbstract: false,
    };
  }
  const nameOnly = /^(\w+)$/.exec(trimmed);
  if (nameOnly !== null) {
    return {
      visibility: '+',
      name: nameOnly[1]!,
      isStatic: false,
      isAbstract: false,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Relationship parsing (same arrow set as class diagrams)
// ---------------------------------------------------------------------------

interface ArrowInfo {
  type: RelationshipType;
  swapDirection: boolean;
}

function resolveArrow(arrow: string): ArrowInfo | null {
  switch (arrow) {
    case '<|--': return { type: 'extension',      swapDirection: true };
    case '<|..': return { type: 'implementation', swapDirection: true };
    case '--|>': return { type: 'extension',      swapDirection: false };
    case '..|>': return { type: 'implementation', swapDirection: false };
    case '--*':  return { type: 'composition',    swapDirection: false };
    case '--o':  return { type: 'aggregation',    swapDirection: false };
    case '*--':  return { type: 'composition',    swapDirection: false };
    case 'o--':  return { type: 'aggregation',    swapDirection: false };
    case '-->':  return { type: 'association',    swapDirection: false };
    case '..>':  return { type: 'dependency',     swapDirection: false };
    case '..':   return { type: 'usage',          swapDirection: false };
    default:     return null;
  }
}

const REL_RE =
  /^(\w+|"[^"]+")\s*(?:"([^"]*)")?\s*(<\|--|<\|\.\.|--\|>|\.\.\|>|--\*|--o|\*--|o--|-->|\.\.>|\.\.)\s*(?:"([^"]*)")?\s*(\w+|"[^"]+")\s*(?::\s*(.+))?$/;

function stripQuotes(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

function parseRelationship(line: string): Relationship | null {
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

// ---------------------------------------------------------------------------
// Object declaration parsing
// ---------------------------------------------------------------------------

interface ObjectDecl {
  id: string;
  display: string;
  opensBody: boolean;
  inlineFields: string[];
  stereotype?: string;
  color?: string;
}

function parseObjectDecl(line: string): ObjectDecl | null {
  const kindMatch = /^object\s+(.+)$/i.exec(line);
  if (kindMatch === null) return null;
  let rest = kindMatch[1]!.trim();

  let inlineFields: string[] = [];
  let opensBody = false;

  const inlineBodyMatch = /\{([^}]*)\}\s*$/.exec(rest);
  if (inlineBodyMatch !== null) {
    const content = inlineBodyMatch[1]!.trim();
    if (content.length > 0) {
      inlineFields = content
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    }
    rest = rest.slice(0, inlineBodyMatch.index).trimEnd();
  } else if (rest.endsWith('{')) {
    opensBody = true;
    rest = rest.slice(0, -1).trimEnd();
  }

  let stereotype: string | undefined;
  const stereoMatch = /<<\s*(.+?)\s*>>/.exec(rest);
  if (stereoMatch !== null) {
    stereotype = stereoMatch[1]!;
    rest =
      rest.slice(0, stereoMatch.index) +
      rest.slice(stereoMatch.index + stereoMatch[0].length);
    rest = rest.trim();
  }

  let color: string | undefined;
  const colorMatch = /(#\w+)$/.exec(rest);
  if (colorMatch !== null) {
    color = colorMatch[1]!;
    rest = rest.slice(0, -colorMatch[0].length).trimEnd();
  }

  let id: string;
  let display: string;

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
      display = rest.trim();
      id = display;
    }
  }

  if (id === '' || display === '') return null;

  return {
    id,
    display,
    opensBody,
    inlineFields,
    ...(stereotype !== undefined ? { stereotype } : {}),
    ...(color !== undefined ? { color } : {}),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function parseObject(block: UmlSource): ClassDiagramAST {
  const ast = makeDefaultAST();
  const classifierIndex = new Map<string, number>();
  let pendingBodyId: string | null = null;

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    if (line.startsWith("'") || /^(skinparam|hide\s|show\s|title\s)/i.test(line)) {
      continue;
    }

    if (pendingBodyId !== null) {
      if (/^\}\s*$/.test(line)) {
        pendingBodyId = null;
        continue;
      }
      const idx = classifierIndex.get(pendingBodyId);
      if (idx !== undefined) {
        const c = ast.classifiers[idx];
        if (c !== undefined) {
          const field = parseField(line);
          if (field !== null) c.members.push(field);
        }
      }
      continue;
    }

    if (/^\}\s*$/.test(line)) continue;

    if (/^object\s+/i.test(line)) {
      const decl = parseObjectDecl(line);
      if (decl === null) continue;
      const c = ensureClassifier(ast, classifierIndex, decl.id, decl.display);
      if (decl.stereotype !== undefined) c.stereotype = decl.stereotype;
      if (decl.color !== undefined) c.color = decl.color;
      for (const fieldStr of decl.inlineFields) {
        const field = parseField(fieldStr);
        if (field !== null) c.members.push(field);
      }
      if (decl.opensBody) pendingBodyId = decl.id;
      continue;
    }

    if (REL_RE.test(line)) {
      const rel = parseRelationship(line);
      if (rel !== null) {
        ensureClassifier(ast, classifierIndex, rel.from);
        ensureClassifier(ast, classifierIndex, rel.to);
        ast.relationships.push(rel);
      }
    }
  }

  return ast;
}
