/**
 * class-member-creole.ts — routes ONE classifier member row's display text
 * through the shared creole atom engine (`core/klimt/creole/`, built for
 * description by mission E2r) instead of drawing it as a single plain
 * `<text>` element.
 *
 * Upstream mirror: `cucadiagram/MethodsOrFieldsArea#createTextBlock` (java
 * :238-267) builds EVERY member row via `Display.getWithNewlines(pragma,
 * s).create8(config, align, skinParam, CreoleMode.SIMPLE_LINE,
 * style.wrapWidth())` — the SAME `Display`/creole machinery
 * `EntityImageDescription` uses for entity labels (`CreoleMode.FULL`), just a
 * narrower mode. `CreoleMode.SIMPLE_LINE` differs from `FULL` ONLY by
 * skipping the `*`-bullet-list and `#`-heading patterns
 * (`CreoleStripeSimpleParser.java:119-147`, both gated `if (mode ==
 * CreoleMode.FULL)`) — this port's own `classifyStripeLine` never ported
 * those two patterns for EITHER mode (zero known reach, `CreoleStripeSimple
 * Parser.ts`'s own doc comment), so reusing the description engine's exact
 * classify/build functions here reproduces `SIMPLE_LINE` semantics exactly,
 * with no new parsing logic needed — "REUSE the engine, don't re-port" per
 * this iteration's own charter.
 *
 * What's DIFFERENT from `core/svek/image/EntityImageDescriptionSupport.ts
 * #buildTextBlock` (description's own adapter over the same shared engine):
 * class's renderer is a pure-string SVG builder (`core/svg.ts`), not klimt's
 * `UGraphic`/`StringBounder`/`TextBlock` object model — so this file is a
 * SECOND, structurally different adapter over the SAME shared atom
 * primitives (`classifyStripeLine`, `buildStripeAtoms`, `buildLiteralAtoms`,
 * `measureInlineAtom`), matching the CLAUDE.md instruction to build a
 * class-local seam rather than force class onto klimt's drawing model.
 *
 * Member text is always ONE physical display line in this port's AST today
 * (`Member.name`/`rawDisplay` never carries an embedded `\n` — no upstream
 * `Display.getWithNewlines` multi-CharSequence member has been observed in
 * the corpus); `buildMemberAtoms` therefore classifies/builds exactly one
 * line, matching every existing `ClassifierGeo.rows[]` entry's "one row, one
 * baseline y" invariant. A member line embedding a literal `\n` (from a TIM
 * macro expansion, say) is out of this iteration's scope — unsurveyed, zero
 * corpus evidence found.
 *
 * Measurement-identity guarantee (mission HARD BOUNDARY): for a row with NO
 * creole markup, `classifyStripeLine` returns `{type:'NORMAL', content:
 * text}` (content === the untouched input) and `buildStripeAtoms` -- when it
 * recognizes no command/atom anywhere in the line -- returns EXACTLY one
 * `{kind:'text', text, font}` atom carrying that same untouched string
 * (`StripeSimple.ts#StripeAtomBuilder#modifyStripe`: every character with no
 * command/atom match accumulates into `pending`, flushed as ONE atom at EOL).
 * `measureMemberAtoms` then measures that lone atom with `measurer.measure
 * (text, {family, size})` -- byte-identical to the pre-cutover
 * `measurer.measure(text, fontSpec).width` call this file's callers replace.
 */
import type { FontConfiguration } from '../../core/klimt/shape/UText.js';
import { FontStyle } from '../../core/klimt/shape/UText.js';
import type { CreoleAtom, CreoleAtomUrl } from '../../core/klimt/creole/atom/Atom.js';
import { classifyStripeLine } from '../../core/klimt/creole/legacy/CreoleStripeSimpleParser.js';
import {
  buildStripeAtoms,
  buildLiteralAtoms,
  fontConfigurationForHeading,
} from '../../core/klimt/creole/legacy/StripeSimple.js';
import { measureInlineAtom, type SpriteDimsLookup } from '../../core/creole-atoms.js';
import { getSpriteMonochrome, spriteDimsLookupFor, type SpriteRegistry } from '../../core/sprite-commands.js';
import { spriteToPngDataUri, spriteMonochromeAsLike } from '../../core/klimt/sprite/sprite-raster.js';
import type { StringMeasurer, FontSpec } from '../../core/measurer.js';

