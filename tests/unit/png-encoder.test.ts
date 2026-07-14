/**
 * Unit tests for the SI5b/T5 PNG encoder + monochrome sprite tint:
 *  - `crc32`/`adler32`/`encodePng`/`toBase64DataUri`
 *    (src/core/klimt/sprite/png-encoder.ts)
 *  - `spriteToRgba`/`spriteToPngDataUri`
 *    (src/core/klimt/sprite/sprite-raster.ts) -- ports
 *    `SpriteMonochrome#toUImage`'s gradient/alpha math
 *    (~/git/plantuml/.../klimt/sprite/SpriteMonochrome.java:180-208).
 *
 * The PNG-parsing tests below use Node's `zlib.inflateSync` ONLY as a test
 * oracle to decode the IDAT payload back to raw scanlines -- the encoder
 * itself (src/) stays browser-safe with zero Node dependencies.
 */
import { describe, it, expect } from 'vitest';
import { inflateSync, crc32 as nodeCrc32 } from 'node:zlib';
import { crc32, adler32, encodePng, toBase64, toBase64DataUri } from '../../src/core/klimt/sprite/png-encoder.js';
import { spriteToRgba, spriteToPngDataUri, type SpriteLike } from '../../src/core/klimt/sprite/sprite-raster.js';
import { AsciiEncoder } from '../../src/core/klimt/sprite/AsciiEncoder.js';
import { decompressPlantumlZ } from '../../src/core/code/deflate/decompressPlantumlZ.js';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RGBA_BYTES = 4;

/** Parses a PNG produced by `encodePng` back to signature/IHDR/scanline data, via Node's zlib as an oracle. */
function parsePng(png: Uint8Array): { width: number; height: number; scanlines: Buffer } {
  const buf = Buffer.from(png);
  expect(Array.from(buf.subarray(0, 8))).toEqual(PNG_SIGNATURE);

  const ihdrLength = buf.readUInt32BE(8);
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(ihdrLength).toBe(13);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  // IHDR chunk: 4 (length) + 4 (type) + 13 (data) + 4 (crc) = 25 bytes, then IDAT.
  const idatStart = 8 + 25;
  const idatLength = buf.readUInt32BE(idatStart);
  expect(buf.subarray(idatStart + 4, idatStart + 8).toString('ascii')).toBe('IDAT');
  const idatData = buf.subarray(idatStart + 8, idatStart + 8 + idatLength);
  const scanlines = inflateSync(idatData);

  const iendStart = idatStart + 8 + idatLength + 4;
  expect(buf.subarray(iendStart + 4, iendStart + 8).toString('ascii')).toBe('IEND');
  expect(buf.readUInt32BE(iendStart)).toBe(0);
  expect(iendStart + 12).toBe(buf.length);

  return { width, height, scanlines };
}

/** Reads pixel (x, y) as [r, g, b, a] out of unfiltered (filter-type-0) scanlines. */
function readPixel(scanlines: Buffer, width: number, x: number, y: number): readonly [number, number, number, number] {
  const rowBytes = 1 + width * RGBA_BYTES;
  const rowStart = y * rowBytes;
  expect(scanlines[rowStart]).toBe(0); // filter type 0 (None)
  const pixelStart = rowStart + 1 + x * RGBA_BYTES;
  return [
    scanlines[pixelStart]!,
    scanlines[pixelStart + 1]!,
    scanlines[pixelStart + 2]!,
    scanlines[pixelStart + 3]!,
  ];
}

/** A fixed-grid `SpriteLike` for handmade test fixtures. */
function grid(width: number, height: number, grayLevels: number, values: readonly number[]): SpriteLike {
  return {
    width,
    height,
    grayLevels,
    pixelAt: (x, y) => values[y * width + x]!,
  };
}

