export const CHART_TOKENS = {
  colors: {
    chartBackground: '#050000',
    chartBorder: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.78)',
    axisLine: 'rgba(255, 255, 255, 0.2)',
    axisLabel: 'rgba(255, 255, 255, 0.65)',
    gridMajor: 'rgba(255, 255, 255, 0.1)',
    gridMinor: 'rgba(255, 255, 255, 0.04)',
    waveGreen: '#00ff88',
    waveCyan: '#00ffff',
    waveAmber: '#ffaa00',
    waveRed: '#ff4455',
    statusActive: '#00ff88',
    statusError: '#ff4444',
  },
  typography: {
    chartFontFamily: [
      'ui-monospace',
      'SFMono-Regular',
      '"SF Mono"',
      'Menlo',
      'Consolas',
      '"Liberation Mono"',
      'monospace',
    ],
    labelFontSize: 12,
    titleFontSize: 14,
  },
  dimensions: {
    axisPadding: 8,
    strokeThicknessDefault: 1,
  },
} as const;

export const CHART_FONT_FAMILY = CHART_TOKENS.typography.chartFontFamily.join(', ');
