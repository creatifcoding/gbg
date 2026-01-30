import { Effect } from 'effect';
import type { ChartAdapter } from './types';
import { ChartMountError, ChartUpdateError } from '../errors';
import type { ChartInstance } from '../types';
import type { ChartSeries, ChartSpec, ProjectionKind } from '../schemas';
import { ChartState } from '../schemas';
import { CHART_TOKENS, echartsTheme } from '../../v1/tokens';

type EChartsInstance = {
  setOption: (option: unknown, opts?: unknown) => void;
  resize: () => void;
  dispose: () => void;
};

type Projection = {
  x: (datum: { t: number; x: number; y: number }) => number;
  y: (datum: { t: number; x: number; y: number }) => number;
};

const resolveProjection = (projection?: ProjectionKind): Projection => {
  switch (projection) {
    case 'XY':
      return { x: (d) => d.x, y: (d) => d.y };
    case 'TX':
      return { x: (d) => d.t, y: (d) => d.x };
    case 'TY':
    default:
      return { x: (d) => d.t, y: (d) => d.y };
  }
};

const buildBaseOption = (spec: ChartSpec): Record<string, unknown> => ({
  animation: spec.animate ?? true,
  grid: {
    top: spec.title ? 48 : 24,
    right: 24,
    bottom: 32,
    left: 16,
    containLabel: true,
  },
  title: spec.title
    ? {
        text: spec.title,
        left: 'center',
        top: 8,
        textStyle: {
          fontSize: 12,
          fontWeight: 500,
          fontFamily: CHART_TOKENS.typography.fontFamily,
          color: CHART_TOKENS.colors.textPrimary,
          letterSpacing: 1,
        },
      }
    : undefined,
  textStyle: {
    fontFamily: CHART_TOKENS.typography.fontFamily,
  },
});

const buildLineOption = (spec: ChartSpec, base: Record<string, unknown>) => ({
  ...base,
  xAxis: {
    type: 'category',
    data: [],
    axisLine: {
      show: true,
      lineStyle: { color: CHART_TOKENS.colors.axisLine },
    },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_TOKENS.colors.axisLabel,
      fontSize: 12,
      margin: 8,
      interval: 'auto',
      hideOverlap: true,
    },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_TOKENS.colors.axisLabel,
      fontSize: 12,
      margin: 8,
      formatter: (value: number) => value.toFixed(value % 1 === 0 ? 0 : 1),
    },
    splitLine: {
      lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: 'dashed' },
    },
    splitNumber: 4,
  },
  series: [
    {
      type: 'line',
      data: [],
      smooth: 'smooth' in spec ? spec.smooth ?? false : false,
      symbol: 'showPoints' in spec && spec.showPoints ? 'circle' : 'none',
      symbolSize: 4,
      lineStyle: {
        width:
          'strokeWidth' in spec && typeof spec.strokeWidth === 'number'
            ? spec.strokeWidth
            : CHART_TOKENS.dimensions.strokeThicknessDefault,
        color: CHART_TOKENS.colors.waveGreen,
      },
      itemStyle: {
        color: CHART_TOKENS.colors.waveGreen,
      },
      areaStyle:
        'showArea' in spec && spec.showArea
          ? { opacity: 0.2, color: CHART_TOKENS.colors.waveGreen }
          : undefined,
    },
  ],
});

const buildAreaOption = (spec: ChartSpec, base: Record<string, unknown>) => ({
  ...base,
  xAxis: {
    type: 'category',
    data: [],
    axisLine: {
      show: true,
      lineStyle: { color: CHART_TOKENS.colors.axisLine },
    },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_TOKENS.colors.axisLabel,
      fontSize: 12,
      hideOverlap: true,
    },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12 },
    splitLine: {
      lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: 'dashed' },
    },
    splitNumber: 4,
  },
  series: [
    {
      type: 'line',
      data: [],
      smooth: 'smooth' in spec ? spec.smooth ?? false : false,
      areaStyle: { opacity: 0.3, color: CHART_TOKENS.colors.waveCyan },
      lineStyle: { color: CHART_TOKENS.colors.waveCyan, width: 2 },
      itemStyle: { color: CHART_TOKENS.colors.waveCyan },
      symbol: 'none',
    },
  ],
});

const buildBarOption = (spec: ChartSpec, base: Record<string, unknown>) => ({
  ...base,
  xAxis: {
    type: 'category',
    data: [],
    axisLine: {
      show: true,
      lineStyle: { color: CHART_TOKENS.colors.axisLine },
    },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_TOKENS.colors.axisLabel,
      fontSize: 12,
      margin: 8,
      hideOverlap: true,
    },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_TOKENS.colors.axisLabel,
      fontSize: 12,
      margin: 8,
    },
    splitLine: {
      lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: 'dashed' },
    },
    splitNumber: 4,
  },
  series: [
    {
      type: 'bar',
      data: [],
      barWidth: 'barWidth' in spec ? spec.barWidth ?? '60%' : '60%',
      itemStyle: {
        color: CHART_TOKENS.colors.waveAmber,
        borderRadius: [2, 2, 0, 0],
      },
    },
  ],
});

const buildScatterOption = (base: Record<string, unknown>) => ({
  ...base,
  xAxis: {
    type: 'value',
    axisLine: {
      show: true,
      lineStyle: { color: CHART_TOKENS.colors.axisLine },
    },
    axisTick: { show: false },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12 },
    splitLine: { show: false },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12 },
    splitLine: {
      lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: 'dashed' },
    },
    splitNumber: 4,
  },
  series: [
    {
      type: 'scatter',
      data: [],
      symbolSize: 8,
      itemStyle: {
        color: CHART_TOKENS.colors.waveRed,
        opacity: 0.8,
      },
    },
  ],
});

const buildCandlestickOption = (
  spec: ChartSpec,
  base: Record<string, unknown>
) => ({
  ...base,
  xAxis: { type: 'category', data: [] },
  yAxis: { type: 'value', scale: true },
  series: [
    {
      type: 'candlestick',
      data: [],
      itemStyle: {
        color:
          'bullColor' in spec && spec.bullColor
            ? spec.bullColor
            : CHART_TOKENS.colors.statusActive,
        color0:
          'bearColor' in spec && spec.bearColor
            ? spec.bearColor
            : CHART_TOKENS.colors.statusError,
        borderColor:
          'bullColor' in spec && spec.bullColor
            ? spec.bullColor
            : CHART_TOKENS.colors.statusActive,
        borderColor0:
          'bearColor' in spec && spec.bearColor
            ? spec.bearColor
            : CHART_TOKENS.colors.statusError,
      },
    },
  ],
});

const buildEChartsOption = (spec: ChartSpec): Record<string, unknown> => {
  const base = buildBaseOption(spec);
  switch (spec.kind) {
    case 'LINE':
      return buildLineOption(spec, base);
    case 'AREA':
      return buildAreaOption(spec, base);
    case 'BAR':
    case 'COLUMN':
      return buildBarOption(spec, base);
    case 'SCATTER':
      return buildScatterOption(base);
    case 'CANDLESTICK':
      return buildCandlestickOption(spec, base);
    default:
      return buildLineOption(spec, base);
  }
};

const applySeriesData = (
  chart: EChartsInstance,
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
            echarts.registerTheme('tmnl', echartsTheme);
            const instance = echarts.init(container, 'tmnl', {
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
