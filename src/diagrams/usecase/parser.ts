/**
 * Parser for PlantUML use case diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type { UCLink, UCLinkStyle, UCNode, UCNodeKind, UseCaseDiagramAST } from './ast.js';

// ---------------------------------------------------------------------------
// Mutable parse state
// ---------------------------------------------------------------------------

interface ParseState {
  /** Top-level node list (root scope). */
  nodes: UCNode[];
  links: UCLink[];
  /**
   * Container stack. When non-empty, newly parsed nodes are added as
   * children of the top container instead of the root list.
   */
  containerStack: UCNode[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(): ParseState {
  return { nodes: [], links: [], containerStack: [] };
}

/** Return the node list for the current scope. */
function currentNodes(state: ParseState): UCNode[] {
  const top = state.containerStack[state.containerStack.length - 1];
  return top !== undefined ? top.children : state.nodes;
}

/** Add a node to the current scope. */
function addNode(state: ParseState, node: UCNode): void {
  currentNodes(state).push(node);
}

// ---------------------------------------------------------------------------
// ID / display parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a use-case endpoint token. Tokens may be:
 *   (Name)            → id = display = "Name"
 *   :Name:            → id = display = "Name"
 *   plain             → id = display = plain
 *
 * Returns { id, display }.
 */
function resolveEndpoint(token: string): { id: string; display: string } {
  // (Name)
  const parenMatch = /^\((.+)\)$/.exec(token);
  if (parenMatch !== null) {
    const name = parenMatch[1]!.trim();
    return { id: name, display: name };
  }
  // :Name:
  const colonMatch = /^:(.+):$/.exec(token);
  if (colonMatch !== null) {
    const name = colonMatch[1]!.trim();
    return { id: name, display: name };
  }
  return { id: token, display: token };
}

/**
 * Parse a node declaration's name/alias/color section.
 *
 * Supported forms (after optional trailing #color is stripped):
 *   "Display Name" as Alias        → id=Alias, display=Display Name
 *   'Display Name' as Alias        → id=Alias, display=Display Name
 *   Alias as "Display Name"        → id=Alias, display=Display Name
 *   Alias as 'Display Name'        → id=Alias, display=Display Name
 *   (Name) as Alias                → id=Alias, display=Name
 *   (Name)                         → id=display=Name
 *   PlainName as Alias             → id=Alias, display=PlainName
 *   PlainName                      → id=display=PlainName
 */
function parseNameSection(raw: string): {
  id: string;
  display: string;
  color: string | undefined;
} {
  let rest = raw.trim();
  let color: string | undefined;

  // Strip trailing color (#word)
  const colorMatch = /\s+(#\w+)$/.exec(rest);
  if (colorMatch !== null) {
    color = colorMatch[1]!;
    // colorMatch[0] is the full match — always a string in RegExpExecArray
    rest = rest.slice(0, rest.length - colorMatch[0].length).trim();
  }

  // "Display" as Alias  or  'Display' as Alias  (display-first forms)
  const doubleQuotedAlias = /^"([^"]+)"\s+as\s+(\S+)$/.exec(rest);
  if (doubleQuotedAlias !== null) {
    return { id: doubleQuotedAlias[2]!, display: doubleQuotedAlias[1]!, color };
  }
  const singleQuotedAliasDisplayFirst = /^'([^']+)'\s+as\s+(\S+)$/.exec(rest);
  if (singleQuotedAliasDisplayFirst !== null) {
    return {
      id: singleQuotedAliasDisplayFirst[2]!,
      display: singleQuotedAliasDisplayFirst[1]!,
      color,
    };
  }

  // Alias as "Display"  or  Alias as 'Display'  (id-first, quoted display)
  const idFirstDoubleQuoted = /^(\S+)\s+as\s+"([^"]+)"$/.exec(rest);
  if (idFirstDoubleQuoted !== null) {
    return { id: idFirstDoubleQuoted[1]!, display: idFirstDoubleQuoted[2]!, color };
  }
  const idFirstSingleQuoted = /^(\S+)\s+as\s+'([^']+)'$/.exec(rest);
  if (idFirstSingleQuoted !== null) {
    return { id: idFirstSingleQuoted[1]!, display: idFirstSingleQuoted[2]!, color };
  }

  // (Name) as Alias
  const parenAlias = /^\(([^)]+)\)\s+as\s+(\S+)$/.exec(rest);
  if (parenAlias !== null) {
    return { id: parenAlias[2]!, display: parenAlias[1]!.trim(), color };
  }

  // (Name)
  const parenOnly = /^\(([^)]+)\)$/.exec(rest);
  if (parenOnly !== null) {
    const name = parenOnly[1]!.trim();
    return { id: name, display: name, color };
  }

  // PlainName as Alias  (unquoted display, unquoted alias)
  const plainAlias = /^(\S+)\s+as\s+(\S+)$/.exec(rest);
  if (plainAlias !== null) {
    return { id: plainAlias[2]!, display: plainAlias[1]!, color };
  }

  // Plain name (possibly multi-word without alias — treat whole as id/display)
  return { id: rest, display: rest, color };
}

