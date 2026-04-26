import { deflateRawSync } from 'node:zlib';

const PLANTUML_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

function encode6Bit(b: number): string {
  return PLANTUML_CHARS[b & 0x3f]!;
}

function encodeChunk(b1: number, b2: number, b3: number): string {
  return (
    encode6Bit(b1 >> 2) +
    encode6Bit(((b1 & 0x3) << 4) | (b2 >> 4)) +
    encode6Bit(((b2 & 0xf) << 2) | (b3 >> 6)) +
    encode6Bit(b3 & 0x3f)
  );
}

function encodeBytes(data: Buffer): string {
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    result += encodeChunk(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
  }
  return result;
}

export function encodeDiagram(source: string): string {
  const compressed = deflateRawSync(Buffer.from(source, 'utf8'));
  return encodeBytes(compressed);
}

export function plantumlUrl(source: string, format: 'png' | 'svg' = 'png'): string {
  return `https://www.plantuml.com/plantuml/${format}/${encodeDiagram(source)}`;
}
