import { Effect } from 'effect';
import type { ChartAdapter } from './types';
import { ChartMountError, ChartUpdateError } from '../errors';
import type { ChartInstance } from '../types';
import { makeEChartsInstance } from './echarts/lifecycle';

export const EChartsAdapter: ChartAdapter = {
  renderer: 'ECHARTS',
  makeInstance: (
    spec
  ): Effect.Effect<ChartInstance, ChartUpdateError | ChartMountError> =>
    Effect.sync(() => makeEChartsInstance(spec)),
};