describe('crc32 / adler32 known vectors', () => {
  it('crc32 matches the CRC-32/ISO-HDLC check value for "123456789"', () => {
    const input = new TextEncoder().encode('123456789');
    expect(crc32(input)).toBe(0xcbf43926);
    expect(crc32(input)).toBe(nodeCrc32(Buffer.from(input)));
  });

  it('crc32 of the empty buffer is 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('crc32 of the ASCII bytes "IEND" matches the well-known empty-IEND-chunk CRC', () => {
    const input = new TextEncoder().encode('IEND');
    expect(crc32(input)).toBe(0xae426082);
    expect(crc32(input)).toBe(nodeCrc32(Buffer.from(input)));
  });

  it('adler32 of the empty buffer is 1', () => {
    expect(adler32(new Uint8Array(0))).toBe(1);
  });

  it('adler32 of a single byte 0x61 ("a") is 0x00620062', () => {
    // a = 1 + 97 = 98 = 0x62; b = 0 + 98 = 98 = 0x62; (b<<16)|a = 0x00620062.
    expect(adler32(new TextEncoder().encode('a'))).toBe(0x00620062);
  });

  it('adler32 of "abc" is 0x024d0127', () => {
    // a: 1 ->98(+97) ->196(+98) ->295(+99); b: 0 ->98 ->294(+196) ->589(+295)
    // adler32 = (589<<16)|295 = 0x024d0127.
    expect(adler32(new TextEncoder().encode('abc'))).toBe(0x024d0127);
  });
});

describe('encodePng: stored-block framing + scanline round-trip', () => {
  it('rejects an rgba buffer that does not match width*height*4', () => {
    expect(() => encodePng(new Uint8Array(3), 1, 1)).toThrow(/does not match/);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => encodePng(new Uint8Array(0), 0, 1)).toThrow(/invalid dimensions/);
  });

  it('round-trips a 1x1 opaque red pixel through Node zlib.inflateSync', () => {
    const rgba = new Uint8Array([0xff, 0x00, 0x00, 0xff]);
    const png = encodePng(rgba, 1, 1);
    const { width, height, scanlines } = parsePng(png);
    expect(width).toBe(1);
    expect(height).toBe(1);
    expect(readPixel(scanlines, 1, 0, 0)).toEqual([0xff, 0x00, 0x00, 0xff]);
  });

  it('splits a scanline stream larger than 64KB-1 into multiple stored blocks', () => {
    // width chosen so width*height*4 + height (filter bytes) comfortably
    // exceeds 0xFFFF (65535), forcing deflateStoredBlocks to emit >1 block.
    const width = 200;
    const height = 100; // raw size = 100 * (1 + 200*4) = 80_100 bytes > 65535
    const rgba = new Uint8Array(width * height * RGBA_BYTES);
    for (let i = 0; i < rgba.length; i++) rgba[i] = i % 256;
    const png = encodePng(rgba, width, height);
    const { width: w, height: h, scanlines } = parsePng(png);
    expect(w).toBe(width);
    expect(h).toBe(height);
    expect(scanlines.length).toBe(height * (1 + width * RGBA_BYTES));
    // Spot-check a pixel deep into the second stored block's territory.
    const [r, g, b, a] = readPixel(scanlines, width, width - 1, height - 1);
    const lastPixelOffset = ((height - 1) * width + (width - 1)) * RGBA_BYTES;
    expect([r, g, b, a]).toEqual([
      lastPixelOffset % 256,
      (lastPixelOffset + 1) % 256,
      (lastPixelOffset + 2) % 256,
      (lastPixelOffset + 3) % 256,
    ]);
  });

  it('is deterministic: two encodes of the same pixels produce byte-identical output', () => {
    const rgba = new Uint8Array(4 * 4 * RGBA_BYTES);
    for (let i = 0; i < rgba.length; i++) rgba[i] = (i * 17 + 3) % 256;
    const first = encodePng(rgba, 4, 4);
    const second = encodePng(new Uint8Array(rgba), 4, 4); // fresh copy, same values
    expect(Array.from(second)).toEqual(Array.from(first));
  });
});

