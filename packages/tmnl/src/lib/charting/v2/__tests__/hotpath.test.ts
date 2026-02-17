import { describe, expect, it } from 'vitest';
import type { ChartDatum } from '../schemas';
import {
  appendSeriesBatch,
  appendSeriesPoint,
  type SciChartDataSeriesEngine,
} from '../adapters/scichart/seriesEngine';
import { trimHeadToMaxPoints } from '../adapters/shared/boundedSeries';

const datum = (n: number): ChartDatum => ({ t: n, x: n, y: n });

const projection = {
  x: (d: ChartDatum) => d.t,
  y: (d: ChartDatum) => d.y,
};

const makeSeriesEngine = () => {
  const xs: number[] = [];
  const ys: number[] = [];
  const removeCalls: Array<{ start: number; count: number }> = [];

  const engine: SciChartDataSeriesEngine = {
    clear: () => {
      xs.length = 0;
      ys.length = 0;
    },
    append: (x, y) => {
      xs.push(x);
      ys.push(y);
    },
    appendRange: (xValues, yValues) => {
      xs.push(...xValues);
      ys.push(...yValues);
    },
    removeRange: (start, count) => {
      removeCalls.push({ start, count });
      xs.splice(start, count);
      ys.splice(start, count);
    },
    count: () => xs.length,
  };

  return { engine, xs, ys, removeCalls };
};

describe('charting v2 hot path', () => {
  it('trimHeadToMaxPoints trims from start and returns overflow', () => {
    const items = [1, 2, 3, 4, 5];
    const overflow = trimHeadToMaxPoints(items, 3);

    expect(overflow).toBe(2);
    expect(items).toEqual([3, 4, 5]);
  });

  it('appendSeriesPoint enforces maxPoints on local series and data series', () => {
    const localSeries: ChartDatum[] = [];
    const { engine, xs, removeCalls } = makeSeriesEngine();

    for (let i = 0; i < 5; i += 1) {
      appendSeriesPoint(engine, localSeries, projection, datum(i), 3);
    }

    expect(localSeries.map((d) => d.t)).toEqual([2, 3, 4]);
    expect(xs).toEqual([2, 3, 4]);
    expect(removeCalls.length).toBeGreaterThan(0);
  });

  it('appendSeriesBatch enforces maxPoints after batched appends', () => {
    const localSeries: ChartDatum[] = [];
    const { engine, xs, removeCalls } = makeSeriesEngine();

    appendSeriesBatch(engine, localSeries, projection, [
      datum(0),
      datum(1),
      datum(2),
      datum(3),
      datum(4),
    ], 3);

    expect(localSeries.map((d) => d.t)).toEqual([2, 3, 4]);
    expect(xs).toEqual([2, 3, 4]);
    expect(removeCalls).toEqual([{ start: 0, count: 2 }]);
  });
});
