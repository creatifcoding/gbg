import {
  createEChartsAxisLabel,
  createEChartsAxisLine,
  createEChartsAxisTick,
  createEChartsMajorSplitLine,
  createEChartsMinorSplitLine,
  createEChartsMinorTick,
} from '../../../theme/index';

export const axisLine = createEChartsAxisLine;
export const axisTick = createEChartsAxisTick;
export const axisLabel = createEChartsAxisLabel;
export const majorSplitLine = createEChartsMajorSplitLine;
export const minorSplitLine = createEChartsMinorSplitLine;
export const minorTick = createEChartsMinorTick;

export const createCategoryAxis = (options?: { hideOverlap?: boolean }) => ({
  type: 'category',
  data: [],
  axisLine: axisLine(),
  axisTick: axisTick(),
  axisLabel: {
    ...axisLabel(),
    hideOverlap: options?.hideOverlap ?? true,
  },
  splitLine: majorSplitLine(),
  minorSplitLine: minorSplitLine(),
});

export const createValueAxis = (options?: {
  splitNumber?: number;
  scale?: boolean;
  formatter?: (value: number) => string;
}) => ({
  type: 'value',
  ...(options?.scale ? { scale: true } : {}),
  axisLine: axisLine(),
  axisTick: axisTick(),
  axisLabel: {
    ...axisLabel(),
    ...(options?.formatter ? { formatter: options.formatter } : {}),
  },
  splitLine: majorSplitLine(),
  minorSplitLine: minorSplitLine(),
  minorTick: minorTick(),
  splitNumber: options?.splitNumber ?? 4,
});