describe('toBase64 / toBase64DataUri', () => {
  it('encodes standard base64 (not the sprite 6-bit alphabet), including padding', () => {
    // "Man" -> "TWFu" (0 padding); "Ma" -> "TWE=" (1 pad); "M" -> "TQ==" (2 pad).
    expect(toBase64(new TextEncoder().encode('Man'))).toBe('TWFu');
    expect(toBase64(new TextEncoder().encode('Ma'))).toBe('TWE=');
    expect(toBase64(new TextEncoder().encode('M'))).toBe('TQ==');
  });

  it('wraps a PNG in a data:image/png;base64, URI matching Buffer.toString("base64")', () => {
    const png = encodePng(new Uint8Array([0, 0, 0, 0]), 1, 1);
    const uri = toBase64DataUri(png);
    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    const b64 = uri.slice('data:image/png;base64,'.length);
    expect(Buffer.from(b64, 'base64')).toEqual(Buffer.from(png));
  });
});

describe('spriteToRgba: SpriteMonochrome#toUImage gradient/alpha port', () => {
  // 2x2 grid, grayLevel=16 (maxLevel=15): gray 0 (background), gray 15
  // (the sprite's own darkest-used level -> maxCoef=1), gray 1 (below the
  // maxCoef/4 threshold -> ramp branch), gray 8 (above threshold -> opaque
  // branch but not the max gray value). fontColor=black, backColor=white.
  const sprite = grid(2, 2, 16, [0, 15, 1, 8]);

  it('gray 0 is fully transparent regardless of fontColor/backColor', () => {
    const { rgba } = spriteToRgba(sprite, '#000000', '#ffffff');
    expect(Array.from(rgba.subarray(0, 4))).toEqual([255, 255, 255, 0]);
  });

  it('the sprite-relative darkest gray level (15, coef=maxCoef=1) is fully opaque fontColor', () => {
    const { rgba } = spriteToRgba(sprite, '#000000', '#ffffff');
    expect(Array.from(rgba.subarray(4, 8))).toEqual([0, 0, 0, 255]);
  });

  it('a middle gray below the maxCoef/4 threshold ramps alpha (not a flat linear map)', () => {
    // gray=1: coef=1/15; alpha=trunc(255*(1/15)*4/1)=trunc(1020/15)=68;
    // channel=trunc(255*(1-1/15))=trunc(3570/15)=238.
    const { rgba } = spriteToRgba(sprite, '#000000', '#ffffff');
    expect(Array.from(rgba.subarray(8, 12))).toEqual([238, 238, 238, 68]);
  });

  it('a middle gray above the maxCoef/4 threshold is fully opaque but not full fontColor', () => {
    // gray=8: coef=8/15 > maxCoef/4=0.25 -> alpha=255;
    // channel=trunc(255*(1-8/15))=trunc(1785/15)=119.
    const { rgba } = spriteToRgba(sprite, '#000000', '#ffffff');
    expect(Array.from(rgba.subarray(12, 16))).toEqual([119, 119, 119, 255]);
  });

  it('an all-gray-0 sprite (maxCoef=0) is fully transparent everywhere, no NaN/crash', () => {
    const blank = grid(2, 2, 16, [0, 0, 0, 0]);
    const { rgba } = spriteToRgba(blank, '#000000', '#ffffff');
    expect(Array.from(rgba)).toEqual(new Array(16).fill(0).map((_, i) => (i % 4 === 3 ? 0 : 255)));
  });

  it('defaults fontColor to black and backColor to white when omitted', () => {
    const withDefaults = spriteToRgba(sprite);
    const explicit = spriteToRgba(sprite, '#000000', '#ffffff');
    expect(Array.from(withDefaults.rgba)).toEqual(Array.from(explicit.rgba));
  });

  it('throws on an unresolvable color string', () => {
    expect(() => spriteToRgba(sprite, 'not-a-color')).toThrow(/unknown color/);
  });
});

