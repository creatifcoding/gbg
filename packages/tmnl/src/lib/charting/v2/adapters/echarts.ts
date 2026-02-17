import { Effect } from 'effect';
import type { ChartAdapter } from './types';
import { ChartMountError, ChartUpdateError } from '../errors';
import type { ChartInstance } from '../types';
import type { ChartSeries, ChartSpec } from '../schemas';
import { ChartState } from '../schemas';
import { applySeriesData } from './echarts/data';
import { buildEChartsOption } from './echarts/options/index';
import { ECHARTS_THEME_NAME, echartsThemeV2 } from '../theme/index';

type EChartsInstance = {
  setOption: (option: unknown, opts?: unknown) => void;
  resize: () => void;
  dispose: () => void;
};

export const EChartsAdapter: ChartAdapter = {
  renderer: 'ECHARTS',
  makeInstance: (
    spec
  ): Effect.Effect<ChartInstance, ChartUpdateError | ChartMountError> =>
    Effect.sync(() => {
      const resolvedSpec = { ...spec, renderer: 'ECHARTS' } as ChartSpec;
      let state: ChartState = 'UNINITIALIZED';
      let series: ChartSeries = [];
      let chart: EChartsInstance | null = null;
      let resizeObserver: ResizeObserver | null = null;
      const listeners = new Set<(next: ChartState) => void>();

      const setState = (next: ChartState) => {
        if (state === next) return;
        state = next;
        listeners.forEach((cb) => cb(next));
      };

      const updateRenderer = () =>
        Effect.try({
          try: () => {
            if (!chart) return;
            applySeriesData(chart, resolvedSpec, series);
          },
          catch: (error) =>
            new ChartUpdateError({
              renderer: 'ECHARTS',
              message: error instanceof Error ? error.message : String(error),
            }),
        });

      const mount = (container: HTMLElement) =>
        Effect.tryPromise({
          try: async () => {
            if (state !== 'UNINITIALIZED') return;
            setState('LOADING');
            const echarts = await import('echarts');
            echarts.registerTheme(ECHARTS_THEME_NAME, echartsThemeV2);
            const instance = echarts.init(container, ECHARTS_THEME_NAME, {
              renderer: 'canvas',
            }) as unknown as EChartsInstance;
            instance.setOption(buildEChartsOption(resolvedSpec));
            chart = instance;
            resizeObserver = new ResizeObserver(() => instance.resize());
            resizeObserver.observe(container);
            setState('READY');
            if (series.length > 0) {
              applySeriesData(instance, resolvedSpec, series);
            }
          },
          catch: (error) => {
            setState('ERROR');
            return new ChartMountError({
              renderer: 'ECHARTS',
              message: error instanceof Error ? error.message : String(error),
            });
          },
        });

      const unmount = () =>
        Effect.sync(() => {
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
          if (chart) {
            chart.dispose();
            chart = null;
          }
          setState('UNINITIALIZED');
        });

      const dispose = () =>
        Effect.sync(() => {
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
          if (chart) {
            chart.dispose();
            chart = null;
          }
          listeners.clear();
          setState('DISPOSED');
        });

      const setData = (data: ChartSeries) =>
        Effect.sync(() => {
          series = data;
        }).pipe(Effect.andThen(updateRenderer));

      const appendData = (data: ChartSeries) =>
        Effect.sync(() => {
          series = [...series, ...data];
        }).pipe(Effect.andThen(updateRenderer));

      const clearData = () =>
        Effect.sync(() => {
          series = [];
        }).pipe(Effect.andThen(updateRenderer));

      const onStateChange = (handler: (next: ChartState) => void) => {
        listeners.add(handler);
        return () => listeners.delete(handler);
      };

      return {
        id: resolvedSpec.id,
        renderer: 'ECHARTS',
        spec: resolvedSpec,
        get state() {
          return state;
        },
        mount,
        unmount,
        dispose,
        setData,
        appendData,
        clearData,
        onStateChange,
      } satisfies ChartInstance;
    }),
};
