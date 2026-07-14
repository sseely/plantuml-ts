/**
 * Upstream's `code/deflate` package throws two checked JDK exception types
 * that TS has no built-in equivalent for: `java.io.EOFException` (from
 * {@link BitInputStream.readNoEof} and `Decompressor#decompressUncompressedBlock`)
 * and `java.util.zip.DataFormatException` (from `Decompressor`'s malformed-
 * stream checks). These are not renamed ports of a plantuml class -- they
 * stand in for the two JDK types the ported files import directly, kept
 * under their original JDK names so a reader cross-referencing the Java can
 * still grep for `EOFException` / `DataFormatException` and land here.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/ByteBitInputStream.java
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/Decompressor.java
 */
export class EOFException extends Error {
  constructor(message = 'End of stream reached') {
    super(message);
    this.name = 'EOFException';
  }
}

/**
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/Decompressor.java
 */
export class DataFormatException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataFormatException';
  }
}
