import { CHART_TOKENS } from '../../../../theme/index';
import type { SciChartRenderableSeriesInput } from '../types';

export const createAreaRenderableSeries = ({
  scichart,
  wasmContext,
  dataSeries,
  strokeWidth,
}: SciChartRenderableSeriesInput): unknown =>
  new scichart.FastMountainRenderableSeries(wasmContext, {
    dataSeries,
    stroke: CHART_TOKENS.colors.waveCyan,
    strokeThickness: strokeWidth,
    fill: CHART_TOKENS.colors.waveCyan,
    opacity: 0.35,
  });
