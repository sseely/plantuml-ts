/**
 * Parser for PlantUML component diagrams.
 *
 * Uses a command-dispatch table: an array of { pattern, execute } objects
 * tested against each trimmed line in priority order. First match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import type {
  ComponentDiagramAST,
  ComponentKind,
  ComponentLink,
  ComponentNode,
  LinkStyle,
} from './ast.js';

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseComponent call)
// ---------------------------------------------------------------------------

interface ParseState {
  ast: ComponentDiagramAST;
  /** Stack of open container nodes (package, node, folder, etc.). */
  containerStack: ComponentNode[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultAST(): ComponentDiagramAST {
  return { nodes: [], links: [] };
}

/**
 * Emit a node into the current container scope (or top-level if no container
 * is open).
 */
function emitNode(state: ParseState, node: ComponentNode): void {
  const parent = state.containerStack[state.containerStack.length - 1];
  if (parent !== undefined) {
    parent.children.push(node);
  } else {
    state.ast.nodes.push(node);
  }
}

/**
 * Parse stereotype `<< name >>` from the remainder of a line.
 * Returns the stereotype string and the remainder with the << >> token
 * removed if found, otherwise undefined.
 */
function extractStereotype(
  rest: string,
): { stereotype: string; remainder: string } | undefined {
  const m = /<<\s*(.+?)\s*>>/.exec(rest);
  if (m === null) return undefined;
  return {
    stereotype: m[1]!,
    remainder:
      rest.slice(0, m.index).trimEnd() +
      rest.slice(m.index + m[0].length).trimStart(),
  };
}

/**
 * Parse a trailing color token `#word` from the end of a string.
 */
function extractColor(
  rest: string,
): { color: string; remainder: string } | undefined {
  const m = /(#\w+)\s*$/.exec(rest);
  if (m === null) return undefined;
  return {
    color: m[1]!,
    remainder: rest.slice(0, m.index).trimEnd(),
  };
}

/**
 * Build a ComponentNode from parsed parts, applying exactOptionalPropertyTypes
 * rules (no undefined values in optional slots).
 */
function makeNode(
  id: string,
  display: string,
  kind: ComponentKind,
  stereotype?: string,
  color?: string,
): ComponentNode {
  return {
    id,
    display,
    kind,
    children: [],
    ...(stereotype !== undefined ? { stereotype } : {}),
    ...(color !== undefined ? { color } : {}),
  };
}

/**
 * Parse the "rest" portion of a named-entity line. Handles:
 *   "Display Name" as Alias [<< Stereotype >>] [#color]
 *   DisplayName as Alias [<< Stereotype >>] [#color]
 *   "Display Name" [<< Stereotype >>] [#color]
 *   DisplayName [<< Stereotype >>] [#color]
 */
function parseNamedEntity(kind: ComponentKind, rest: string): ComponentNode {
  let remainder = rest.trim();
  let stereotype: string | undefined;
  let color: string | undefined;

  // Extract stereotype first (it may appear anywhere).
  const stereoResult = extractStereotype(remainder);
  if (stereoResult !== undefined) {
    stereotype = stereoResult.stereotype;
    remainder = stereoResult.remainder.trim();
  }

  // Extract color from the end.
  const colorResult = extractColor(remainder);
  if (colorResult !== undefined) {
    color = colorResult.color;
    remainder = colorResult.remainder.trim();
  }

  let id: string;
  let display: string;

  // Try: "Display Name" as Alias
  const quotedAlias = /^"([^"]+)"\s+as\s+(\S+)$/.exec(remainder);
  if (quotedAlias !== null) {
    display = quotedAlias[1]!;
    id = quotedAlias[2]!;
    return makeNode(id, display, kind, stereotype, color);
  }

  // Try: Name as Alias (unquoted display)
  const unquotedAlias = /^(\S+)\s+as\s+(\S+)$/.exec(remainder);
  if (unquotedAlias !== null) {
    display = unquotedAlias[1]!;
    id = unquotedAlias[2]!;
    return makeNode(id, display, kind, stereotype, color);
  }

  // Try: "Display Name" (no alias — id = display)
  const quotedNoAlias = /^"([^"]+)"$/.exec(remainder);
  if (quotedNoAlias !== null) {
    display = quotedNoAlias[1]!;
    id = display;
    return makeNode(id, display, kind, stereotype, color);
  }

  // Bare name
  id = remainder.trim();
  display = id;
  return makeNode(id, display, kind, stereotype, color);
}

