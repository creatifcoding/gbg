import type { ChartSpec } from '../../../../schemas';
import type { EChartsOption } from './types';
import { buildBaseOption } from './base/index';
import { buildLineOption } from './line/index';
import { buildAreaOption } from './area/index';
import { buildBarOption } from './bar/index';
import { buildScatterOption } from './scatter/index';
import { buildCandlestickOption } from './candlestick/index';

export const buildEChartsOption = (spec: ChartSpec): EChartsOption => {
  const base = buildBaseOption(spec);

  switch (spec.kind) {
    case 'LINE':
      return buildLineOption(spec, base);
    case 'AREA':
      return buildAreaOption(spec, base);
    case 'BAR':
    case 'COLUMN':
      return buildBarOption(spec, base);
    case 'SCATTER':
      return buildScatterOption(base);
    case 'CANDLESTICK':
      return buildCandlestickOption(spec, base);
    default:
      return buildLineOption(spec, base);
  }
};

export type { EChartsOption } from './types';
