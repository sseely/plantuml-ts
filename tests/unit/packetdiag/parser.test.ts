import { describe, it, expect } from 'vitest';
import { parsePacket } from '../../../src/diagrams/packetdiag/parser.js';
import type { UmlSource } from '../../../src/core/block-extractor.js';

function src(lines: string[]): UmlSource {
  return { lines, type: 'packetdiag' };
}

describe('parsePacket', () => {
  // ------------------------------------------------------------------
  // defaults
  // ------------------------------------------------------------------
  it('returns defaults when source is empty', () => {
    const ast = parsePacket(src([]));
    expect(ast.colWidth).toBe(16);
    expect(ast.bitHeight).toBe(32);
    expect(ast.scaleDirection).toBe('ltr');
    expect(ast.scaleInterval).toBeNull();
    expect(ast.sameHeight).toBe(false);
    expect(ast.items).toEqual([]);
  });

  // ------------------------------------------------------------------
  // @start / @end directives are skipped
  // ------------------------------------------------------------------
  it('skips @startpacketdiag and @endpacketdiag lines', () => {
    const ast = parsePacket(src(['@startpacketdiag', '0: A', '@endpacketdiag']));
    expect(ast.items).toHaveLength(1);
  });

  // ------------------------------------------------------------------
  // packetdiag { } wrapper ignored
  // ------------------------------------------------------------------
  it('skips packetdiag wrapper braces', () => {
    const ast = parsePacket(
      src(['@startpacketdiag', 'packetdiag {', '0: A', '}', '@endpacketdiag']),
    );
    expect(ast.items).toHaveLength(1);
  });

  // ------------------------------------------------------------------
  // config directives
  // ------------------------------------------------------------------
  it('parses colwidth=8', () => {
    const ast = parsePacket(src(['colwidth=8']));
    expect(ast.colWidth).toBe(8);
  });

  it('parses colwidth with spaces around =', () => {
    const ast = parsePacket(src(['colwidth = 16']));
    expect(ast.colWidth).toBe(16);
  });

  it('ignores colwidth=0 (keeps default 16)', () => {
    const ast = parsePacket(src(['colwidth=0']));
    expect(ast.colWidth).toBe(16);
  });

  it('parses node_height=48', () => {
    const ast = parsePacket(src(['node_height=48']));
    expect(ast.bitHeight).toBe(48);
  });

  it('parses node_height=0', () => {
    const ast = parsePacket(src(['node_height=0']));
    expect(ast.bitHeight).toBe(0);
  });

  it('parses scale_direction=rtl', () => {
    const ast = parsePacket(src(['scale_direction=rtl']));
    expect(ast.scaleDirection).toBe('rtl');
  });

  it('parses scale_direction=ltr (explicit)', () => {
    const ast = parsePacket(src(['scale_direction=ltr']));
    expect(ast.scaleDirection).toBe('ltr');
  });

  it('parses scale_interval=4', () => {
    const ast = parsePacket(src(['scale_interval=4']));
    expect(ast.scaleInterval).toBe(4);
  });

  it('ignores scale_interval=0 (keeps null)', () => {
    const ast = parsePacket(src(['scale_interval=0']));
    expect(ast.scaleInterval).toBeNull();
  });

  it('parses same_height=true', () => {
    const ast = parsePacket(src(['same_height=true']));
    expect(ast.sameHeight).toBe(true);
  });

  it('parses same_height=false', () => {
    const ast = parsePacket(src(['same_height=false']));
    expect(ast.sameHeight).toBe(false);
  });

  it('parses same_height with spaces (same_height = true)', () => {
    const ast = parsePacket(src(['same_height = true']));
    expect(ast.sameHeight).toBe(true);
  });

  // ------------------------------------------------------------------
  // field parsing — explicit range
  // ------------------------------------------------------------------
  it('parses explicit range 0-7: Source Port', () => {
    const ast = parsePacket(src(['0-7: Source Port']));
    expect(ast.items).toHaveLength(1);
    const item = ast.items[0]!;
    expect(item.bitStart).toBe(0);
    expect(item.bitEnd).toBe(7);
    expect(item.width).toBe(8);
    expect(item.label).toBe('Source Port');
    expect(item.height).toBe(1);
  });

  it('parses single-bit field 16: Flag', () => {
    const ast = parsePacket(src(['16: Flag']));
    const item = ast.items[0]!;
    expect(item.bitStart).toBe(16);
    expect(item.bitEnd).toBe(16);
    expect(item.width).toBe(1);
    expect(item.label).toBe('Flag');
  });

  it('parses single-bit with len=4 attribute', () => {
    const ast = parsePacket(src(['0: Data [len=4]']));
    const item = ast.items[0]!;
    expect(item.bitStart).toBe(0);
    expect(item.bitEnd).toBe(3);
    expect(item.width).toBe(4);
  });

  it('parses * auto-position after previous item', () => {
    const ast = parsePacket(src(['0-7: A', '* B [len=8]']));
    expect(ast.items).toHaveLength(2);
    const b = ast.items[1]!;
    expect(b.bitStart).toBe(8);
    expect(b.bitEnd).toBe(15);
    expect(b.width).toBe(8);
    expect(b.label).toBe('B');
  });

  it('parses * as first item starting at bit 0', () => {
    const ast = parsePacket(src(['* A [len=8]']));
    const a = ast.items[0]!;
    expect(a.bitStart).toBe(0);
    expect(a.bitEnd).toBe(7);
    expect(a.width).toBe(8);
  });

  it('parses height attribute', () => {
    const ast = parsePacket(src(['0-3: A [height=2]']));
    expect(ast.items[0]!.height).toBe(2);
  });

  it('parses height attribute with spaces (height = 3)', () => {
    const ast = parsePacket(src(['0-3: A [height = 3]']));
    expect(ast.items[0]!.height).toBe(3);
  });

  it('produces width=0 for len=0 field (auto position)', () => {
    const ast = parsePacket(src(['* A [len=0]']));
    expect(ast.items[0]!.width).toBe(0);
  });

  it('empty len attribute defaults to len=1', () => {
    const ast = parsePacket(src(['* A [len = ]']));
    expect(ast.items[0]!.width).toBe(1);
  });

  // ------------------------------------------------------------------
  // simple TCP header
  // ------------------------------------------------------------------
  it('parses the simple TCP header fixture', () => {
    const ast = parsePacket(
      src([
        '@startpacketdiag',
        'packetdiag {',
        '  0-7: Source Port',
        '  8-15: Destination Port',
        '  16-31: Sequence Number',
        '  32-47: Acknowledgment Number',
        '}',
        '@endpacketdiag',
      ]),
    );
    expect(ast.items).toHaveLength(4);
    expect(ast.items[0]!.label).toBe('Source Port');
    expect(ast.items[0]!.width).toBe(8);
    expect(ast.items[2]!.label).toBe('Sequence Number');
    expect(ast.items[2]!.width).toBe(16);
  });

  // ------------------------------------------------------------------
  // sparse fields (no gap filling)
  // ------------------------------------------------------------------
  it('sparse fields: 2: A and 5: B produce two width=1 items', () => {
    const ast = parsePacket(src(['2: A', '5: B']));
    expect(ast.items).toHaveLength(2);
    expect(ast.items[0]!.width).toBe(1);
    expect(ast.items[1]!.width).toBe(1);
  });
});
