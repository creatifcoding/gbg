import type * as Effect from 'effect/Effect';
import type { ChartError } from '../errors';
import type { ChartSpec, ChartRenderer } from '../schemas';
import type { ChartInstance } from '../types';

export interface ChartAdapter {
  readonly renderer: ChartRenderer;
  readonly makeInstance: (
    spec: ChartSpec
  ) => Effect.Effect<ChartInstance, ChartError>;
}
