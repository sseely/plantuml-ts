/**
 * Parser for PlantUML descriptive diagrams (component / use-case / deployment).
 *
 * Merges the component and use-case parsers into one upstream-faithful engine
 * keyed by KEYWORD_TO_SYMBOL (mirrors CommandCreateElementFull.ALL_TYPES in
 * net.sourceforge.plantuml.descdiagram.command). Uses a command-dispatch table
 * tested against each trimmed line in priority order — first match wins.
 */

import type { UmlSource } from '../../core/block-extractor.js';
import { KEYWORD_TO_SYMBOL } from '../../core/descriptive-keywords.js';
import type {
  DescriptionDiagramAST,
  DescriptiveLink,
  DescriptiveLinkStyle,
  DescriptiveNode,
} from './ast.js';
import {
  CONTAINER_INLINE_RE,
  CONTAINER_OPEN_RE,
  KEYWORD_RE,
  extractLinkStereotype,
  extractNodeStereotype,
  extractColor,
  makeNode,
  parseInlineBody,
  parseNameSection,
  resolveEndpointId,
} from './parse-helpers.js';

export { CONTAINER_SYMBOLS } from './parse-helpers.js';

// ---------------------------------------------------------------------------
// Module-level regex constants
// Lizard 1.23.0 miscounts brace depth for $ inside /regex/ in function bodies.
// ---------------------------------------------------------------------------

/** Alias suffix in bracket shorthand: `as Alias [rest]` */
const RE_BRACKET_ALIAS = /^as\s+(\S+)(.*)?$/i;

/** `left to right direction` — CommandRankDir.java sets skinparam Rankdir=LR. */
const RE_LEFT_TO_RIGHT_DIRECTION = /^left\s+to\s+right\s+direction\b/i;
/** `top to bottom direction` — explicit no-op; TB is already the default. */
const RE_TOP_TO_BOTTOM_DIRECTION = /^top\s+to\s+bottom\s+direction\b/i;

// ---------------------------------------------------------------------------
// Arrow classification — extracted from the link execute body to stay <30 NLOC
// ---------------------------------------------------------------------------

type ArrowHead = 'open' | 'filled' | 'none';

interface ArrowStyle {
  style: DescriptiveLinkStyle;
  /** Never undefined — classifyArrow always returns a concrete head. */
  arrowHead: ArrowHead;
  /** Upstream `Link.getLength()` — count of '-'/'.' characters in the token. */
  length: number;
}

/** Count of '-' or '.' characters in an arrow token — upstream Link length. */
function arrowLength(arrow: string): number {
  let count = 0;
  for (const ch of arrow) {
    if (ch === '-' || ch === '.') count++;
  }
  return count;
}

function classifyArrow(arrow: string): ArrowStyle {
  const length = arrowLength(arrow);
  switch (arrow) {
    case '->>': return { style: 'solid', arrowHead: 'filled', length };
    case '-->':
    case '->':  return { style: 'solid', arrowHead: 'open', length };
    case '--':  return { style: 'solid', arrowHead: 'none', length };
    case '..>':
    case '.>':  return { style: 'dashed', arrowHead: 'open', length };
    case '..':  return { style: 'dashed', arrowHead: 'none', length };
    default:    return { style: 'solid', arrowHead: 'open', length };
  }
}

// ---------------------------------------------------------------------------
// Mutable parse state (local to each parseDescription call)
// ---------------------------------------------------------------------------

interface ParseState {
  ast: DescriptionDiagramAST;
  /** Stack of open container nodes (package, node, folder, etc.). */
  containerStack: DescriptiveNode[];
}

function makeDefaultAST(): DescriptionDiagramAST {
  return { nodes: [], links: [] };
}

function emitNode(state: ParseState, node: DescriptiveNode): void {
  const parent = state.containerStack[state.containerStack.length - 1];
  if (parent !== undefined) {
    parent.children.push(node);
  } else {
    state.ast.nodes.push(node);
  }
}

// ---------------------------------------------------------------------------
// Link builder — parameter object keeps param count ≤5 and satisfies
// exactOptionalPropertyTypes (no spreading of possibly-undefined values).
// ---------------------------------------------------------------------------

interface LinkArgs {
  from: string;
  to: string;
  style: DescriptiveLinkStyle;
  arrowHead: ArrowHead;
  length: number;
  label: string | undefined;
  stereotype: string | undefined;
}

function buildLink(args: LinkArgs): DescriptiveLink {
  const link: DescriptiveLink = {
    from: args.from,
    to: args.to,
    style: args.style,
    arrowHead: args.arrowHead,
    length: args.length,
  };
  if (args.label !== undefined) link.label = args.label;
  if (args.stereotype !== undefined) link.stereotype = args.stereotype;
  return link;
}

// ---------------------------------------------------------------------------
// Command dispatch table
// Order matters: patterns are tested top-to-bottom; first match wins.
// More specific patterns MUST precede more general ones.
// ---------------------------------------------------------------------------

interface Command {
  pattern: RegExp;
  execute(state: ParseState, match: RegExpExecArray): void;
}