/**
 * One RESOLVED, render-ready run of a member row -- unlike `CreoleAtom`
 * (whose `'inline'` variant carries an unresolved `InlineAtomToken`), a
 * `'sprite'`/`'img'` atom is already resolved to its drawable `<image>`
 * geometry here, at LAYOUT time (`buildMemberRow`, which already has the
 * `SpriteRegistry` in scope) -- so `renderer-classifier-box.ts` never needs
 * its own sprite-registry parameter, mirroring how `row.width`/`textLength`
 * are already pre-measured at layout time rather than recomputed at render
 * time. `'latex'` `CreoleAtom`s are dropped (zero corpus reach inside a
 * class member row -- the corpus's few `<latex>` samples are activity-diagram
 * fixtures misfiled under `tests/corpus/class/`, confirmed by inspection);
 * an unresolved sprite name is ALSO dropped, matching `StripeSimple
 * .addSprite`'s "unknown sprite contributes nothing" rule (java :228-236).
 */
export type MemberRenderAtom =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly font: FontConfiguration;
      readonly width: number;
      /** G2 N40: set when this run came from a `[[url]]` creole command's
       *  captured label (`core/klimt/creole/atom/Atom.ts#CreoleAtomUrl`) --
       *  `renderer-classifier-box.ts#renderRowAtoms` wraps the emitted
       *  `<text>` in `<a href>` when present. */
      readonly url?: CreoleAtomUrl;
    }
  | { readonly kind: 'image'; readonly href: string; readonly width: number; readonly height: number };

/** One member row's fully built+measured creole content. */
export interface MemberRowBuild {
  readonly atoms: readonly MemberRenderAtom[];
  /** Sum of every atom's own measured width -- UNROUNDED (callers apply
   *  `javaRound4` at their own existing call sites, matching the pre-cutover
   *  rounding discipline: `sectionWidth`'s max-width scan stays unrounded,
   *  `buildSectionRows`'s stored `row.width` stays rounded -- see each
   *  call site). */
  readonly width: number;
}

/**
 * The base `FontConfiguration` a member row's creole build starts from --
 * `color: null` (renders as the classifier box's own hardcoded `#000000`
 * default, `renderer-classifier-box.ts#renderRowText`'s existing rule,
 * unless a `<color:...>` command overrides it) plus upstream's own
 * member-level modifier styling (`MethodsOrFieldsArea#createTextBlock`,
 * java :249-253): `{abstract}` -> italic, `{static}` -> underline. Both
 * fields are parsed onto every `Member` already (`class-member-parser.ts
 * #stripModifiers`) but were never consumed by rendering before this
 * mission -- a THIRD, smaller dead-field gap discovered while building this
 * file's font-configuration seam, landed alongside the primary creole-atom
 * mechanism since it shares the exact same code path.
 */
export function memberBaseFont(
  fontSpec: {
    readonly family: string;
    readonly size: number;
    /** G2 N32: `skinparam classAttributeFontStyle` -- forces BOLD/ITALIC
     *  onto EVERY member row's base font, independent of (unioned with) the
     *  per-member `{abstract}`/`{static}` modifiers below -- see
     *  `theme.ts#classAttributeFontBold`'s doc comment. Absent for every
     *  classifier with no such skinparam override (zero behavior change). */
    readonly bold?: boolean;
    readonly italic?: boolean;
  },
  member: { readonly isAbstract?: boolean; readonly isStatic?: boolean },
): FontConfiguration {
  const styles = new Set<FontStyle>();
  if (member.isAbstract === true || fontSpec.italic === true) styles.add(FontStyle.ITALIC);
  if (member.isStatic === true) styles.add(FontStyle.UNDERLINE);
  if (fontSpec.bold === true) styles.add(FontStyle.BOLD);
  return { family: fontSpec.family, size: fontSpec.size, color: null, styles };
}

