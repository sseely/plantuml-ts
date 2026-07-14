/**
 * Tests for the Creole `<img>`/`<$sprite>` inline-atom scanner
 * (src/core/creole-atoms.ts), the PNG IHDR reader
 * (src/core/klimt/sprite/png-ihdr.ts), and their measurement wiring into
 * the description engine's label paths (link-edge-attrs.ts, leaf-sizing.ts).
 *
 * Mission SI5b+E2r, T6. See plans/si5b-stdlib/batch-2/overview.md and
 * decisions.md D7/D9.
 */
import { describe, it, expect } from 'vitest';
import {
  scanLineForAtoms,
  measureInlineAtom,
  measureLineWithAtoms,
  lineAtomHeightExcess,
  type SpriteDimsLookup,
  type InlineAtomToken,
} from '../../src/core/creole-atoms.js';
import { parsePngIhdrFromDataUri } from '../../src/core/klimt/sprite/png-ihdr.js';
import { buildLinkEdgeAttributes } from '../../src/diagrams/description/link-edge-attrs.js';
import type { DescriptiveLink } from '../../src/diagrams/description/ast.js';
import type { DescriptiveNode } from '../../src/diagrams/description/ast.js';
import { measureLeafNode } from '../../src/diagrams/description/leaf-sizing.js';
import type { FontSpec, StringMeasurer } from '../../src/core/measurer.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A real awslib14 icon data URI (DynamoDBItemsIMG), copied verbatim from
 *  ~/git/plantuml-stdlib/stdlib/awslib14/Database/DynamoDBItems.puml —
 *  64x64, 8-bit, RGBA (color type 6). */
const AWSLIB_DYNAMODB_ITEMS_DATA_URI =
  'data:image/png;base64,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';

/** 1x1 minimal PNG (8-bit grayscale, color type 0). Handy for byte-precise
 *  boundary tests without dragging the awslib fixture along. */
const TINY_PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQI12NgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

const fontSpec: FontSpec = { family: 'Helvetica', size: 12 };

/** Deterministic: 10px per character, height = fontSize -- lets tests
 *  compute exact expected width deltas. */
const stubMeasurer: StringMeasurer = {
  measure: (text) => ({ width: text.length * 10, height: fontSpec.size }),
  getDescent: () => 0,
};

function spriteRegistry(dims: Record<string, { width: number; height: number }>): SpriteDimsLookup {
  return { get: (name) => dims[name] };
}

/** Minimal `DescriptiveNode` for leaf-sizing tests. */
function node(display: string): DescriptiveNode {
  return { id: 'n1', symbol: 'component', display, children: [] };
}

// ---------------------------------------------------------------------------
// png-ihdr.ts
// ---------------------------------------------------------------------------

