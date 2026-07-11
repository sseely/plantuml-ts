/**
 * Preprocessor — expands macros, applies conditionals, strips comments,
 * and extracts the !theme hint from raw PlantUML source before any other
 * pipeline stage runs.
 *
 * Pure function: no side effects, no mutation of inputs.
 */

import { FunctionsSet, type TProcedureParam } from './tim/FunctionsSet.js';
import { parseDeclareProcedureHeader } from './tim/EaterDeclareProcedure.js';
import { expandProcedureCalls } from './tim/TContext.js';
import {
  type Define,
  registerDefine as registerDefineImpl,
  splitDefineParams,
  applyDefines as applyDefinesImpl,
} from './tim/legacy-define.js';

export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
  readonly styles: readonly string[];
  readonly skinparam: ReadonlyMap<string, string>;
}

/**
 * Process raw PlantUML source.
 *
 * @param source  - Raw multi-line string (the full document, not pre-split).
 * @param defines - Optional pre-seeded defines (for testing and include chaining).
 */
export function preprocess(
  source: string,
  defines?: ReadonlyMap<string, string>,
): PreprocessorResult {
  if (source === '') {
    return { lines: [], theme: null, styles: [], skinparam: new Map() };
  }

  // Working copy of the defines map — mutable during processing. Keyed by
  // name to an OVERLOAD LIST, arity-keyed like upstream's function registry
  // — see legacy-define.ts for the full rationale.
  const activeDefines = new Map<string, Define[]>();
  const registerDefine = (name: string, def: Define): void =>
    registerDefineImpl(activeDefines, name, def);
  if (defines !== undefined) {
    for (const [k, v] of defines) {
      registerDefine(k, { kind: 'simple', value: v });
    }
  }

  // Regex patterns for directives.
  // Parametric define must be tested BEFORE the plain-value define so that
  // `!define FOO(x) body` is not mismatched as a simple define.
  const RE_DEFINE_PARAMETRIC = /^!define\s+(\w+)\(([^)]*)\)\s+(.+)$/;
  const RE_DEFINE_WITH_VALUE = /^!define\s+(\w+)\s+(.+)$/;
  const RE_DEFINE_NO_VALUE = /^!define\s+(\w+)\s*$/;
  // `!definelong NAME(params)` … `!enddefinelong` (EaterLegacyDefineLong.java):
  // a multi-line parametric define, body collected verbatim like `!procedure`.
  const RE_DEFINELONG_HEADER = /^!definelong\s+(\w+)\s*\(([^)]*)\)\s*$/i;
  const RE_ENDDEFINELONG = /^!enddefinelong\s*$/i;
  const RE_UNDEFINE = /^!undefine\s+(\w+)\s*$/;
  const RE_IFDEF = /^!ifdef\s+(\w+)\s*$/;
  const RE_IFNDEF = /^!ifndef\s+(\w+)\s*$/;
  const RE_ENDIF = /^!endif\s*$/;
  const RE_ELSE = /^!else\s*$/;
  const RE_THEME = /^!theme\s+(\S+)\s*$/;
  const RE_BLOCK_COMMENT_OPEN = /^\/'/;
  const RE_BLOCK_COMMENT_CLOSE = /'\/\s*$/;
  const RE_STYLE_OPEN = /^<style>$/i;
  const RE_STYLE_CLOSE = /^<\/style>$/i;
  const RE_SKINPARAM_LINE = /^skinparam\s+(\w+)\s+(.+)$/;
  const RE_SKINPARAM_BLOCK_OPEN = /^skinparam\s*\{$/;
  // Selector-scoped block, e.g. `skinparam component {` — inner entries are
  // keyed `<selector><name>` (upstream sugar: `component { Style X }` ≡
  // `skinparam componentStyle X`).
  const RE_SKINPARAM_SELECTOR_BLOCK_OPEN = /^skinparam\s+(\w+)\s*\{$/;
  const RE_SKINPARAM_BLOCK_ENTRY = /^\s*(\w+)\s+(.+)$/;
  const RE_SKINPARAM_BLOCK_CLOSE = /^\s*\}\s*$/;
  const RE_ENDPROCEDURE = /^!endprocedure\s*$/i;

  // ReadLineReader.java:99-102: strip a leading BOM and normalize the
  // en-dash (U+2013) to a hyphen on every line, before any parsing.
  const rawLines = source
    .replace(/\u2013/g, '-')
    .replace(/^\uFEFF/, '')
    .split('\n');
  const outputLines: string[] = [];
  const styleBlocks: string[] = [];
  const skinparamMap = new Map<string, string>();
  let theme: string | null = null;

  // Conditional-inclusion stack.
  // Each entry: { include: boolean }
  // When `include` is false, lines inside the block are skipped.
  // We track depth so nested blocks work correctly.
  type ConditionalFrame = { include: boolean };
  const condStack: ConditionalFrame[] = [];

  // Whether the current position is inside a block comment.
  let inBlockComment = false;

  // Whether we are collecting lines inside a <style>…</style> block.
  let inStyleBlock = false;
  // Buffer for lines inside the current style block.
  const styleBuffer: string[] = [];

  // Whether we are collecting lines inside a skinparam { } block.
  let inSkinparamBlock = false;
  // Selector prefix for the current block (`component` for `skinparam component
  // {`; empty string for the global `skinparam {`).
  let skinparamBlockSelector = '';

  // TIM `!procedure` family (src/core/tim/) — declared procedures, plus the
  // one currently being declared (collecting raw body lines until
  // `!endprocedure`). No `$param` bindings apply at document scope, hence
  // the shared empty map passed to `expandProcedureCalls` below.
  const procedureRegistry = new FunctionsSet();
  const EMPTY_BINDINGS: ReadonlyMap<string, string> = new Map();
  interface PendingProcedure {
    readonly name: string;
    readonly params: readonly TProcedureParam[];
    readonly unquoted: boolean;
    readonly finalFlag: boolean;
    readonly body: string[];
  }
  let pendingProcedure: PendingProcedure | null = null;

  // `!definelong` currently being collected (raw body lines until
  // `!enddefinelong`) — see RE_DEFINELONG_HEADER/RE_ENDDEFINELONG above.
  interface PendingDefineLong {
    readonly name: string;
    readonly params: string[];
    readonly body: string[];
  }
  let pendingDefineLong: PendingDefineLong | null = null;

  /**
   * Returns true when all enclosing conditional blocks are active
   * (i.e., every frame on the stack has include === true).
   */
  function isActive(): boolean {
    return condStack.every((frame) => frame.include);
  }

  /** Apply all active !define/!definelong substitutions to a line — see
   *  legacy-define.ts's `applyDefines` for the fixed-point/nesting rationale. */
  const applyDefines = (line: string): string => applyDefinesImpl(activeDefines, line);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // ── Block comment handling ──────────────────────────────────────────────
    if (inBlockComment) {
      if (RE_BLOCK_COMMENT_CLOSE.test(trimmed)) {
        inBlockComment = false;
      }
      // Either way, discard this line.
      continue;
    }

    if (RE_BLOCK_COMMENT_OPEN.test(trimmed)) {
      // Check if it also closes on the same line.
      if (!RE_BLOCK_COMMENT_CLOSE.test(trimmed.slice(2))) {
        inBlockComment = true;
      }
      // Discard the opening line regardless.
      continue;
    }

    // ── Single-line comment (starts with ') ─────────────────────────────────
    if (trimmed.startsWith("'")) {
      // Only strip if we're currently inside an active block; otherwise the
      // skip-inactive-block logic will handle it via the `isActive()` guard
      // below. But since we continue immediately, it doesn't matter — either
      // way the line is not emitted.
      continue;
    }

    // ── TIM procedure declaration / body capture ────────────────────────
    // Placed before the `isActive()` conditional-inclusion check below,
    // matching upstream's iterator composition
    // (CodeIteratorProcedure wraps CodeIteratorReturnFunction and is itself
    // wrapped by CodeIteratorIf — see TContext#buildCodeIterator), which
    // means a `!procedure` declaration is parsed and registered even when
    // lexically nested inside an inactive `!ifdef`/`!ifndef` block. This is
    // a genuine (if surprising) upstream behavior, not a simplification.
    if (pendingProcedure !== null) {
      if (RE_ENDPROCEDURE.test(trimmed)) {
        procedureRegistry.declare({ ...pendingProcedure });
        pendingProcedure = null;
      } else {
        pendingProcedure.body.push(rawLine);
      }
      continue;
    }
    const declareHeader = parseDeclareProcedureHeader(trimmed);
    if (declareHeader !== null) {
      pendingProcedure = { ...declareHeader, body: [] };
      continue;
    }

    // ── Preprocessor directives — evaluated even inside inactive blocks ──
    // (We must track !ifdef / !endif depth regardless of active status.)

    const endifMatch = RE_ENDIF.test(trimmed);
    if (endifMatch) {
      condStack.pop();
      continue;
    }

    const elseMatch = RE_ELSE.test(trimmed);
    if (elseMatch) {
      const frame = condStack[condStack.length - 1];
      if (frame !== undefined) {
        frame.include = !frame.include;
      }
      continue;
    }

    const ifdefMatch = RE_IFDEF.exec(trimmed);
    if (ifdefMatch !== null) {
      const token = ifdefMatch[1]!;
      condStack.push({ include: activeDefines.has(token) });
      continue;
    }

    const ifndefMatch = RE_IFNDEF.exec(trimmed);
    if (ifndefMatch !== null) {
      const token = ifndefMatch[1]!;
      condStack.push({ include: !activeDefines.has(token) });
      continue;
    }

    // ── Skip lines inside an inactive conditional block ──────────────────
    if (!isActive()) {
      // If we were collecting a style block inside an inactive branch,
      // discard it when we hit </style>.
      if (inStyleBlock && RE_STYLE_CLOSE.test(trimmed)) {
        inStyleBlock = false;
        styleBuffer.length = 0;
      }
      // If we were collecting a skinparam block inside an inactive branch,
      // discard it when we hit the closing brace.
      if (inSkinparamBlock && RE_SKINPARAM_BLOCK_CLOSE.test(trimmed)) {
        inSkinparamBlock = false;
      }
      continue;
    }

    // ── Legacy !definelong body collection (active blocks only) ──────────
    if (pendingDefineLong !== null) {
      if (RE_ENDDEFINELONG.test(trimmed)) {
        registerDefine(pendingDefineLong.name, {
          kind: 'parametric',
          params: pendingDefineLong.params,
          body: pendingDefineLong.body.join('\n'),
        });
        pendingDefineLong = null;
      } else {
        pendingDefineLong.body.push(rawLine);
      }
      continue;
    }

    // ── Style block handling (active blocks only) ─────────────────────────
    if (inStyleBlock) {
      if (RE_STYLE_CLOSE.test(trimmed)) {
        // Commit the collected buffer as one style entry.
        styleBlocks.push(styleBuffer.join('\n'));
        styleBuffer.length = 0;
        inStyleBlock = false;
      } else {
        // Collect verbatim — no define substitution, no comment stripping.
        styleBuffer.push(rawLine);
      }
      continue;
    }

    if (RE_STYLE_OPEN.test(trimmed)) {
      inStyleBlock = true;
      // Do not emit the opening tag.
      continue;
    }

    // ── Skinparam block handling (active blocks only) ─────────────────────
    if (inSkinparamBlock) {
      if (RE_SKINPARAM_BLOCK_CLOSE.test(trimmed)) {
        inSkinparamBlock = false;
        skinparamBlockSelector = '';
      } else {
        const entryMatch = RE_SKINPARAM_BLOCK_ENTRY.exec(trimmed);
        if (entryMatch !== null) {
          const key = (skinparamBlockSelector + entryMatch[1]!.trim()).toLowerCase();
          const value = entryMatch[2]!.trim();
          skinparamMap.set(key, value);
        }
      }
      // Consume the line — do not emit to outputLines.
      continue;
    }

    // ── Directives that consume the line and have side effects ────────────

    const themeMatch = RE_THEME.exec(trimmed);
    if (themeMatch !== null) {
      theme = themeMatch[1]!;
      continue;
    }

    // `!definelong NAME(params)` header — starts multi-line body collection,
    // mirroring the `!procedure`/`!endprocedure` buffering above, but (per
    // TContext#buildCodeIterator: CodeIteratorLegacyDefine WRAPS
    // CodeIteratorIf) only recognized in an ACTIVE block, unlike `!procedure`
    // — this check sits after the `isActive()` guard further up, not before.
    const defineLongHeaderMatch = RE_DEFINELONG_HEADER.exec(trimmed);
    if (defineLongHeaderMatch !== null) {
      pendingDefineLong = {
        name: defineLongHeaderMatch[1]!,
        params: splitDefineParams(defineLongHeaderMatch[2]!),
        body: [],
      };
      continue;
    }

    // Parametric define must be checked before simple-with-value because
    // `!define FOO(x) body` would otherwise partially match RE_DEFINE_WITH_VALUE
    // as name="FOO(x)" value="body".
    const defineParametricMatch = RE_DEFINE_PARAMETRIC.exec(trimmed);
    if (defineParametricMatch !== null) {
      const name = defineParametricMatch[1]!;
      const params = splitDefineParams(defineParametricMatch[2]!);
      registerDefine(name, { kind: 'parametric', params, body: defineParametricMatch[3]! });
      continue;
    }

    const defineWithValueMatch = RE_DEFINE_WITH_VALUE.exec(trimmed);
    if (defineWithValueMatch !== null) {
      registerDefine(defineWithValueMatch[1]!, {
        kind: 'simple',
        value: defineWithValueMatch[2]!,
      });
      continue;
    }

    const defineNoValueMatch = RE_DEFINE_NO_VALUE.exec(trimmed);
    if (defineNoValueMatch !== null) {
      registerDefine(defineNoValueMatch[1]!, { kind: 'simple', value: '' });
      continue;
    }

    const undefineMatch = RE_UNDEFINE.exec(trimmed);
    if (undefineMatch !== null) {
      activeDefines.delete(undefineMatch[1]!);
      continue;
    }

    // ── Skinparam directives ──────────────────────────────────────────────

    // Check block-open before single-line so `skinparam {` is not
    // mismatched by RE_SKINPARAM_LINE.
    if (RE_SKINPARAM_BLOCK_OPEN.test(trimmed)) {
      inSkinparamBlock = true;
      skinparamBlockSelector = '';
      // Do not emit the opening line.
      continue;
    }

    // Selector-scoped block `skinparam <selector> {` — must precede the
    // single-line match (which would otherwise capture `<selector>`=`{`).
    const selectorBlockMatch = RE_SKINPARAM_SELECTOR_BLOCK_OPEN.exec(trimmed);
    if (selectorBlockMatch !== null) {
      inSkinparamBlock = true;
      skinparamBlockSelector = selectorBlockMatch[1]!.trim().toLowerCase();
      continue;
    }

    const skinparamLineMatch = RE_SKINPARAM_LINE.exec(trimmed);
    if (skinparamLineMatch !== null) {
      const key = skinparamLineMatch[1]!.trim().toLowerCase();
      const value = skinparamLineMatch[2]!.trim();
      skinparamMap.set(key, value);
      // Do not emit the skinparam line.
      continue;
    }

    // ── Normal content line: expand !procedure calls, apply defines. ──────
    // `expandProcedureCalls` is a transparent passthrough (`[rawLine]`)
    // whenever no procedure has been declared, so this adds no behavior
    // change for the common case. A bare mid-line `'` is ordinary text
    // upstream (only full-line and `/' ... '/` block comments exist —
    // preproc2/ReadFilterQuoteComment.java:66, text/StringLocated.java:209-229,
    // live-oracle-verified) — no trailing-comment stripping here.
    for (const procLine of expandProcedureCalls(rawLine, procedureRegistry, EMPTY_BINDINGS)) {
      const withDefines = applyDefines(procLine);
      // %n() and %newline() are built-in functions that produce a newline,
      // potentially splitting one source line into multiple output lines.
      const expanded = withDefines.replace(/%n\(\)|%newline\(\)/gi, '\n');
      for (const segment of expanded.split('\n')) {
        const finalLine = segment.trimEnd();
        if (finalLine.length > 0) {
          outputLines.push(finalLine);
        }
      }
    }
  }

  return { lines: outputLines, theme, styles: styleBlocks, skinparam: skinparamMap };
}