// ---------------------------------------------------------------------------
// Link arrow helpers
// ---------------------------------------------------------------------------

/**
 * Classify an arrow token as solid or dashed.
 * Dashed: anything containing "." (e.g. ..>, .., .>)
 * Solid: --, -->, ->
 */
function classifyArrow(arrow: string): UCLinkStyle {
  if (arrow.includes('.')) return 'dashed';
  return 'solid';
}

/**
 * Extract stereotype and clean label from a raw label string.
 * e.g. "<<include>>"          → { stereotype: "include", label: undefined }
 *      "some text <<extend>>" → { stereotype: "extend", label: "some text" }
 *      "just a label"         → { stereotype: undefined, label: "just a label" }
 */
function extractStereotype(raw: string): {
  stereotype: string | undefined;
  label: string | undefined;
} {
  const stereoMatch = /<<([^>]+)>>/.exec(raw);
  if (stereoMatch === null) {
    const trimmed = raw.trim();
    return {
      stereotype: undefined,
      label: trimmed.length > 0 ? trimmed : undefined,
    };
  }
  const stereotype = stereoMatch[1]!.trim();
  const remaining = raw.replace(/<<[^>]+>>/, '').trim();
  return {
    stereotype,
    label: remaining.length > 0 ? remaining : undefined,
  };
}

// ---------------------------------------------------------------------------
// Container (package/rectangle/etc.) helpers
// ---------------------------------------------------------------------------

const CONTAINER_KINDS = new Set<UCNodeKind>([
  'package',
  'rectangle',
  'node',
  'folder',
  'frame',
  'cloud',
  'database',
]);

function isContainerKind(kind: string): kind is UCNodeKind {
  return CONTAINER_KINDS.has(kind as UCNodeKind);
}

/**
 * Parse the body of a single-line container block such as:
 *   rectangle System { (Login) (Logout) }
 * Returns an array of UCNodes found inside the braces.
 */
function parseInlineBody(body: string): UCNode[] {
  const nodes: UCNode[] = [];
  // Find (Name) tokens
  const parenRe = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(body)) !== null) {
    const name = m[1]!.trim();
    nodes.push({
      id: name,
      display: name,
      kind: 'usecase',
      children: [],
    });
  }
  // Find :Name: tokens
  const colonRe = /:([^:]+):/g;
  while ((m = colonRe.exec(body)) !== null) {
    const name = m[1]!.trim();
    nodes.push({
      id: name,
      display: name,
      kind: 'actor',
      children: [],
    });
  }
  return nodes;
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
 * More specific patterns must precede general ones.
 */
