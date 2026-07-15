/**
 * StripeSimple — builds one physical creole display line's flat `CreoleAtom`
 * sequence: plain-text runs interleaved with `<img>`/`<$sprite>`/`<latex>`
 * atoms, each text run carrying its own resolved `FontConfiguration` (nested
 * `<b>`/`**`/etc. runs collapse into this flat sequence — matching the jar's
 * one-`<text>`-per-styled-run SVG output, this mission's cutover charter).
 *
 * Upstream: klimt/creole/legacy/StripeSimple.java — `analyzeAndAdd`
 * (cell-alignment strip, `CharHidder.hide`, then the HEADING/HORIZONTAL_LINE/
 * else dispatch), `modifyStripe`+`searchCommand`+`addPending` (the
 * character-by-character command scan), `fontConfigurationForHeading`,
 * `getAtoms()`'s "empty stripe -> one space atom" fallback. Ported: all of
 * the above except the HORIZONTAL_LINE branch (already correctly handled by
 * `EntityImageDescriptionSupport.ts`'s pre-existing separator-line drawing —
 * see `buildStripeAtoms`'s doc comment for why that branch is dispatched by
 * the CALLER, not here) and `manageCellAlignment`/`CharHidder.hide` (no
 * `<left>`/`<center>`/`<right>` cell-alignment markup or hidden-newline
 * sentinel reaches a descdiagram entity display in this port — cell
 * alignment is a creole-TABLE-cell-only feature, tables are a separate,
 * already-ported subsystem, `core/creole.ts`).
 *
 * Composition order (E2r/L2 correction of L1's own integration decision,
 * journaled — `plans/e2r-creole/decision-journal.md`): L1 ran SI5b+E2r T6's
 * `scanLineForAtoms` (`core/creole-atoms.ts`) as a PRE-PASS over the whole
 * line to carve out `<img>`/`<$sprite>` atoms BEFORE running the style-run
 * splitter on each remaining text SEGMENT independently. That composition
 * is provably wrong whenever a color/size/font command's captured inner
 * text itself CONTAINS an atom (`<color:red><$Batch></color>`, a real
 * corpus pattern — 10 fixtures, `usecase/nenedo-78-fiva569` jar-verified
 * 2026-07-15): the pre-pass splits the command's activation tag into one
 * segment and its deactivation tag into a LATER segment (the atom sits
 * between them), so `matchLegacy`'s "shortest run up to the deactivation
 * tag" search never sees the closing tag at all (it is not in the same
 * segment) and the command falls through as literal, unstyled text —
 * differently wrong from the jar, which tints the sprite. Upstream's REAL
 * architecture is a single unified per-character scan:
 * `CommandCreoleImg`/`CommandCreoleSprite` are registered in the exact same
 * `searchCommand` starter map as the style/size/color commands
 * (`CommandCreoleBuilder.java` :106,114) — there is no separate "atom pass".
 * `modifyStripe` below now mirrors that: at each position it tries a creole
 * command first, then an inline atom
 * (`core/creole-atoms.ts#matchAtomAt`, reusing T6's already-tested regex
 * recognizers rather than re-deriving them), then falls back to plain-text
 * accumulation — so an atom recognized INSIDE a command's recursive
 * `analyzeAndAddInline` call (the SAME function) is now interleaved
 * correctly with the active font state, matching the jar exactly for this
 * class of input. This is a behavior-preserving refactor for every input
 * with no atom/command boundary crossing (verified: the old segment-by-
 * segment walk and the new single-pass walk produce byte-identical
 * `CreoleAtom[]` output whenever no atom sits inside a command's capture —
 * each still becomes its own flushed text run at the same boundary).
 */
import type { FontConfiguration } from '../../shape/UText.js';
import { FontStyle } from '../../shape/UText.js';
import type { CreoleAtom } from '../atom/Atom.js';
import type { Command, StripeBuilder } from '../command/Command.js';
import { CREOLE_COMMANDS } from './CommandCreoleBuilder.js';
import { scanLineForAtoms, matchAtomAt } from '../../../creole-atoms.js';

/** Upstream: `StripeSimple#searchCommand`. `line.length > pos + 2` (not
 *  `>=`) is upstream's own bound — ported verbatim, including its edge
 *  case (a 2-char starter with zero content chars remaining never looks
 *  itself up; every L1/L2 command needs >=1 content char anyway, per each
 *  form's own minimum-match rule, so this never rejects a real match). */
function searchCommand(line: string, pos: number): Command | null {
  if (line.length <= pos + 2) return null;
  const candidates = CREOLE_COMMANDS.get(line.slice(pos, pos + 2));
  if (candidates === undefined) return null;
  for (const cmd of candidates) {
    if (cmd.matchingSize(line, pos) !== 0) return cmd;
  }
  return null;
}

/** Upstream: `StripeSimple#fontConfigurationForHeading` (private static).
 *  I4c mechanism 2 / mechanism 5's per-line `==` heading font cascade. */
export function fontConfigurationForHeading(font: FontConfiguration, order: number): FontConfiguration {
  if (order === 0) return addStyleAndBigger(font, 4);
  if (order === 1) return addStyleAndBigger(font, 2);
  if (order === 2) return addStyleAndBigger(font, 1);
  return { ...font, styles: new Set(font.styles).add(FontStyle.ITALIC) };
}

