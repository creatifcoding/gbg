import { CHART_TOKENS } from '../../../../theme/index';
import { createValueAxis } from '../common';
import type { EChartsOption } from '../types';

export const buildScatterOption = (base: EChartsOption): EChartsOption => ({
  ...base,
  xAxis: createValueAxis(),
  yAxis: createValueAxis(),
  series: [
    {
      type: 'scatter',
      data: [],
      symbolSize: 8,
      itemStyle: {
        color: CHART_TOKENS.colors.waveRed,
        opacity: 0.8,
      },
    },
  ],
});
