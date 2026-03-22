import { CHARTING_V2_THEME } from './contracts';
import { CHART_TOKENS } from './tokens';

export const createSciChartThemeOverrides = () => ({
  sciChartBackground: CHART_TOKENS.colors.chartBackground,
  gridBackgroundBrush: CHART_TOKENS.colors.chartBackground,
  gridBorderBrush: CHART_TOKENS.colors.chartBorder,
  axisBorder: CHARTING_V2_THEME.axis.lineColor,
  axisBandsFill: 'transparent',
  tickTextBrush: CHARTING_V2_THEME.axis.labelColor,
  majorGridLineBrush: CHARTING_V2_THEME.axis.majorGrid.color,
  minorGridLineBrush: CHARTING_V2_THEME.axis.minorGrid.color,
  axisTitleColor: CHART_TOKENS.colors.textPrimary,
  chartTitleColor: CHART_TOKENS.colors.textPrimary,
  labelBackgroundBrush: 'transparent',
  labelBorderBrush: 'transparent',
  labelForegroundBrush: CHART_TOKENS.colors.textPrimary,
});

export const createSciChartAxisOptions = (labelPrecision: number) => ({
  useNativeText: false,
  labelPrecision,
  maxAutoTicks: CHARTING_V2_THEME.axis.maxAutoTicks,
  minorsPerMajor: CHARTING_V2_THEME.axis.minorsPerMajor,
  drawMajorBands: false,
  drawMajorGridLines: true,
  drawMinorGridLines: true,
  drawMajorTickLines: false,
  drawMinorTickLines: false,
  labelStyle: {
    fontSize: CHARTING_V2_THEME.typography.axisLabelSize,
    fontFamily: CHARTING_V2_THEME.typography.fontFamily,
    color: CHARTING_V2_THEME.axis.labelColor,
  },
  majorGridLineStyle: {
    strokeThickness: CHARTING_V2_THEME.axis.majorGrid.width,
    color: CHARTING_V2_THEME.axis.majorGrid.color,
    strokeDashArray: [...CHARTING_V2_THEME.axis.majorGrid.dash],
  },
  minorGridLineStyle: {
    strokeThickness: CHARTING_V2_THEME.axis.minorGrid.width,
    color: CHARTING_V2_THEME.axis.minorGrid.color,
  },
});

export const createSciChartTitleStyle = () => ({
  useNativeText: false,
  fontFamily: CHARTING_V2_THEME.typography.fontFamily,
  fontSize: CHARTING_V2_THEME.typography.titleSize,
  color: CHART_TOKENS.colors.textPrimary,
});
