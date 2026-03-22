import type { ChartSpec } from '../../../../schemas';
import { CHART_TOKENS } from '../../../../theme/index';
import { createCategoryAxis, createValueAxis } from '../common';
import type { EChartsOption } from '../types';

export const buildAreaOption = (
  spec: ChartSpec,
  base: EChartsOption
): EChartsOption => ({
  ...base,
  xAxis: createCategoryAxis({ hideOverlap: true }),
  yAxis: createValueAxis(),
  series: [
    {
      type: 'line',
      data: [],
      smooth: 'smooth' in spec ? spec.smooth ?? false : false,
      areaStyle: { opacity: 0.3, color: CHART_TOKENS.colors.waveCyan },
      lineStyle: { color: CHART_TOKENS.colors.waveCyan, width: 2 },
      itemStyle: { color: CHART_TOKENS.colors.waveCyan },
      symbol: 'none',
    },
  ],
});
