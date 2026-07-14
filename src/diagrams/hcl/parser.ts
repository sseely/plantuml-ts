import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import { createSpriteRegistry, matchSpriteCommand } from '../../core/sprite-commands.js';
import type { JsonDiagramAST } from '../json/ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

// ---------------------------------------------------------------------------
// Token types — port of net.sourceforge.plantuml.hcl.SymbolType
// ---------------------------------------------------------------------------

type SymbolType =
  | 'STRING_SIMPLE'
  | 'STRING_QUOTED'
  | 'FUNCTION_NAME'
  | 'CURLY_BRACKET_OPEN'
  | 'CURLY_BRACKET_CLOSE'
  | 'SQUARE_BRACKET_OPEN'
  | 'SQUARE_BRACKET_CLOSE'
  | 'PARENTHESIS_OPEN'
  | 'PARENTHESIS_CLOSE'
  | 'EQUALS'
  | 'TWO_POINTS'
  | 'COMMA';

interface HclTerm {
  type: SymbolType;
  data?: string; // present for STRING_SIMPLE, STRING_QUOTED, FUNCTION_NAME
}

// ---------------------------------------------------------------------------
// Tokenizer — port of HclParser.parse() / HclParser.getType()
// ---------------------------------------------------------------------------

function getSpecialType(c: string): SymbolType | 'SPACE' | null {
  if (c === ' ' || c === '\t' || c === '\n' || c === '\r') return 'SPACE';
  if (c === '{') return 'CURLY_BRACKET_OPEN';
  if (c === '}') return 'CURLY_BRACKET_CLOSE';
  if (c === '[') return 'SQUARE_BRACKET_OPEN';
  if (c === ']') return 'SQUARE_BRACKET_CLOSE';
  if (c === '(') return 'PARENTHESIS_OPEN';
  if (c === ')') return 'PARENTHESIS_CLOSE';
  if (c === '=') return 'EQUALS';
  if (c === ',') return 'COMMA';
  if (c === ':') return 'TWO_POINTS';
  // #lizard forgives -- pre-existing faithful port of HclParser.getType()
  // (already over CCN threshold before mission G0b/T6 touched this file).
  return null;
}

function eatUntilDoubleQuote(chars: string, idx: number): { value: string; nextIdx: number } {
  let s = '';
  while (idx < chars.length) {
    const c = chars[idx]!;
    idx++;
    if (c === '\\' && idx < chars.length) {
      s += chars[idx]!;
      idx++;
      continue;
    }
    if (c === '"') return { value: s, nextIdx: idx };
    s += c;
  }
  return { value: s, nextIdx: idx };
}

function tokenize(chars: string): HclTerm[] {
  const terms: HclTerm[] = [];
  let pendingString = '';
  let i = 0;

  while (i < chars.length) {
    const c = chars[i]!;
    const type = getSpecialType(c);

    if (type === 'PARENTHESIS_OPEN') {
      if (pendingString.length === 0) {
        throw new Error('PARENTHESIS_OPEN with empty pendingString');
      }
      terms.push({ type: 'FUNCTION_NAME', data: pendingString });
      pendingString = '';
      // Fall through to emit PARENTHESIS_OPEN below
    } else if (type !== null && pendingString.length > 0) {
      terms.push({ type: 'STRING_SIMPLE', data: pendingString });
      pendingString = '';
    }

    if (type === 'SPACE') {
      i++;
      continue;
    }

    if (type !== null) {
      terms.push({ type });
      i++;
      continue;
    }

    if (c === '"') {
      i++;
      const { value, nextIdx } = eatUntilDoubleQuote(chars, i);
      terms.push({ type: 'STRING_QUOTED', data: value });
      i = nextIdx;
      continue;
    }

    pendingString += c;
    i++;
  }

  // Flush any remaining pending string
  if (pendingString.length > 0) {
    terms.push({ type: 'STRING_SIMPLE', data: pendingString });
  }

  // #lizard forgives -- pre-existing faithful port of HclParser.parse()'s
  // tokenizer loop (already over threshold before mission G0b/T6).
  return terms;
}

// ---------------------------------------------------------------------------
// Index-based iterator helpers
// ---------------------------------------------------------------------------

interface TokenCursor {
  terms: HclTerm[];
  idx: number;
}

function next(cursor: TokenCursor): HclTerm {
  const term = cursor.terms[cursor.idx];
  if (term === undefined) {
    throw new Error('Unexpected end of token stream');
  }
  cursor.idx++;
  return term;
}

