import { GtileGroup } from './gtile-group.js';

export class GtilePartition extends GtileGroup {
  override readonly kind = 'gtile-partition' as const;
}
