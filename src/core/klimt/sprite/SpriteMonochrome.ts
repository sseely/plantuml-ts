import type { Sprite } from './Sprite.js';

/**
 * A rectangular grid of gray-level pixels -- the data half of PlantUML's
 * sprite pipeline. `SpriteGrayLevel` (this directory) decodes hex/6-bit/
 * z-compressed sprite bodies INTO a `SpriteMonochrome`; T5's
 * `png-encoder.ts` and tint port (`toUImage`, java :180-208) read one back
 * OUT as a PNG data URI. This file owns only the 'pixel grid + getPixel/
 * gray storage' half -- the task's explicit scope reduction (T4 spec):
 * `toUImage`/`asTextBlock` rendering, and the six dead (no external
 * caller, confirmed via `grep -rn '\.xor(\|xSymetric\|ySymetric\|isSame'
 * ~/git/plantuml/src/main/java/net/sourceforge/plantuml/` outside this
 * file) utility methods `isSameKind`/`isSame`/`xor`/`xSymetric`/
 * `ySymetric`/`exportSprite1`, are NOT ported here.
 *
 * `width`/`height`/`grayLevel` are exposed as readonly properties (not
 * Java-style `getWidth()`/`getHeight()` methods) -- the 'data surface'
 * shape T5/T6 need per the T4 task spec, and the natural TS idiom for the
 * `Sprite.width`/`Sprite.height` interface this class implements.
 * `getGray`/`setGray` keep their upstream method names (the actual pixel
 * accessor/mutator behavior, not a plain data field).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/sprite/SpriteMonochrome.java
 */
export class SpriteMonochrome implements Sprite {
  readonly width: number;
  readonly height: number;
  readonly grayLevel: number;

  /** Row-major: `gray[y][x]`, matching upstream's `gray[height][width]`
   *  array-of-rows layout. Every cell starts at 0 (JS `Array.fill(0)`
   *  mirrors Java's default-initialized `int[][]`). */
  private readonly gray: number[][];

  constructor(width: number, height: number, grayLevel: number) {
    if (grayLevel !== 2 && grayLevel !== 4 && grayLevel !== 8 && grayLevel !== 16) {
      throw new Error(`Unsupported grayLevel: ${grayLevel}`);
    }
    this.width = width;
    this.height = height;
    this.grayLevel = grayLevel;
    this.gray = [];
    for (let y = 0; y < height; y++) {
      // Explicit fill loop (not `new Array(width).fill(0)`, which
      // ESLint's type checker widens to `any[]`, and not
      // `new Array<number>(width)`, banned generic-call syntax per
      // project CLAUDE.md's complexity-hook workarounds).
      const row: number[] = [];
      for (let x = 0; x < width; x++) row.push(0);
      this.gray.push(row);
    }
  }

  /** @see SpriteMonochrome.java#setGray -- silently no-ops for an
   *  out-of-bounds (x, y) (matching upstream exactly); throws for an
   *  out-of-range `level` (also matching upstream's `IllegalArgumentException`). */
  setGray(x: number, y: number, level: number): void {
    if (x < 0 || x >= this.width) return;
    if (y < 0 || y >= this.height) return;
    if (level < 0 || level >= this.grayLevel) {
      throw new Error(`level=${level} grayLevel=${this.grayLevel}`);
    }
    this.gray[y]![x] = level;
  }

  /** @see SpriteMonochrome.java#getGray -- throws for ANY out-of-bounds
   *  (x, y), including negative indices: upstream's explicit checks only
   *  guard the upper bound, but a negative Java array index throws
   *  `ArrayIndexOutOfBoundsException` regardless -- this port preserves
   *  that observable 'always throws when out of range' behavior rather
   *  than the narrower literal conditional (a JS array index never
   *  throws on its own, unlike Java's). */
  getGray(x: number, y: number): number {
    if (x < 0 || x >= this.width) throw new Error(`x=${x} width=${this.width}`);
    if (y < 0 || y >= this.height) throw new Error(`y=${y} height=${this.height}`);
    return this.gray[y]![x]!;
  }
}
