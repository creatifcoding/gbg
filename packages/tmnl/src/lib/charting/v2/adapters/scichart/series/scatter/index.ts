import { CHART_TOKENS } from '../../../../theme/index';
import type { SciChartRenderableSeriesInput } from '../types';

export const createScatterRenderableSeries = ({
  scichart,
  wasmContext,
  dataSeries,
  spec,
}: SciChartRenderableSeriesInput): unknown =>
  new scichart.XyScatterRenderableSeries(wasmContext, {
    dataSeries,
    pointMarker: new scichart.EllipsePointMarker(wasmContext, {
      fill: CHART_TOKENS.colors.waveRed,
      stroke: CHART_TOKENS.colors.waveRed,
      size: 'pointSize' in spec && spec.pointSize ? spec.pointSize : 7,
    }),
  });
