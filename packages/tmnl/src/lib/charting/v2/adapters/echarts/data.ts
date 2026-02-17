import type { ChartSeries, ChartSpec } from '../../schemas';
import { resolveProjection } from '../shared/projection';

export type EChartsApplyInstance = {
  setOption: (option: unknown, opts?: unknown) => void;
};

export const applySeriesData = (
  chart: EChartsApplyInstance,
  spec: ChartSpec,
  data: ChartSeries
): void => {
  const projection = resolveProjection(spec.projection);

  if (spec.kind === 'SCATTER') {
    const scatterData = data.map((d) => [projection.x(d), projection.y(d)]);
    chart.setOption(
      { series: [{ data: scatterData }] },
      { notMerge: false, lazyUpdate: true }
    );
    return;
  }

  const xData = data.map((d) => {
    const x = projection.x(d);
    return typeof x === 'number' ? x.toFixed(0) : x;
  });
  const yData = data.map((d) => projection.y(d));

  chart.setOption(
    {
      xAxis: { data: xData },
      series: [{ data: yData }],
    },
    { notMerge: false, lazyUpdate: true }
  );
};
