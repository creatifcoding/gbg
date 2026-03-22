import { ChartAdapterUnavailable } from '../errors';
import type { ChartRenderer, ChartSpec } from '../schemas';
import type { ChartAdapter } from '../adapters/types';

export type AdapterRegistry = {
  readonly adapters: Map<ChartRenderer, ChartAdapter>;
  readonly registerAdapter: (adapter: ChartAdapter) => void;
  readonly resolveAdapter: (
    spec: ChartSpec
  ) => ChartAdapter | ChartAdapterUnavailable;
};

export const makeAdapterRegistry = (
  initial: ReadonlyArray<readonly [ChartRenderer, ChartAdapter]>
): AdapterRegistry => {
  const adapters = new Map<ChartRenderer, ChartAdapter>(initial);

  return {
    adapters,
    registerAdapter: (adapter) => {
      adapters.set(adapter.renderer, adapter);
    },
    resolveAdapter: (spec) => {
      const renderer = spec.renderer ?? 'ECHARTS';
      const adapter = adapters.get(renderer);

      if (!adapter) {
        return new ChartAdapterUnavailable({
          renderer,
          message: `No adapter registered for ${renderer}`,
        });
      }

      return adapter;
    },
  };
};