describe('spriteToPngDataUri', () => {
  const sprite = grid(2, 2, 16, [0, 15, 1, 8]);

  it('produces a data URI whose PNG pixels match spriteToRgba, and natural dims equal the sprite', () => {
    const result = spriteToPngDataUri(sprite, '#000000', '#ffffff');
    expect(result.naturalWidth).toBe(2);
    expect(result.naturalHeight).toBe(2);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);

    const b64 = result.dataUri.slice('data:image/png;base64,'.length);
    const { width, height, scanlines } = parsePng(new Uint8Array(Buffer.from(b64, 'base64')));
    expect(width).toBe(2);
    expect(height).toBe(2);
    expect(readPixel(scanlines, 2, 1, 0)).toEqual([0, 0, 0, 255]);
  });

  it('scale multiplies the reported display dims but not the natural PNG raster size', () => {
    const result = spriteToPngDataUri(sprite, '#000000', '#ffffff', 3);
    expect(result.naturalWidth).toBe(2);
    expect(result.naturalHeight).toBe(2);
    expect(result.width).toBe(6);
    expect(result.height).toBe(6);

    const b64 = result.dataUri.slice('data:image/png;base64,'.length);
    const { width, height } = parsePng(new Uint8Array(Buffer.from(b64, 'base64')));
    expect(width).toBe(2); // raster stays natural-size; see sprite-raster.ts divergence note
    expect(height).toBe(2);
  });
});

describe('a real stdlib sprite decodes and PNG-encodes to the expected IHDR dims', () => {
  // Copied verbatim (compressed body only) from
  // tests/unit/sprite-decode.test.ts, matching the same upstream vector:
  // awslib14/Storage/SimpleStorageService.puml (sprite $SimpleStorageService, 64x64/16z).
  const lines = [
    'xPO5akKm34IVsBh_WPSfgT4eIuN_5IRcxZRq_-35YrELdwcgtssPhi85iNZOIxa0ekQPzPdCS5C0ZTCB8I2URzIhCC3gtR45UM-CCh2vF93Sf76OEYYiTmeP',
    'Ifn-Gd2c0k-T8zCm2RgQdC2yCj1SiY5e3-370Pty5v3eMUKlFQS9tmBe7fdkRgfyHhsw3z43Aj_p7tRT0AB-FVz5ze1nr_hKEUVkqgYn3yu-JKbIlQBCzd2N',
    '9j3xb4Hxuk3t7zn_NUrRoWw0dViO8o9tHSJickeYUyGOjhn4VoF6-Cm6dX3mywtAJT9dsKZzjhMCOAnLvBid5vQYNS9P39mdWNWwiHWu4dncpBdeUdhcgUe9',
    'bNNyUhYvPeVtitb9s4mo6xWBD1vkpmt2b_xzsVpMWEu6xlRj-kxsxHNsxfyVmI9hlcEtRwknzpvZs9aNn-aD0urwex61LE-K0QXvP7qXmrK0ZNv8XGaNrFFy',
    'uVivw_H_uiMBZm',
  ];

  it('decodes to 4096 gray bytes and PNG-encodes with IHDR width=height=64', () => {
    const encoder = new AsciiEncoder();
    const compressed = encoder.decode(lines.map((l) => l.trim()).join(''));
    const grays = decompressPlantumlZ(compressed);
    expect(grays).toHaveLength(64 * 64);

    const sprite: SpriteLike = {
      width: 64,
      height: 64,
      grayLevels: 16,
      pixelAt: (x, y) => grays[y * 64 + x]!,
    };

    const result = spriteToPngDataUri(sprite, '#000000', '#ffffff');
    expect(result.naturalWidth).toBe(64);
    expect(result.naturalHeight).toBe(64);

    const b64 = result.dataUri.slice('data:image/png;base64,'.length);
    const pngBytes = Buffer.from(b64, 'base64');
    // IHDR width/height: bytes 16-23 (big-endian) after the 8-byte signature.
    expect(pngBytes.readUInt32BE(16)).toBe(64);
    expect(pngBytes.readUInt32BE(20)).toBe(64);

    const { width, height, scanlines } = parsePng(new Uint8Array(pngBytes));
    expect(width).toBe(64);
    expect(height).toBe(64);
    expect(scanlines).toHaveLength(64 * (1 + 64 * RGBA_BYTES));
  });
});