/**
 * Parse inline children from a single-line block syntax, e.g.:
 *   `package P { [A] [B] }`
 * Returns an array of child ComponentNodes.
 */
function parseInlineChildren(body: string): ComponentNode[] {
  const children: ComponentNode[] = [];

  // Match bracket-shorthand components: [Name]
  const compRe = /\[([^\]]+)\]/g;
  let m = compRe.exec(body);
  while (m !== null) {
    const name = m[1]!.trim();
    children.push(makeNode(name, name, 'component'));
    m = compRe.exec(body);
  }

  // Match interface shorthand: () Name  (not inside brackets, after any [...])
  // Strip bracket regions first to avoid double-matching.
  const stripped = body.replace(/\[[^\]]*\]/g, '');
  const ifaceRe = /\(\)\s*(\S+)/g;
  let im = ifaceRe.exec(stripped);
  while (im !== null) {
    const name = im[1]!.trim();
    children.push(makeNode(name, name, 'interface'));
    im = ifaceRe.exec(stripped);
  }

  return children;
}

/**
 * Resolve the source/target id from a link endpoint token.
 * Endpoints may be:
 *   [Name]    → id = "Name"
 *   ()Name    → id = "Name"
 *   Name      → id = "Name"
 */
function resolveEndpointId(token: string): string {
  const bracketMatch = /^\[([^\]]+)\]$/.exec(token);
  if (bracketMatch !== null) return bracketMatch[1]!.trim();

  const ifaceMatch = /^\(\)\s*(.+)$/.exec(token);
  if (ifaceMatch !== null) return ifaceMatch[1]!.trim();

  return token;
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
 *
 * Critically, the link pattern MUST come before the bracket-shorthand pattern
 * because `[A] --> [B]` would otherwise be consumed by the bracket rule first.
 */
