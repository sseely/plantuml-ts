/**
 * Preprocessor — expands macros, applies conditionals, strips comments,
 * and extracts the !theme hint from raw PlantUML source before any other
 * pipeline stage runs.
 *
 * Pure function: no side effects, no mutation of inputs.
 */

export interface PreprocessorResult {
  readonly lines: readonly string[];
  readonly theme: string | null;
  readonly styles: readonly string[];
  readonly skinparam: ReadonlyMap<string, string>;
}

// ── Define discriminated union ────────────────────────────────────────────────

type SimpleDef = { kind: 'simple'; value: string };
type ParamDef = { kind: 'parametric'; params: string[]; body: string };
type Define = SimpleDef | ParamDef;

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

  // Working copy of the defines map — mutable during processing.
  // Seed from legacy ReadonlyMap<string, string> as simple defines.
  const activeDefines = new Map<string, Define>();
  if (defines !== undefined) {
    for (const [k, v] of defines) {
      activeDefines.set(k, { kind: 'simple', value: v });
    }
  }

  // Regex patterns for directives.
  // Parametric define must be tested BEFORE the plain-value define so that
  // `!define FOO(x) body` is not mismatched as a simple define.
  const RE_DEFINE_PARAMETRIC = /^!define\s+(\w+)\(([^)]*)\)\s+(.+)$/;
  const RE_DEFINE_WITH_VALUE = /^!define\s+(\w+)\s+(.+)$/;
  const RE_DEFINE_NO_VALUE = /^!define\s+(\w+)\s*$/;
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

  /**
   * Returns true when all enclosing conditional blocks are active
   * (i.e., every frame on the stack has include === true).
   */
  function isActive(): boolean {
    return condStack.every((frame) => frame.include);
  }

  /**
   * Apply all active !define substitutions to a line.
   *
   * Simple defines: whole-word token replacement (word-boundary matching).
   * Parametric defines: replace MACRO(arg1,arg2,...) call-sites with the
   * macro body after substituting ##param## tokens.
   *
   * Order matches Java's Defines.applyDefines: simple first, then parametric.
   */
  function applyDefines(line: string): string {
    let result = line;

    // Pass 1 — simple defines (word-boundary replacement).
    for (const [token, def] of activeDefines) {
      if (def.kind !== 'simple') continue;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`\\b${escaped}\\b`, 'g'),
        def.value,
      );
    }

    // Pass 2 — parametric defines (call-site replacement).
    for (const [macroName, def] of activeDefines) {
      if (def.kind !== 'parametric') continue;
      // Quick check before building a RegExp.
      if (!result.includes(`${macroName}(`)) continue;
      const escaped = macroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`\\b${escaped}\\(([^)]*)\\)`, 'g'),
        (_fullMatch, argStr: string) => {
          const args = argStr.split(',').map((a) => a.trim());
          if (args.length !== def.params.length) {
            // Wrong arg count — pass through unchanged.
            return _fullMatch;
          }
          let body = def.body;
          for (let i = 0; i < def.params.length; i++) {
            // replaceAll is available in es2021+ (our target is es2025).
            body = body.replaceAll(`##${def.params[i]!}##`, args[i]!);
          }
          return body;
        },
      );
    }

    return result;
  }

  /**
   * Strip trailing inline comment from a content line.
   * A trailing comment starts at the first ` '` (space + single-quote)
   * sequence.
   */
  function stripTrailingComment(line: string): string {
    const idx = line.indexOf(" '");
    if (idx === -1) return line;
    return line.slice(0, idx);
  }

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

    // Parametric define must be checked before simple-with-value because
    // `!define FOO(x) body` would otherwise partially match RE_DEFINE_WITH_VALUE
    // as name="FOO(x)" value="body".
    const defineParametricMatch = RE_DEFINE_PARAMETRIC.exec(trimmed);
    if (defineParametricMatch !== null) {
      const name = defineParametricMatch[1]!;
      const rawParams = defineParametricMatch[2]!;
      const body = defineParametricMatch[3]!;
      const params = rawParams
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      activeDefines.set(name, { kind: 'parametric', params, body });
      continue;
    }

    const defineWithValueMatch = RE_DEFINE_WITH_VALUE.exec(trimmed);
    if (defineWithValueMatch !== null) {
      activeDefines.set(defineWithValueMatch[1]!, {
        kind: 'simple',
        value: defineWithValueMatch[2]!,
      });
      continue;
    }

    const defineNoValueMatch = RE_DEFINE_NO_VALUE.exec(trimmed);
    if (defineNoValueMatch !== null) {
      activeDefines.set(defineNoValueMatch[1]!, { kind: 'simple', value: '' });
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

    // ── Normal content line: strip trailing comment, apply defines ────────
    const withoutTrailingComment = stripTrailingComment(rawLine);
    const withDefines = applyDefines(withoutTrailingComment);
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

  return { lines: outputLines, theme, styles: styleBlocks, skinparam: skinparamMap };
}
