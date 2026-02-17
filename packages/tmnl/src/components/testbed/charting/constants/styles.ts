import type { ChartState } from '@/lib/charting/v2';
import { CHART_TOKENS } from '@/lib/charting/v2';

export const chartSurfaceStyle = {
  width: '100%',
  height: 280,
  background: CHART_TOKENS.colors.chartBackground,
  marginTop: 12,
  borderRadius: 8,
  border: `1px solid ${CHART_TOKENS.colors.chartBorder}`,
};

export const resolveIndicator = (state: ChartState) => {
  switch (state) {
    case 'READY':
    case 'STREAMING':
      return { status: 'active' as const, label: state };
    case 'LOADING':
      return { status: 'pending' as const, label: state };
    case 'ERROR':
      return { status: 'error' as const, label: state };
    case 'DISPOSED':
      return { status: 'inactive' as const, label: state };
    case 'PAUSED':
      return { status: 'idle' as const, label: state };
    case 'UNINITIALIZED':
    default:
      return { status: 'idle' as const, label: state };
  }
};
