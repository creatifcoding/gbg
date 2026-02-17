import { Effect } from 'effect';
import { ChartRuntime } from '../runtime';
import type { ChartError } from '../errors';
import type { ChartSpec, ChartSeries } from '../schemas';
import {
  chartingRuntimeAtom,
  chartInstancesAtom,
  chartReleasesAtom,
  chartSpecsAtom,
  chartStateSubscriptionsAtom,
  chartStatesAtom,
} from './state';
import {
  cleanupRegistration,
  removeMapValue,
  requireInstance,
  setMapValue,
} from './internal';
import { toChartMapKey } from '../keys';

export const chartOps = {
  create: chartingRuntimeAtom.fn<ChartSpec>()((spec, ctx) =>
    Effect.gen(function* () {
      const runtime = yield* ChartRuntime;
      const key = toChartMapKey(spec.id);
      yield* cleanupRegistration(spec.id, ctx);
      return yield* runtime.acquire(spec).pipe(
        Effect.tap(({ instance, release }) =>
          Effect.all(
            [
              Effect.sync(() => {
                ctx.set(
                  chartInstancesAtom,
                  setMapValue(ctx(chartInstancesAtom), key, instance)
                );
              }),
              Effect.sync(() => {
                ctx.set(chartSpecsAtom, setMapValue(ctx(chartSpecsAtom), key, spec));
              }),
              Effect.sync(() => {
                ctx.set(
                  chartStatesAtom,
                  setMapValue(ctx(chartStatesAtom), key, instance.state)
                );
              }),
              Effect.sync(() => {
                ctx.set(
                  chartReleasesAtom,
                  setMapValue(ctx(chartReleasesAtom), key, release)
                );
              }),
              Effect.sync(() => {
                const unsubscribe = instance.onStateChange((state) => {
                  ctx.set(
                    chartStatesAtom,
                    setMapValue(ctx(chartStatesAtom), key, state)
                  );
                });
                ctx.set(
                  chartStateSubscriptionsAtom,
                  setMapValue(ctx(chartStateSubscriptionsAtom), key, unsubscribe)
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
      const key = toChartMapKey(id);
      yield* requireInstance(ctx(chartInstancesAtom), id);
      yield* cleanupRegistration(id, ctx);
      yield* runtime.invalidate(id).pipe(Effect.catchAll(() => Effect.void));
      yield* Effect.all(
        [
          Effect.sync(() => {
            ctx.set(chartInstancesAtom, removeMapValue(ctx(chartInstancesAtom), key));
          }),
          Effect.sync(() => {
            ctx.set(chartSpecsAtom, removeMapValue(ctx(chartSpecsAtom), key));
          }),
          Effect.sync(() => {
            ctx.set(chartStatesAtom, removeMapValue(ctx(chartStatesAtom), key));
          }),
          Effect.sync(() => {
            ctx.set(chartReleasesAtom, removeMapValue(ctx(chartReleasesAtom), key));
          }),
          Effect.sync(() => {
            ctx.set(
              chartStateSubscriptionsAtom,
              removeMapValue(ctx(chartStateSubscriptionsAtom), key)
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
