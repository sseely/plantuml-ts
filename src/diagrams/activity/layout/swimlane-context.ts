export interface SwimlaneContext {
  name: string;
  x: number;
  width: number;
}

export function buildSwimlaneContexts(
  laneNames: string[],
  startX: number,
  laneWidth: number,
): SwimlaneContext[] {
  return laneNames.map((name, i) => ({
    name,
    x: startX + i * laneWidth,
    width: laneWidth,
  }));
}
