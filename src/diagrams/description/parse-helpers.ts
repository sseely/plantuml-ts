/**
 * Pure, stateless helpers for the descriptive-diagram parser.
 *
 * Extracted so both modules stay under 500 lines and each function stays
 * under 30 NLOC. All regex literals that contain $, " or ' are pre-compiled
 * at module scope — Lizard 1.23.0 miscounts braces when those chars appear
 * inside /regex/ literals inside function bodies.
 */

import {
  KEYWORD_TO_SYMBOL,
  type USymbol,
} from '../../core/descriptive-keywords.js';
import type { DescriptiveNode } from './ast.js';

// ---------------------------------------------------------------------------
// Container symbols — exported so layout.ts and renderer.ts can import them.
// The 17 keywords upstream allows to open a `{` group: the SYMBOL alternation
// in descdiagram/command/CommandPackageWithUSymbol.java.
// ---------------------------------------------------------------------------

export const CONTAINER_SYMBOLS: ReadonlySet<USymbol> = new Set<USymbol>([
  'package',
  'rectangle',
  'hexagon',
  'node',
  'artifact',
  'folder',
  'file',
  'frame',
  'cloud',
  'action',
  'process',
  'database',
  'storage',
  'component',
  'card',
  'queue',
  'stack',
]);

// ---------------------------------------------------------------------------
// Named return-type interfaces (prevent Lizard brace-counting confusion)
// ---------------------------------------------------------------------------

export interface StereotypeResult {
  stereotype: string;
  remainder: string;
}

export interface ColorResult {
  color: string;
  remainder: string;
}

export interface LinkStereoResult {
  stereotype: string | undefined;
  label: string | undefined;
}

export interface NameSection {
  id: string;
  display: string;
  stereotype?: string;
  color?: string;
}

interface IdDisplay {
  id: string;
  display: string;
}

// ---------------------------------------------------------------------------
// Module-level regex constants
// Lizard 1.23.0 miscounts brace depth when $, " or ' appear inside /regex/
// literals in function bodies, producing false NLOC attribution. Defining
// them here (outside any function) avoids the issue entirely.
// ---------------------------------------------------------------------------

// extractColor
const RE_COLOR = /(#\w+)\s*$/;

// parseAliasForms — quoted / paren / alias forms
const RE_DQ_AS_ALIAS = /^"([^"]+)"\s+as\s+(\S+)$/;
const RE_SQ_AS_ALIAS = /^'([^']+)'\s+as\s+(\S+)$/;
const RE_ID_AS_DQ   = /^(\S+)\s+as\s+"([^"]+)"$/;
const RE_ID_AS_SQ   = /^(\S+)\s+as\s+'([^']+)'$/;
const RE_PAREN_ALIAS = /^\(([^)]+)\)\s+as\s+(\S+)$/;
const RE_PAREN_ONLY  = /^\(([^)]+)\)$/;
const RE_PLAIN_ALIAS = /^(\S+)\s+as\s+(\S+)$/;

// parseNameSection — quoted-only form
const RE_DQ_ONLY = /^"([^"]+)"$/;

// ---------------------------------------------------------------------------
// Node factory
// ---------------------------------------------------------------------------

/** Build a DescriptiveNode, omitting optional fields when undefined. */
export function makeNode(
  id: string,
  display: string,
  symbol: USymbol,
  stereotype?: string,
  color?: string,
): DescriptiveNode {
  const node: DescriptiveNode = { id, display, symbol, children: [] };
  if (stereotype !== undefined) node.stereotype = stereotype;
  if (color !== undefined) node.color = color;
  return node;
}

// ---------------------------------------------------------------------------
// Stereotype and color helpers
// ---------------------------------------------------------------------------

/** Extract angle-bracket stereotype from a node-declaration remainder. */
export function extractNodeStereotype(rest: string): StereotypeResult | undefined {
  const m = /<<\s*(.+?)\s*>>/.exec(rest);
  if (m === null) return undefined;
  const stereotype = m[1]!;
  const before = rest.slice(0, m.index).trimEnd();
  const after = rest.slice(m.index + m[0].length).trimStart();
  return { stereotype, remainder: before + after };
}

/** Extract trailing color token from a declaration remainder. */
export function extractColor(rest: string): ColorResult | undefined {
  const m = RE_COLOR.exec(rest);
  if (m === null) return undefined;
  return { color: m[1]!, remainder: rest.slice(0, m.index).trimEnd() };
}

/** Extract angle-bracket stereotype from a link label string. */
export function extractLinkStereotype(raw: string): LinkStereoResult {
  const m = /<<([^>]+)>>/.exec(raw);
  if (m === null) {
    const t = raw.trim();
    return { stereotype: undefined, label: t.length > 0 ? t : undefined };
  }
  const stereotype = m[1]!.trim();
  const remaining = raw.replace(/<<[^>]+>>/, '').trim();
  return { stereotype, label: remaining.length > 0 ? remaining : undefined };
}

// ---------------------------------------------------------------------------
// Name-section parsing — split across two functions to stay under 30 NLOC
// ---------------------------------------------------------------------------

