/**
 * A stream of bits that can be read. Bits are packed in little endian within
 * a byte. For example, the byte 0x87 reads as the sequence of bits
 * [1,1,1,0,0,0,0,1].
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/BitInputStream.java
 */
export interface BitInputStream {
  /** Returns the current bit position, which ascends from 0 to 7 as bits are read. */
  getBitPosition(): number;

  /**
   * Discards the remainder of the current byte (if any) and reads the next
   * whole byte from the stream. Returns -1 if the end of stream is reached.
   */
  readByte(): number;

  /**
   * Reads a bit from this stream. Returns 0 or 1 if a bit is available, or
   * -1 if the end of stream is reached. The end of stream always occurs on
   * a byte boundary.
   */
  read(): number;

  /**
   * Reads a bit from this stream. Returns 0 or 1 if a bit is available, or
   * throws {@link EOFException} if the end of stream is reached.
   */
  readNoEof(): number;

  /** Closes this stream and any underlying resource. */
  close(): void;
}
