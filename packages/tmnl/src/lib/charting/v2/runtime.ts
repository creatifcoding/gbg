import { Effect, Exit, RcMap, Ref, Scope } from 'effect';
import {
  ChartAdapterUnavailable,
  ChartInstanceNotFound,
  type ChartError,
} from './errors';
import type { ChartSpec, ChartRenderer } from './schemas';
import type { ChartInstance } from './types';
import type { ChartAdapter } from './adapters/types';
import { EChartsAdapter } from './adapters/echarts';
import { SciChartAdapter } from './adapters/scichart';

export class ChartRuntime extends Effect.Service<ChartRuntime>()(
  'tmnl/charting/ChartRuntime',
  {
    effect: Effect.gen(function* () {
      const adapters = new Map<ChartRenderer, ChartAdapter>([
        ['ECHARTS', EChartsAdapter],
        ['SCICHART', SciChartAdapter],
      ]);

      const specsRef = yield* Ref.make<ReadonlyMap<string, ChartSpec>>(
        new Map()
      );
      const mapScope = yield* Scope.make();
      const closeMapScope = Scope.close(mapScope, Exit.void);

      const instances = yield* RcMap.make({
        lookup: (id: string) =>
          Ref.get(specsRef).pipe(
            Effect.flatMap((specs) => {
              const spec = specs.get(id);
              if (!spec) {
                return Effect.fail(new ChartInstanceNotFound({ id }));
              }
              const renderer = spec.renderer ?? 'ECHARTS';
              const adapter = adapters.get(renderer);
              if (!adapter) {
                return Effect.fail(
                  new ChartAdapterUnavailable({
                    renderer,
                    message: `No adapter registered for ${renderer}`,
                  })
                );
              }
              return adapter.makeInstance(spec);
            }),
            Effect.acquireRelease((instance) =>
              instance.dispose().pipe(Effect.catchAll(() => Effect.void))
            )
          ),
      }).pipe(Scope.extend(mapScope));

      const registerAdapter = (adapter: ChartAdapter) =>
        Effect.sync(() => {
          adapters.set(adapter.renderer, adapter);
        });

      const registerSpec = (spec: ChartSpec) =>
        Ref.update(specsRef, (current) => {
          const next = new Map(current);
          next.set(spec.id, spec);
          return next;
        });

      const acquire = (spec: ChartSpec) =>
        Effect.gen(function* () {
          const scope = yield* Scope.make();
          const release = Scope.close(scope, Exit.void);
          const instance = yield* registerSpec(spec).pipe(
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
          [
            RcMap.invalidate(instances, id),
            Ref.update(specsRef, (current) => {
              const next = new Map(current);
              next.delete(id);
              return next;
            }),
          ],
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
