import { createAnnotations, matchAnnotationCommand } from '../../core/annotations/index.js';
import type { ChronologyDiagramAST, ChronologyEvent } from './ast.js';
import type { UmlSource } from '../../core/block-extractor.js';

const EVENT_RE =
  /^\[([^\]]+)\]\s+happens\s+(?:at|on|the)?\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/;

/** Builds a `ChronologyEvent` from a matched `EVENT_RE` result. */
function eventFromMatch(m: RegExpExecArray): ChronologyEvent {
  const name = m[1]!;
  const year = parseInt(m[2]!.slice(0, 4), 10);
  const month = parseInt(m[2]!.slice(5, 7), 10);
  const day = parseInt(m[2]!.slice(8, 10), 10);
  const hour = parseInt(m[3]!, 10);
  const minute = parseInt(m[4]!, 10);
  const second = parseInt(m[5]!, 10);
  const ms = parseInt(m[6] ?? '0', 10);
  const timestampMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return { name, timestampMs };
}

export function parseChronology(source: UmlSource): ChronologyDiagramAST {
  const events: ChronologyEvent[] = [];
  const annotations = createAnnotations();
  const lines = source.lines;

  for (let i = 0; i < lines.length; ) {
    const t = lines[i]!.trim();
    if (t === '') {
      i++;
      continue;
    }
    if (/^@startchronology\s*$/i.test(t) || /^@endchronology\s*$/i.test(t)) {
      i++;
      continue;
    }

    // title/caption/legend/header/footer/mainframe (mission G0b/T6): tried
    // BEFORE the event-line grammar below, mirroring upstream CommonCommands
    // being registered first — chronology has no other "ignore" mechanism
    // for non-event lines, so without this a chrome directive would be
    // silently dropped rather than reaching `ast.annotations`.
    const annotationMatch = matchAnnotationCommand(lines, i, annotations);
    if (annotationMatch !== null) {
      i += annotationMatch.consumed;
      continue;
    }

    const m = EVENT_RE.exec(t);
    if (m !== null) events.push(eventFromMatch(m));
    i++;
  }

  return { events, annotations };
}
