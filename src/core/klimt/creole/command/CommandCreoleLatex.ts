/**
 * CommandCreoleLatex — `<latex>expr</latex>`.
 *
 * Upstream: klimt/creole/command/CommandCreoleLatex.java, built on
 * `Splitter.latexPattern` (`\<latex\>(.+?)\</latex\>`, non-greedy, no EOL
 * form — unlike size/color/font, a `<latex>` tag always needs its own
 * closing tag). `stripe.addMath(ScientificEquationSafe.fromLatex(latex))`
 * ported as `stripe.pushLatexAtom(expr)` — this port's `CreoleAtom`
 * `'latex'` variant, drawn via `core/latex.ts#renderLatexAsImage` (KaTeX,
 * NOT upstream's JLaTeXMath — see that function's doc comment for why this
 * can never be byte-conformant, only structurally present).
 */
import type { Command } from './Command.js';

const LATEX_TAG_SOURCE = '<latex>(.+?)</latex>';

/** Upstream: `CommandCreoleLatex.create()`. No EOL variant exists upstream. */
export function createLatexCommand(): Command {
  const re = new RegExp('^' + LATEX_TAG_SOURCE);
  return {
    starters: ['<l'],
    matchingSize(line, pos) {
      const m = re.exec(line.slice(pos));
      return m === null ? 0 : m[0].length;
    },
    executeAndAdvance(line, pos, stripe) {
      const m = re.exec(line.slice(pos));
      if (m === null) return 0;
      stripe.pushLatexAtom(m[1]!);
      return m[0].length;
    },
  };
}
