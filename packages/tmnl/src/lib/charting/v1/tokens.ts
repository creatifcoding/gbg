/**
 * TMNL Charting v1 - Design Tokens
 *
 * CHART_TOKENS derives from TMNL_TOKENS and extends for chart-specific styling.
 * Inspired by MAGI aesthetic (Evangelion-style oscilloscope).
 *
 * @experimental v1 API may change.
 */

import { TMNL_TOKENS } from "@/components/tldraw/shapes/data-grid-theme"

// ─────────────────────────────────────────────────────────────────────────────
// CHART_TOKENS - Extends TMNL_TOKENS for charting
// ─────────────────────────────────────────────────────────────────────────────

export const CHART_TOKENS = {
  // Inherit core palette from TMNL
  colors: {
    ...TMNL_TOKENS.colors,

    // Chart-specific backgrounds
    chartBackground: "#050000", // Deeper black for oscilloscope feel
    chartBackgroundAlt: "#0a0a0a",

    // Grid
    gridMajor: "rgba(255, 255, 255, 0.1)",
    gridMinor: "rgba(255, 255, 255, 0.04)",

    // Crosshair / cursor
    crosshair: "#ffaa00",
    crosshairSubtle: "rgba(255, 170, 0, 0.5)",

    // Wave colors (MAGI-inspired)
    waveOrange: "#ff6600",
    waveOrangeLight: "#ff9944",
    waveAmber: "#ffaa00", // Alias for amber tones
    waveBlue: "#00aaff",
    waveBlueLight: "#44ccff",
    waveCyan: "#00ffff",
    waveGreen: "#00ff88",
    waveRed: "#ff4455",
    wavePurple: "#aa44ff",

    // Chart frame/border
    chartBorder: "rgba(255, 255, 255, 0.08)",
    chartGrid: "rgba(255, 255, 255, 0.12)",

    // Status indicators
    statusActive: "#00ff88",
    statusWarning: "#ffaa00",
    statusError: "#ff4444",
    statusIdle: "rgba(255, 255, 255, 0.3)",

    // Axis
    axisLine: "rgba(255, 255, 255, 0.2)",
    axisLabel: "rgba(255, 255, 255, 0.65)",
    axisLabelHighlight: "rgba(255, 255, 255, 0.9)",

    // Tooltip
    tooltipBackground: "rgba(0, 0, 0, 0.92)",
    tooltipBorder: "rgba(255, 170, 0, 0.4)",
    tooltipText: "#ffffff",

    // Scanline overlay
    scanlineColor: "rgba(0, 0, 0, 0.15)",
  },

  // Typography (inherit + extend)
  // IMPORTANT: Minimum 12px for readability. DO NOT shrink.
  typography: {
    ...TMNL_TOKENS.typography,
    chartFontFamily: ['"Share Tech Mono"', "monospace"],
    labelFontSize: 12,   // Axis labels — floor at 12px
    titleFontSize: 14,   // Chart titles
    tooltipFontSize: 12, // Tooltip text
  },

  // Chart-specific dimensions
  dimensions: {
    ...TMNL_TOKENS.dimensions,

    // Default chart sizes
    defaultWidth: 800,
    defaultHeight: 400,
    minHeight: 120,
    maxHeight: 1200,

    // Axis
    axisTickLength: 5,
    axisTickLengthMajor: 10,
    axisPadding: 8,

    // Stroke
    strokeThicknessDefault: 1,
    strokeThicknessThin: 0.5,
    strokeThicknessThick: 2,

    // Tooltip
    tooltipPadding: 6,
    tooltipOffset: 16,
  },

  // Animation timing
  animation: {
    ...TMNL_TOKENS.animation,

    // Chart-specific
    mountDuration: 0.5,
    waveFadeDuration: 0.4,
    cursorFadeDuration: 0.1,
    updateInterval: 16, // ~60fps

    // Easing
    waveEasing: "power2.out",
    cursorEasing: "power2.out",
  },

  // Scope-specific (oscilloscope charts)
  scope: {
    defaultPointCount: 512,
    hueDiscretization: 24,
    scanlineSpacing: 4,
    scanlineOpacity: 0.4,

    // Range defaults
    xRangeMin: 0,
    xRangeMax: 512,
    yRangeMin: -1.5,
    yRangeMax: 1.5,

    // Zoom constraints
    xMinVisibleRange: 64,
    yMinVisibleRange: 0.5,
  },

  // Wave presets
  waves: {
    blue: {
      baseHue: 210,
      saturation: 0.9,
      lightness: 0.55,
    },
    orange: {
      baseHue: 20,
      saturation: 0.9,
      lightness: 0.55,
    },
    cyan: {
      baseHue: 180,
      saturation: 0.9,
      lightness: 0.55,
    },
    green: {
      baseHue: 150,
      saturation: 0.9,
      lightness: 0.55,
    },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Color Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert HSL to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + hNorm * 12) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Discretize hue for stepped color animation
 */
export function discretizeHue(baseHue: number, phase: number, steps: number): number {
  const hueShift = (phase * 30) % 360
  const rawHue = (baseHue + hueShift) % 360
  const stepSize = 360 / steps
  return Math.round(rawHue / stepSize) * stepSize
}

/**
 * Get wave color at a given phase
 */
export function getWaveColor(
  wavePreset: keyof typeof CHART_TOKENS.waves,
  phase: number = 0
): string {
  const preset = CHART_TOKENS.waves[wavePreset]
  const hue = discretizeHue(preset.baseHue, phase, CHART_TOKENS.scope.hueDiscretization)
  return hslToHex(hue, preset.saturation, preset.lightness)
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ECharts theme object derived from CHART_TOKENS
 */
export const echartsTheme = {
  backgroundColor: CHART_TOKENS.colors.chartBackground,
  textStyle: {
    fontFamily: CHART_TOKENS.typography.chartFontFamily.join(", "),
    color: CHART_TOKENS.colors.textSecondary,
  },
  title: {
    textStyle: {
      color: CHART_TOKENS.colors.textPrimary,
      fontSize: CHART_TOKENS.typography.titleFontSize,
    },
  },
  legend: {
    textStyle: {
      color: CHART_TOKENS.colors.textMuted,
    },
  },
  tooltip: {
    backgroundColor: CHART_TOKENS.colors.tooltipBackground,
    borderColor: CHART_TOKENS.colors.tooltipBorder,
    textStyle: {
      color: CHART_TOKENS.colors.tooltipText,
      fontSize: CHART_TOKENS.typography.tooltipFontSize,
    },
  },
  xAxis: {
    axisLine: { lineStyle: { color: CHART_TOKENS.colors.axisLine } },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel },
    splitLine: { lineStyle: { color: CHART_TOKENS.colors.gridMajor } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: CHART_TOKENS.colors.axisLine } },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel },
    splitLine: { lineStyle: { color: CHART_TOKENS.colors.gridMajor } },
  },
  grid: {
    borderColor: CHART_TOKENS.colors.borderMuted,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: CHART_TOKENS.colors.axisLine } },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: CHART_TOKENS.colors.axisLine } },
    axisLabel: { color: CHART_TOKENS.colors.axisLabel },
  },
  line: {
    symbol: "none",
    smooth: false,
  },
  color: [
    CHART_TOKENS.colors.waveBlue,
    CHART_TOKENS.colors.waveOrange,
    CHART_TOKENS.colors.waveCyan,
    CHART_TOKENS.colors.waveGreen,
    CHART_TOKENS.colors.wavePurple,
    CHART_TOKENS.colors.accentYellow,
    CHART_TOKENS.colors.accentRed,
  ],
}

/**
 * SciChart theme provider (MAGI-style)
 */
export const sciChartTheme = {
  sciChartBackground: CHART_TOKENS.colors.chartBackground,
  loadedTheme: "tmnl",
  axisBandsFill: "transparent",
  majorGridLineBrush: CHART_TOKENS.colors.gridMajor,
  minorGridLineBrush: "transparent",
  tickTextBrush: CHART_TOKENS.colors.axisLabel,
  axisTitleColor: CHART_TOKENS.colors.textPrimary,
  labelBorderBrush: "transparent",
  labelBackgroundBrush: "transparent",
  labelForegroundBrush: CHART_TOKENS.colors.textPrimary,
}
