/**
 * A growable byte sink with a hard size cap, guarding against a malformed
 * or hostile DEFLATE stream expanding without bound.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/OutputStreamProtected.java
 */
export class OutputStreamProtected {
  static readonly MAX_OUTPUT_SIZE = 1 * 1024 * 1024;

  private readonly bytes: number[] = [];
  private counter = 0;

  write(b: number): void {
    this.counter++;
    this.bytes.push(b & 0xff);
    if (this.counter > OutputStreamProtected.MAX_OUTPUT_SIZE) {
      throw new Error('Too big');
    }
  }

  toByteArray(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  /** No-op: nothing to release in this browser-safe port (no underlying fd). */
  close(): void {
    // intentionally empty
  }
}
