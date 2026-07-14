import { ByteBitInputStream } from './ByteBitInputStream.js';
import { Decompressor } from './Decompressor.js';

/**
 * Inflates a raw-DEFLATE PlantUML payload (the `~1` / hex / 6-bit-alphabet
 * URL encodings all bottom out here), mirroring
 * `CompressionZlib#decompress`'s exact calling convention: the input is
 * padded with 256 trailing zero bytes before being fed to the bit-stream
 * reader and inflater. Upstream pads because a malformed/truncated stream
 * would otherwise throw `EOFException` mid-symbol instead of cleanly
 * hitting the final-block terminator; the padding gives the inflater
 * enough trailing zero bits to always find one. Named for what it does --
 * there is no upstream class of this name; `CompressionZlib` itself mixes
 * zlib-format compression (not ported here; out of this task's D6 scope),
 * decompression, and an array-copy helper into one class.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/CompressionZlib.java:77-87
 */
export function decompressPlantumlZ(input: Uint8Array): Uint8Array {
  const padded = new Uint8Array(input.length + 256);
  padded.set(input, 0);

  const stream = new ByteBitInputStream(padded);
  return Decompressor.decompress(stream);
}
