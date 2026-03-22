import type { ChartSpec } from '../../../../schemas';
import { CHART_TOKENS, CHARTING_V2_THEME } from '../../../../theme/index';
import type { EChartsOption } from '../types';

const CHART_FONT_FAMILY = CHARTING_V2_THEME.typography.fontFamily;
const TITLE_FONT_SIZE = CHARTING_V2_THEME.typography.titleSize;

export const buildBaseOption = (spec: ChartSpec): EChartsOption => ({
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
          fontSize: TITLE_FONT_SIZE,
          fontWeight: 500,
          fontFamily: CHART_FONT_FAMILY,
          color: CHART_TOKENS.colors.textPrimary,
          letterSpacing: 1,
        },
      }
    : undefined,
  textStyle: {
    fontFamily: CHART_FONT_FAMILY,
  },
});
