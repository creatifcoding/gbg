import type * as Effect from 'effect/Effect';
import type { ChartError } from './errors';
import type {
  ChartRenderer,
  ChartSeries,
  ChartSpec,
  ChartState,
} from './schemas';

export interface ChartInstance {
  readonly id: string;
  readonly renderer: ChartRenderer;
  readonly spec: ChartSpec;
  readonly state: ChartState;
  readonly mount: (container: HTMLElement) => Effect.Effect<void, ChartError>;
  readonly unmount: () => Effect.Effect<void, ChartError>;
  readonly dispose: () => Effect.Effect<void, ChartError>;
  readonly setData: (data: ChartSeries) => Effect.Effect<void, ChartError>;
  readonly appendData: (data: ChartSeries) => Effect.Effect<void, ChartError>;
  readonly clearData: () => Effect.Effect<void, ChartError>;
  readonly onStateChange: (handler: (state: ChartState) => void) => () => void;
}
