import type { SciChartRenderableSeriesInput } from './types';
import { createAreaRenderableSeries } from './area/index';
import { createLineRenderableSeries } from './line/index';
import { createScatterRenderableSeries } from './scatter/index';

export const createRenderableSeriesForKind = (
  input: SciChartRenderableSeriesInput
): unknown => {
  switch (input.spec.kind) {
    case 'AREA':
      return createAreaRenderableSeries(input);
    case 'SCATTER':
      return createScatterRenderableSeries(input);
    default:
      return createLineRenderableSeries(input);
  }
};
