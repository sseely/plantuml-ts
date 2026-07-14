/**
 * PlantUML's own 6-bit encoding used for sprite/URL payloads -- NOT
 * base64. `encode6bit` maps 0-9 to '0'-'9', 10-35 to 'A'-'Z', 36-61 to
 * 'a'-'z', 62 to '-', 63 to '_'. Four characters decode to three bytes;
 * characters past the end of the input string are treated as `'0'`
 * (value 0), matching upstream's `scharAt` fallback.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/AsciiEncoder.java
 */
export class AsciiEncoder {
  private static readonly ENCODE_6BIT: string[] = [];
  private static readonly DECODE_6BIT: number[] = new Array(128).fill(0) as number[];

  static {
    for (let b = 0; b < 64; b++) {
      const c = AsciiEncoder.encode6bit(b);
      AsciiEncoder.ENCODE_6BIT[b] = c;
      AsciiEncoder.DECODE_6BIT[c.charCodeAt(0)] = b;
    }
  }

  /** Encodes a single 6-bit value (0-63) to its alphabet character. */
  static encode6bit(b: number): string {
    if (b < 10) return String.fromCharCode('0'.charCodeAt(0) + b);

    b -= 10;
    if (b < 26) return String.fromCharCode('A'.charCodeAt(0) + b);

    b -= 26;
    if (b < 26) return String.fromCharCode('a'.charCodeAt(0) + b);

    b -= 26;
    if (b === 0) return '-';
    if (b === 1) return '_';
    return '?';
  }

  /** Decodes a single alphabet character back to its 6-bit value (0-63). */
  static decode6bit(c: string): number {
    return AsciiEncoder.DECODE_6BIT[c.charCodeAt(0)] ?? 0;
  }

  encode(data: Uint8Array | null | undefined): string {
    if (data === null || data === undefined) return '';

    const result: string[] = [];
    for (let i = 0; i < data.length; i += 3) {
      const b1 = data[i]! & 0xff;
      const b2 = i + 1 < data.length ? data[i + 1]! & 0xff : 0;
      const b3 = i + 2 < data.length ? data[i + 2]! & 0xff : 0;
      this.append3bytes(result, b1, b2, b3);
    }
    return result.join('');
  }

  decode(s: string): Uint8Array {
    const data = new Uint8Array(this.computeSize(s.length));
    let pos = 0;
    for (let i = 0; i < s.length; i += 4) {
      const cc1 = this.scharAt(s, i);
      const cc2 = this.scharAt(s, i + 1);
      const cc3 = this.scharAt(s, i + 2);
      const cc4 = this.scharAt(s, i + 3);
      this.decode3bytes(data, pos, cc1, cc2, cc3, cc4);
      pos += 3;
    }
    return data;
  }

  private computeSize(length: number): number {
    const r = length % 4;
    const padded = r !== 0 ? length + (4 - r) : length;
    return Math.floor((padded * 3 + 3) / 4);
  }

  private scharAt(s: string, i: number): string {
    if (i >= s.length) return '0';
    return s.charAt(i);
  }

  private append3bytes(sb: string[], b1: number, b2: number, b3: number): void {
    const c1 = b1 >> 2;
    const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
    const c4 = b3 & 0x3f;
    sb.push(AsciiEncoder.ENCODE_6BIT[c1 & 0x3f]!);
    sb.push(AsciiEncoder.ENCODE_6BIT[c2 & 0x3f]!);
    sb.push(AsciiEncoder.ENCODE_6BIT[c3 & 0x3f]!);
    sb.push(AsciiEncoder.ENCODE_6BIT[c4 & 0x3f]!);
  }

  private decode3bytes(r: Uint8Array, pos: number, cc1: string, cc2: string, cc3: string, cc4: string): void {
    const c1 = AsciiEncoder.decode6bit(cc1);
    const c2 = AsciiEncoder.decode6bit(cc2);
    const c3 = AsciiEncoder.decode6bit(cc3);
    const c4 = AsciiEncoder.decode6bit(cc4);
    r[pos] = (c1 << 2) | (c2 >> 4);
    r[pos + 1] = ((c2 & 0x0f) << 4) | (c3 >> 2);
    r[pos + 2] = ((c3 & 0x3) << 6) | c4;
  }
}
