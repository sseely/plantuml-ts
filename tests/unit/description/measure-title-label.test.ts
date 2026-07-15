/**
 * Unit tests for `measureTitleLabel` (layout-helpers.ts) — the port-cluster
 * anchor's title-bar dims, ported from `ClusterHeader.getTitleAndAttribute
 * Width/Height` (java) + `SvekEdge.appendTable`'s `-5` reduction
 * (`ClusterDotString.java:134-135,177-184`). Verified against 4 jar-cached
 * `svek-1.dot` anchors (`label=<TABLE ... WIDTH=".." HEIGHT="..">`):
 * component `comp` -> 34x9 (component/gafegu-06-nito976, gocexi-61-biso565,
 * rapaji-98-xato067), node `srv1`/`srv2` -> 86x14 (component/bujige-52-gase998).
 */
import { describe, test, expect } from 'vitest';
import { measureTitleLabel } from '../../../src/diagrams/description/layout-helpers.js';
import { WidthTableMeasurer } from '../../../src/core/measurer.js';
import type { FontSpec } from '../../../src/core/measurer.js';

const measurer = new WidthTableMeasurer();
const font: FontSpec = { family: 'sans-serif', size: 14 };

describe('measureTitleLabel', () => {
  test('component symbol: no supp — jar-exact 34x9 (gafegu-06-nito976)', () => {
    expect(measureTitleLabel('comp', 'component', font, measurer)).toEqual({ width: 34, height: 9 });
  });

  test('node symbol: +60 width / +5 height supp — jar-exact 86x14 (bujige-52-gase998, both clusters)', () => {
    expect(measureTitleLabel('srv1', 'node', font, measurer)).toEqual({ width: 86, height: 14 });
    expect(measureTitleLabel('srv2', 'node', font, measurer)).toEqual({ width: 86, height: 14 });
  });

  test('database symbol: +15 height supp, no width supp (USymbolDatabase.java:173-175)', () => {
    const plain = measureTitleLabel('db', 'component', font, measurer);
    const database = measureTitleLabel('db', 'database', font, measurer);
    expect(database.width).toBe(plain.width);
    expect(database.height).toBe(plain.height + 15);
  });
});
