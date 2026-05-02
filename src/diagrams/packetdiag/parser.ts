import type { UmlSource } from '../../core/block-extractor.js';
import type { PacketDiagramAST, PacketItem, ScaleDirection } from './ast.js';

const DEFAULT_COL_WIDTH = 16;
const DEFAULT_BIT_HEIGHT = 32;

// colwidth=N  (optional spaces around =, optional trailing ;)
const RE_COLWIDTH = /^\s*colwidth\s*=\s*(\d{1,3})\s*;?\s*$/i;
// node_height=N
const RE_NODE_HEIGHT = /^\s*node_height\s*=\s*(\d{1,3})\s*;?\s*$/i;
// scale_direction=ltr|rtl
const RE_SCALE_DIR = /^\s*scale_direction\s*=\s*(ltr|rtl)\s*;?\s*$/i;
// scale_interval=N
const RE_SCALE_INTERVAL = /^\s*scale_interval\s*=\s*(\d+)\s*;?\s*$/i;
// same_height=true|false
const RE_SAME_HEIGHT = /^\s*same_height\s*=\s*(true|false)\s*;?\s*$/i;

// Field line: (<start>-<end>|<bit>|*):? <desc> [attrs]
const RE_FIELD =
  /^\s*(?:(\d{1,7})-(\d{1,7})|(\d{1,7})|\*):?\s+(.*?)(?:\s*\[(.*?)\])?\s*$/;

function parseAttrs(raw: string | undefined): Map<string, string> {
  const m = new Map<string, string>();
  if (!raw) return m;
  for (const part of raw.split(',')) {
    const eq = part.indexOf('=');
    if (eq >= 0) {
      const k = part.slice(0, eq).trim().toLowerCase();
      const v = part.slice(eq + 1).trim();
      m.set(k, v);
    }
  }
  return m;
}

function intAttr(attrs: Map<string, string>, key: string, def: number): number {
  const v = attrs.get(key);
  if (v === undefined) return def;
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

export function parsePacket(source: UmlSource): PacketDiagramAST {
  let colWidth = DEFAULT_COL_WIDTH;
  let bitHeight = DEFAULT_BIT_HEIGHT;
  let scaleDirection: ScaleDirection = 'ltr';
  let scaleInterval: number | null = null;
  let sameHeight = false;
  const items: PacketItem[] = [];

  for (const line of source.lines) {
    const t = line.trim();
    if (t === '') continue;
    if (/^@start/i.test(t) || /^@end/i.test(t)) continue;
    // Skip wrapper braces and packetdiag { header
    if (/^packetdiag\s*\{?\s*$/i.test(t) || t === '{' || t === '}') continue;

    let m: RegExpMatchArray | null;

    if ((m = RE_COLWIDTH.exec(t)) !== null) {
      const v = parseInt(m[1]!, 10);
      if (v > 0) colWidth = v;
      continue;
    }
    if ((m = RE_NODE_HEIGHT.exec(t)) !== null) {
      bitHeight = Math.max(0, parseInt(m[1]!, 10));
      continue;
    }
    if ((m = RE_SCALE_DIR.exec(t)) !== null) {
      scaleDirection = m[1]!.toLowerCase() as ScaleDirection;
      continue;
    }
    if ((m = RE_SCALE_INTERVAL.exec(t)) !== null) {
      const v = parseInt(m[1]!, 10);
      if (v > 0) scaleInterval = v;
      continue;
    }
    if ((m = RE_SAME_HEIGHT.exec(t)) !== null) {
      sameHeight = m[1]!.toLowerCase() === 'true';
      continue;
    }

    if ((m = RE_FIELD.exec(t)) !== null) {
      const [, r2start, r2end, r1, , rawAttrs] = m;
      const desc = (m[4] ?? '').trim();
      const attrs = parseAttrs(rawAttrs);
      const height = Math.max(1, intAttr(attrs, 'height', 1));

      let start: number;
      let end: number;

      if (r2start !== undefined && r2end !== undefined) {
        start = parseInt(r2start, 10);
        end = parseInt(r2end, 10);
      } else if (r1 !== undefined) {
        start = parseInt(r1, 10);
        const len = intAttr(attrs, 'len', 1);
        end = start + len - 1;
      } else {
        // auto-position (*)
        const lastEnd = items.length > 0 ? items[items.length - 1]!.bitEnd : -1;
        start = lastEnd + 1;
        const len = intAttr(attrs, 'len', 1);
        end = start + len - 1;
      }

      const width = end - start + 1;
      items.push({ bitStart: start, bitEnd: end, width, height, label: desc });
    }
  }

  return { colWidth, bitHeight, scaleDirection, scaleInterval, sameHeight, items };
}
