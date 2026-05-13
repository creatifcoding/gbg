import { CHART_TOKENS, echartsTheme as echartsV1Theme } from '../v1/tokens';

export const CHART_FONT_FAMILY = CHART_TOKENS.typography.chartFontFamily.join(', ');
export const AXIS_LABEL_FONT_SIZE = CHART_TOKENS.typography.labelFontSize;
export const TITLE_FONT_SIZE = CHART_TOKENS.typography.titleFontSize;
export const AXIS_PADDING = CHART_TOKENS.dimensions.axisPadding;

export const echartsV2Theme = {
  ...echartsV1Theme,
  textStyle: {
    ...(echartsV1Theme as Record<string, unknown>).textStyle,
    fontFamily: CHART_FONT_FAMILY,
  },
  title: {
    ...(echartsV1Theme as Record<string, unknown>).title,
    textStyle: {
      ...((echartsV1Theme as Record<string, any>).title?.textStyle ?? {}),
      fontFamily: CHART_FONT_FAMILY,
      fontSize: TITLE_FONT_SIZE,
      color: CHART_TOKENS.colors.textPrimary,
    },
  },
};

export const createEchartsAxisLine = () => ({
  show: true,
  lineStyle: {
    color: CHART_TOKENS.colors.axisLine,
    width: 1,
  },
});

export const createEchartsAxisTick = () => ({ show: false });

export const createEchartsAxisLabel = () => ({
  color: CHART_TOKENS.colors.axisLabel,
  fontSize: AXIS_LABEL_FONT_SIZE,
  fontFamily: CHART_FONT_FAMILY,
  margin: AXIS_PADDING,
});

export const createEchartsMajorSplitLine = () => ({
  show: true,
  lineStyle: {
    color: CHART_TOKENS.colors.gridMajor,
    type: 'dashed' as const,
    width: 1,
  },
});

export const createEchartsMinorSplitLine = () => ({
  show: true,
  lineStyle: {
    color: CHART_TOKENS.colors.gridMinor,
    type: 'solid' as const,
    width: 1,
  },
});

export const createEchartsMinorTick = () => ({
  show: true,
  splitNumber: 2,
});

export const createSciChartTheme = <T extends object>(baseTheme: T) =>
  Object.assign(baseTheme, {
    sciChartBackground: CHART_TOKENS.colors.chartBackground,
    gridBackgroundBrush: CHART_TOKENS.colors.chartBackground,
    gridBorderBrush: CHART_TOKENS.colors.chartBorder,
    axisBorder: CHART_TOKENS.colors.axisLine,
    axisBandsFill: 'transparent',
    tickTextBrush: CHART_TOKENS.colors.axisLabel,
    majorGridLineBrush: CHART_TOKENS.colors.gridMajor,
    minorGridLineBrush: CHART_TOKENS.colors.gridMinor,
    axisTitleColor: CHART_TOKENS.colors.textPrimary,
    chartTitleColor: CHART_TOKENS.colors.textPrimary,
    labelBackgroundBrush: 'transparent',
    labelBorderBrush: 'transparent',
    labelForegroundBrush: CHART_TOKENS.colors.textPrimary,
  });

export const createSciChartTitleStyle = () => ({
  useNativeText: false,
  fontFamily: CHART_FONT_FAMILY,
  fontSize: TITLE_FONT_SIZE,
  color: CHART_TOKENS.colors.textPrimary,
});

export const createSciChartAxisOptions = (labelPrecision: number) => ({
  use