describe('parsePngIhdrFromDataUri', () => {
  it('reads width/height/bitDepth/colorType from a real awslib14 icon', () => {
    const ihdr = parsePngIhdrFromDataUri(AWSLIB_DYNAMODB_ITEMS_DATA_URI);
    expect(ihdr).toEqual({ width: 64, height: 64, bitDepth: 8, colorType: 6 });
  });

  it('reads a 1x1 PNG', () => {
    const ihdr = parsePngIhdrFromDataUri(TINY_PNG_1X1);
    expect(ihdr).toEqual({ width: 1, height: 1, bitDepth: 8, colorType: 0 });
  });

  it('returns undefined for a non-PNG data scheme', () => {
    expect(parsePngIhdrFromDataUri('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeUndefined();
  });

  it('returns undefined for undecodable base64', () => {
    expect(parsePngIhdrFromDataUri('data:image/png;base64,!!!not-base64!!!')).toBeUndefined();
  });

  it('returns undefined for base64 that decodes to too few bytes', () => {
    expect(parsePngIhdrFromDataUri('data:image/png;base64,aGVsbG8=')).toBeUndefined();
  });

  it('returns undefined when the PNG signature bytes are wrong', () => {
    // 29 well-formed-base64 bytes that are NOT a PNG signature.
    const notPng = 'data:image/png;base64,' + 'A'.repeat(40);
    expect(parsePngIhdrFromDataUri(notPng)).toBeUndefined();
  });

  it('returns undefined for a plain (non-data-URI) src', () => {
    expect(parsePngIhdrFromDataUri('icons/foo.png')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// scanLineForAtoms — img regex variants (Splitter.imgPatternNoSrcColon)
// ---------------------------------------------------------------------------

describe('scanLineForAtoms — img markup variants', () => {
  it('parses `<img:src>` (colon form, no scale)', () => {
    const line = `<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}>`;
    const { atoms, textWithoutAtoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(1);
    const atom = atoms[0] as InlineAtomToken;
    expect(atom.kind).toBe('img');
    expect(atom).toMatchObject({ kind: 'img', scale: 1, width: 64, height: 64 });
    expect(textWithoutAtoms).toBe('');
  });

  it('parses `<img src>` (whitespace form)', () => {
    const line = `<img ${AWSLIB_DYNAMODB_ITEMS_DATA_URI}>`;
    const { atoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]).toMatchObject({ kind: 'img', width: 64, height: 64 });
  });

  it('strips a leading `src=` prefix (case-insensitive)', () => {
    const line = `<img SRC=${AWSLIB_DYNAMODB_ITEMS_DATA_URI}>`;
    const { atoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(1);
    expect((atoms[0] as InlineAtomToken & { kind: 'img' }).dataUri).toBe(AWSLIB_DYNAMODB_ITEMS_DATA_URI);
  });

  it('strips surrounding double quotes around the src', () => {
    const quoted = '\x22' + AWSLIB_DYNAMODB_ITEMS_DATA_URI + '\x22';
    const line = `<img src=${quoted}>`;
    const { atoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(1);
    expect((atoms[0] as InlineAtomToken & { kind: 'img' }).dataUri).toBe(AWSLIB_DYNAMODB_ITEMS_DATA_URI);
  });

  it('parses a `{scale=N}` suffix', () => {
    const line = `<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}{scale=0.5}>`;
    const { atoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(1);
    expect(atoms[0]).toMatchObject({ kind: 'img', scale: 0.5 });
  });

  it('preserves surrounding text around the atom, atom markup removed', () => {
    const line = `before <img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}> after`;
    const { atoms, textWithoutAtoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(1);
    expect(textWithoutAtoms).toBe('before  after');
  });

  it('an atom-free line has no atoms and unchanged text', () => {
    const { atoms, textWithoutAtoms } = scanLineForAtoms('plain text, no markup');
    expect(atoms).toHaveLength(0);
    expect(textWithoutAtoms).toBe('plain text, no markup');
  });
});

// ---------------------------------------------------------------------------
// '(Cannot decode)' fallback — AtomImg.buildRasterFromData's SImageIO
// .read()==null branch, simplified per this task's scope (D7).
// ---------------------------------------------------------------------------

describe('scanLineForAtoms — Cannot-decode fallback', () => {
  it('a malformed data:image/png;base64 payload becomes literal (Cannot decode) text, not a dropped atom', () => {
    const line = '<img:data:image/png;base64,not-a-real-png>';
    const { atoms, textWithoutAtoms } = scanLineForAtoms(line);
    expect(atoms).toHaveLength(0);
    expect(textWithoutAtoms).toBe('(Cannot decode)');
  });

  it('an out-of-scope src (e.g. a plain file path) also falls back to (Cannot decode)', () => {
    const { atoms, textWithoutAtoms } = scanLineForAtoms('<img:icons/foo.png>');
    expect(atoms).toHaveLength(0);
    expect(textWithoutAtoms).toBe('(Cannot decode)');
  });
});

// ---------------------------------------------------------------------------
// scanLineForAtoms — sprite regex variants (Splitter.spritePattern)
// ---------------------------------------------------------------------------

describe('scanLineForAtoms — sprite markup variants', () => {
  it('parses `<$name>` (no scale/color)', () => {
    const { atoms } = scanLineForAtoms('<$DynamoDBItems>');
    expect(atoms).toEqual<InlineAtomToken[]>([{ kind: 'sprite', name: 'DynamoDBItems', scale: 1 }]);
  });

  it('parses `<$name{scale=2}>`', () => {
    const { atoms } = scanLineForAtoms('<$DynamoDBItems{scale=2}>');
    expect(atoms).toEqual<InlineAtomToken[]>([{ kind: 'sprite', name: 'DynamoDBItems', scale: 2 }]);
  });

  it('parses `<#FF0000$name>` (forced-color prefix)', () => {
    const { atoms } = scanLineForAtoms('<#FF0000$DynamoDBItems>');
    expect(atoms).toEqual<InlineAtomToken[]>([
      { kind: 'sprite', name: 'DynamoDBItems', scale: 1, forcedColor: 'FF0000' },
    ]);
  });

  it('parses an in-block `{color=red}` when no forced-color prefix is present', () => {
    const { atoms } = scanLineForAtoms('<$DynamoDBItems{color=red}>');
    expect(atoms).toEqual<InlineAtomToken[]>([
      { kind: 'sprite', name: 'DynamoDBItems', scale: 1, forcedColor: 'red' },
    ]);
  });

  it('the forced-color prefix wins over an in-block color when both are present', () => {
    const { atoms } = scanLineForAtoms('<#00FF00$DynamoDBItems{color=red}>');
    expect(atoms).toEqual<InlineAtomToken[]>([
      { kind: 'sprite', name: 'DynamoDBItems', scale: 1, forcedColor: '00FF00' },
    ]);
  });

  it('removes the sprite markup from the surrounding text', () => {
    const { textWithoutAtoms } = scanLineForAtoms('icon: <$DynamoDBItems> done');
    expect(textWithoutAtoms).toBe('icon:  done');
  });
});

// ---------------------------------------------------------------------------
// measureInlineAtom — D9 scaled-dims contribution
// ---------------------------------------------------------------------------

describe('measureInlineAtom', () => {
  it('an img atom contributes width/height * scale', () => {
    const atom: InlineAtomToken = { kind: 'img', dataUri: 'x', scale: 2, width: 64, height: 64 };
    expect(measureInlineAtom(atom)).toEqual({ width: 128, height: 128 });
  });

  it('a sprite atom resolves dims from the registry, scaled', () => {
    const atom: InlineAtomToken = { kind: 'sprite', name: 'Foo', scale: 2 };
    const sprites = spriteRegistry({ Foo: { width: 64, height: 32 } });
    expect(measureInlineAtom(atom, sprites)).toEqual({ width: 128, height: 64 });
  });

  it('an unknown sprite name contributes nothing (StripeSimple.addSprite silently skips)', () => {
    const atom: InlineAtomToken = { kind: 'sprite', name: 'DoesNotExist', scale: 1 };
    expect(measureInlineAtom(atom, spriteRegistry({}))).toEqual({ width: 0, height: 0 });
  });

  it('a sprite atom with no registry supplied contributes nothing', () => {
    const atom: InlineAtomToken = { kind: 'sprite', name: 'Foo', scale: 1 };
    expect(measureInlineAtom(atom, undefined)).toEqual({ width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// measureLineWithAtoms / lineAtomHeightExcess — the D9 width-add/height-max
// contract, and the atom-free zero-diff fast path.
// ---------------------------------------------------------------------------

describe('measureLineWithAtoms', () => {
  it('an atom-free line is measured identically to a bare measurer.measure call', () => {
    const plain = 'hello world';
    expect(measureLineWithAtoms(plain, fontSpec, stubMeasurer)).toEqual(stubMeasurer.measure(plain, fontSpec));
  });

  it('a label with an img atom measures wider by EXACTLY the scaled image width', () => {
    const withoutImg = 'Label ';
    const lineWithImg = `${withoutImg}<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}{scale=0.5}>`;
    const baseline = measureLineWithAtoms(withoutImg, fontSpec, stubMeasurer);
    const withImg = measureLineWithAtoms(lineWithImg, fontSpec, stubMeasurer);
    const scaledWidth = 64 * 0.5; // IHDR width (64) * {scale=0.5}
    expect(withImg.width).toBe(baseline.width + scaledWidth);
  });

  it('height maxes with the image height when the image is taller than the text line', () => {
    const line = `x<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}>`; // scale=1 -> 64px tall
    const { height } = measureLineWithAtoms(line, fontSpec, stubMeasurer);
    expect(height).toBe(64); // 64 > fontSpec.size (12)
  });

  it('an unknown sprite measures as if the atom were absent (0 width contribution)', () => {
    const withSprite = 'Label <$DoesNotExist>';
    const withoutSprite = 'Label ';
    const withSpriteDim = measureLineWithAtoms(withSprite, fontSpec, stubMeasurer, spriteRegistry({}));
    const withoutSpriteDim = measureLineWithAtoms(withoutSprite, fontSpec, stubMeasurer);
    expect(withSpriteDim.width).toBe(withoutSpriteDim.width);
    expect(withSpriteDim.height).toBe(withoutSpriteDim.height);
  });

  it('a known sprite adds its scaled width', () => {
    const sprites = spriteRegistry({ Foo: { width: 40, height: 20 } });
    const withoutSprite = 'Label ';
    const withSprite = 'Label <$Foo{scale=2}>';
    const baseline = measureLineWithAtoms(withoutSprite, fontSpec, stubMeasurer, sprites);
    const withAtom = measureLineWithAtoms(withSprite, fontSpec, stubMeasurer, sprites);
    expect(withAtom.width).toBe(baseline.width + 80); // 40 * scale 2
  });
});

describe('lineAtomHeightExcess', () => {
  it('is 0 for an atom-free line', () => {
    expect(lineAtomHeightExcess('plain text', fontSpec)).toBe(0);
  });

  it('is 0 when the atom is no taller than the font size', () => {
    const sprites = spriteRegistry({ Tiny: { width: 4, height: 4 } });
    expect(lineAtomHeightExcess('<$Tiny>', fontSpec, sprites)).toBe(0);
  });

  it('is exactly (atomHeight - fontSize) when the atom is taller', () => {
    const line = `<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}>`; // 64px tall, scale=1
    expect(lineAtomHeightExcess(line, fontSpec)).toBe(64 - fontSpec.size);
  });
});

// ---------------------------------------------------------------------------
// Measurement wiring — link-edge-attrs.ts (edge labels)
// ---------------------------------------------------------------------------

describe('buildLinkEdgeAttributes — img/sprite atoms in an edge label', () => {
  it('an img atom in the label widens labelWidth by exactly its scaled width', () => {
    const baseLink = { from: 'a', to: 'b', length: 1, arrowHead: 'none', label: 'x' } as DescriptiveLink;
    const imgLink = {
      ...baseLink,
      label: `x<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}{scale=0.25}>`,
    } as DescriptiveLink;
    const baseAttrs = buildLinkEdgeAttributes(baseLink, fontSpec, stubMeasurer);
    const imgAttrs = buildLinkEdgeAttributes(imgLink, fontSpec, stubMeasurer);
    expect(imgAttrs.labelWidth).toBe((baseAttrs.labelWidth ?? 0) + 64 * 0.25);
  });
});

// ---------------------------------------------------------------------------
// Measurement wiring — leaf-sizing.ts (node labels, measureLeafNode)
// ---------------------------------------------------------------------------

describe('measureLeafNode — img atom widens a component box (D9)', () => {
  it('a component display with an img atom is wider than the same display without it', () => {
    const plainNode = node('Foo');
    const imgNode = node(`Foo<img:${AWSLIB_DYNAMODB_ITEMS_DATA_URI}{scale=0.1}>`);
    const plainDim = measureLeafNode(plainNode, fontSpec, stubMeasurer);
    const imgDim = measureLeafNode(imgNode, fontSpec, stubMeasurer);
    expect(imgDim.width).toBe(plainDim.width + 64 * 0.1);
  });

  it('an unregistered sprite in a component display does not change its size', () => {
    const plainNode = node('Foo');
    const spriteNode = node('Foo<$Unregistered>');
    const plainDim = measureLeafNode(plainNode, fontSpec, stubMeasurer);
    const spriteDim = measureLeafNode(spriteNode, fontSpec, stubMeasurer);
    expect(spriteDim).toEqual(plainDim);
  });
});
