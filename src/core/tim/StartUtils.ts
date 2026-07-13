/**
 * The two directive probes `DiagramExtractor` needs: is this line a
 * `@start...` / `@end...` (or the backslash spelling, `\startuml`)?
 *
 * Scope guard: upstream's `StartUtils` is a 200-line grab-bag (pause/unpause
 * directives, `beforeStartUml`, filename patterns, `@start` argument parsing).
 * Only the two probes below have a caller in this port; the rest is not ported.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/utils/StartUtils.java
 */

/** @see ~/git/plantuml/.../utils/StartUtils.java#isStartDirective */
export function isStartDirective(s: string): boolean {
  const n = s.length;
  let i = 0;
  while (i < n && /\s/u.test(s.charAt(i))) i++;
  if (i >= n) return false;

  const c = s.charAt(i);
  if (c !== '@' && c !== '\\') return false;

  // need '@' + "start" + at least one char after
  return i + 6 < n && s.startsWith('start', i + 1);
}

/** @see ~/git/plantuml/.../utils/StartUtils.java#startsWithDirectiveKeyword */
function startsWithDirectiveKeyword(text: string, from: number, keyword: string): boolean {
  const n = text.length;
  let i = from;
  while (i < n) {
    const c = text.charAt(i);
    if (/\s/u.test(c)) {
      i++;
      continue;
    }
    if (c !== '@' && c !== '\\') return false;

    const start = i + 1;
    if (start + keyword.length > n) return false;

    return text.startsWith(keyword, start);
  }
  return false;
}

/** @see ~/git/plantuml/.../utils/StartUtils.java#isEndDirective */
export function isEndDirective(s: string): boolean {
  return startsWithDirectiveKeyword(s, 0, 'end');
}
