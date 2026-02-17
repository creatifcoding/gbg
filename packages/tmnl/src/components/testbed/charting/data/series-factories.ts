import type { ChartSeries } from '@/lib/charting/v2';

export const makeSignalSeries = (params: {
  pointCount: number;
  frequency: number;
  amplitude: number;
  noise?: number;
  phase?: number;
}): ChartSeries => {
  const { pointCount, frequency, amplitude, noise = 0, phase = 0 } = params;

  return Array.from({ length: pointCount }, (_, i) => {
    const t = i;
    const theta = (i / pointCount) * Math.PI * 2 * frequency + phase;
    const jitter = noise ? (Math.random() - 0.5) * noise : 0;
    return { t, x: t, y: amplitude * Math.sin(theta) + jitter };
  });
};

export const makeBarSeries = (): ChartSeries =>
  [120, 200, 150, 80, 190, 130].map((y, i) => ({
    t: i,
    x: i,
    y,
  }));

export const makeScatterSeries = (count = 64): ChartSeries =>
  Array.from({ length: count }, (_, i) => ({
    t: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
  }));

export const makeBurstSeries = (): ChartSeries =>
  Array.from({ length: 32 }, (_, i) => ({
    t: i,
    x: i,
    y: 0.6 + Math.sin(i * 0.35) * 0.5 + Math.random() * 0.25,
  }));