const COMMANDS: readonly Command[] = [
  // ── Ignored lines ────────────────────────────────────────────────────────

  // skinparam, title, hide, show, direction directives
  {
    pattern:
      /^(?:skinparam|title|hide|show|left\s+to\s+right\s+direction|top\s+to\s+bottom\s+direction)\b/i,
    execute() {
      // no-op: intentionally ignored
    },
  },

  // Single-quote comments
  {
    pattern: /^'/,
    execute() {
      // no-op
    },
  },

  // ── Close container block ─────────────────────────────────────────────────
  {
    pattern: /^\}\s*$/,
    execute(state) {
      state.containerStack.pop();
    },
  },

  // ── Business actor shorthand :Name:/ ─────────────────────────────────────
  // Must be tested before the plain :Name: pattern (more specific).
  {
    pattern: /^:([^:]+):\s*\/\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      const node: UCNode = { id: name, display: name, kind: 'business-actor', children: [] };
      addNode(state, node);
    },
  },

  // ── Actor shorthand :Name: ────────────────────────────────────────────────
  {
    pattern: /^:([^:]+):\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      const node: UCNode = { id: name, display: name, kind: 'actor', children: [] };
      addNode(state, node);
    },
  },

  // ── Business actor keyword: actor/ Name ──────────────────────────────────
  // upstream USymbols.fromString treats "actor/" as ACTOR_STICKMAN_BUSINESS
  // (see USymbols.java line 162-163). CommandCreateElementFull2 routes that
  // symbol to DESCRIPTION + usymbol, not a LeafType.USECASE_BUSINESS path,
  // so we model it as kind='business-actor' here.
  {
    pattern: /^actor\/\s+(.+)$/i,
    execute(state, match) {
      const { id, display, color } = parseNameSection(match[1]!);
      const node: UCNode = {
        id,
        display,
        kind: 'business-actor',
        children: [],
        ...(color !== undefined ? { color } : {}),
      };
      addNode(state, node);
    },
  },

  // ── Actor keyword ─────────────────────────────────────────────────────────
  // actor User
  // actor "Admin User" as AU
  // actor User #pink
  {
    pattern: /^actor\s+(.+)$/i,
    execute(state, match) {
      const { id, display, color } = parseNameSection(match[1]!);
      const node: UCNode = {
        id,
        display,
        kind: 'actor',
        children: [],
        ...(color !== undefined ? { color } : {}),
      };
      addNode(state, node);
    },
  },

  // ── Business use case shorthand (Name)/ ──────────────────────────────────
  // Must be tested before the plain (Name) pattern (more specific).
  {
    pattern: /^\(([^)]+)\)\s*\/\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      const node: UCNode = { id: name, display: name, kind: 'business-usecase', children: [] };
      addNode(state, node);
    },
  },

  // ── Use case shorthand (Name) ─────────────────────────────────────────────
  // Bare "(Name)" with nothing else on the line creates a use case node.
  // Link patterns require an arrow token, so this pattern is unambiguous.
  {
    pattern: /^\(([^)]+)\)\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      const node: UCNode = { id: name, display: name, kind: 'usecase', children: [] };
      addNode(state, node);
    },
  },

  // ── Use case keyword ──────────────────────────────────────────────────────
  // usecase UC1
  // usecase "Do Thing" as UC1
  // usecase (Login)
  // usecase UC1 #yellow
  {
    pattern: /^usecase\s+(.+)$/i,
    execute(state, match) {
      const { id, display, color } = parseNameSection(match[1]!);
      const node: UCNode = {
        id,
        display,
        kind: 'usecase',
        children: [],
        ...(color !== undefined ? { color } : {}),
      };
      addNode(state, node);
    },
  },

  // ── Container: single-line with inline body ───────────────────────────────
  // rectangle System { (Login) (Logout) }
  {
    pattern:
      /^(package|rectangle|node|folder|frame|cloud|database)\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*\{([^}]*)\}\s*$/i,
    execute(state, match) {
      const kindStr = match[1]!.toLowerCase();
      if (!isContainerKind(kindStr)) return;

      const display = match[2] ?? match[3] ?? match[4] ?? kindStr;
      const id = display;
      const body = match[5] ?? '';

      const children = parseInlineBody(body);
      const node: UCNode = { id, display, kind: kindStr, children };
      addNode(state, node);
    },
  },

  // ── Container: open block ────────────────────────────────────────────────
  // rectangle System {
  // package "My System" {
  {
    pattern:
      /^(package|rectangle|node|folder|frame|cloud|database)\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*\{\s*$/i,
    execute(state, match) {
      const kindStr = match[1]!.toLowerCase();
      if (!isContainerKind(kindStr)) return;

      const display = match[2] ?? match[3] ?? match[4] ?? kindStr;
      const id = display;

      const node: UCNode = { id, display, kind: kindStr, children: [] };
      addNode(state, node);
      state.containerStack.push(node);
    },
  },

  // ── Links ─────────────────────────────────────────────────────────────────
  // Supports:
  //   User --> (Login)
  //   User -- (Login)
  //   (Login) ..> (Validate) : <<include>>
  //   (Login) .> (Validate) : <<include>>
  //   (A) .. (B) : label
  //
  // Arrow token: --, -->, ->, ..>, .., .>, ..>>
  // Endpoint token: (Name), :Name:, or plain non-whitespace identifier.
  {
    pattern:
      /^((?:\([^)]+\)|:[^:]+:|[^\s.>-]+))\s*(\.\.?>?|\.>|--?>?|->>?)\s*((?:\([^)]+\)|:[^:]+:|[^\s.>-]+))(?:\s*:\s*(.*))?$/,
    execute(state, match) {
      const fromToken = match[1]!.trim();
      const arrow = match[2]!.trim();
      const toToken = match[3]!.trim();
      const rawLabel = match[4]?.trim() ?? '';

      const { id: from } = resolveEndpoint(fromToken);
      const { id: to } = resolveEndpoint(toToken);
      const style = classifyArrow(arrow);
      const { stereotype, label } = extractStereotype(rawLabel);

      const link: UCLink = {
        from,
        to,
        style,
        ...(label !== undefined ? { label } : {}),
        ...(stereotype !== undefined ? { stereotype } : {}),
      };
      state.links.push(link);
    },
  },
];

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a PlantUML use case diagram block into an AST.
 */
export function parseUseCase(block: UmlSource): UseCaseDiagramAST {
  const state = makeState();

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    for (const cmd of COMMANDS) {
      const match = cmd.pattern.exec(line);
      if (match !== null) {
        cmd.execute(state, match);
        break;
      }
    }
  }

  return { nodes: state.nodes, links: state.links };
}