/**
 * Classify + build one member row's flat `CreoleAtom` sequence -- the
 * class-side mirror of `EntityImageDescriptionSupport.ts`'s private
 * `buildLine` helper (not reused directly: that function also handles the
 * `HORIZONTAL_LINE` classification by returning `atoms: []` for its
 * caller's separate separator-drawing branch, a description-only concept
 * with no member-row analogue).
 */
export function buildMemberAtoms(text: string, font: FontConfiguration): readonly CreoleAtom[] {
  const cls = classifyStripeLine(text);
  if (cls.type === 'NORMAL') return buildStripeAtoms(cls.content, font);
  if (cls.type === 'HEADING') return buildStripeAtoms(cls.content, fontConfigurationForHeading(font, cls.order));
  if (cls.type === 'LITERAL') return buildLiteralAtoms(cls.content, font);
  // HORIZONTAL_LINE: a member row shaped EXACTLY like a bare `----`/`====`/
  // `....` separator (empty capture) has no MethodsOrFieldsArea analogue --
  // that shape only exists for description's block-level separator stripe.
  // Zero corpus reach for a class member declaration (grep-verified); fall
  // back to ONE plain atom of the untouched original text so this
  // unreachable-in-practice case still measures/renders exactly as it did
  // before this mission, rather than silently losing the text.
  return [{ kind: 'text', text, font }];
}

function atomFontSpec(font: FontConfiguration): FontSpec {
  return {
    family: font.family,
    size: font.size,
    ...(font.styles.has(FontStyle.BOLD) ? { weight: 'bold' as const } : {}),
    ...(font.styles.has(FontStyle.ITALIC) ? { style: 'italic' as const } : {}),
  };
}

/** Resolves one `'inline'` `CreoleAtom` (an `InlineAtomToken`, img or
 *  sprite) to a drawable `<image>` -- the class-local mirror of `diagrams/
 *  description/render-atoms.ts#resolveImgAtom`/`resolveSpriteAtom` (that
 *  file lives under `description/` but is otherwise diagram-agnostic; not
 *  imported directly here to avoid a cross-diagram-type dependency on a
 *  file the description mission owns -- see this module's own doc comment
 *  for why a second small adapter is the right shape, not a re-port: the
 *  underlying `spriteToPngDataUri`/`getSpriteMonochrome` calls are
 *  IDENTICAL, only the caller-side glue differs). `baseFont` is the ROW's
 *  own base font (NOT a per-atom font -- `CreoleAtom`'s `'inline'` variant
 *  carries no font of its own; the shared engine's own `StripeAtomBuilder
 *  .modifyStripe` never captures one either, description's `render-atoms.ts`
 *  doc comment already documents this as an approximation, "the CURRENT
 *  textblock's own resolved font color" -- reused verbatim here, same
 *  precedent, not a new gap this file introduces) used as the sprite tint's
 *  fallback color when the atom carries no `forcedColor` of its own.
 *  `undefined` registry/spriteDims (no `sprite` definitions on this
 *  diagram) resolves an `img` atom fine (it needs no registry) but always
 *  skips a `sprite` atom, matching `StripeSimple.addSprite`'s "unknown name
 *  contributes nothing" rule. */
function resolveInlineAtom(
  atom: Extract<CreoleAtom, { kind: 'inline' }>['atom'],
  baseFont: FontConfiguration,
  sprites: SpriteRegistry | undefined,
  spriteDims: SpriteDimsLookup | undefined,
): MemberRenderAtom | undefined {
  if (atom.kind === 'img') {
    const dims = measureInlineAtom(atom);
    return { kind: 'image', href: atom.dataUri, width: dims.width, height: dims.height };
  }
  if (sprites === undefined) return undefined;
  const sprite = getSpriteMonochrome(sprites, atom.name);
  if (sprite === undefined) return undefined; // unknown name -- contributes nothing.
  const dims = measureInlineAtom(atom, spriteDims);
  const png = spriteToPngDataUri(
    spriteMonochromeAsLike(sprite),
    baseFont.color ?? undefined,
    atom.forcedColor,
    atom.scale,
  );
  return { kind: 'image', href: png.dataUri, width: dims.width, height: dims.height };
}