function addStyleAndBigger(font: FontConfiguration, delta: number): FontConfiguration {
  return { ...font, size: font.size + delta, styles: new Set(font.styles).add(FontStyle.BOLD) };
}

/** The mutable per-line builder state — upstream: `StripeSimple`'s own
 *  `atoms`/`fontConfiguration` fields. A single instance is shared across
 *  one line's ENTIRE (possibly recursive, nested-style) build, matching
 *  upstream's own single-stripe-per-line lifetime. */
class StripeAtomBuilder implements StripeBuilder {
  private readonly built: CreoleAtom[] = [];
  private font: FontConfiguration;

  constructor(initialFont: FontConfiguration) {
    this.font = initialFont;
  }

  getActualFontConfiguration(): FontConfiguration {
    return this.font;
  }

  setActualFontConfiguration(font: FontConfiguration): void {
    this.font = font;
  }

  analyzeAndAddInline(text: string): void {
    this.modifyStripe(text);
  }

  pushLatexAtom(expr: string): void {
    this.built.push({ kind: 'latex', expr, color: this.font.color });
  }

  /** Upstream: `StripeSimple#modifyStripe`, extended (E2r/L2, see module doc
   *  comment) to also recognize `<img>`/`<$sprite>` atoms at each position
   *  it does not recognize a creole command — the single unified scan
   *  upstream's own `searchCommand` map performs. */
  private modifyStripe(line: string): void {
    let pending = '';
    let pos = 0;
    while (pos < line.length) {
      const cmd = searchCommand(line, pos);
      if (cmd !== null) {
        this.flushPending(pending);
        pending = '';
        pos += cmd.executeAndAdvance(line, pos, this);
        continue;
      }
      const atomMatch = matchAtomAt(line, pos);
      if (atomMatch !== null) {
        if (atomMatch.atom !== undefined) {
          this.flushPending(pending);
          pending = '';
          this.built.push({ kind: 'inline', atom: atomMatch.atom });
        } else if (atomMatch.fallbackText !== undefined) {
          pending += atomMatch.fallbackText;
        }
        pos += atomMatch.length;
        continue;
      }
      pending += line[pos];
      pos += 1;
    }
    this.flushPending(pending);
  }

  /** Upstream: `StripeSimple#addPending` (`AtomTextUtils.createLegacy`). */
  private flushPending(pending: string): void {
    if (pending.length === 0) return;
    this.built.push({ kind: 'text', text: pending, font: this.font });
  }

  /** Upstream: `StripeSimple#getAtoms()`'s "empty stripe -> one space atom"
   *  fallback, applied once the whole line has been processed. */
  finish(): readonly CreoleAtom[] {
    if (this.built.length === 0) return [{ kind: 'text', text: ' ', font: this.font }];
    return this.built;
  }
}

/**
 * Builds one already-classified (NORMAL or HEADING content) line's flat
 * atom sequence via a SINGLE unified per-character scan (see module doc
 * comment): creole style/size/color/font commands AND `<img>`/`<$sprite>`
 * atoms are recognized in the same pass, so a command's captured inner text
 * may itself contain an atom and still resolve correctly. The caller
 * (`EntityImageDescriptionSupport.ts`, `leaf-sizing.ts`) is responsible for
 * the HORIZONTAL_LINE branch (unchanged, pre-existing) and for computing
 * `font` via `fontConfigurationForHeading` when the line classified as
 * HEADING — see `legacy/CreoleStripeSimpleParser.ts`'s `classifyStripeLine`.
 */
export function buildStripeAtoms(line: string, font: FontConfiguration): readonly CreoleAtom[] {
  const builder = new StripeAtomBuilder(font);
  builder.analyzeAndAddInline(line);
  return builder.finish();
}

/**
 * Builds a line's atom sequence WITHOUT running the style-command engine —
 * img/sprite carve-out only, each remaining text segment becomes ONE plain
 * text atom verbatim. Used for `CreoleStripeSimpleParser.ts`'s `LITERAL`
 * classification (a non-empty-captured `--Header--`/`==Header==`/
 * `..Header..`-shaped line — see that module's doc comment for the
 * jar-verified reason this must NOT be style-processed: it happens to also
 * satisfy the STRIKE creole syntax as plain text, which would incorrectly
 * strike part of it). This path has no command captures to cross an atom
 * boundary, so the plain whole-line `scanLineForAtoms` pre-scan remains
 * correct and is kept (unlike `buildStripeAtoms` above).
 */
export function buildLiteralAtoms(line: string, font: FontConfiguration): readonly CreoleAtom[] {
  const scan = scanLineForAtoms(line);
  const atoms: CreoleAtom[] = [];
  for (const seg of scan.segments) {
    if (seg.kind === 'text') atoms.push({ kind: 'text', text: seg.text, font });
    else atoms.push({ kind: 'inline', atom: seg.atom });
  }
  return atoms.length === 0 ? [{ kind: 'text', text: ' ', font }] : atoms;
}
