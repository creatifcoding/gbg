import type { ChartSpec } from '../schemas';

export type ChartMapKey = ChartSpec['id'] & {
  readonly __chartMapKey: unique symbol;
};

export const toChartMapKey = (id: ChartSpec['id']): ChartMapKey =>
  id as ChartMapKey;