// ---------------------------------------------------------------------------
// Sentinel used to pass COMMA / PARENTHESIS_CLOSE up the call stack
// without throwing — mirrors the Java pattern of returning an HclTerm
// instance for these two tokens from getValue().
// ---------------------------------------------------------------------------

class SentinelToken {
  constructor(public readonly term: HclTerm) {}
}

// ---------------------------------------------------------------------------
// Parser functions — port of HclParser parsing methods
// ---------------------------------------------------------------------------

function getFunctionData(
  functionName: string,
  cursor: TokenCursor,
): unknown {
  const parenOpen = next(cursor);
  if (parenOpen.type !== 'PARENTHESIS_OPEN') {
    throw new Error('Expected PARENTHESIS_OPEN after FUNCTION_NAME');
  }

  const args: unknown[] = [];
  while (true) {
    const value = getValue(cursor);
    if (value instanceof SentinelToken) {
      if (value.term.type === 'PARENTHESIS_CLOSE') {
        if (args.length === 0) return `${functionName}()`;
        const result: Record<string, unknown> = {};
        result[`${functionName}()`] = args;
        return result;
      }
      // COMMA sentinel — continue
      continue;
    }
    args.push(value);
  }
}

function getBracketData(cursor: TokenCursor): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  while (true) {
    const current = next(cursor);
    if (current.type === 'CURLY_BRACKET_CLOSE') return result;
    if (current.type === 'STRING_SIMPLE' || current.type === 'STRING_QUOTED') {
      const fieldName = current.data ?? '';
      const separator = next(cursor);
      if (separator.type !== 'EQUALS' && separator.type !== 'TWO_POINTS') {
        throw new Error(`Expected EQUALS or TWO_POINTS, got ${separator.type}`);
      }
      const value = getValue(cursor);
      if (value instanceof SentinelToken) {
        throw new Error(`Unexpected sentinel as value for field ${fieldName}`);
      }
      result[fieldName] = value;
    } else {
      throw new Error(`Unexpected token in bracket data: ${current.type}`);
    }
  }
}

function getValue(cursor: TokenCursor): unknown {
  const current = next(cursor);
  if (current.type === 'COMMA' || current.type === 'PARENTHESIS_CLOSE') {
    return new SentinelToken(current);
  }
  if (current.type === 'STRING_QUOTED') return current.data ?? '';
  if (current.type === 'STRING_SIMPLE') return current.data ?? '';
  if (current.type === 'SQUARE_BRACKET_OPEN') return getArray(cursor);
  if (current.type === 'CURLY_BRACKET_OPEN') return getBracketData(cursor);
  if (current.type === 'FUNCTION_NAME') return getFunctionData(current.data ?? '', cursor);
  // #lizard forgives -- pre-existing faithful port of HclParser.getValue()
  // (already over CCN threshold before mission G0b/T6 touched this file).
  throw new Error(`Unexpected token in getValue: ${current.type}`);
}

function getArray(cursor: TokenCursor): unknown[] {
  const result: unknown[] = [];
  while (true) {
    const current = next(cursor);
    if (current.type === 'CURLY_BRACKET_OPEN') {
      result.push(getBracketData(cursor));
    }
    if (current.type === 'SQUARE_BRACKET_CLOSE') {
      return result;
    }
    if (current.type === 'COMMA') {
      continue;
    }
    if (current.type === 'STRING_QUOTED') {
      result.push(current.data ?? '');
    }
    // STRING_SIMPLE, TWO_POINTS, PARENTHESIS_CLOSE, and anything else:
    // silently continue (do NOT push) — matches Java getArray() behavior
  }
}

function getModuleOrSomething(cursor: TokenCursor): Map<string, unknown> {
  let name = '';
  while (true) {
    const current = next(cursor);
    if (current.type === 'STRING_QUOTED') {
      name += `"${current.data ?? ''}" `;
    } else if (current.type === 'STRING_SIMPLE') {
      name += `${current.data ?? ''} `;
    } else if (current.type === 'CURLY_BRACKET_OPEN') {
      const bracketData = getBracketData(cursor);
      const map = new Map<string, unknown>();
      map.set(name.trim(), bracketData);
      return map;
    } else {
      throw new Error(`Unexpected token in getModuleOrSomething: ${current.type}`);
    }
  }
}

