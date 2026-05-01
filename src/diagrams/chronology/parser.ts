import type { ChronologyDiagramAST, ChronologyEvent } from './ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

const EVENT_RE =
  /^\[([^\]]+)\]\s+happens\s+(?:at|on|the)?\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/;

export function parseChronology(source: UmlSource): ChronologyDiagramAST {
  const events: ChronologyEvent[] = [];

  for (const line of source.lines) {
    const t = line.trim();
    if (t === '') continue;
    if (/^@startchronology\s*$/i.test(t) || /^@endchronology\s*$/i.test(t)) continue;

    const m = EVENT_RE.exec(t);
    if (m === null) continue;

    const name = m[1]!;
    const year = parseInt(m[2]!.slice(0, 4), 10);
    const month = parseInt(m[2]!.slice(5, 7), 10);
    const day = parseInt(m[2]!.slice(8, 10), 10);
    const hour = parseInt(m[3]!, 10);
    const minute = parseInt(m[4]!, 10);
    const second = parseInt(m[5]!, 10);
    const msStr = m[6];
    const ms = parseInt(msStr ?? '0', 10);

    const timestampMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    events.push({ name, timestampMs });
  }

  return { events };
}
