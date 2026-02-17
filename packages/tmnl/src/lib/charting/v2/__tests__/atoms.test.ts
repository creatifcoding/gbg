/**
 * ChartOps v2 — Atom Integration Tests
 *
 * CH-OP-H1: create registers instance + spec + state.
 * CH-OP-H2: state change callbacks update chartStatesAtom.
 * CH-OP-H3: dispose clears atoms and disposes adapter instance.
 * CH-OP-H4: duplicate create releases the prior instance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';
import { Effect, HashMap, Option } from 'effect';
import * as Runtime from 'effect/Runtime';
import { ChartRuntime } from '../runtime';
import {
  chartingRuntimeAtom,
  chartInstancesAtom,
  chartSpecsAtom,
  chartStatesAtom,
  chartReleasesAtom,
  chartStateSubscriptionsAtom,
  chartOps,
} from '../atoms/index';
import { toChartMapKey } from '../keys';
import type { ChartSpec, ChartState } from '../schemas';
import type { ChartAdapter } from '../adapters/types';
import type { ChartInstance } from '../types';

type Counters = {
  created: number;
  disposed: number;
  mounted: number;
  unmounted: number;
  setData: number;
  appendData: number;
  cleared: number;
};

const makeSpec = (id: string): ChartSpec => ({
  id,
  kind: 'LINE',
  renderer: 'ECHARTS',
});

const makeTestAdapter = (
  counters: Counters,
  emitters: Map<string, (state: ChartState) => void>
): ChartAdapter => ({
  renderer: 'ECHARTS',
  makeInstance: (spec) =>
    Effect.sync(() => {
      counters.created += 1;
      const listeners = new Set<(state: ChartState) => void>();
      const emit = (state: ChartState) => {
        for (const listener of listeners) {
          listener(state);
        }
      };

      emitters.set(spec.id, emit);

      const instance: ChartInstance = {
        id: spec.id,
        renderer: spec.renderer ?? 'ECHARTS',
        spec,
        state: 'READY',
        mount: () =>
          Effect.sync(() => {
            counters.mounted += 1;
          }).pipe(Effect.asVoid),
        unmount: () =>
          Effect.sync(() => {
            counters.unmounted += 1;
          }).pipe(Effect.asVoid),
        dispose: () =>
          Effect.sync(() => {
            counters.disposed += 1;
          }).pipe(Effect.asVoid),
        setData: () =>
          Effect.sync(() => {
            counters.setData += 1;
          }).pipe(Effect.asVoid),
        appendData: () =>
          Effect.sync(() => {
            counters.appendData += 1;
          }).pipe(Effect.asVoid),
        clearData: () =>
          Effect.sync(() => {
            counters.cleared += 1;
          }).pipe(Effect.asVoid),
        onStateChange: (handler) => {
          listeners.add(handler);
          return () => {
            listeners.delete(handler);
          };
        },
      };

      return instance;
    }),
});

describe('ChartOps atoms', () => {
  let registry: ReturnType<typeof Registry.make>;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = Registry.make();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const initRuntime = async (adapter: ChartAdapter) => {
    registry.mount(chartingRuntimeAtom);
    registry.mount(chartInstancesAtom);
    registry.mount(chartSpecsAtom);
    registry.mount(chartStatesAtom);
    registry.mount(chartReleasesAtom);
    registry.mount(chartStateSubscriptionsAtom);

    await vi.advanceTimersByTimeAsync(0);

    const runtimeResult = registry.get(chartingRuntimeAtom);
    if (!Result.isSuccess(runtimeResult)) {
      throw new Error(`Runtime failed: ${runtimeResult._tag}`);
    }

    const runtime = runtimeResult.value as Runtime.Runtime<ChartRuntime>;
    await Runtime.runPromise(
      runtime,
      Effect.flatMap(ChartRuntime, (service) =>
        service.registerAdapter(adapter)
      )
    );
    return runtime;
  };

  it('CH-OP-H1: create registers instance + spec + state', async () => {
    const counters: Counters = {
      created: 0,
      disposed: 0,
      mounted: 0,
      unmounted: 0,
      setData: 0,
      appendData: 0,
      cleared: 0,
    };
    const emitters = new Map<string, (state: ChartState) => void>();

    await initRuntime(makeTestAdapter(counters, emitters));

    registry.mount(chartOps.create);
    registry.set(chartOps.create, makeSpec('chart-op-1'));
    await vi.advanceTimersByTimeAsync(0);

    const createResult = registry.get(chartOps.create);
    expect(Result.isSuccess(createResult)).toBe(true);

    expect(
      HashMap.has(registry.get(chartInstancesAtom), toChartMapKey('chart-op-1'))
    ).toBe(true);
    expect(
      HashMap.has(registry.get(chartSpecsAtom), toChartMapKey('chart-op-1'))
    ).toBe(true);
    expect(
      Option.getOrUndefined(
        HashMap.get(registry.get(chartStatesAtom), toChartMapKey('chart-op-1'))
      )
    ).toBe('READY');
    expect(counters.created).toBe(1);
  });

  it('CH-OP-H2: state change updates chartStatesAtom', async () => {
    const counters: Counters = {
      created: 0,
      disposed: 0,
      mounted: 0,
      unmounted: 0,
      setData: 0,
      appendData: 0,
      cleared: 0,
    };
    const emitters = new Map<string, (state: ChartState) => void>();

    await initRuntime(makeTestAdapter(counters, emitters));

    registry.mount(chartOps.create);
    registry.set(chartOps.create, makeSpec('chart-op-2'));
    await vi.advanceTimersByTimeAsync(0);

    const emit = emitters.get('chart-op-2');
    if (!emit) {
      throw new Error('Missing state emitter for chart-op-2');
    }

    emit('ERROR');
    await vi.advanceTimersByTimeAsync(0);

    expect(
      Option.getOrUndefined(
        HashMap.get(registry.get(chartStatesAtom), toChartMapKey('chart-op-2'))
      )
    ).toBe('ERROR');
  });

  it('CH-OP-H3: dispose clears atoms and disposes adapter instance', async () => {
    const counters: Counters = {
      created: 0,
      disposed: 0,
      mounted: 0,
      unmounted: 0,
      setData: 0,
      appendData: 0,
      cleared: 0,
    };
    const emitters = new Map<string, (state: ChartState) => void>();

    await initRuntime(makeTestAdapter(counters, emitters));

    registry.mount(chartOps.create);
    registry.mount(chartOps.dispose);

    registry.set(chartOps.create, makeSpec('chart-op-3'));
    await vi.advanceTimersByTimeAsync(0);

    registry.set(chartOps.dispose, 'chart-op-3');
    await vi.advanceTimersByTimeAsync(0);

    expect(counters.disposed).toBe(1);
    expect(
      HashMap.has(registry.get(chartInstancesAtom), toChartMapKey('chart-op-3'))
    ).toBe(false);
    expect(
      HashMap.has(registry.get(chartSpecsAtom), toChartMapKey('chart-op-3'))
    ).toBe(false);
    expect(
      HashMap.has(registry.get(chartStatesAtom), toChartMapKey('chart-op-3'))
    ).toBe(false);
  });

  it('CH-OP-H4: duplicate create releases prior instance', async () => {
    const counters: Counters = {
      created: 0,
      disposed: 0,
      mounted: 0,
      unmounted: 0,
      setData: 0,
      appendData: 0,
      cleared: 0,
    };
    const emitters = new Map<string, (state: ChartState) => void>();

    await initRuntime(makeTestAdapter(counters, emitters));

    registry.mount(chartOps.create);

    registry.set(chartOps.create, makeSpec('chart-op-4'));
    await vi.advanceTimersByTimeAsync(0);

    registry.set(chartOps.create, makeSpec('chart-op-4'));
    await vi.advanceTimersByTimeAsync(0);

    expect(counters.created).toBe(2);
    expect(counters.disposed).toBe(1);
  });
});
