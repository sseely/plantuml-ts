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
    return { lines: [], theme: null };
  }

  // Working copy of the defines map — mutable during processing.
  const activeDefines = new Map<string, string>(defines ?? []);

  // Regex patterns for directives.
  const RE_DEFINE_WITH_VALUE = /^!define\s+(\w+)\s+(.+)$/;
  const RE_DEFINE_NO_VALUE = /^!define\s+(\w+)\s*$/;
  const RE_UNDEFINE = /^!undefine\s+(\w+)\s*$/;
  const RE_IFDEF = /^!ifdef\s+(\w+)\s*$/;
  const RE_IFNDEF = /^!ifndef\s+(\w+)\s*$/;
  const RE_ENDIF = /^!endif\s*$/;
  const RE_THEME = /^!theme\s+(\S+)\s*$/;
  const RE_BLOCK_COMMENT_OPEN = /^\/'/;
  const RE_BLOCK_COMMENT_CLOSE = /'\/\s*$/;

  const rawLines = source.split('\n');
  const outputLines: string[] = [];
  let theme: string | null = null;

  // Conditional-inclusion stack.
  // Each entry: { include: boolean, directive: 'ifdef' | 'ifndef' }
  // When `include` is false, lines inside the block are skipped.
  // We track depth so nested blocks work correctly.
  type ConditionalFrame = { include: boolean };
  const condStack: ConditionalFrame[] = [];

  // Whether the current position is inside a block comment.
  let inBlockComment = false;

  /**
   * Returns true when all enclosing conditional blocks are active
   * (i.e., every frame on the stack has include === true).
   */
  function isActive(): boolean {
    return condStack.every((frame) => frame.include);
  }

  /**
   * Apply all active !define substitutions to a line.
   * Tokens are replaced as whole words only (word-boundary matching).
   */
  function applyDefines(line: string): string {
    let result = line;
    for (const [token, value] of activeDefines) {
      // Use a RegExp so we can use the global flag for multiple occurrences.
      // Escape the token in case it contains regex special chars (unlikely
      // for PlantUML identifiers, but defensive).
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), value);
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
      continue;
    }

    // ── Directives that consume the line and have side effects ────────────

    const themeMatch = RE_THEME.exec(trimmed);
    if (themeMatch !== null) {
      theme = themeMatch[1]!;
      continue;
    }

    const defineWithValueMatch = RE_DEFINE_WITH_VALUE.exec(trimmed);
    if (defineWithValueMatch !== null) {
      activeDefines.set(defineWithValueMatch[1]!, defineWithValueMatch[2]!);
      continue;
    }

    const defineNoValueMatch = RE_DEFINE_NO_VALUE.exec(trimmed);
    if (defineNoValueMatch !== null) {
      activeDefines.set(defineNoValueMatch[1]!, '');
      continue;
    }

    const undefineMatch = RE_UNDEFINE.exec(trimmed);
    if (undefineMatch !== null) {
      activeDefines.delete(undefineMatch[1]!);
      continue;
    }

    // ── Normal content line: strip trailing comment, apply defines ────────
    const withoutTrailingComment = stripTrailingComment(rawLine);
    const withDefines = applyDefines(withoutTrailingComment);
    const finalLine = withDefines.trimEnd();

    if (finalLine.length > 0) {
      outputLines.push(finalLine);
    }
  }

  return { lines: outputLines, theme };
}
