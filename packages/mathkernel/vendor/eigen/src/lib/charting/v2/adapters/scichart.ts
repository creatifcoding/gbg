import { Effect } from 'effect';
import type { ChartAdapter } from './types';
import { ChartMountError, ChartUpdateError } from '../errors';
import type { ChartInstance } from '../types';
import { makeSciChartInstance } from './scichart/lifecycle';

export const SciChartAdapter: ChartAdapter = {
  renderer: 'SCICHART',
  makeInstance: (
    spec
  ): Effect.Effect<ChartInstance, ChartMountError | ChartUpdateError> =>
    Effect.sync(() => makeSciChartInstance(spec)),
};
