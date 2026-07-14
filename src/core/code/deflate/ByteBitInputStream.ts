import type { BitInputStream } from './BitInputStream.js';
import { EOFException } from './DeflateErrors.js';

/**
 * A stream of bits that can be read. Because they come from an underlying
 * byte stream, the total number of bits is always a multiple of 8. The bits
 * are read in little endian. Mutable and not thread-safe.
 *
 * Upstream wraps a generic `java.io.InputStream`; every construction site in
 * the Java codebase (`CompressionZlib#decompress`) hands it a
 * `ByteArrayInputStream`, so this port narrows the source directly to a
 * `Uint8Array` rather than porting the JDK's `InputStream` abstraction --
 * the byte-at-a-time read semantics, bit-packing order, and end-of-stream
 * (-1) behavior are ported verbatim.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/ByteBitInputStream.java
 */
export class ByteBitInputStream implements BitInputStream {
  private readonly input: Uint8Array;

  /** Index of the next unread byte in `input`. */
  private position = 0;

  /** Either in [0x00, 0xFF] if bits are available, or -1 if end of stream. */
  private currentByte = 0;

  /** Number of remaining bits in the current byte, always 0-7 inclusive. */
  private numBitsRemaining = 0;

  constructor(input: Uint8Array) {
    this.input = input;
  }

  private readByteFromSource(): number {
    if (this.position >= this.input.length) return -1;
    return this.input[this.position++]!;
  }

  getBitPosition(): number {
    if (this.numBitsRemaining < 0 || this.numBitsRemaining > 7) {
      throw new Error('IllegalStateException');
    }
    return (8 - this.numBitsRemaining) % 8;
  }

  readByte(): number {
    this.currentByte = 0;
    this.numBitsRemaining = 0;
    return this.readByteFromSource();
  }

  read(): number {
    if (this.currentByte === -1) return -1;
    if (this.numBitsRemaining === 0) {
      this.currentByte = this.readByteFromSource();
      if (this.currentByte === -1) return -1;
      this.numBitsRemaining = 8;
    }
    if (this.numBitsRemaining <= 0) throw new Error('IllegalStateException');
    this.numBitsRemaining--;
    return (this.currentByte >>> (7 - this.numBitsRemaining)) & 1;
  }

  readNoEof(): number {
    const result = this.read();
    if (result === -1) throw new EOFException();
    return result;
  }

  close(): void {
    this.currentByte = -1;
    this.numBitsRemaining = 0;
  }
}
