import type { ChartSeries } from '@/lib/charting/v2';
import type { StreamApplyMode } from './types';

type StreamCapableInstance = {
  appendBatchFast?: (points: ReadonlyArray<ChartSeries[number]>, maxPoints?: number) => void;
  appendPointFast?: (point: ChartSeries[number], maxPoints?: number) => void;
};

export const applyStreamBatch = (params: {
  instance: StreamCapableInstance;
  points: ReadonlyArray<ChartSeries[number]>;
  maxPoints: number;
  appendData: (data: ChartSeries) => unknown;
}): StreamApplyMode => {
  const { instance, points, maxPoints, appendData } = params;

  if (instance.appendBatchFast) {
    instance.appendBatchFast(points, maxPoints);
    return 'batch';
  }

  if (instance.appendPointFast) {
    for (const point of points) {
      instance.appendPointFast(point, maxPoints);
    }
    return 'point';
  }

  void appendData(points as ChartSeries);
  return 'effect';
};
