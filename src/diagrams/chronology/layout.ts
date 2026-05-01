import type {
  ChronologyDiagramAST,
  ChronologyGeometry,
  EventGeometry,
  DayTick,
} from './ast.js';

const TOTAL_WIDTH = 1000;
const HEADER_HEIGHT = 30;
const BASELINE_Y = 40;
const TOTAL_HEIGHT = 80;
const MS_PER_DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayLabel(dayMs: number): string {
  const d = new Date(dayMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function layoutChronology(ast: ChronologyDiagramAST): ChronologyGeometry {
  if (ast.events.length === 0) {
    return {
      events: [],
      dayTicks: [],
      totalWidth: TOTAL_WIDTH,
      totalHeight: TOTAL_HEIGHT,
      baselineY: BASELINE_Y,
      headerHeight: HEADER_HEIGHT,
    };
  }

  const timestamps = ast.events.map((e) => e.timestampMs);
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);

  const minEpochDay = Math.floor(minTs / MS_PER_DAY);
  const maxEpochDay = Math.floor(maxTs / MS_PER_DAY);
  const minMs = minEpochDay * MS_PER_DAY;
  const maxMs = (maxEpochDay + 1) * MS_PER_DAY;
  const range = maxMs - minMs;

  const events: EventGeometry[] = ast.events.map((e, i) => ({
    name: e.name,
    x: (TOTAL_WIDTH * (e.timestampMs - minMs)) / range,
    labelAbove: i % 2 === 0,
  }));

  const numDays = maxEpochDay - minEpochDay + 1;
  const dayTicks: DayTick[] = [];
  for (let i = 0; i < numDays; i++) {
    const dayMs = (minEpochDay + i) * MS_PER_DAY;
    const x = (TOTAL_WIDTH * (dayMs - minMs)) / range;
    dayTicks.push({ x, label: dayLabel(dayMs) });
  }

  return {
    events,
    dayTicks,
    totalWidth: TOTAL_WIDTH,
    totalHeight: TOTAL_HEIGHT,
    baselineY: BASELINE_Y,
    headerHeight: HEADER_HEIGHT,
  };
}
