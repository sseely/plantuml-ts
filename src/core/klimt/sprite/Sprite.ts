/**
 * The shared marker every sprite kind implements: pixel dimensions.
 *
 * Upstream's `Sprite` interface exposes a single
 * `asTextBlock(fontColor, forcedColor, scale, backColor)` method that
 * returns an AWT-era `TextBlock` capable of drawing itself onto a
 * `UGraphic`. This port has no such drawing abstraction (browser-safe pure
 * SVG renderer -- project CLAUDE.md's Architecture Notes); the equivalent
 * capability described by the batch-2 interface contract
 * (plans/si5b-stdlib/batch-2/overview.md:37-39) is `asPng(fontColor,
 * backColor, scale): { dataUri, w, h }`, backed by a STORED-block PNG
 * encoder and the `SpriteMonochrome.toUImage` tint/gradient math -- both
 * out of THIS task's write-set (T5 owns `png-encoder.ts` and the tint
 * port; T6 wires the result into creole's `<$sprite>` atom).
 *
 * T4 (this file) therefore ports only the data surface every sprite kind
 * shares -- `width`/`height` -- so T5/T6 can depend on `Sprite` without a
 * forward reference to code that does not exist yet. `SpriteMonochrome`
 * additionally exposes `grayLevel` and a `getGray(x, y)` pixel accessor
 * (see its own file doc) -- the full 'data in' side of the tint/PNG
 * pipeline T5 builds on top.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/sprite/Sprite.java
 */
export interface Sprite {
  readonly width: number;
  readonly height: number;
}
