/**
 * Unit tests for the SI5b/T2 sprite decode primitives:
 *  - `AsciiEncoder` (src/core/klimt/sprite/AsciiEncoder.ts) — PlantUML's
 *    6-bit alphabet, NOT base64.
 *  - `Decompressor` / `decompressPlantumlZ` (src/core/code/deflate/**) — a
 *    faithful port of upstream's hand-rolled raw-DEFLATE inflater
 *    (Project Nayuki's Simple-DEFLATE-decompressor, as vendored by
 *    PlantUML) plus the `CompressionZlib#decompress` 256-zero-byte padding
 *    convention.
 *
 * Real sprite vectors below are copied verbatim (compressed body only, no
 * transformation) from ~/git/plantuml-stdlib/stdlib, matching D6's "port
 * upstream's own code" decision: 2026-07-13/14 checkout, paths:
 *   - awslib14/Storage/SimpleStorageService.puml  (sprite $SimpleStorageService, 64x64/16z)
 *   - k8s/OSS/KubernetesCrd.puml                  (sprite $KubernetesCrd, 70x66/16z)
 *   - eip/EIP-PlantUML.puml                       (sprite $claim_check, 42x41/16z)
 *
 * Per SpriteGrayLevel#buildSpriteZ (klimt/sprite/SpriteGrayLevel.java:292-307),
 * upstream's calling convention is: `AsciiEncoder().decode(compressed)` to
 * get the raw compressed bytes, then `CompressionZlib().decompress(...)`
 * (raw DEFLATE inflate with the 256-zero-byte pad) to get exactly
 * `width * height` gray-level bytes (one nibble-range byte per pixel, for
 * the `16z` -- 16 gray level -- format used by every vector below).
 */
import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { AsciiEncoder } from '../../src/core/klimt/sprite/AsciiEncoder.js';
import { decompressPlantumlZ } from '../../src/core/code/deflate/decompressPlantumlZ.js';
import { Decompressor } from '../../src/core/code/deflate/Decompressor.js';
import { ByteBitInputStream } from '../../src/core/code/deflate/ByteBitInputStream.js';

describe('AsciiEncoder', () => {
  const encoder = new AsciiEncoder();

  it('encode6bit maps the exact upstream alphabet (0-9,A-Z,a-z,-,_)', () => {
    const expected: string[] = [];
    for (let i = 0; i < 10; i++) expected.push(String(i));
    for (let i = 0; i < 26; i++) expected.push(String.fromCharCode('A'.charCodeAt(0) + i));
    for (let i = 0; i < 26; i++) expected.push(String.fromCharCode('a'.charCodeAt(0) + i));
    expected.push('-', '_');

    expect(expected).toHaveLength(64);
    for (let b = 0; b < 64; b++) {
      expect(AsciiEncoder.encode6bit(b)).toBe(expected[b]);
    }
  });

  it('decode6bit inverts encode6bit for every value 0-63', () => {
    for (let b = 0; b < 64; b++) {
      const c = AsciiEncoder.encode6bit(b);
      expect(AsciiEncoder.decode6bit(c)).toBe(b);
    }
  });

  it('decode6bit of an unmapped character falls back to 0 (DECODE_6BIT default fill)', () => {
    // '!' is never assigned by the static init loop, so it reads the
    // array's `fill(0)` default -- mirrors Java's decode6bit[] default of 0
    // for byte array slots never written by the static initializer.
    expect(AsciiEncoder.decode6bit('!')).toBe(0);
  });

  it('round-trips byte arrays of every remainder length (0..7)', () => {
    for (let len = 0; len <= 7; len++) {
      const data = new Uint8Array(len);
      for (let i = 0; i < len; i++) data[i] = (i * 37 + 11) & 0xff;
      const encoded = encoder.encode(data);
      const decoded = encoder.decode(encoded);
      // decode always yields a multiple-of-3-byte buffer (computeSize pads
      // up to the next 4-char group before converting to bytes); the
      // original data must be a prefix of it.
      expect(Array.from(decoded.slice(0, len))).toEqual(Array.from(data));
    }
  });

  it('encode(null/undefined) returns the empty string', () => {
    expect(encoder.encode(null)).toBe('');
    expect(encoder.encode(undefined)).toBe('');
  });

  it('decode("") returns an empty byte array', () => {
    expect(encoder.decode('')).toEqual(new Uint8Array(0));
  });

  it('missing trailing characters in the last 4-char group decode as value 0', () => {
    // encode([0xFF]) yields a 4-char group where c3=c4 encode the value 0
    // (b2=b3=0 for a single-byte input) -- so truncating the string to its
    // first 2 characters must decode identically to the full 4-char string,
    // per upstream's scharAt() returning '0' past the string end.
    const full = encoder.encode(new Uint8Array([0xff]));
    expect(full).toHaveLength(4);
    const truncated = full.slice(0, 2);

    const fromFull = encoder.decode(full);
    const fromTruncated = encoder.decode(truncated);
    expect(Array.from(fromTruncated)).toEqual(Array.from(fromFull));
    expect(Array.from(fromFull.slice(0, 3))).toEqual([0xff, 0x00, 0x00]);
  });
});

