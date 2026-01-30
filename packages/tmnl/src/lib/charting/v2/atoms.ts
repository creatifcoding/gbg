import { Atom } from '@effect-atom/atom';
import { Effect } from 'effect';
import { ChartInstanceNotFound } from './errors';
import { ChartRuntime } from './runtime';
import type { ChartError } from './errors';
import type { ChartSpec, ChartSeries, ChartState } from './schemas';
import type { ChartInstance } from './types';

export const chartingRuntimeAtom = Atom.runtime(ChartRuntime.Default);

export const chartSpecsAtom = Atom.make<ReadonlyMap<string, ChartSpec>>(
  new Map()
);
export const chartStatesAtom = Atom.make<ReadonlyMap<string, ChartState>>(
  new Map()
);
export const chartInstancesAtom = Atom.make<ReadonlyMap<string, ChartInstance>>(
  new Map()
);
export const chartReleasesAtom = Atom.make<
  ReadonlyMap<string, Effect.Effect<void>>
>(new Map());
export const chartStateSubscriptionsAtom = Atom.make<
  ReadonlyMap<string, () => void>
>(new Map());

const setMapValue = <K, V>(source: ReadonlyMap<K, V>, key: K, value: V) => {
  const next = new Map(source);
  next.set(key, value);
  return next;
};

const removeMapValue = <K, V>(source: ReadonlyMap<K, V>, key: K) => {
  const next = new Map(source);
  next.delete(key);
  return next;
};

const requireInstance = (
  instances: ReadonlyMap<string, ChartInstance>,
  id: string
) =>
  Effect.sync(() => instances.get(id)).pipe(
    Effect.flatMap((instance) =>
      instance
        ? Effect.succeed(instance)
        : Effect.fail(new ChartInstanceNotFound({ id }))
    )
  );

const cleanupRegistration = (
  id: string,
  ctx: Atom.FnContext
): Effect.Effect<void> => {
  const release = ctx(chartReleasesAtom).get(id);
  const unsubscribe = ctx(chartStateSubscriptionsAtom).get(id);
  return Effect.all(
    [
      unsubscribe ? Effect.sync(unsubscribe) : Effect.void,
      release ? release.pipe(Effect.catchAll(() => Effect.void)) : Effect.void,
    ],
    { concurrency: 'unbounded' }
  ).pipe(Effect.asVoid);
};

export const chartSpecFamily = Atom.family((id: string) =>
  Atom.make((get) => get(chartSpecsAtom).get(id) ?? null)
);

export const chartStateFamily = Atom.family((id: string) =>
  Atom.make((get) => get(chartStatesAtom).get(id) ?? 'UNINITIALIZED')
);

export const chartInstanceFamily = Atom.family((id: string) =>
  Atom.make((get) => get(chartInstancesAtom).get(id) ?? null)
);

export const chartOps = {
  create: chartingRuntimeAtom.fn<ChartSpec>()((spec, ctx) =>
    Effect.gen(function* () {
      const runtime = yield* ChartRuntime;
      yield* cleanupRegistration(spec.id, ctx);
      return yield* runtime.acquire(spec).pipe(
        Effect.tap(({ instance, release }) =>
          Effect.all(
            [
              Effect.sync(() => {
                ctx.set(
                  chartInstancesAtom,
                  setMapValue(ctx(chartInstancesAtom), spec.id, instance)
                );
              }),
              Effect.sync(() => {
                ctx.set(
                  chartSpecsAtom,
                  setMapValue(ctx(chartSpecsAtom), spec.id, spec)
                );
              }),
              Effect.sync(() => {
                ctx.set(
                  chartStatesAtom,
                  setMapValue(ctx(chartStatesAtom), spec.id, instance.state)
                );
              }),
              Effect.sync(() => {
                ctx.set(
                  chartReleasesAtom,
                  setMapValue(ctx(chartReleasesAtom), spec.id, release)
                );
              }),
              Effect.sync(() => {
                const unsubscribe = instance.onStateChange((state) => {
                  ctx.set(
                    chartStatesAtom,
                    setMapValue(ctx(chartStatesAtom), spec.id, state)
                  );
                });
                ctx.set(
                  chartStateSubscriptionsAtom,
                  setMapValue(
                    ctx(chartStateSubscriptionsAtom),
                    spec.id,
                    unsubscribe
                  )
                );
              }),
            ],
            { concurrency: 'unbounded' }
          )
        ),
        Effect.map(({ instance }) => instance)
      );
    })
  ),

  mount: chartingRuntimeAtom.fn<{ id: string; container: HTMLElement }>()(
    (input, ctx) =>
      requireInstance(ctx(chartInstancesAtom), input.id).pipe(
        Effect.flatMap((instance) => instance.mount(input.container))
      )
  ),

  unmount: chartingRuntimeAtom.fn<string>()((id, ctx) =>
    requireInstance(ctx(chartInstancesAtom), id).pipe(
      Effect.flatMap((instance) => instance.unmount())
    )
  ),

  dispose: chartingRuntimeAtom.fn<string>()((id, ctx) =>
    Effect.gen(function* () {
      const runtime = yield* ChartRuntime;
      yield* requireInstance(ctx(chartInstancesAtom), id);
      yield* cleanupRegistration(id, ctx);
      yield* runtime.invalidate(id).pipe(Effect.catchAll(() => Effect.void));
      yield* Effect.all(
        [
          Effect.sync(() => {
            ctx.set(
              chartInstancesAtom,
              removeMapValue(ctx(chartInstancesAtom), id)
            );
          }),
          Effect.sync(() => {
            ctx.set(chartSpecsAtom, removeMapValue(ctx(chartSpecsAtom), id));
          }),
          Effect.sync(() => {
            ctx.set(chartStatesAtom, removeMapValue(ctx(chartStatesAtom), id));
          }),
          Effect.sync(() => {
            ctx.set(
              chartReleasesAtom,
              removeMapValue(ctx(chartReleasesAtom), id)
            );
          }),
          Effect.sync(() => {
            ctx.set(
              chartStateSubscriptionsAtom,
              removeMapValue(ctx(chartStateSubscriptionsAtom), id)
            );
          }),
        ],
        { concurrency: 'unbounded' }
      );
    })
  ),

  setData: chartingRuntimeAtom.fn<{ id: string; data: ChartSeries }>()(
    (input, ctx) =>
      requireInstance(ctx(chartInstancesAtom), input.id).pipe(
        Effect.flatMap((instance) => instance.setData(input.data))
      )
  ),

  appendData: chartingRuntimeAtom.fn<{ id: string; data: ChartSeries }>()(
    (input, ctx) =>
      requireInstance(ctx(chartInstancesAtom), input.id).pipe(
        Effect.flatMap((instance) => instance.appendData(input.data))
      )
  ),

  clearData: chartingRuntimeAtom.fn<string>()((id, ctx) =>
    requireInstance(ctx(chartInstancesAtom), id).pipe(
      Effect.flatMap((instance) => instance.clearData())
    )
  ),
};

export type ChartOps = typeof chartOps;
export type ChartOpsError = ChartError;
