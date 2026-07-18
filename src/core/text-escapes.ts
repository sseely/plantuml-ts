/**
 * Shared text-escape resolution — `<U+XXXX>`/`<U+XXXXX>` unicode-codepoint
 * escapes and `&#NNN;` HTML numeric character references, resolved to their
 * literal glyph.
 *
 * Faithful (single-pass, char-by-char) port of the two branches of `AtomText
 * .manageSpecialChars` (klimt/creole/legacy/AtomText.java:89-163) — this is
 * the shared creole atom engine's text-decode step, applied to every text
 * atom the jar draws (member/note/entity-display text alike), NOT a
 * description-diagram-specific mechanism. Originally landed description-only
 * (mission I4c, `descdiagram/parse-helpers.ts`); promoted to `core/` (G2/N21)
 * so the class engine's note text can share it rather than re-porting the
 * same two branches — `AtomText`'s other two branches (`~@start`, a bare
 * `\t`) are still not ported: no corpus sample exercises either from this
 * call site.
 */
export function resolveTextEscapes(s: string): string {
  let result = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '&') {
      const m = /^&#(\d+);/.exec(s.slice(i));
      if (m !== null) {
        result += String.fromCodePoint(Number.parseInt(m[1]!, 10));
        i += m[0].length;
        continue;
      }
    } else if (c === '<') {
      const m = /^<U\+([0-9a-fA-F]{4,5})>/.exec(s.slice(i));
      if (m !== null) {
        result += String.fromCodePoint(Number.parseInt(m[1]!, 16));
        i += m[0].length;
        continue;
      }
    }
    result += c;
    i++;
  }
  return result;
}
