import { Effect, Exit, HashMap, RcMap, Ref, Scope } from 'effect';
import {
  ChartAdapterUnavailable,
  ChartInstanceNotFound,
  type ChartError,
} from './errors';
import type { ChartSpec } from './schemas';
import type { ChartInstance } from './types';
import { type ChartMapKey } from './keys';
import type { ChartAdapter } from './adapters/types';
import { EChartsAdapter } from './adapters/echarts';
import { SciChartAdapter } from './adapters/scichart';
import { makeAdapterRegistry } from './runtime/registry';
import {
  invalidateSpec,
  lookupSpec,
  registerSpec,
  type ChartSpecsRef,
} from './runtime/instances';

export class ChartRuntime extends Effect.Service<ChartRuntime>()(
  'tmnl/charting/ChartRuntime',
  {
    effect: Effect.gen(function* () {
      const registry = makeAdapterRegistry([
        ['ECHARTS', EChartsAdapter],
        ['SCICHART', SciChartAdapter],
      ] as const);

      const specsRef: ChartSpecsRef = yield* Ref.make<
        HashMap.HashMap<ChartMapKey, ChartSpec>
      >(HashMap.empty());
      const mapScope = yield* Scope.make();
      const closeMapScope = Scope.close(mapScope, Exit.void);

      const instances = yield* RcMap.make({
        lookup: (id: string) =>
          lookupSpec(specsRef, id).pipe(
            Effect.flatMap((spec) => {
              const adapterOrError = registry.resolveAdapter(spec);
              if (adapterOrError instanceof ChartAdapterUnavailable) {
                return Effect.fail(adapterOrError);
              }
              return adapterOrError.makeInstance(spec);
            }),
            Effect.acquireRelease((instance) =>
              instance.dispose().pipe(Effect.catchAll(() => Effect.void))
            )
          ),
      }).pipe(Scope.extend(mapScope));

      const registerAdapter = (adapter: ChartAdapter) =>
        Effect.sync(() => {
          registry.registerAdapter(adapter);
        });

      const acquire = (spec: ChartSpec) =>
        Effect.gen(function* () {
          const scope = yield* Scope.make();
          const release = Scope.close(scope, Exit.void);
          const instance = yield* registerSpec(specsRef, spec).pipe(
            Effect.andThen(RcMap.get(instances, spec.id)),
            Scope.extend(scope),
            Effect.tapError(() => release)
          );
          return { instance, release } as const;
        });

      const create = (
        spec: ChartSpec
      ): Effect.Effect<
        { instance: ChartInstance; release: Effect.Effect<void> },
        ChartError
      > => acquire(spec);

      const invalidate = (id: string) =>
        Effect.all(
          [RcMap.invalidate(instances, id), invalidateSpec(specsRef, id)],
          { concurrency: 'unbounded' }
        ).pipe(Effect.asVoid);

      return {
        create,
        acquire,
        invalidate,
        registerAdapter,
        shutdown: closeMapScope,
      } as const;
    }),
  }
) {}

export const createChart = (spec: ChartSpec) =>
  Effect.gen(function* () {
    const runtime = yield* ChartRuntime;
    return yield* runtime.create(spec);
  });
