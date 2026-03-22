import { Effect, HashMap, Option, Ref } from 'effect';
import { ChartInstanceNotFound } from '../errors';
import { toChartMapKey, type ChartMapKey } from '../keys';
import type { ChartSpec } from '../schemas';

export type ChartSpecsRef = Ref.Ref<HashMap.HashMap<ChartMapKey, ChartSpec>>;

export const lookupSpec = (specsRef: ChartSpecsRef, id: ChartSpec['id']) =>
  Ref.get(specsRef).pipe(
    Effect.flatMap((specs) =>
      Option.match(HashMap.get(specs, toChartMapKey(id)), {
        onNone: () => Effect.fail(new ChartInstanceNotFound({ id })),
        onSome: (spec) => Effect.succeed(spec),
      })
    )
  );

export const registerSpec = (specsRef: ChartSpecsRef, spec: ChartSpec) =>
  Ref.update(specsRef, (current) => HashMap.set(current, toChartMapKey(spec.id), spec));

export const invalidateSpec = (specsRef: ChartSpecsRef, id: ChartSpec['id']) =>
  Ref.update(specsRef, (current) => HashMap.remove(current, toChartMapKey(id)));
