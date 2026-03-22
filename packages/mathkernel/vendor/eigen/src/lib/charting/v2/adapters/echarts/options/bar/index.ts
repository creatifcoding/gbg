import type { ChartSpec } from '../../../../schemas';
import { CHART_TOKENS } from '../../../../theme/index';
import { createCategoryAxis, createValueAxis } from '../common';
import type { EChartsOption } from '../types';

export const buildBarOption = (
  spec: ChartSpec,
  base: EChartsOption
): EChartsOption => ({
  ...base,
  xAxis: createCategoryAxis({ hideOverlap: true }),
  yAxis: createValueAxis(),
  series: [
    {
      type: 'bar',
      data: [],
      barWidth: 'barWidth' in spec ? spec.barWidth ?? '60%' : '60%',
      itemStyle: {
        color: CHART_TOKENS.colors.waveAmber,
        borderRadius: [2, 2, 0, 0],
      },
    },
  ],
});