const COMMANDS: readonly Command[] = [
  // 1. Comment lines
  {
    pattern: /^'/,
    execute() { /* ignore */ },
  },

  // 2. Direction directives — must precede the general ignore rule (3) since
  //    both patterns would otherwise match. left-to-right sets skinparam
  //    Rankdir=LR (CommandRankDir.java); top-to-bottom is an explicit no-op
  //    because top-to-bottom is already our unset default.
  {
    pattern: RE_LEFT_TO_RIGHT_DIRECTION,
    execute(state) { state.ast.rankdir = 'LR'; },
  },
  {
    pattern: RE_TOP_TO_BOTTOM_DIRECTION,
    execute() { /* explicit TB is the default; no-op */ },
  },

  // 3. Ignored directives: skinparam, title, hide, show
  {
    pattern: /^(?:skinparam|title|hide|show)\b/i,
    execute() { /* ignore */ },
  },

  // 4. Closing brace — pops the current container
  {
    pattern: /^\}\s*$/,
    execute(state) { state.containerStack.pop(); },
  },

  // 5. Business-actor shorthand: :Name:/ or :Name: /
  //    More specific than plain :Name:, so must come first.
  {
    pattern: /^:([^:]+):\s*\/\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'actor-business'));
    },
  },

  // 6. Actor shorthand: :Name:
  {
    pattern: /^:([^:]+):\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'actor'));
    },
  },

  // 7. Business-usecase shorthand: (Name)/ or (Name) /
  {
    pattern: /^\(([^)]+)\)\s*\/\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'usecase-business'));
    },
  },

  // 8. Interface shorthand: () InterfaceName (standalone, no arrow)
  {
    pattern: /^\(\)\s+(\S+)\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'interface'));
    },
  },

  // 9. Links — MUST come before bracket (10) and paren (11) shorthands.
  //    Endpoints: [Comp], () IFace, (UseCase), :Actor:, bare identifier.
  //    Arrows (longest first): ->> --> -> -- ..> .. .>
  {
    pattern: /^((?:\[[^\]]+\]|\(\)\s*\S+|\([^)]+\)|:[^:]+:|\S+))\s*(->>|-->|->|--|\.\.>|\.\.|\.>)\s*((?:\[[^\]]+\]|\(\)\s*\S+|\([^)]+\)|:[^:]+:|\S+))(?:\s*:\s*(.*))?$/,
    execute(state, match) {
      const from = resolveEndpointId(match[1]!.trim());
      const to   = resolveEndpointId(match[3]!.trim());
      const { style, arrowHead, length } = classifyArrow(match[2]!);
      const { stereotype, label } = extractLinkStereotype((match[4] ?? '').trim());
      state.ast.links.push(buildLink({ from, to, style, arrowHead, length, label, stereotype }));
    },
  },

  // 10. Bracket shorthand: [Name] [as Alias] [<<stereotype>>] [#color]
  {
    pattern: /^\[([^\]]+)\](.*)?$/,
    execute(state, match) {
      const bracketName = match[1]!.trim();
      let extra = (match[2] ?? '').trim();
      let id = bracketName;
      const aliasMatch = RE_BRACKET_ALIAS.exec(extra);
      if (aliasMatch !== null) {
        id = aliasMatch[1]!.trim();
        extra = (aliasMatch[2] ?? '').trim();
      }
      let stereotype: string | undefined;
      let color: string | undefined;
      const sr = extractNodeStereotype(extra);
      if (sr !== undefined) {
        stereotype = sr.stereotype;
        const cr = extractColor(sr.remainder.trim());
        if (cr !== undefined) color = cr.color;
      } else {
        const cr = extractColor(extra);
        if (cr !== undefined) color = cr.color;
      }
      emitNode(state, makeNode(id, bracketName, 'component', stereotype, color));
    },
  },

  // 11. Use-case shorthand: (Name) standalone
  {
    pattern: /^\(([^)]+)\)\s*$/,
    execute(state, match) {
      const name = match[1]!.trim();
      emitNode(state, makeNode(name, name, 'usecase'));
    },
  },

  // 12. Container inline block: CONTAINER header { body }
  {
    pattern: CONTAINER_INLINE_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw) ?? 'node';
      const { id, display, stereotype, color } = parseNameSection(match[2]!.trim());
      const container = makeNode(id, display, symbol, stereotype, color);
      for (const child of parseInlineBody(match[3]!)) {
        container.children.push(child);
      }
      emitNode(state, container);
    },
  },

  // 13. Container open block: CONTAINER header {
  {
    pattern: CONTAINER_OPEN_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw) ?? 'node';
      const { id, display, stereotype, color } = parseNameSection(match[2]!.trim());
      const container = makeNode(id, display, symbol, stereotype, color);
      emitNode(state, container);
      state.containerStack.push(container);
    },
  },

  // 14. Generic keyword dispatch: any KEYWORD_TO_SYMBOL key followed by a name.
  //     Handles non-container keywords (artifact, person, boundary, …) and
  //     container keywords used standalone without braces (node Foo).
  //     Business-variant keywords: actor/ Name, usecase/ Name.
  {
    pattern: KEYWORD_RE,
    execute(state, match) {
      const kw = match[1]!.toLowerCase();
      const symbol = KEYWORD_TO_SYMBOL.get(kw);
      if (symbol === undefined) return;
      const { id, display, stereotype, color } = parseNameSection(match[2]!);
      emitNode(state, makeNode(id, display, symbol, stereotype, color));
    },
  },
];

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse a UmlSource block for a descriptive diagram (component / use-case /
 * deployment) into a DescriptionDiagramAST.
 */
export function parseDescription(block: UmlSource): DescriptionDiagramAST {
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
