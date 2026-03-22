import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../schemas';
import { buildEChartsOption } from '../adapters/echarts/options/index';
import {
  CHART_TOKENS,
  CHARTING_V2_THEME,
  createEChartsMajorSplitLine,
  createSciChartThemeOverrides,
} from '../theme/index';

const lineSpec: ChartSpec = {
  id: 'line-spec',
  kind: 'LINE',
  renderer: 'ECHARTS',
};

const areaSpec: ChartSpec = {
  id: 'area-spec',
  kind: 'AREA',
  renderer: 'ECHARTS',
};

const barSpec: ChartSpec = {
  id: 'bar-spec',
  kind: 'BAR',
  renderer: 'ECHARTS',
};

const scatterSpec: ChartSpec = {
  id: 'scatter-spec',
  kind: 'SCATTER',
  renderer: 'ECHARTS',
};

const candleSpec: ChartSpec = {
  id: 'candle-spec',
  kind: 'CANDLESTICK',
  renderer: 'ECHARTS',
  windowSize: 32,
};

describe('charting v2 option/theme contracts', () => {
  it('selects correct option builder per chart kind', () => {
    const line = buildEChartsOption(lineSpec) as any;
    const area = buildEChartsOption(areaSpec) as any;
    const bar = buildEChartsOption(barSpec) as any;
    const scatter = buildEChartsOption(scatterSpec) as any;
    const candle = buildEChartsOption(candleSpec) as any;

    expect(line.series[0].type).toBe('line');
    expect(line.series[0].lineStyle.color).toBe(CHART_TOKENS.colors.waveGreen);

    expect(area.series[0].type).toBe('line');
    expect(area.series[0].areaStyle.color).toBe(CHART_TOKENS.colors.waveCyan);

    expect(bar.series[0].type).toBe('bar');
    expect(bar.series[0].itemStyle.color).toBe(CHART_TOKENS.colors.waveAmber);

    expect(scatter.series[0].type).toBe('scatter');
    expect(scatter.xAxis.type).toBe('value');

    expect(candle.series[0].type).toBe('candlestick');
    expect(candle.series[0].itemStyle.color).toBe(
      CHART_TOKENS.colors.statusActive
    );
  });

  it('keeps ECharts and SciChart grid color parity via shared theme contracts', () => {
    const eMajor = createEChartsMajorSplitLine();
    const sci = createSciChartThemeOverrides();

    expect(eMajor.lineStyle.color).toBe(CHARTING_V2_THEME.axis.majorGrid.color);
    expect(sci.majorGridLineBrush).toBe(CHARTING_V2_THEME.axis.majorGrid.color);
    expect(sci.tickTextBrush).toBe(CHARTING_V2_THEME.axis.labelColor);
  });
});