/** Concatenates sprite body lines the way `CommandFactorySprite#concat` does. */
function concatSpriteBody(lines: readonly string[]): string {
  return lines.map((l) => l.trim()).join('');
}

describe('Decompressor / decompressPlantumlZ against Node zlib as a reference deflater', () => {
  const encoder = new AsciiEncoder();

  function roundTripViaPlantumlPipeline(original: Uint8Array): Uint8Array {
    // Mirrors the full stdlib sprite pipeline: raw-deflate compress
    // (reference implementation, test-only) -> AsciiEncoder 6-bit encode
    // -> AsciiEncoder decode -> our ported Decompressor via
    // decompressPlantumlZ's 256-zero-byte pad convention.
    const compressed = deflateRawSync(Buffer.from(original));
    const asciiEncoded = encoder.encode(new Uint8Array(compressed));
    const compressedBack = encoder.decode(asciiEncoded).slice(0, compressed.length);
    return decompressPlantumlZ(compressedBack);
  }

  it('inflates an all-zero 8x8 gray-level payload (64 bytes)', () => {
    const original = new Uint8Array(64).fill(0);
    const result = roundTripViaPlantumlPipeline(original);
    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('inflates a repeating nibble pattern (exercises LZ77 back-references)', () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < original.length; i++) original[i] = i % 16;
    const result = roundTripViaPlantumlPipeline(original);
    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('inflates pseudo-random gray-level pixel data (forces dynamic Huffman coding)', () => {
    const original = new Uint8Array(4096); // matches a 64x64 sprite's byte count
    let seed = 12345;
    for (let i = 0; i < original.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      original[i] = seed % 16;
    }
    const result = roundTripViaPlantumlPipeline(original);
    expect(result).toHaveLength(original.length);
    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('inflates raw deflate output directly via Decompressor.decompress (no PlantUML padding)', () => {
    const original = new TextEncoder().encode('the quick brown fox jumps over the lazy dog'.repeat(4));
    const compressed = deflateRawSync(Buffer.from(original));
    const stream = new ByteBitInputStream(new Uint8Array(compressed));
    const result = Decompressor.decompress(stream);
    expect(Array.from(result)).toEqual(Array.from(original));
  });

  it('throws on a corrupt/malformed stream (reserved block type 3)', () => {
    // A leading 0xFF byte: bit 0 (bfinal) = 1, bits 1-2 (btype) = 0b11 = 3,
    // the DEFLATE-reserved block type -- Decompressor must reject it
    // immediately rather than silently return garbage.
    const corrupt = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
    expect(() => decompressPlantumlZ(corrupt)).toThrow(/Reserved block type/);
  });

  it('throws on a truncated stream that runs out of bits mid-symbol', () => {
    // A single non-final, non-reserved-type byte with no further data at
    // all (not even the 256-byte PlantUML pad) must hit EOFException.
    const stream = new ByteBitInputStream(new Uint8Array([0x00]));
    expect(() => Decompressor.decompress(stream)).toThrow();
  });
});

describe('Decompressor against real plantuml-stdlib sprite vectors', () => {
  const encoder = new AsciiEncoder();

  function decodeSprite(width: number, height: number, lines: readonly string[]): Uint8Array {
    const compressed = encoder.decode(concatSpriteBody(lines));
    const pixels = decompressPlantumlZ(compressed);
    expect(pixels).toHaveLength(width * height);
    return pixels;
  }

  it('decodes awslib14 SimpleStorageService (64x64/16z) to 4096 in-range gray bytes', () => {
    const lines = [
      'xPO5akKm34IVsBh_WPSfgT4eIuN_5IRcxZRq_-35YrELdwcgtssPhi85iNZOIxa0ekQPzPdCS5C0ZTCB8I2URzIhCC3gtR45UM-CCh2vF93Sf76OEYYiTmeP',
      'Ifn-Gd2c0k-T8zCm2RgQdC2yCj1SiY5e3-370Pty5v3eMUKlFQS9tmBe7fdkRgfyHhsw3z43Aj_p7tRT0AB-FVz5ze1nr_hKEUVkqgYn3yu-JKbIlQBCzd2N',
      '9j3xb4Hxuk3t7zn_NUrRoWw0dViO8o9tHSJickeYUyGOjhn4VoF6-Cm6dX3mywtAJT9dsKZzjhMCOAnLvBid5vQYNS9P39mdWNWwiHWu4dncpBdeUdhcgUe9',
      'bNNyUhYvPeVtitb9s4mo6xWBD1vkpmt2b_xzsVpMWEu6xlRj-kxsxHNsxfyVmI9hlcEtRwknzpvZs9aNn-aD0urwex61LE-K0QXvP7qXmrK0ZNv8XGaNrFFy',
      'uVivw_H_uiMBZm',
    ];
    const pixels = decodeSprite(64, 64, lines);
    for (const p of pixels) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(16);
    }
    // Spot-check (derived by running this port's own decode over the
    // vector and reading back the value -- not asserted from a guess):
    // every corner and the entire first scanline decode to gray level 9,
    // a uniform background-fill run (AWS 64x64 icons matte the artwork
    // onto a solid background square before the transparent margin).
    // This exercises the LZ77 back-reference path (a long run of equal
    // bytes), not just literal-byte decoding.
    expect(pixels[0]).toBe(9);
    expect(pixels[63]).toBe(9);
    expect(pixels[64 * 63]).toBe(9);
    expect(pixels[64 * 64 - 1]).toBe(9);
    expect(Array.from(pixels.slice(0, 64))).toEqual(new Array(64).fill(9));
  });

  it('decodes k8s KubernetesCrd (70x66/16z) to 4620 in-range gray bytes', () => {
    const lines = [
      'rPTNegKm34DltBN_1K-lE7RArAS_sY6MaO7N6v80yF6hZCyAlcSelkkICmmFoJd3CP4UCIXGoBQDva2ZlOOnLdBQRMsluAEsm9ZO6yvMMoWzDul6UtEYOohQ',
      'Wc3b-7YMWudYSJJ9KdzlA7XGx8AII_hfOg7nMTyB_YpItjzqWqBS6KFR0y0ROpIjif8s56nJf37ccgB9bXjAf4Ddb6nCt5D6ikM68aKKtSoaf92g-jGOGLBG',
      'xZkYdItnwZGcnkmCn786S9jxspJPKqvlAEWc5BYlA1a37BjB-NRdRsFEfTFJ45Nb6c3cCOcI0iS9o1JyAeMM51ALiQ3mb98QAXjhaPgY-2nkATCmKivSP4e-',
      'FmeAJoQQbgaTnLYN2SNhk55QJ4MHAYZveF9dwVTbysUbuAQCtkYPji25SjnmBYq6SYtdlElyqzrfSuvflf849iETM19bypi98y2c8p0SGarxkaR5000Ln2jL',
      'r0xtccAqQayLXU5WKq6ko0_-Zvo8OGeOiN9gJoCzV_0t_t3svtkVgFF_wd6SddDlWbx_kTu3',
    ];
    const pixels = decodeSprite(70, 66, lines);
    for (const p of pixels) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(16);
    }
    // Spot-check (derived by running this port's decode over the vector,
    // not asserted from a guess): all 4 corners decode to gray level 0
    // (transparent background), matching the inset-artwork convention of
    // every k8s OSS glyph sprite.
    expect(pixels[0]).toBe(0);
    expect(pixels[69]).toBe(0);
    expect(pixels[70 * 65]).toBe(0);
    expect(pixels[70 * 66 - 1]).toBe(0);
  });

  it('decodes eip claim_check (42x41/16z) to 1722 in-range gray bytes', () => {
    const lines = [
      'xP9LUiGm30PhjaN__MzRUSEBpuK99sF15ttzJlv9hRSQFdlDS8FJUoyg8BssuNv_AnfaZLNVgme-hwf-2UlJLUoGSsUma1Z5xQOO5nr8CqhO5ogSpfXGD-Jr',
      'Ixc5PEmbJAt3uP9nesmn-ZmHRRqGUVWcBSnQZ7BVr35R47WiZ_qK0S9Yjddg0_HSx5WhhTE81bXyj4BSaZjXYLrAE7qkhGyMsnfQ8OnJb6pOCMKQBHyPW7hv',
      'ipHwBJa-6Qm2j2FYyxuELMiCiJ1SV4iKhBJF8zz5bNte_m3_V0C',
    ];
    const pixels = decodeSprite(42, 41, lines);
    for (const p of pixels) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(16);
    }
    // Spot-check (derived by running this port's decode over the vector):
    // exactly 280 of the 1722 pixels are non-background, and the decoded
    // gray levels span the full 0-15 range -- proving the inflate produced
    // real image data (both literal bytes and back-reference runs), not an
    // all-zero or truncated buffer.
    const nonZeroCount = Array.from(pixels).filter((p) => p !== 0).length;
    expect(nonZeroCount).toBe(280);
    expect(Math.max(...pixels)).toBe(15);
  });
});
