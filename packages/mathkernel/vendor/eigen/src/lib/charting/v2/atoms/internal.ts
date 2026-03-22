import { Atom } from '@effect-atom/atom';
import { Effect, HashMap, Option } from 'effect';
import { ChartInstanceNotFound } from '../errors';
import type { ChartSpec } from '../schemas';
import type { ChartInstance } from '../types';
import { chartReleasesAtom, chartStateSubscriptionsAtom } from './state';
import { toChartMapKey, type ChartMapKey } from '../keys';

export const setMapValue = <K, V>(
  source: HashMap.HashMap<K, V>,
  key: K,
  value: V
) => HashMap.set(source, key, value);

export const removeMapValue = <K, V>(source: HashMap.HashMap<K, V>, key: K) =>
  HashMap.remove(source, key);

export const requireInstance = (
  instances: HashMap.HashMap<ChartMapKey, ChartInstance>,
  id: ChartSpec['id']
) =>
  Effect.sync(() => HashMap.get(instances, toChartMapKey(id))).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new ChartInstanceNotFound({ id })),
        onSome: (instance) => Effect.succeed(instance),
      })
    )
  );

export const cleanupRegistration = (
  id: ChartSpec['id'],
  ctx: Atom.FnContext
): Effect.Effect<void> => {
  const key = toChartMapKey(id);

  const releaseEffect = Option.match(HashMap.get(ctx(chartReleasesAtom), key), {
    onNone: () => Effect.void,
    onSome: (release) => release.pipe(Effect.catchAll(() => Effect.void)),
  });

  const unsubscribeEffect = Option.match(
    HashMap.get(ctx(chartStateSubscriptionsAtom), key),
    {
      onNone: () => Effect.void,
      onSome: (unsubscribe) => Effect.sync(unsubscribe),
    }
  );

  return Effect.all([unsubscribeEffect, releaseEffect], {
    concurrency: 'unbounded',
  }).pipe(Effect.asVoid);
};
