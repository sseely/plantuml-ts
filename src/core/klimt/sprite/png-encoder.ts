/**
 * Minimal deterministic PNG writer, browser-safe, zero deps, synchronous.
 *
 * Not a port of any single upstream Java class -- upstream relies on the
 * JDK's `javax.imageio` PNG writer (via `SImageIO`/`PortableImageAwt`),
 * which is not portable to TypeScript/browser. This is new code built to
 * the PNG (RFC 2083) and zlib/DEFLATE (RFC 1950/1951) specs directly,
 * scoped exactly to what sprite/img rendering needs per D7
 * (plans/si5b-stdlib/decisions.md): 8-bit RGBA, one PNG per sprite/img
 * atom, deterministic byte output (no compression heuristics, no OS/time
 * metadata) so the same pixels always produce the same bytes.
 *
 * Compression strategy: DEFLATE stored (uncompressed) blocks only.
 * This keeps the encoder small and fully deterministic; PlantUML sprites
 * are tiny (~64x64), so the size cost of skipping LZ77/Huffman coding is
 * negligible and irrelevant to a data-URI embedded in an SVG string.
 *
 * @see https://www.rfc-editor.org/rfc/rfc2083 (PNG)
 * @see https://www.rfc-editor.org/rfc/rfc1950 (ZLIB)
 * @see https://www.rfc-editor.org/rfc/rfc1951 (DEFLATE) section 3.2.4 (stored blocks)
 */

/** 8-byte PNG file signature (RFC 2083 section 3.1). */
const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** zlib CMF byte: CM=8 (deflate), CINFO=7 (32K window) -- RFC 1950 section 2.2. */
const ZLIB_CMF_BYTE = 0x78;
/**
 * zlib FLG byte: FLEVEL=0 (fastest/no compression hint), FDICT=0, and
 * FCHECK chosen so `(CMF*256 + FLG) % 31 === 0` as RFC 1950 section 2.2
 * requires. For CMF=0x78, FLG=0x01 satisfies the check.
 */
const ZLIB_FLG_BYTE = 0x01;

/** Max length of a single DEFLATE stored block (LEN is a 16-bit field). */
const STORED_BLOCK_MAX_LEN = 0xffff;
/** DEFLATE stored-block header byte when this is the final block (BFINAL=1, BTYPE=00). */
const STORED_BLOCK_HEADER_FINAL = 0x01;
/** DEFLATE stored-block header byte for a non-final block (BFINAL=0, BTYPE=00). */
const STORED_BLOCK_HEADER_MORE = 0x00;

const CRC32_POLYNOMIAL = 0xedb88320;
const CRC32_SEED = 0xffffffff;
const ADLER32_MODULO = 65521;

const PNG_BIT_DEPTH_8 = 8;
/** PNG color type 6 = truecolor with alpha (RGBA). */
const PNG_COLOR_TYPE_RGBA = 6;
const PNG_COMPRESSION_METHOD_DEFLATE = 0;
const PNG_FILTER_METHOD_ADAPTIVE = 0;
const PNG_INTERLACE_METHOD_NONE = 0;
/** Per-scanline filter type 0 (None) -- every scanline is written unfiltered. */
const SCANLINE_FILTER_NONE = 0;

/** Bytes per pixel for 8-bit RGBA. */
export const RGBA_BYTES_PER_PIXEL = 4;

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

let crc32TableCache: Uint32Array | undefined;

function getCrc32Table(): Uint32Array {
  if (crc32TableCache !== undefined) return crc32TableCache;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? CRC32_POLYNOMIAL ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crc32TableCache = table;
  return table;
}

/** CRC-32 (zlib/PNG polynomial 0xEDB88320), matching a PNG chunk's trailing CRC. */
export function crc32(data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = CRC32_SEED;
  for (let i = 0; i < data.length; i++) {
    const index = (crc ^ data[i]!) & 0xff;
    crc = table[index]! ^ (crc >>> 8);
  }
  return (crc ^ CRC32_SEED) >>> 0;
}

/** Adler-32 checksum (RFC 1950 section 8), matching zlib's trailing IDAT checksum. */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]!) % ADLER32_MODULO;
    b = (b + a) % ADLER32_MODULO;
  }
  return ((b << 16) | a) >>> 0;
}

function writeUint32BE(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Wraps `type` (a 4-char ASCII chunk tag) + `data` into a length-prefixed, CRC-suffixed PNG chunk. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(type.length);
  for (let i = 0; i < type.length; i++) typeBytes[i] = type.charCodeAt(i);
  const crc = writeUint32BE(crc32(concatBytes([typeBytes, data])));
  return concatBytes([writeUint32BE(data.length), typeBytes, data, crc]);
}

