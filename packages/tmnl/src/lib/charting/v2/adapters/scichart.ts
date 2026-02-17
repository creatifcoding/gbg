import { Effect } from 'effect';
import type { ChartAdapter } from './types';
import { ChartMountError, ChartUpdateError } from '../errors';
import type { ChartInstance } from '../types';
import type { ChartDatum, ChartSeries, ChartSpec } from '../schemas';
import { ChartState } from '../schemas';
import { resolveProjection } from './shared/projection';
import { trimHeadToMaxPoints } from './shared/boundedSeries';
import { loadSciChartModule } from './scichart/bootstrap';
import {
  appendSeriesBatch,
  appendSeriesPoint,
  setSeriesData,
} from './scichart/seriesEngine';
import { createRenderableSeriesForKind } from './scichart/series/index';
import {
  CHART_TOKENS,
  createSciChartAxisOptions,
  createSciChartThemeOverrides,
  createSciChartTitleStyle,
} from '../theme/index';

type SciChartSurface = {
  xAxes: { add: (axis: unknown) => void };
  yAxes: { add: (axis: unknown) => void };
  renderableSeries: { add: (series: unknown) => void };
  chartModifiers: { add: (...mods: unknown[]) => void };
  delete: () => void;
};

type SciChartDataSeries = {
  clear: () => void;
  append: (xValue: number, yValue: number) => void;
  appendRange: (xValues: number[], yValues: number[]) => void;
  removeRange: (startIndex: number, count: number) => void;
  count: () => number;
};

const axisOptions = createSciChartAxisOptions;

export const SciChartAdapter: ChartAdapter = {
  renderer: 'SCICHART',
  makeInstance: (
    spec
  ): Effect.Effect<ChartInstance, ChartMountError | ChartUpdateError> =>
    Effect.sync(() => {
      const resolvedSpec = { ...spec, renderer: 'SCICHART' } as ChartSpec;
      let state: ChartState = 'UNINITIALIZED';
      let series: ChartDatum[] = [];
      let surface: SciChartSurface | null = null;
      let dataSeries: SciChartDataSeries | null = null;
      const projection = resolveProjection(resolvedSpec.projection);
      const listeners = new Set<(next: ChartState) => void>();

      const setState = (next: ChartState) => {
        if (state === next) return;
        state = next;
        listeners.forEach((cb) => cb(next));
      };

      const updateSeries = () =>
        Effect.try({
          try: () => {
            if (!dataSeries) return;
            setSeriesData(dataSeries, series, projection);
          },
          catch: (error) =>
            new ChartUpdateError({
              renderer: 'SCICHART',
              message: error instanceof Error ? error.message : String(error),
            }),
        });

      const mount = (container: HTMLElement) =>
        Effect.tryPromise({
          try: async () => {
            if (state !== 'UNINITIALIZED') return;
            setState('LOADING');
            const scichart = await loadSciChartModule();
            const {
              SciChartSurface,
              NumericAxis,
              XyDataSeries,
              ZoomPanModifier,
              MouseWheelZoomModifier,
              ZoomExtentsModifier,
              SciChartJsNavyTheme,
            } = scichart;

            const tmnlTheme = Object.assign(
              new SciChartJsNavyTheme(),
              createSciChartThemeOverrides()
            );

            const { sciChartSurface, wasmContext } =
              await SciChartSurface.create(container, {
                theme: tmnlTheme,
                title: resolvedSpec.title ?? '',
                titleStyle: createSciChartTitleStyle(),
              });

            const xAxis = new NumericAxis(wasmContext, axisOptions(0));
            const yAxis = new NumericAxis(wasmContext, axisOptions(1));
            sciChartSurface.xAxes.add(xAxis);
            sciChartSurface.yAxes.add(yAxis);

            dataSeries = new XyDataSeries(wasmContext);

            const strokeWidth =
              'strokeWidth' in resolvedSpec &&
              typeof resolvedSpec.strokeWidth === 'number'
                ? resolvedSpec.strokeWidth
                : CHART_TOKENS.dimensions.strokeThicknessDefault;

            const renderableSeries = createRenderableSeriesForKind({
              scichart,
              wasmContext,
              dataSeries,
              spec: resolvedSpec,
              strokeWidth,
            });

            sciChartSurface.renderableSeries.add(renderableSeries);
            sciChartSurface.chartModifiers.add(
              new ZoomPanModifier({ enableZoom: true }),
              new MouseWheelZoomModifier(),
              new ZoomExtentsModifier()
            );

            surface = sciChartSurface;
            setState('READY');

            if (dataSeries && series.length > 0) {
              setSeriesData(dataSeries, series, projection);
            }
          },
          catch: (error) => {
            setState('ERROR');
            return new ChartMountError({
              renderer: 'SCICHART',
              message: error instanceof Error ? error.message : String(error),
            });
          },
        });

      const unmount = () =>
        Effect.sync(() => {
          if (surface) {
            surface.delete();
            surface = null;
            dataSeries = null;
          }
          setState('UNINITIALIZED');
        });

      const dispose = () =>
        Effect.sync(() => {
          if (surface) {
            surface.delete();
            surface = null;
            dataSeries = null;
          }
          listeners.clear();
          setState('DISPOSED');
        });

      const setData = (data: ChartSeries) =>
        Effect.sync(() => {
          series = [...data];
        }).pipe(Effect.andThen(updateSeries));

      const appendData = (data: ChartSeries) =>
        Effect.try({
          try: () => {
            if (data.length === 0) return;
            if (!dataSeries) {
              series.push(...data);
              return;
            }
            appendSeriesBatch(dataSeries, series, projection, data);
          },
          catch: (error) =>
            new ChartUpdateError({
              renderer: 'SCICHART',
              message: error instanceof Error ? error.message : String(error),
            }),
        });

      const clearData = () =>
        Effect.try({
          try: () => {
            series.length = 0;
            dataSeries?.clear();
          },
          catch: (error) =>
            new ChartUpdateError({
              renderer: 'SCICHART',
              message: error instanceof Error ? error.message : String(error),
            }),
        });

      const appendPointFast = (point: ChartDatum, maxPoints?: number) => {
        if (!dataSeries) {
          series.push(point);
          trimHeadToMaxPoints(series, maxPoints);
          return;
        }

        appendSeriesPoint(dataSeries, series, projection, point, maxPoints);
      };

      const appendBatchFast = (
        points: ReadonlyArray<ChartDatum>,
        maxPoints?: number
      ) => {
        if (points.length === 0) return;

        if (!dataSeries) {
          series.push(...points);
          trimHeadToMaxPoints(series, maxPoints);
          return;
        }

        appendSeriesBatch(dataSeries, series, projection, points, maxPoints);
      };

      const onStateChange = (handler: (next: ChartState) => void) => {
        listeners.add(handler);
        return () => listeners.delete(handler);
      };

      return {
        id: resolvedSpec.id,
        renderer: 'SCICHART',
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
        appendPointFast,
        appendBatchFast,
        onStateChange,
      } satisfies ChartInstance;
    }),
};
