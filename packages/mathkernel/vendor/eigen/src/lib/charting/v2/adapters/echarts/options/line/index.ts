import type { ChartSpec } from '../../../../schemas';
import { CHART_TOKENS } from '../../../../theme/index';
import { createCategoryAxis, createValueAxis } from '../common';
import type { EChartsOption } from '../types';

export const buildLineOption = (
  spec: ChartSpec,
  base: EChartsOption
): EChartsOption => {
  const categoryAxis = createCategoryAxis({ hideOverlap: true });

  return {
    ...base,
    xAxis: {
      ...categoryAxis,
      axisLabel: {
        ...categoryAxis.axisLabel,
        interval: 'auto',
        hideOverlap: true,
      },
    },
    yAxis: createValueAxis({
      formatter: (value) => value.toFixed(value % 1 === 0 ? 0 : 1),
    }),
    series: [
      {
        type: 'line',
        data: [],
        smooth: 'smooth' in spec ? spec.smooth ?? false : false,
        symbol: 'showPoints' in spec && spec.showPoints ? 'circle' : 'none',
        symbolSize: 4,
        lineStyle: {
          width:
            'strokeWidth' in spec && typeof spec.strokeWidth === 'number'
              ? spec.strokeWidth
              : CHART_TOKENS.dimensions.strokeThicknessDefault,
          color: CHART_TOKENS.colors.waveGreen,
        },
        itemStyle: {
          color: CHART_TOKENS.colors.waveGreen,
        },
        areaStyle:
          'showArea' in spec && spec.showArea
            ? { opacity: 0.2, color: CHART_TOKENS.colors.waveGreen }
            : undefined,
      },
    ],
  };
};
