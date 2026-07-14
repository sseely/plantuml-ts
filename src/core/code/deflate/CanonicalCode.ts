import type { BitInputStream } from './BitInputStream.js';

/** The maximum Huffman code length allowed in the DEFLATE standard. */
const MAX_CODE_LENGTH = 15;

/**
 * Binary search over an ascending-sorted array. Returns the matching index,
 * or -1 if `target` is absent. Upstream uses `Arrays.binarySearch`, whose
 * full not-found contract (negative insertion point) is never consulted by
 * `CanonicalCode#decodeNextSymbol` beyond the `>= 0` found check, so this
 * port only needs found-vs-not-found.
 */
function binarySearch(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const value = sorted[mid]!;
    if (value === target) return mid;
    if (value < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/**
 * A canonical Huffman code, where the code value for each symbol is derived
 * from a given sequence of code lengths. This data structure is immutable.
 *
 * `symbolCodeBits` contains Huffman codes, each padded with a leading 1 bit
 * to disambiguate codes of different lengths (e.g. otherwise `0b01` and
 * `0b0001` can't be told apart). Each `symbolCodeBits[i]` decodes to its
 * corresponding `symbolValues[i]`. Values in `symbolCodeBits` are strictly
 * increasing.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/code/deflate/CanonicalCode.java
 */
export class CanonicalCode {
  private readonly symbolCodeBits: number[];
  private readonly symbolValues: number[];

  /**
   * Constructs a canonical Huffman code from the specified array of symbol
   * code lengths. Each code length must be non-negative; 0 means no code
   * for that symbol. The collection of code lengths must represent a
   * proper full Huffman code tree (neither under-full nor over-full).
   */
  constructor(codeLengths: readonly number[]) {
    for (const x of codeLengths) {
      if (x < 0) throw new Error('Negative code length');
      if (x > MAX_CODE_LENGTH) throw new Error('Maximum code length exceeded');
    }

    // Allocate code values to symbols. Symbols are processed in order of
    // shortest code length first, breaking ties by lowest symbol value.
    const symbolCodeBits: number[] = [];
    const symbolValues: number[] = [];
    let nextCode = 0;
    for (let codeLength = 1; codeLength <= MAX_CODE_LENGTH; codeLength++) {
      nextCode <<= 1;
      const startBit = 1 << codeLength;
      for (let symbol = 0; symbol < codeLengths.length; symbol++) {
        if (codeLengths[symbol] !== codeLength) continue;
        if (nextCode >= startBit) {
          throw new Error('This canonical code produces an over-full Huffman code tree');
        }
        symbolCodeBits.push(startBit | nextCode);
        symbolValues.push(symbol);
        nextCode++;
      }
    }
    if (nextCode !== 1 << MAX_CODE_LENGTH) {
      throw new Error('This canonical code produces an under-full Huffman code tree');
    }

    this.symbolCodeBits = symbolCodeBits;
    this.symbolValues = symbolValues;
  }

  /**
   * Decodes the next symbol from the specified bit input stream based on
   * this canonical code. The returned symbol value is in the range
   * `[0, codeLengths.length)`.
   */
  decodeNextSymbol(input: BitInputStream): number {
    let codeBits = 1; // The start bit
    for (;;) {
      // Accumulate one bit at a time on the right side until a match is
      // found in symbolCodeBits. Because the Huffman code tree is full,
      // this loop must terminate after at most MAX_CODE_LENGTH iterations.
      codeBits = (codeBits << 1) | input.readNoEof();
      const index = binarySearch(this.symbolCodeBits, codeBits);
      if (index >= 0) return this.symbolValues[index]!;
    }
  }
}
