import { CHART_TOKENS } from '../../../../theme/index';
import type { SciChartRenderableSeriesInput } from '../types';

export const createLineRenderableSeries = ({
  scichart,
  wasmContext,
  dataSeries,
  strokeWidth,
}: SciChartRenderableSeriesInput): unknown =>
  new scichart.FastLineRenderableSeries(wasmContext, {
    dataSeries,
    stroke: CHART_TOKENS.colors.waveGreen,
    strokeThickness: strokeWidth,
  });
