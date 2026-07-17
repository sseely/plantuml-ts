/**
 * Shared `#color`/`#back:color;...` background-override extraction — split
 * out of `renderer-classifier-box.ts` (G2 N34) so `renderer-note.ts` can
 * reuse the SAME bare/`back:`-component grammar for a note's own `#color`
 * override (`ClassNote.color`) instead of re-deriving it. Upstream mirror:
 * `ColorParser.simpleColor(ColorType.BACK)` — both `Classifier`'s and
 * `ClassNote`'s color decorations run through the identical parser
 * (`CommandCreateClassMultilines`/`CommandFactoryNoteOnEntity`'s own
 * `color()` helper), so one extraction function correctly serves both.
 */

/**
 * G2 N31 (classifier) / G2 N34 (note): a bare token (`#f00`) IS the
 * background per `ColorParser`'s own `simpleColor(BACK)` default, a
 * compound token (`#back:blue;text:red`) needs its explicit `back:` part,
 * and a LINECOLOR-only token (`##red`, no COLOR half) carries no background
 * at all. Returns `undefined` (caller falls back to its own default) for
 * every other compound part (`text:`/`line:`/`shadowing`) — named
 * remainder, not yet consumed by any render-side field (both `Classifier
 * .color`'s and `ClassNote.color`'s own doc comments repeat this caveat).
 */
export function resolveBareOrBackColor(color: string | undefined): string | undefined {
  if (color === undefined) return undefined;
  const colorToken = color.split(' ')[0];
  if (colorToken === undefined || colorToken.startsWith('##')) return undefined;
  if (!colorToken.includes(';') && !colorToken.includes(':')) return colorToken;
  const backMatch = /(?:^#|;)back:([^;]+)/i.exec(colorToken);
  return backMatch?.[1];
}
