import type { BitInputStream } from './BitInputStream.js';
import { ByteHistory } from './ByteHistory.js';
import { CanonicalCode } from './CanonicalCode.js';
import { DataFormatException, EOFException } from './DeflateErrors.js';
import { OutputStreamProtected } from './OutputStreamProtected.js';

function fixedLiteralLengthCode(): CanonicalCode {
  const llcodelens = (new Array(288) as number[]).fill(0);
  llcodelens.fill(8, 0, 144);
  llcodelens.fill(9, 144, 256);
  llcodelens.fill(7, 256, 280);
  llcodelens.fill(8, 280, 288);
  return new CanonicalCode(llcodelens);
}

function fixedDistanceCode(): CanonicalCode {
  return new CanonicalCode((new Array(32) as number[]).fill(5));
}

/*-- The constant code trees for static Huffman codes (btype = 1) --*/
const FIXED_LITERAL_LENGTH_CODE = fixedLiteralLengthCode();
const FIXED_DISTANCE_CODE = fixedDistanceCode();

/**
 * Decompresses raw DEFLATE data (without zlib or gzip container) into
 * bytes.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/Decompressor.java
 */
export class Decompressor {
  /*---- Public functions ----*/

  /**
   * Reads from the specified input stream, decompresses the data, and
   * returns a new byte array.
   */
  static decompress(input: BitInputStream): Uint8Array;
  /**
   * Reads from the specified input stream, decompresses the data, and
   * writes to the specified output stream.
   */
  static decompress(input: BitInputStream, output: OutputStreamProtected): void;
  static decompress(input: BitInputStream, output?: OutputStreamProtected): Uint8Array | void {
    if (output === undefined) {
      const out = new OutputStreamProtected();
      Decompressor.decompress(input, out);
      return out.toByteArray();
    }
    // Constructor performs the decompression as its side effect, mirroring
    // upstream's `new Decompressor(in, out)` factory call.
    new Decompressor(input, output);
    return undefined;
  }

  /*---- Private implementation ----*/

  private readonly input: BitInputStream;
  private readonly output: OutputStreamProtected;
  private readonly dictionary: ByteHistory;

  // Constructor, which immediately performs decompression.
  private constructor(input: BitInputStream, output: OutputStreamProtected) {
    if (input === null || input === undefined) throw new TypeError('input must not be null/undefined');
    if (output === null || output === undefined) throw new TypeError('output must not be null/undefined');
    this.input = input;
    this.output = output;
    this.dictionary = new ByteHistory(32 * 1024);

    // Process the stream of blocks
    let isFinal: boolean;
    do {
      // Read the block header
      isFinal = this.input.readNoEof() === 1; // bfinal
      const type = this.readInt(2); // btype

      // Decompress rest of block based on the type
      if (type === 0) this.decompressUncompressedBlock();
      else if (type === 1) this.decompressHuffmanBlock(FIXED_LITERAL_LENGTH_CODE, FIXED_DISTANCE_CODE);
      else if (type === 2) {
        const [litLenCode, distCode] = this.decodeHuffmanCodes();
        this.decompressHuffmanBlock(litLenCode, distCode);
      } else if (type === 3) throw new DataFormatException('Reserved block type');
      else throw new Error('Impossible value');
    } while (!isFinal);
  }

  /*-- Method for reading and decoding dynamic Huffman codes (btype = 2) --*/

