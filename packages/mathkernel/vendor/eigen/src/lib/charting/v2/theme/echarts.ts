import { CHART_TOKENS } from './tokens';
import { CHARTING_V2_THEME } from './contracts';

export const ECHARTS_THEME_NAME = 'tmnl-v2';

export const echartsThemeV2 = {
  backgroundColor: CHART_TOKENS.colors.chartBackground,
  textStyle: {
    fontFamily: CHARTING_V2_THEME.typography.fontFamily,
    color: CHART_TOKENS.colors.textSecondary,
  },
  title: {
    textStyle: {
      fontFamily: CHARTING_V2_THEME.typography.fontFamily,
      fontSize: CHARTING_V2_THEME.typography.titleSize,
      color: CHART_TOKENS.colors.textPrimary,
    },
  },
  xAxis: {
    axisLine: { lineStyle: { color: CHARTING_V2_THEME.axis.lineColor } },
    axisLabel: {
      color: CHARTING_V2_THEME.axis.labelColor,
      fontFamily: CHARTING_V2_THEME.typography.fontFamily,
      fontSize: CHARTING_V2_THEME.typography.axisLabelSize,
    },
    splitLine: {
      lineStyle: {
        color: CHARTING_V2_THEME.axis.majorGrid.color,
        type: CHARTING_V2_THEME.axis.majorGrid.type,
      },
    },
  },
  yAxis: {
    axisLine: { lineStyle: { color: CHARTING_V2_THEME.axis.lineColor } },
    axisLabel: {
      color: CHARTING_V2_THEME.axis.labelColor,
      fontFamily: CHARTING_V2_THEME.typography.fontFamily,
      fontSize: CHARTING_V2_THEME.typography.axisLabelSize,
    },
    splitLine: {
      lineStyle: {
        color: CHARTING_V2_THEME.axis.majorGrid.color,
        type: CHARTING_V2_THEME.axis.majorGrid.type,
      },
    },
  },
  color: [
    CHART_TOKENS.colors.waveGreen,
    CHART_TOKENS.colors.waveCyan,
    CHART_TOKENS.colors.waveAmber,
    CHART_TOKENS.colors.waveRed,
  ],
};

export const createEChartsAxisLine = () => ({
  show: true,
  lineStyle: {
    color: CHARTING_V2_THEME.axis.lineColor,
    width: 1,
  },
});

export const createEChartsAxisTick = () => ({
  show: CHARTING_V2_THEME.axis.tickVisible,
});

export const createEChartsAxisLabel = () => ({
  color: CHARTING_V2_THEME.axis.labelColor,
  fontSize: CHARTING_V2_THEME.typography.axisLabelSize,
  fontFamily: CHARTING_V2_THEME.typography.fontFamily,
  margin: CHARTING_V2_THEME.axis.labelPadding,
});

export const createEChartsMajorSplitLine = () => ({
  show: true,
  lineStyle: {
    color: CHARTING_V2_THEME.axis.majorGrid.color,
    type: CHARTING_V2_THEME.axis.majorGrid.type,
    width: CHARTING_V2_THEME.axis.majorGrid.width,
  },
});

export const createEChartsMinorSplitLine = () => ({
  show: true,
  lineStyle: {
    color: CHARTING_V2_THEME.axis.minorGrid.color,
    type: CHARTING_V2_THEME.axis.minorGrid.type,
    width: CHARTING_V2_THEME.axis.minorGrid.width,
  },
});

export const createEChartsMinorTick = () => ({
  show: true,
  splitNumber: CHARTING_V2_THEME.axis.minorSplitNumber,
});