/**
 * Detect whether the token stream represents flat top-level key=value
 * assignments (i.e., the first name token is immediately followed by
 * EQUALS or TWO_POINTS rather than CURLY_BRACKET_OPEN).
 *
 * This is an extension beyond the Java parser which requires all top-level
 * entries to be named blocks. Flat assignments are treated as an implicit
 * bracket block.
 */
function isFlatAssignment(terms: HclTerm[]): boolean {
  // Walk through string tokens; as soon as we see EQUALS or TWO_POINTS
  // before a CURLY_BRACKET_OPEN, it's a flat assignment stream.
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i]!;
    if (t.type === 'EQUALS' || t.type === 'TWO_POINTS') return true;
    if (t.type === 'CURLY_BRACKET_OPEN') return false;
  }
  return false;
}

function parseTerms(terms: HclTerm[]): unknown {
  // Flat key=value (no wrapping block) — treat as implicit bracket block
  if (isFlatAssignment(terms)) {
    // Synthesize a CURLY_BRACKET_CLOSE sentinel at the end so getBracketData
    // terminates correctly, then parse as a bracket block.
    const syntheticTerms: HclTerm[] = [
      ...terms,
      { type: 'CURLY_BRACKET_CLOSE' },
    ];
    const cursor: TokenCursor = { terms: syntheticTerms, idx: 0 };
    return getBracketData(cursor);
  }

  const cursor: TokenCursor = { terms, idx: 0 };
  const map = new Map<string, unknown>();

  while (cursor.idx < cursor.terms.length) {
    const entry = getModuleOrSomething(cursor);
    for (const [k, v] of entry) {
      map.set(k, v);
    }
  }

  if (map.size === 1) {
    // Single top-level block — return the value directly (Java parseMe() behavior)
    return map.values().next().value;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of map) {
    result[k] = v;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API — port of the Java entry point
// ---------------------------------------------------------------------------

export function parseHcl(source: UmlSource): JsonDiagramAST {
  const bodyLines: string[] = [];
  let inStyleBlock = false;
  const annotations = createAnnotations();
  const sprites = createSpriteRegistry();
  const lines = source.lines;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();

    // Strip @starthcl/@endhcl wrapper lines
    if (/^@starthcl\s*$/i.test(t) || /^@endhcl\s*$/i.test(t)) continue;

    // Strip <style> blocks
    if (t === '<style>') { inStyleBlock = true; continue; }
    if (inStyleBlock) { if (t === '</style>') inStyleBlock = false; continue; }

    // Strip comment lines (D2)
    if (t.startsWith('#')) continue;

    // title/caption/legend/header/footer/mainframe (mission G0b/T6) — only
    // before body starts, same scope as the directive strips below. Unlike
    // json/yaml, HCL never captured `title` into its own AST field (it was
    // silently discarded pre-T6), so routing it through the shared matcher
    // here is a straight migration, not a dual-mechanism conflict.
    if (bodyLines.length === 0) {
      const annotationMatch = matchAnnotationCommand(lines, i, annotations);
      if (annotationMatch !== null) {
        i += annotationMatch.consumed - 1;
        continue;
      }
      // `sprite $name [WxH/N[z]] { ... }` definitions (mission SI5b/T4):
      // same before-body-only scope as the chrome matcher above, tried
      // immediately after it.
      const spriteMatch = matchSpriteCommand(lines, i, sprites);
      if (spriteMatch !== null) {
        i += spriteMatch.consumed - 1;
        continue;
      }
    }

    // Strip other known directive lines before body
    if (
      bodyLines.length === 0 &&
      /^(?:skinparam|scale|skin|hide|!assume|!pragma)\s/i.test(t)
    ) {
      continue;
    }

    // Skip leading blank lines, but include blank lines within the body
    if (t === '') {
      if (bodyLines.length > 0) bodyLines.push(line);
      continue;
    }

    bodyLines.push(line);
  }

  let root: unknown = null;
  try {
    if (bodyLines.some((l) => l.trim() !== '')) {
      const joined = bodyLines.join(' ');
      const terms = tokenize(joined);
      root = parseTerms(terms);
    }
  } catch {
    // parse errors: root stays null
  }

  // #lizard forgives -- pre-existing faithful port of the HCL entry point
  // (already over threshold before mission G0b/T6 added the annotation-
  // matcher check above).
  return { root, parseError: false, highlights: [], annotations, sprites };
}