  // Reads from the bit input stream, decodes the Huffman code
  // specifications into code trees, and returns the trees.
  private decodeHuffmanCodes(): [CanonicalCode, CanonicalCode | undefined] {
    const numLitLenCodes = this.readInt(5) + 257; // hlit + 257
    const numDistCodes = this.readInt(5) + 1; // hdist + 1

    // Read the code length code lengths
    const numCodeLenCodes = this.readInt(4) + 4; // hclen + 4
    const codeLenCodeLen = (new Array(19) as number[]).fill(0); // Filled in a strange order
    codeLenCodeLen[16] = this.readInt(3);
    codeLenCodeLen[17] = this.readInt(3);
    codeLenCodeLen[18] = this.readInt(3);
    codeLenCodeLen[0] = this.readInt(3);
    for (let i = 0; i < numCodeLenCodes - 4; i++) {
      const j = i % 2 === 0 ? 8 + Math.floor(i / 2) : 7 - Math.floor(i / 2);
      codeLenCodeLen[j] = this.readInt(3);
    }

    // Create the code length code
    let codeLenCode: CanonicalCode;
    try {
      codeLenCode = new CanonicalCode(codeLenCodeLen);
    } catch (e) {
      throw new DataFormatException(e instanceof Error ? e.message : String(e));
    }

    // Read the main code lengths and handle runs
    const codeLens = (new Array(numLitLenCodes + numDistCodes) as number[]).fill(0);
    for (let codeLensIndex = 0; codeLensIndex < codeLens.length; ) {
      const sym = codeLenCode.decodeNextSymbol(this.input);
      if (sym >= 0 && sym <= 15) {
        codeLens[codeLensIndex] = sym;
        codeLensIndex++;
        continue;
      }
      let runLen: number;
      let runVal = 0;
      if (sym === 16) {
        if (codeLensIndex === 0) throw new DataFormatException('No code length value to copy');
        runLen = this.readInt(2) + 3;
        runVal = codeLens[codeLensIndex - 1]!;
      } else if (sym === 17) runLen = this.readInt(3) + 3;
      else if (sym === 18) runLen = this.readInt(7) + 11;
      else throw new Error('Symbol out of range');
      const end = codeLensIndex + runLen;
      if (end > codeLens.length) throw new DataFormatException('Run exceeds number of codes');
      codeLens.fill(runVal, codeLensIndex, end);
      codeLensIndex = end;
    }

    // Create literal-length code tree
    const litLenCodeLen = codeLens.slice(0, numLitLenCodes);
    let litLenCode: CanonicalCode;
    try {
      litLenCode = new CanonicalCode(litLenCodeLen);
    } catch (e) {
      throw new DataFormatException(e instanceof Error ? e.message : String(e));
    }

    // Create distance code tree with some extra processing
    let distCodeLen = codeLens.slice(numLitLenCodes, codeLens.length);
    let distCode: CanonicalCode | undefined;
    if (distCodeLen.length === 1 && distCodeLen[0] === 0) {
      distCode = undefined; // Empty distance code; the block shall be all literal symbols
    } else {
      // Get statistics for upcoming logic
      let oneCount = 0;
      let otherPositiveCount = 0;
      for (const x of distCodeLen) {
        if (x === 1) oneCount++;
        else if (x > 1) otherPositiveCount++;
      }

      // Handle the case where only one distance code is defined
      if (oneCount === 1 && otherPositiveCount === 0) {
        // Add a dummy invalid code to make the Huffman tree complete
        // (Arrays.copyOf zero-pads; slice+push mirrors that here)
        distCodeLen = distCodeLen.slice(0, 32);
        while (distCodeLen.length < 32) distCodeLen.push(0);
        distCodeLen[31] = 1;
      }
      try {
        distCode = new CanonicalCode(distCodeLen);
      } catch (e) {
        throw new DataFormatException(e instanceof Error ? e.message : String(e));
      }
    }

    return [litLenCode, distCode];
    // #lizard forgives -- faithful port of Decompressor.java#decodeHuffmanCodes; upstream's own
    // dynamic-Huffman-header parsing has this shape (strange-order fills, run-length decoding,
    // three CanonicalCode constructions with distinct error wrapping).
  }

  /*-- Block decompression methods --*/

  // Handles and copies an uncompressed block from the bit input stream.
  private decompressUncompressedBlock(): void {
    // Discard bits to align to byte boundary
    while (this.input.getBitPosition() !== 0) this.input.readNoEof();

    // Read length
    const len = this.readInt(16);
    const nlen = this.readInt(16);
    if ((len ^ 0xffff) !== nlen) throw new DataFormatException('Invalid length in uncompressed block');

    // Copy bytes
    for (let i = 0; i < len; i++) {
      const b = this.input.readByte();
      if (b === -1) throw new EOFException();
      this.output.write(b);
      this.dictionary.append(b);
    }
  }

  // Decompresses a Huffman-coded block from the bit input stream based on
  // the given Huffman codes.
  private decompressHuffmanBlock(litLenCode: CanonicalCode, distCode: CanonicalCode | undefined): void {
    for (;;) {
      const sym = litLenCode.decodeNextSymbol(this.input);
      if (sym === 256) break; // End of block

      if (sym < 256) {
        // Literal byte
        this.output.write(sym);
        this.dictionary.append(sym);
      } else {
        // Length and distance for copying
        const run = this.decodeRunLength(sym);
        if (run < 3 || run > 258) throw new Error('Invalid run length');
        if (distCode === undefined) {
          throw new DataFormatException('Length symbol encountered with empty distance code');
        }
        const distSym = distCode.decodeNextSymbol(this.input);
        const dist = this.decodeDistance(distSym);
        if (dist < 1 || dist > 32768) throw new Error('Invalid distance');
        this.dictionary.copy(dist, run, this.output);
      }
    }
  }

  /*-- Symbol decoding methods --*/

  // Returns the run length based on the given symbol and possibly reading
  // more bits.
  private decodeRunLength(sym: number): number {
    if (sym < 257 || sym > 287) throw new Error(`Invalid run length symbol: ${sym}`);
    else if (sym <= 264) return sym - 254;
    else if (sym <= 284) {
      const numExtraBits = Math.floor((sym - 261) / 4);
      const base = ((sym - 265) % 4) + 4;
      return (base << numExtraBits) + 3 + this.readInt(numExtraBits);
    } else if (sym === 285) return 258;
    else throw new DataFormatException(`Reserved length symbol: ${sym}`);
  }

  // Returns the distance based on the given symbol and possibly reading
  // more bits.
  private decodeDistance(sym: number): number {
    if (sym < 0 || sym > 31) throw new Error(`Invalid distance symbol: ${sym}`);
    if (sym <= 3) return sym + 1;
    else if (sym <= 29) {
      const numExtraBits = Math.floor(sym / 2) - 1;
      const base = (sym % 2) + 2;
      return (base << numExtraBits) + 1 + this.readInt(numExtraBits);
    } else throw new DataFormatException(`Reserved distance symbol: ${sym}`);
  }

  /*-- Utility method --*/

  // Reads the given number of bits from the bit input stream as a single
  // integer, packed in little endian.
  private readInt(numBits: number): number {
    if (numBits < 0 || numBits > 31) throw new Error('IllegalArgumentException');
    let result = 0;
    for (let i = 0; i < numBits; i++) result |= this.input.readNoEof() << i;
    return result;
  }
}