const COMMANDS: readonly Command[] = [
  // 1. Comment lines: ' ...
  {
    pattern: /^'\s*/,
    execute() {
      /* ignore */
    },
  },

  // 2. Ignored directives: skinparam, title, hide, show
  {
    pattern: /^(skinparam|title|hide|show)\b/i,
    execute() {
      /* ignore */
    },
  },

  // 3. Closing brace — ends the current container block
  {
    pattern: /^\}\s*$/,
    execute(state) {
      state.containerStack.pop();
    },
  },

  // 4. Links — MUST precede bracket-shorthand (command 5) because
  //    `[A] --> [B]` starts with `[A]` and would otherwise match [Name].
  //    Handles solid/dashed, open/filled/no arrow, optional label.
  //    Endpoints may be [Comp], () IFace, or bare identifiers.
  //    Arrow tokens: -->, .., ..>, ->>, --, ->
  {
    pattern:
      /^(\[[^\]]+\]|\(\)\s*\S+|\S+)\s*(\.\.>|\.\.|->>|-->|->|--)\s*(\[[^\]]+\]|\(\)\s*\S+|\S+)\s*(?::\s*(.*))?$/,
    execute(state, match) {
      const fromToken = match[1]!.trim();
      const arrowToken = match[2]!;
      const toToken = match[3]!.trim();
      const rawLabel = match[4];

      const from = resolveEndpointId(fromToken);
      const to = resolveEndpointId(toToken);

      let style: LinkStyle;
      let arrowHead: ComponentLink['arrowHead'];

      switch (arrowToken) {
        case '-->':
          style = 'solid';
          arrowHead = 'open';
          break;
        case '->':
          style = 'solid';
          arrowHead = 'open';
          break;
        case '->>':
          style = 'solid';
          arrowHead = 'filled';
          break;
        case '--':
          style = 'solid';
          arrowHead = 'none';
          break;
        case '..>':
          style = 'dashed';
          arrowHead = 'open';
          break;
        case '..':
          style = 'dashed';
          arrowHead = 'none';
          break;
        default:
          style = 'solid';
          arrowHead = 'open';
      }

      const label = rawLabel?.trim();

      const link: ComponentLink = {
        from,
        to,
        style,
        ...(arrowHead !== undefined ? { arrowHead } : {}),
        ...(label !== undefined && label !== '' ? { label } : {}),
      };

      state.ast.links.push(link);
    },
  },

  // 5. Bracket shorthand for component: [Name] [<< Stereotype >>] [#color]
  {
    pattern: /^\[([^\]]+)\](.*)?$/,
    execute(state, match) {
      const name = match[1]!.trim();
      const extra = (match[2] ?? '').trim();

      let stereotype: string | undefined;
      let color: string | undefined;

      const stereoResult = extractStereotype(extra);
      if (stereoResult !== undefined) {
        stereotype = stereoResult.stereotype;
        const colorResult = extractColor(stereoResult.remainder.trim());
        if (colorResult !== undefined) {
          color = colorResult.color;
        }
      } else {
        const colorResult = extractColor(extra);
        if (colorResult !== undefined) {
          color = colorResult.color;
        }
      }

      emitNode(state, makeNode(name, name, 'component', stereotype, color));
    },
  },

  // 6. Interface shorthand: () InterfaceName
  {
    pattern: /^\(\)\s+(\S+)\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'interface'));
    },
  },

  // 7. Explicit interface keyword: interface Name [...]
  {
    pattern: /^interface\s+(.+)$/i,
    execute(state, match) {
      const node = parseNamedEntity('interface', match[1]!);
      emitNode(state, node);
    },
  },

  // 8. Explicit component keyword: component Name [...]
  {
    pattern: /^component\s+(.+)$/i,
    execute(state, match) {
      const node = parseNamedEntity('component', match[1]!);
      emitNode(state, node);
    },
  },

  // 9. Container kinds with an inline block: `package P { [A] [B] }`
  //    Must be checked before the multi-line open-brace variant.
  {
    pattern:
      /^(package|node|folder|frame|cloud|database|storage)\s+(.*?)\s*\{([^}]*)\}\s*$/i,
    execute(state, match) {
      const rawKind = match[1]!.toLowerCase() as ComponentKind;
      const header = match[2]!.trim();
      const body = match[3]!;

      const container = parseNamedEntity(rawKind, header);

      // Parse inline children and attach them.
      const children = parseInlineChildren(body);
      for (const child of children) {
        container.children.push(child);
      }

      emitNode(state, container);
    },
  },

  // 10. Container kinds with multi-line block: `package P {`
  {
    pattern:
      /^(package|node|folder|frame|cloud|database|storage)\s+(.*?)\s*\{\s*$/i,
    execute(state, match) {
      const rawKind = match[1]!.toLowerCase() as ComponentKind;
      const header = match[2]!.trim();
      const container = parseNamedEntity(rawKind, header);
      emitNode(state, container);
      state.containerStack.push(container);
    },
  },
];

// ---------------------------------------------------------------------------
// Main parser entry point
// ---------------------------------------------------------------------------

/**
 * Parse a UmlSource block for a component diagram into an AST.
 */
export function parseComponent(block: UmlSource): ComponentDiagramAST {
  const state: ParseState = {
    ast: makeDefaultAST(),
    containerStack: [],
  };

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

  return state.ast;
}