/**
 * Resolves a raw `CreoleAtom[]` (from `buildMemberAtoms`) into render-ready
 * `MemberRenderAtom[]` + their summed width -- text atoms measure via the
 * SAME `StringMeasurer` every other class text measurement uses; inline
 * (img/sprite) atoms resolve via {@link resolveInlineAtom} when a
 * `SpriteRegistry` is supplied (`ast.sprites` -- `undefined` for a diagram
 * with no `sprite` definitions at all); `latex` atoms are dropped (see
 * `MemberRenderAtom`'s own doc comment).
 */
export function resolveMemberAtoms(
  atoms: readonly CreoleAtom[],
  baseFont: FontConfiguration,
  measurer: StringMeasurer,
  sprites?: SpriteRegistry,
): MemberRowBuild {
  const spriteDims: SpriteDimsLookup | undefined = sprites !== undefined ? spriteDimsLookupFor(sprites) : undefined;
  const rendered: MemberRenderAtom[] = [];
  let width = 0;
  for (const atom of atoms) {
    const resolved = resolveOneAtom(atom, baseFont, measurer, sprites, spriteDims);
    if (resolved === undefined) continue;
    rendered.push(resolved.atom);
    width += resolved.width;
  }
  return { atoms: rendered, width };
}

/** One loop-body iteration of {@link resolveMemberAtoms} -- factored out to
 *  keep that function's own NLOC/CCN under this project's complexity cap.
 *  Returns `undefined` for an atom that contributes nothing (an unresolved
 *  sprite name, or a dropped `latex` atom). */
function resolveOneAtom(
  atom: CreoleAtom,
  baseFont: FontConfiguration,
  measurer: StringMeasurer,
  sprites: SpriteRegistry | undefined,
  spriteDims: SpriteDimsLookup | undefined,
): { readonly atom: MemberRenderAtom; readonly width: number } | undefined {
  if (atom.kind === 'text') {
    const width = measurer.measure(atom.text, atomFontSpec(atom.font)).width;
    // Per-atom width stored on the atom itself (not just summed into the row
    // total) so `renderer-classifier-box.ts` can emit each atom's OWN
    // `<text textLength>` and x-advance -- matches jar's real one-`<text>`-
    // per-styled-run SVG output (this file's module doc comment).
    return {
      atom: {
        kind: 'text',
        text: atom.text,
        font: atom.font,
        width,
        ...(atom.url !== undefined ? { url: atom.url } : {}),
      },
      width,
    };
  }
  if (atom.kind === 'inline') {
    const resolved = resolveInlineAtom(atom.atom, baseFont, sprites, spriteDims);
    return resolved === undefined ? undefined : { atom: resolved, width: resolved.width };
  }
  // 'latex': dropped, see MemberRenderAtom's doc comment (zero corpus reach).
  return undefined;
}

/** One-stop build for a member row: classify + build + resolve + measure --
 *  the function `class-member-rows.ts#buildSectionRows`/`sectionWidth`'s
 *  shared precompute pass calls once per member (see those functions' own
 *  doc comments for why the result is computed ONCE and reused for both the
 *  section max-width scan and the stored row). */
export function buildMemberRow(
  text: string,
  member: { readonly isAbstract?: boolean; readonly isStatic?: boolean },
  fontSpec: { readonly family: string; readonly size: number; readonly bold?: boolean; readonly italic?: boolean },
  measurer: StringMeasurer,
  sprites?: SpriteRegistry,
): MemberRowBuild {
  const font = memberBaseFont(fontSpec, member);
  const atoms = buildMemberAtoms(text, font);
  return resolveMemberAtoms(atoms, font, measurer, sprites);
}
