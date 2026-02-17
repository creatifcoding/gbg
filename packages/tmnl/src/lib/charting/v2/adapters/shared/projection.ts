import type { ChartDatum, ProjectionKind } from '../../schemas';

export type Projection = {
  x: (datum: ChartDatum) => number;
  y: (datum: ChartDatum) => number;
};

export const resolveProjection = (projection?: ProjectionKind): Projection => {
  switch (projection) {
    case 'XY':
      return { x: (d) => d.x, y: (d) => d.y };
    case 'TX':
      return { x: (d) => d.t, y: (d) => d.x };
    case 'TY':
    default:
      return { x: (d) => d.t, y: (d) => d.y };
  }
};