/**
 * Wraps `raw` in DEFLATE stored (uncompressed) blocks (RFC 1951 section
 * 3.2.4): each block is a 1-byte header (BFINAL/BTYPE, byte-aligned since
 * every block here starts on a byte boundary) followed by 2-byte LEN,
 * 2-byte NLEN (one's-complement of LEN), then LEN raw bytes. Blocks are
 * split every 64KB-1 bytes (0xFFFF, the max a 16-bit LEN field can hold).
 */
function deflateStoredBlocks(raw: Uint8Array): Uint8Array {
  if (raw.length === 0) {
    const nlen = ~0 & 0xffff;
    return new Uint8Array([STORED_BLOCK_HEADER_FINAL, 0x00, 0x00, nlen & 0xff, (nlen >>> 8) & 0xff]);
  }

  const blocks: Uint8Array[] = [];
  let offset = 0;
  while (offset < raw.length) {
    const len = Math.min(STORED_BLOCK_MAX_LEN, raw.length - offset);
    const isFinal = offset + len >= raw.length;
    const nlen = ~len & 0xffff;
    const block = new Uint8Array(5 + len);
    block[0] = isFinal ? STORED_BLOCK_HEADER_FINAL : STORED_BLOCK_HEADER_MORE;
    block[1] = len & 0xff;
    block[2] = (len >>> 8) & 0xff;
    block[3] = nlen & 0xff;
    block[4] = (nlen >>> 8) & 0xff;
    block.set(raw.subarray(offset, offset + len), 5);
    blocks.push(block);
    offset += len;
  }
  return concatBytes(blocks);
}

/** Wraps `raw` in a full zlib stream: 2-byte header, stored DEFLATE blocks, 4-byte Adler-32 trailer. */
function zlibWrap(raw: Uint8Array): Uint8Array {
  const header = new Uint8Array([ZLIB_CMF_BYTE, ZLIB_FLG_BYTE]);
  const compressed = deflateStoredBlocks(raw);
  const checksum = writeUint32BE(adler32(raw));
  return concatBytes([header, compressed, checksum]);
}

/** Prepends filter-type-0 (None) to every scanline, per RFC 2083 section 6.2. */
function buildScanlines(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const rowStride = width * RGBA_BYTES_PER_PIXEL;
  const rowBytes = 1 + rowStride;
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    out[rowStart] = SCANLINE_FILTER_NONE;
    out.set(rgba.subarray(y * rowStride, (y + 1) * rowStride), rowStart + 1);
  }
  return out;
}

function buildIhdrData(width: number, height: number): Uint8Array {
  return concatBytes([
    writeUint32BE(width),
    writeUint32BE(height),
    new Uint8Array([
      PNG_BIT_DEPTH_8,
      PNG_COLOR_TYPE_RGBA,
      PNG_COMPRESSION_METHOD_DEFLATE,
      PNG_FILTER_METHOD_ADAPTIVE,
      PNG_INTERLACE_METHOD_NONE,
    ]),
  ]);
}

/**
 * Encodes `rgba` (row-major, 4 bytes/pixel, `width * height * 4` bytes
 * total) into a complete 8-bit RGBA PNG file: signature, IHDR, one IDAT
 * (stored-block zlib stream), IEND. Deterministic -- identical input
 * always produces identical output bytes.
 */
export function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const expectedLength = width * height * RGBA_BYTES_PER_PIXEL;
  if (width <= 0 || height <= 0) {
    throw new Error(`encodePng: invalid dimensions ${width}x${height}`);
  }
  if (rgba.length !== expectedLength) {
    throw new Error(`encodePng: rgba.length ${rgba.length} does not match ${width}x${height}x4 (${expectedLength})`);
  }

  const scanlines = buildScanlines(rgba, width, height);
  const signature = new Uint8Array(PNG_SIGNATURE);
  const ihdr = pngChunk('IHDR', buildIhdrData(width, height));
  const idat = pngChunk('IDAT', zlibWrap(scanlines));
  const iend = pngChunk('IEND', new Uint8Array(0));
  return concatBytes([signature, ihdr, idat, iend]);
}

/** Standard (RFC 4648) base64 encoding -- NOT PlantUML's 6-bit sprite alphabet. */
export function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]!;
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    result += BASE64_ALPHABET[b1 >> 2];
    result += BASE64_ALPHABET[((b1 & 0x03) << 4) | (b2 === undefined ? 0 : b2 >> 4)];
    result += b2 === undefined ? '=' : BASE64_ALPHABET[((b2 & 0x0f) << 2) | (b3 === undefined ? 0 : b3 >> 6)];
    result += b3 === undefined ? '=' : BASE64_ALPHABET[b3 & 0x3f];
  }
  return result;
}

/** `data:image/png;base64,...` URI for `pngBytes` (a PNG produced by `encodePng`). */
export function toBase64DataUri(pngBytes: Uint8Array): string {
  return `data:image/png;base64,${toBase64(pngBytes)}`;
}
