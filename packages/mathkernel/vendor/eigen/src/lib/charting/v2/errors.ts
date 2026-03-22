import { Schema } from 'effect';
import { ChartRenderer } from './schemas';

export class ChartAdapterUnavailable extends Schema.TaggedError<ChartAdapterUnavailable>()(
  'ChartAdapterUnavailable',
  {
    renderer: ChartRenderer,
    message: Schema.String,
  }
) {}

export class ChartMountError extends Schema.TaggedError<ChartMountError>()(
  'ChartMountError',
  {
    renderer: ChartRenderer,
    message: Schema.String,
  }
) {}

export class ChartUpdateError extends Schema.TaggedError<ChartUpdateError>()(
  'ChartUpdateError',
  {
    renderer: ChartRenderer,
    message: Schema.String,
  }
) {}

export class ChartInstanceNotFound extends Schema.TaggedError<ChartInstanceNotFound>()(
  'ChartInstanceNotFound',
  {
    id: Schema.String,
  }
) {}

export const ChartError = Schema.Union(
  ChartAdapterUnavailable,
  ChartMountError,
  ChartUpdateError,
  ChartInstanceNotFound
);
export type ChartError = typeof ChartError.Type;
