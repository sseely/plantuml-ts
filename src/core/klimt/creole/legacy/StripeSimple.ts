/**
 * StripeSimple — builds one physical creole display line's flat `CreoleAtom`
 * sequence: plain-text runs interleaved with `<img>`/`<$sprite>` atoms, each
 * text run carrying its own resolved `FontConfiguration` (nested
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
 * Composition order (this task's own integration decision, journaled):
 * `buildStripeAtoms` runs SI5b+E2r T6's existing `scanLineForAtoms`
 * (`core/creole-atoms.ts`) FIRST to carve `<img>`/`<$sprite>` atoms out of
 * the line, THEN runs this file's style-run splitter on each remaining TEXT
 * segment. Upstream instead threads img/sprite recognition through the SAME
 * `searchCommand` map as the style commands (one unified per-character
 * scan) — this port keeps the two subsystems separate (integrate, don't
 * duplicate the already-tested T6/T7 img/sprite scanner) since neither
 * markup family's syntax overlaps the other's (`<img...>`/`<$name>` vs
 * `**`/`<b>`/etc.), so the two-pass composition produces IDENTICAL ordering
 * and content to a single unified pass for every reachable input.
 */
import type { FontConfiguration } from '../../shape/UText.js';
import { FontStyle } from '../../shape/UText.js';
import type { CreoleAtom } from '../atom/Atom.js';
import type { Command, StripeBuilder } from '../command/Command.js';
import { CREOLE_COMMANDS } from './CommandCreoleBuilder.js';
import { scanLineForAtoms } from '../../../creole-atoms.js';

/** Upstream: `StripeSimple#searchCommand`. `line.length > pos + 2` (not
 *  `>=`) is upstream's own bound — ported verbatim, including its edge
 *  case (a 2-char starter with zero content chars remaining never looks
 *  itself up; every L1 command needs >=1 content char anyway, per each
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

  /** Splices an already-resolved inline (`<img>`/`<$sprite>`) atom directly
   *  into the built sequence, in source position order — the seam
   *  `buildStripeAtoms` uses to interleave T6's `scanLineForAtoms` output
   *  with this builder's own text-run splitting. */
  pushInline(atom: CreoleAtom & { kind: 'inline' }): void {
    this.built.push(atom);
  }

  /** Upstream: `StripeSimple#modifyStripe`. */
  private modifyStripe(line: string): void {
    let pending = '';
    let pos = 0;
    while (pos < line.length) {
      const cmd = searchCommand(line, pos);
      if (cmd === null) {
        pending += line[pos];
        pos += 1;
        continue;
      }
      this.flushPending(pending);
      pending = '';
      pos += cmd.executeAndAdvance(line, pos, this);
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
 * atom sequence: `scanLineForAtoms` (T6) carves out `<img>`/`<$sprite>`
 * markup first, then each remaining text segment is style-run split via
 * this file's `StripeAtomBuilder`. The caller (`EntityImageDescriptionSupport
 * .ts`, `leaf-sizing.ts`) is responsible for the HORIZONTAL_LINE branch
 * (unchanged, pre-existing) and for computing `font` via
 * `fontConfigurationForHeading` when the line classified as HEADING — see
 * `legacy/CreoleStripeSimpleParser.ts`'s `classifyStripeLine`. `resolveAtomImage`
 * is accepted for symmetry with `EntityImageDescriptionSupport.ts`'s existing
 * atom-aware call sites but not otherwise used here — atom RESOLUTION
 * (turning an `InlineAtomToken` into drawable geometry/measured dims) is the
 * caller's job (`render-atoms.ts`/`creole-atoms.ts#measureInlineAtom`), this
 * function only builds the ordered token sequence.
 */
export function buildStripeAtoms(line: string, font: FontConfiguration): readonly CreoleAtom[] {
  const scan = scanLineForAtoms(line);
  const builder = new StripeAtomBuilder(font);
  for (const seg of scan.segments) {
    if (seg.kind === 'text') builder.analyzeAndAddInline(seg.text);
    else builder.pushInline({ kind: 'inline', atom: seg.atom });
  }
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
 * strike part of it).
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
