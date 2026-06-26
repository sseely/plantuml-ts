# Architecture Decisions

## D1 — X-Scale Boundaries: Day-Aligned

**Decision:** Use day-boundary milliseconds for the x-scale range, not event timestamps.

**Formula:**
```
minMs = minEpochDay × 86_400_000
maxMs = (maxEpochDay + 1) × 86_400_000
x = 1000 × (eventMs − minMs) / (maxMs − minMs)
```

Where `minEpochDay` = `Math.floor(Date.UTC(year, month-1, day) / 86_400_000)` for
the earliest event's date, and `maxEpochDay` = same for the latest event's date.

**Rationale:** The Java `initMinMax()` sets `timeScale.setMin(epochDay)` and
`timeScale.setMax(epochDay)` — epoch days, not milliseconds. The renderer is a
stub so the unit mismatch was never exercised. Day-aligned boundaries match the
Java's *intent* and produce evenly-spaced day ticks. For the corpus fixture
(events 4 days apart), day ticks fall at x=0, 200, 400, 600, 800 — clean and
readable.

**Verified numbers for corpus fixture (tests/visual/data/chronology.json):**
- Event1 (2023-11-24 10:11:50.750): timestampMs=1700820710750, x≈84.98
- Event2 (2023-11-28 14:11:50.750): timestampMs=1701180710750, x≈918.31
- minMs=1700784000000 (midnight 2023-11-24 UTC)
- maxMs=1701216000000 (midnight 2023-11-29 UTC, 5 days total)
- Day ticks: 2023-11-24→x=0, 2023-11-25→x=200, 2023-11-26→x=400,
  2023-11-27→x=600, 2023-11-28→x=800

**Single-event edge case:** Range = exactly one day; event placed at its
time-of-day fraction. No division by zero.

## D2 — All Timestamps in UTC

Parse timestamps with `Date.UTC(y, m-1, d, h, min, s, ms)`. Java uses
`LocalDate.toEpochDay()` which is UTC-based. No local timezone inference.

## D3 — Diamond Marker Size

Half-diagonal = 10px. Call: `diamond(x, baselineY, 10, { fill, stroke })`.
The existing `diamond(cx, cy, size, extraAttrs?)` function in `src/core/svg.ts`
takes a single `size` = half-diagonal (equilateral diamond).

## D4 — Label Alternation

Even-index events (0, 2, 4…): label above baseline (`labelAbove: true`).
Odd-index events (1, 3, 5…): label below baseline (`labelAbove: false`).
Vertical offset = 16px from baseline (in the direction away from the line).

## D5 — Canvas Dimensions

- `totalWidth = 1000` (matches `TimeScaleChronology.fullWidth`)
- `headerHeight = 30`
- `baselineY = headerHeight + 10 = 40`
- `totalHeight = headerHeight + 20 + 20 + labelHeight` (≈ 80, use 80)

## D6 — Plugin Registration Order

Register `chronologyPlugin` after `boardPlugin` and before `sequencePlugin` in
`src/index.ts` (maintains existing specificity order; sequence is always last).
