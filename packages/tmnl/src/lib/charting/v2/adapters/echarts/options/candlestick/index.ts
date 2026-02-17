import type { ChartSpec } from '../../../../schemas';
import { CHART_TOKENS } from '../../../../theme/index';
import { createCategoryAxis, createValueAxis } from '../common';
import type { EChartsOption } from '../types';

export const buildCandlestickOption = (
  spec: ChartSpec,
  base: EChartsOption
): EChartsOption => ({
  ...base,
  xAxis: createCategoryAxis({ hideOverlap: true }),
  yAxis: createValueAxis({ scale: true }),
  series: [
    {
      type: 'candlestick',
      data: [],
      itemStyle: {
        color:
          'bullColor' in spec && spec.bullColor
            ? spec.bullColor
            : CHART_TOKENS.colors.statusActive,
        color0:
          'bearColor' in spec && spec.bearColor
            ? spec.bearColor
            : CHART_TOKENS.colors.statusError,
        borderColor:
          'bullColor' in spec && spec.bullColor
            ? spec.bullColor
            : CHART_TOKENS.colors.statusActive,
        borderColor0:
          'bearColor' in spec && spec.bearColor
            ? spec.bearColor
            : CHART_TOKENS.colors.statusError,
      },
    },
  ],
});
