import { Effect } from 'effect';
import type { ChartAdapter } from './types';
import { ChartMountError, ChartUpdateError } from '../errors';
import type { ChartInstance } from '../types';
import type {
  ChartDatum,
  ChartSeries,
  ChartSpec,
  ProjectionKind,
} from '../schemas';
import { ChartState } from '../schemas';
import { CHART_TOKENS } from '../../v1/tokens';

type SciChartSurface = {
  xAxes: { add: (axis: unknown) => void };
  yAxes: { add: (axis: unknown) => void };
  renderableSeries: { add: (series: unknown) => void };
  chartModifiers: { add: (...mods: unknown[]) => void };
  delete: () => void;
};

type SciChartDataSeries = {
  clear: () => void;
  appendRange: (xValues: number[], yValues: number[]) => void;
};

const resolveProjection = (projection?: ProjectionKind) => {
  switch (projection) {
    case 'XY':
      return {
        x: (d: ChartDatum) => d.x,
        y: (d: ChartDatum) => d.y,
      };
    case 'TX':
      return {
        x: (d: ChartDatum) => d.t,
        y: (d: ChartDatum) => d.x,
      };
    case 'TY':
    default:
      return {
        x: (d: ChartDatum) => d.t,
        y: (d: ChartDatum) => d.y,
      };
  }
};

export const SciChartAdapter: ChartAdapter = {
  renderer: 'SCICHART',
  makeInstance: (
    spec
  ): Effect.Effect<ChartInstance, ChartMountError | ChartUpdateError> =>
    Effect.sync(() => {
      const resolvedSpec = { ...spec, renderer: 'SCICHART' } as ChartSpec;
      let state: ChartState = 'UNINITIALIZED';
      let series: ChartSeries = [];
      let surface: SciChartSurface | null = null;
      let dataSeries: SciChartDataSeries | null = null;
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
            const projection = resolveProjection(resolvedSpec.projection);
            const xValues = series.map((d) => projection.x(d));
            const yValues = series.map((d) => projection.y(d));
            dataSeries.clear();
            dataSeries.appendRange(xValues, yValues);
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
            const scichartModule = 'scichart';
            const scichart = await import(/* @vite-ignore */ scichartModule);
            const {
              SciChartSurface,
              NumericAxis,
              FastLineRenderableSeries,
              FastMountainRenderableSeries,
              XyDataSeries,
              XyScatterRenderableSeries,
              EllipsePointMarker,
              ZoomPanModifier,
              MouseWheelZoomModifier,
              ZoomExtentsModifier,
              SciChartJsNavyTheme,
            } = scichart;

            const { sciChartSurface, wasmContext } =
              await SciChartSurface.create(container, {
                theme: new SciChartJsNavyTheme(),
                title: resolvedSpec.title ?? '',
                titleStyle: {
                  fontSize: 14,
                  color: CHART_TOKENS.colors.textPrimary,
                },
              });

            const xAxis = new NumericAxis(wasmContext);
            const yAxis = new NumericAxis(wasmContext);
            sciChartSurface.xAxes.add(xAxis);
            sciChartSurface.yAxes.add(yAxis);

            dataSeries = new XyDataSeries(wasmContext);

            const strokeWidth =
              'strokeWidth' in resolvedSpec &&
              typeof resolvedSpec.strokeWidth === 'number'
                ? resolvedSpec.strokeWidth
                : CHART_TOKENS.dimensions.strokeThicknessDefault;

            let renderableSeries: unknown;
            if (resolvedSpec.kind === 'AREA') {
              renderableSeries = new FastMountainRenderableSeries(wasmContext, {
                dataSeries,
                stroke: CHART_TOKENS.colors.waveCyan,
                strokeThickness: strokeWidth,
                fill: CHART_TOKENS.colors.waveCyan,
                opacity: 0.35,
              });
            } else if (resolvedSpec.kind === 'SCATTER') {
              renderableSeries = new XyScatterRenderableSeries(wasmContext, {
                dataSeries,
                pointMarker: new EllipsePointMarker(wasmContext, {
                  fill: CHART_TOKENS.colors.waveRed,
                  stroke: CHART_TOKENS.colors.waveRed,
                  size:
                    'pointSize' in resolvedSpec && resolvedSpec.pointSize
                      ? resolvedSpec.pointSize
                      : 7,
                }),
              });
            } else {
              renderableSeries = new FastLineRenderableSeries(wasmContext, {
                dataSeries,
                stroke: CHART_TOKENS.colors.waveGreen,
                strokeThickness: strokeWidth,
              });
            }

            sciChartSurface.renderableSeries.add(renderableSeries);
            sciChartSurface.chartModifiers.add(
              new ZoomPanModifier({ enableZoom: true }),
              new MouseWheelZoomModifier(),
              new ZoomExtentsModifier()
            );

            surface = sciChartSurface;
            setState('READY');

            if (dataSeries && series.length > 0) {
              const projection = resolveProjection(resolvedSpec.projection);
              const xValues = series.map((d) => projection.x(d));
              const yValues = series.map((d) => projection.y(d));
              dataSeries.appendRange(xValues, yValues);
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
          series = data;
        }).pipe(Effect.andThen(updateSeries));

      const appendData = (data: ChartSeries) =>
        Effect.sync(() => {
          series = [...series, ...data];
        }).pipe(Effect.andThen(updateSeries));

      const clearData = () =>
        Effect.sync(() => {
          series = [];
        }).pipe(Effect.andThen(updateSeries));

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
        onStateChange,
      } satisfies ChartInstance;
    }),
};
