import { Atom } from '@effect-atom/atom';
import { Effect, HashMap } from 'effect';
import { ChartRuntime } from '../runtime';
import type { ChartSpec, ChartState } from '../schemas';
import type { ChartInstance } from '../types';
import type { ChartMapKey } from '../keys';

export const chartingRuntimeAtom = Atom.runtime(ChartRuntime.Default);

export const chartSpecsAtom = Atom.make<HashMap.HashMap<ChartMapKey, ChartSpec>>(
  HashMap.empty()
);

export const chartStatesAtom = Atom.make<HashMap.HashMap<ChartMapKey, ChartState>>(
  HashMap.empty()
);

export const chartInstancesAtom = Atom.make<
  HashMap.HashMap<ChartMapKey, ChartInstance>
>(HashMap.empty());

export const chartReleasesAtom = Atom.make<
  HashMap.HashMap<ChartMapKey, Effect.Effect<void>>
>(HashMap.empty());

export const chartStateSubscriptionsAtom = Atom.make<
  HashMap.HashMap<ChartMapKey, () => void>
>(HashMap.empty());
