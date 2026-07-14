import { AsciiEncoder } from './AsciiEncoder.js';
import { SpriteMonochrome } from './SpriteMonochrome.js';
import { decompressPlantumlZ } from '../../code/deflate/decompressPlantumlZ.js';
import type { Sprite } from './Sprite.js';

/**
 * Ported as a poor-man's Java enum (private constructor + three static
 * readonly instances, `===` identity comparison in the `this === GRAY_16`
 * dispatch checks below) -- TS `enum`/`const enum` cannot carry the
 * `nbColor` field the way a Java enum constant can, and `SpriteGrayLevel`
 * is compared by identity throughout `CommandFactorySprite`
 * (`SpriteGrayLevel.get(nbLevel)`), not by its numeric value.
 *
 * Encoding (`encode16`/`encode8`/`encode4`/`encodeZ`/`encodeZSpiral`) is
 * NOT ported -- this mission only needs to DECODE stdlib sprite bodies
 * (D6), never produce them; a TeaVM-gated, PortableImage-consuming
 * encoder has no reachable caller in this port (no image-to-sprite
 * authoring tool exists here).
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/klimt/sprite/SpriteGrayLevel.java
 */
export class SpriteGrayLevel {
  static readonly GRAY_16: SpriteGrayLevel = new SpriteGrayLevel(16);
  static readonly GRAY_8: SpriteGrayLevel = new SpriteGrayLevel(8);
  static readonly GRAY_4: SpriteGrayLevel = new SpriteGrayLevel(4);

  private constructor(readonly nbColor: number) {}

  /** @see SpriteGrayLevel.java#get */
  static get(n: number): SpriteGrayLevel {
    if (n === 4) return SpriteGrayLevel.GRAY_4;
    if (n === 8) return SpriteGrayLevel.GRAY_8;
    if (n === 16) return SpriteGrayLevel.GRAY_16;
    throw new Error(`Unsupported operation: SpriteGrayLevel.get(${n})`);
  }

  /**
   * Dispatches to the level-specific decoder. `width`/`height` are IGNORED
   * for GRAY_16 -- exactly as upstream's `buildSprite16(List<String>)`
   * overload, which takes no width/height parameters at all and instead
   * deduces both from the row data (first row's length = width, row count
   * = height). This is a preserved upstream quirk, not a bug: a
   * `[10x10/16]` declaration whose body doesn't actually measure 10x10
   * silently uses the BODY's real dimensions.
   * @see SpriteGrayLevel.java#buildSprite
   */
  buildSprite(width: number, height: number, strings: readonly string[]): Sprite {
    if (this === SpriteGrayLevel.GRAY_16) return this.buildSprite16(strings);
    if (this === SpriteGrayLevel.GRAY_8) return this.buildSprite8(width, height, strings);
    if (this === SpriteGrayLevel.GRAY_4) return this.buildSprite4(width, height, strings);
    /* v8 ignore next -- unreachable: only three SpriteGrayLevel instances
     * exist (GRAY_16/8/4 above) and every `this` is one of them. */
    throw new Error('Unsupported operation');
  }

  /** @see SpriteGrayLevel.java#buildSprite16 */
  private buildSprite16(strings: readonly string[]): SpriteMonochrome {
    const first = strings[0] ?? '';
    const result = new SpriteMonochrome(first.length, strings.length, 16);
    for (let col = 0; col < result.width; col++) {
      for (let line = 0; line < result.height; line++) {
        const sline = strings[line] ?? '';
        if (col >= sline.length) continue;
        const c = sline.charAt(col);
        if (c !== '0') {
          const x = hexDigitValue(c);
          result.setGray(col, line, x);
        }
      }
    }
    return result;
  }

  /** @see SpriteGrayLevel.java#buildSprite8 */
  private buildSprite8(width: number, height: number, strings: readonly string[]): SpriteMonochrome {
    const result = new SpriteMonochrome(width, height, 8);
    for (let col = 0; col < result.width; col++) {
      for (let line = 0; line < strings.length; line++) {
        const row = strings[line]!;
        if (col >= row.length) continue;
        const v = AsciiEncoder.decode6bit(row.charAt(col));
        const w1 = Math.floor(v / 8);
        const w2 = v % 8;
        result.setGray(col, line * 2, w1);
        result.setGray(col, line * 2 + 1, w2);
      }
    }
    return result;
  }

  /** @see SpriteGrayLevel.java#buildSprite4 */
  private buildSprite4(width: number, height: number, strings: readonly string[]): SpriteMonochrome {
    const result = new SpriteMonochrome(width, height, 4);
    for (let col = 0; col < result.width; col++) {
      for (let line = 0; line < strings.length; line++) {
        const row = strings[line]!;
        if (col >= row.length) continue;
        let v = AsciiEncoder.decode6bit(row.charAt(col));
        const w1 = Math.floor(v / 16);
        v = v % 16;
        const w2 = Math.floor(v / 4);
        const w3 = v % 4;
        result.setGray(col, line * 3, w1);
        result.setGray(col, line * 3 + 1, w2);
        result.setGray(col, line * 3 + 2, w3);
      }
    }
    return result;
  }

  /**
   * Decodes a `[WxH/Nz]` compressed sprite body: `AsciiEncoder().decode`
   * (PlantUML's 6-bit alphabet, NOT base64) then raw-DEFLATE inflate
   * (`decompressPlantumlZ`, the `CompressionZlib#decompress` port) into
   * exactly `width * height` gray-level bytes, row-major. Returns `null`
   * on a malformed/corrupt stream (mirrors upstream's
   * `catch (NoPlantumlCompressionException e) { return null; }` --
   * `decompressPlantumlZ`/`Decompressor` throw `DataFormatException` /
   * `EOFException` for the equivalent failure modes, see DeflateErrors.ts).
   * @see SpriteGrayLevel.java#buildSpriteZ
   */
  buildSpriteZ(width: number, height: number, compressed: string): Sprite | null {
    const comp = new AsciiEncoder().decode(compressed);
    try {
      const img = decompressPlantumlZ(comp);
      const result = new SpriteMonochrome(width, height, this.nbColor);
      let cpt = 0;
      for (let line = 0; line < result.height; line++) {
        for (let col = 0; col < result.width; col++) {
          result.setGray(col, line, img[cpt++] ?? 0);
        }
      }
      return result;
    } catch {
      return null;
    }
  }
}

/** `Character.digit(c, 16)` for the single-character case: 0-9/a-f/A-F ->
 *  0-15, anything else -> -1 (upstream's sentinel for 'not a hex digit' --
 *  passed straight into `setGray`, which then throws on the negative
 *  `level`, exactly as a genuinely malformed `[.../16]` sprite body does
 *  in the jar). @see java.lang.Character#digit */
function hexDigitValue(c: string): number {
  const code = c.charCodeAt(0);
  if (code >= 0x30 && code <= 0x39) return code - 0x30; // '0'-'9'
  if (code >= 0x41 && code <= 0x46) return code - 0x41 + 10; // 'A'-'F'
  if (code >= 0x61 && code <= 0x66) return code - 0x61 + 10; // 'a'-'f'
  return -1;
}
