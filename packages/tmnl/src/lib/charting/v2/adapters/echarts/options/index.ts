import type { ChartKind, ChartSpec } from '../../../../schemas';
import type { EChartsOption } from './types';
import { buildBaseOption } from './base/index';
import { buildLineOption } from './line/index';
import { buildAreaOption } from './area/index';
import { buildBarOption } from './bar/index';
import { buildScatterOption } from './scatter/index';
import { buildCandlestickOption } from './candlestick/index';

type OptionBuilder = (spec: ChartSpec, base: EChartsOption) => EChartsOption;

const OPTION_BUILDERS: Partial<Record<ChartKind, OptionBuilder>> = {
  LINE: buildLineOption,
  AREA: buildAreaOption,
  BAR: buildBarOption,
  COLUMN: buildBarOption,
  SCATTER: (spec, base) => buildScatterOption(base),
  CANDLESTICK: buildCandlestickOption,
};

export const buildEChartsOption = (spec: ChartSpec): EChartsOption => {
  const base = buildBaseOption(spec);
  const builder = OPTION_BUILDERS[spec.kind] ?? buildLineOption;
  return builder(spec, base);
};

export type { EChartsOption } from './types';
