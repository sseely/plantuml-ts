import type { OutputStreamProtected } from './OutputStreamProtected.js';

/**
 * Stores a finite recent history of a byte stream. Useful as an implicit
 * dictionary for Lempel-Ziv schemes (DEFLATE's LZ77 back-references).
 * Mutable and not thread-safe.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/ByteHistory.java
 */
export class ByteHistory {
  /** Circular buffer of byte data. */
  private readonly data: Uint8Array;

  /** Index of next byte to write to, always in the range [0, data.length). */
  private index = 0;

  constructor(size: number) {
    if (size < 1) throw new Error('Size must be positive');
    this.data = new Uint8Array(size);
  }

  /**
   * Appends the specified byte to this history. This overwrites the byte
   * value at `size` positions ago.
   */
  append(b: number): void {
    if (this.index < 0 || this.index >= this.data.length) {
      throw new Error('IllegalStateException');
    }
    this.data[this.index] = b & 0xff;
    this.index = (this.index + 1) % this.data.length;
  }

  /**
   * Copies `len` bytes starting at `dist` bytes ago to the specified output
   * stream and also back into this buffer itself.
   *
   * Note that if the length exceeds the distance, then some of the output
   * data will be a copy of data that was copied earlier in the process.
   */
  copy(dist: number, len: number, out: OutputStreamProtected): void {
    if (len < 0 || dist < 1 || dist > this.data.length) {
      throw new Error('IllegalArgumentException');
    }

    let readIndex = (this.index - dist + this.data.length) % this.data.length;
    if (readIndex < 0 || readIndex >= this.data.length) {
      throw new Error('IllegalStateException');
    }

    for (let i = 0; i < len; i++) {
      const b = this.data[readIndex]!;
      readIndex = (readIndex + 1) % this.data.length;
      out.write(b);
      this.append(b);
    }
  }
}
