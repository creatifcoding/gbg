import { CHART_FONT_FAMILY, CHART_TOKENS } from './tokens';

export const CHARTING_V2_THEME = {
  typography: {
    fontFamily: CHART_FONT_FAMILY,
    axisLabelSize: CHART_TOKENS.typography.labelFontSize,
    titleSize: CHART_TOKENS.typography.titleFontSize,
  },
  axis: {
    lineColor: CHART_TOKENS.colors.axisLine,
    labelColor: CHART_TOKENS.colors.axisLabel,
    labelPadding: CHART_TOKENS.dimensions.axisPadding,
    tickVisible: false,
    majorGrid: {
      color: CHART_TOKENS.colors.gridMajor,
      width: 1,
      type: 'dashed' as const,
      dash: [6, 4] as const,
    },
    minorGrid: {
      color: CHART_TOKENS.colors.gridMinor,
      width: 1,
      type: 'solid' as const,
    },
    minorSplitNumber: 2,
    maxAutoTicks: 5,
    minorsPerMajor: 2,
  },
} as const;