/** Try every quoted / paren / plain alias form; return id+display or undefined. */
function parseAliasForms(remainder: string): IdDisplay | undefined {
  const m1 = RE_DQ_AS_ALIAS.exec(remainder);
  if (m1 !== null) return { id: m1[2]!, display: m1[1]! };

  const m2 = RE_SQ_AS_ALIAS.exec(remainder);
  if (m2 !== null) return { id: m2[2]!, display: m2[1]! };

  const m3 = RE_ID_AS_DQ.exec(remainder);
  if (m3 !== null) return { id: m3[1]!, display: m3[2]! };

  const m4 = RE_ID_AS_SQ.exec(remainder);
  if (m4 !== null) return { id: m4[1]!, display: m4[2]! };

  const m5 = RE_PAREN_ALIAS.exec(remainder);
  if (m5 !== null) return { id: m5[2]!, display: m5[1]!.trim() };

  const m6 = RE_PAREN_ONLY.exec(remainder);
  if (m6 !== null) { const n = m6[1]!.trim(); return { id: n, display: n }; }

  const m7 = RE_PLAIN_ALIAS.exec(remainder);
  if (m7 !== null) return { id: m7[2]!, display: m7[1]! };

  return undefined;
}

/**
 * Build a NameSection from parsed id/display and optional stereotype/color.
 * Uses imperative assignment to satisfy exactOptionalPropertyTypes — spreading
 * `{ stereotype: undefined }` is not allowed for `stereotype?: string`.
 */
function buildNameSection(
  id: string,
  display: string,
  stereotype: string | undefined,
  color: string | undefined,
): NameSection {
  const section: NameSection = { id, display };
  if (stereotype !== undefined) section.stereotype = stereotype;
  if (color !== undefined) section.color = color;
  return section;
}

/**
 * Parse the name/alias/color/stereotype section of a keyword declaration.
 * Delegates alias matching to parseAliasForms to stay under 30 NLOC.
 */
export function parseNameSection(rest: string): NameSection {
  let remainder = rest.trim();
  let stereotype: string | undefined;
  let color: string | undefined;

  const sr = extractNodeStereotype(remainder);
  if (sr !== undefined) { stereotype = sr.stereotype; remainder = sr.remainder.trim(); }

  const cr = extractColor(remainder);
  if (cr !== undefined) { color = cr.color; remainder = cr.remainder.trim(); }

  const aliases = parseAliasForms(remainder);
  if (aliases !== undefined) {
    return buildNameSection(aliases.id, aliases.display, stereotype, color);
  }

  const mq = RE_DQ_ONLY.exec(remainder);
  if (mq !== null) {
    return buildNameSection(mq[1]!, mq[1]!, stereotype, color);
  }

  const id = remainder.trim();
  return buildNameSection(id, id, stereotype, color);
}

// ---------------------------------------------------------------------------
// Inline body parser (for single-line container blocks)
// ---------------------------------------------------------------------------

/**
 * Parse the body of a single-line container block such as { (A) [B] }.
 * Recognises: [Name] component, () Name interface, (Name) usecase, :Name: actor.
 */
export function parseInlineBody(body: string): DescriptiveNode[] {
  const nodes: DescriptiveNode[] = [];
  let m: RegExpExecArray | null;

  const compRe = /\[([^\]]+)\]/g;
  while ((m = compRe.exec(body)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'component'));
  }

  const noBrackets = body.replace(/\[[^\]]*\]/g, '');

  const ifaceRe = /\(\)\s*(\S+)/g;
  while ((m = ifaceRe.exec(noBrackets)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'interface'));
  }

  const noIface = noBrackets.replace(/\(\)\s*\S+/g, '');

  const parenRe = /\(([^)]+)\)/g;
  while ((m = parenRe.exec(noIface)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'usecase'));
  }

  const colonRe = /:([^:]+):/g;
  const noParens = noIface.replace(/\([^)]*\)/g, '');
  while ((m = colonRe.exec(noParens)) !== null) {
    nodes.push(makeNode(m[1]!.trim(), m[1]!.trim(), 'actor'));
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Dynamic regexes derived from KEYWORD_TO_SYMBOL (single source of truth)
// ---------------------------------------------------------------------------

const CONTAINER_KW_ALT = [...CONTAINER_SYMBOLS].join('|');

const ALL_KW_ALT = [...KEYWORD_TO_SYMBOL.keys()]
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

/** Container keyword + inline body: package P { [A] [B] } */
export const CONTAINER_INLINE_RE = new RegExp(
  `^(${CONTAINER_KW_ALT})\\s+(.*?)\\s*\\{([^}]*)\\}\\s*$`,
  'i',
);

/** Container keyword opening a multi-line block: package P { */
export const CONTAINER_OPEN_RE = new RegExp(
  `^(${CONTAINER_KW_ALT})\\s+(.*?)\\s*\\{\\s*$`,
  'i',
);

/** Any keyword followed by at least one space and a name rest. */
export const KEYWORD_RE = new RegExp(`^(${ALL_KW_ALT})\\s+(.+)$`, 'i');
