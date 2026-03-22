import type { ChartDatum } from '../../schemas';
import { trimHeadToMaxPoints } from '../shared/boundedSeries';
import type { Projection } from '../shared/projection';

export type SciChartDataSeriesEngine = {
  clear: () => void;
  append: (xValue: number, yValue: number) => void;
  appendRange: (xValues: number[], yValues: number[]) => void;
  removeRange: (startIndex: number, count: number) => void;
  count: () => number;
};

export const setSeriesData = (
  dataSeries: SciChartDataSeriesEngine,
  series: ReadonlyArray<ChartDatum>,
  projection: Projection
): void => {
  const xValues = series.map((d) => projection.x(d));
  const yValues = series.map((d) => projection.y(d));
  dataSeries.clear();
  dataSeries.appendRange(xValues, yValues);
};

const trimDataSeriesToMax = (
  dataSeries: SciChartDataSeriesEngine,
  maxPoints?: number
) => {
  if (typeof maxPoints !== 'number' || maxPoints <= 0) return;
  const overflow = dataSeries.count() - maxPoints;
  if (overflow > 0) {
    dataSeries.removeRange(0, overflow);
  }
};

export const appendSeriesPoint = (
  dataSeries: SciChartDataSeriesEngine,
  localSeries: ChartDatum[],
  projection: Projection,
  point: ChartDatum,
  maxPoints?: number
): void => {
  localSeries.push(point);
  dataSeries.append(projection.x(point), projection.y(point));
  trimDataSeriesToMax(dataSeries, maxPoints);
  trimHeadToMaxPoints(localSeries, maxPoints);
};

export const appendSeriesBatch = (
  dataSeries: SciChartDataSeriesEngine,
  localSeries: ChartDatum[],
  projection: Projection,
  points: ReadonlyArray<ChartDatum>,
  maxPoints?: number
): void => {
  if (points.length === 0) return;

  localSeries.push(...points);
  dataSeries.appendRange(
    points.map((d) => projection.x(d)),
    points.map((d) => projection.y(d))
  );
  trimDataSeriesToMax(dataSeries, maxPoints);
  trimHeadToMaxPoints(localSeries, maxPoints);
};
