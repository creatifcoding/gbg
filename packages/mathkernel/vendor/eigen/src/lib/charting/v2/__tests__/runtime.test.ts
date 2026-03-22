/**
 * ChartRuntime v2 — Lifecycle Tests
 *
 * CH-H1: Releasing a chart scope disposes the adapter instance.
 * CH-H2: Invalidating an id evicts the cached instance for the next acquire.
 */

import { describe, expect, it } from '@effect/vitest';
import { Effect, Ref } from 'effect';
import { ChartRuntime } from '../runtime';
import type { ChartSpec } from '../schemas';
import type { ChartAdapter } from '../adapters/types';
import type { ChartInstance } from '../types';

const makeSpec = (id: string): ChartSpec => ({
  id,
  kind: 'LINE',
  renderer: 'ECHARTS',
});

const makeTestInstance = (
  spec: ChartSpec,
  disposedRef: Ref.Ref<number>
): ChartInstance => {
  const listeners = new Set<(state: ChartInstance['state']) => void>();

  return {
    id: spec.id,
    renderer: spec.renderer ?? 'ECHARTS',
    spec,
    state: 'READY',
    mount: () => Effect.void,
    unmount: () => Effect.void,
    dispose: () =>
      Ref.update(disposedRef, (count) => count + 1).pipe(Effect.asVoid),
    setData: () => Effect.void,
    appendData: () => Effect.void,
    clearData: () => Effect.void,
    onStateChange: (handler) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
};

const makeTestAdapter = (
  disposedRef: Ref.Ref<number>,
  createdRef: Ref.Ref<number>
): ChartAdapter => ({
  renderer: 'ECHARTS',
  makeInstance: (spec) =>
    Ref.update(createdRef, (count) => count + 1).pipe(
      Effect.as(makeTestInstance(spec, disposedRef))
    ),
});

describe('ChartRuntime lifecycle', () => {
  it.effect('CH-H1: release disposes adapter instance', () =>
    Effect.gen(function* () {
      const disposedRef = yield* Ref.make(0);
      const createdRef = yield* Ref.make(0);

      const runtime = yield* ChartRuntime;
      yield* runtime.registerAdapter(makeTestAdapter(disposedRef, createdRef));

      const { release } = yield* runtime.acquire(makeSpec('chart-h1'));
      yield* release;

      const disposed = yield* Ref.get(disposedRef);
      const created = yield* Ref.get(createdRef);

      expect(created).toBe(1);
      expect(disposed).toBe(1);

      yield* runtime.shutdown;
    }).pipe(Effect.provide(ChartRuntime.Default))
  );

  it.effect('CH-H2: invalidate evicts cached instance', () =>
    Effect.gen(function* () {
      const disposedRef = yield* Ref.make(0);
      const createdRef = yield* Ref.make(0);

      const runtime = yield* ChartRuntime;
      yield* runtime.registerAdapter(makeTestAdapter(disposedRef, createdRef));

      const first = yield* runtime.acquire(makeSpec('chart-h2'));
      const instanceA = first.instance;

      yield* runtime.invalidate('chart-h2');
      yield* first.release;

      const second = yield* runtime.acquire(makeSpec('chart-h2'));
      const instanceB = second.instance;

      expect(instanceA).not.toBe(instanceB);

      yield* second.release;

      const created = yield* Ref.get(createdRef);
      expect(created).toBe(2);

      yield* runtime.shutdown;
    }).pipe(Effect.provide(ChartRuntime.Default))
  );
});
