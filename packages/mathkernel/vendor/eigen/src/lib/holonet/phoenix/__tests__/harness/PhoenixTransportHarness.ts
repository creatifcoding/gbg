import { Effect } from 'effect';

import { PhoenixErrors } from '../../schemas/errors';
import type {
  PhoenixJsTransportConnectConfig,
  PhoenixJsTransportShape,
} from '../../transport/PhoenixJsTransport';

type ScriptedResult =
  | { readonly kind: 'ok'; readonly value: unknown }
  | { readonly kind: 'error'; readonly error: PhoenixErrors.TransportError }
  | { readonly kind: 'pending'; readonly id: string };

type PendingResolver = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: PhoenixErrors.TransportError) => void;
};

type Waiter = {
  readonly minCount: number;
  readonly resolve: () => void;
};

const ok = (value: unknown): ScriptedResult => ({ kind: 'ok', value });
const pending = (id: string): ScriptedResult => ({ kind: 'pending', id });

export interface PhoenixTransportHarness {
  readonly transport: PhoenixJsTransportShape;
  readonly calls: {
    readonly connect: PhoenixJsTransportConnectConfig[];
    readonly join: number;
    readonly leave: number;
    readonly disconnect: number;
    readonly on: { event: string }[];
    readonly push: { event: string; payload: unknown; timeoutMs?: number }[];
  };
  scriptJoin(results: ReadonlyArray<ScriptedResult>): void;
  scriptPush(event: string, results: ReadonlyArray<ScriptedResult>): void;
  emit(event: string, payload: unknown): void;
  triggerClosed(event?: unknown): void;
  triggerErrored(error?: unknown): void;
  resolvePending(id: string, value: unknown): void;
  rejectPending(id: string, error: PhoenixErrors.TransportError): void;
  waitForHandler(event: string, minCount?: number): Promise<void>;
  waitForPush(event: string, minCount?: number): Promise<void>;
}

export const createPhoenixTransportHarness = (): PhoenixTransportHarness => {
  const calls = {
    connect: [] as PhoenixJsTransportConnectConfig[],
    join: 0,
    leave: 0,
    disconnect: 0,
    on: [] as { event: string }[],
    push: [] as { event: string; payload: unknown; timeoutMs?: number }[],
  };

  const handlers = new Map<string, Array<(payload: unknown) => void>>();
  const handlerWaiters = new Map<string, Waiter[]>();
  const pushWaiters = new Map<string, Waiter[]>();
  const pendingResolvers = new Map<string, PendingResolver>();

  const joinQueue: ScriptedResult[] = [];
  const pushQueues = new Map<string, ScriptedResult[]>();

  let connected = false;
  let onClosed: ((event: unknown) => void) | undefined;
  let onErrored: ((error: unknown) => void) | undefined;

  const releaseWaiters = (waitersMap: Map<string, Waiter[]>, key: string, count: number): void => {
    const waiters = waitersMap.get(key);
    if (!waiters || waiters.length === 0) return;

    const remaining: Waiter[] = [];
    for (const waiter of waiters) {
      if (count >= waiter.minCount) {
        waiter.resolve();
      } else {
        remaining.push(waiter);
      }
    }

    if (remaining.length > 0) {
      waitersMap.set(key, remaining);
    } else {
      waitersMap.delete(key);
    }
  };

  const queueResult = (
    queue: ScriptedResult[],
    fallbackValue: unknown,
  ): Effect.Effect<unknown, PhoenixErrors.TransportError> => {
    const step = queue.shift() ?? ok(fallbackValue);

    switch (step.kind) {
      case 'ok':
        return Effect.succeed(step.value);
      case 'error':
        return Effect.fail(step.error);
      case 'pending':
        return Effect.promise(
          () =>
            new Promise<unknown>((resolve, reject) => {
              pendingResolvers.set(step.id, {
                resolve,
                reject: (error) => reject(error),
              });
            }),
        ).pipe(
          Effect.mapError(
            (cause) =>
              new PhoenixErrors.TransportError({
                message: 'Pending push promise rejected unexpectedly',
                code: 'transport_closed',
                cause,
              }),
          ),
        );
    }
  };

  const waitForCount = (
    waitersMap: Map<string, Waiter[]>,
    key: string,
    currentCount: number,
    minCount: number,
  ): Promise<void> => {
    if (currentCount >= minCount) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const waiters = waitersMap.get(key) ?? [];
      waiters.push({ minCount, resolve });
      waitersMap.set(key, waiters);
    });
  };

  const transport: PhoenixJsTransportShape = {
    connect: (config) =>
      Effect.sync(() => {
        calls.connect.push(config);
        connected = true;
        onClosed = config.onClosed;
        onErrored = config.onErrored;
      }),

    disconnect: () =>
      Effect.sync(() => {
        calls.disconnect += 1;
        connected = false;
      }),

    join: () =>
      Effect.sync(() => {
        if (!connected) {
          throw new PhoenixErrors.TransportError({
            message: 'join called while disconnected',
            code: 'not_connected',
          });
        }
        calls.join += 1;
      }).pipe(
        Effect.flatMap(() =>
          queueResult(joinQueue, {
            mode: 'live',
            requires_ack: false,
          }),
        ),
      ),

    leave: () =>
      Effect.sync(() => {
        calls.leave += 1;
        connected = false;
      }),

    push: (event, payload, timeoutMs) =>
      Effect.sync(() => {
        calls.push.push({ event, payload, timeoutMs });
        releaseWaiters(
          pushWaiters,
          event,
          calls.push.filter((call) => call.event === event).length,
        );
      }).pipe(
        Effect.flatMap(() => {
          const queue = pushQueues.get(event) ?? [];
          return queueResult(queue, { ok: true });
        }),
      ),

    on: (event, handler) =>
      Effect.sync(() => {
        const byEvent = handlers.get(event) ?? [];
        byEvent.push(handler);
        handlers.set(event, byEvent);
        calls.on.push({ event });
        releaseWaiters(handlerWaiters, event, byEvent.length);
      }),

    isConnected: Effect.sync(() => connected),
  };

  return {
    transport,
    calls,
    scriptJoin: (results) => {
      joinQueue.push(...results);
    },
    scriptPush: (event, results) => {
      const queue = pushQueues.get(event) ?? [];
      queue.push(...results);
      pushQueues.set(event, queue);
    },
    emit: (event, payload) => {
      const byEvent = handlers.get(event) ?? [];
      for (const handler of byEvent) {
        handler(payload);
      }
    },
    triggerClosed: (event) => {
      onClosed?.(event ?? { reason: 'closed' });
    },
    triggerErrored: (error) => {
      onErrored?.(error ?? new Error('transport-error'));
    },
    resolvePending: (id, value) => {
      const pendingResolver = pendingResolvers.get(id);
      if (!pendingResolver) {
        throw new Error(`No pending resolver found for id '${id}'`);
      }

      pendingResolvers.delete(id);
      pendingResolver.resolve(value);
    },
    rejectPending: (id, error) => {
      const pendingResolver = pendingResolvers.get(id);
      if (!pendingResolver) {
        throw new Error(`No pending resolver found for id '${id}'`);
      }

      pendingResolvers.delete(id);
      pendingResolver.reject(error);
    },
    waitForHandler: (event, minCount = 1) =>
      waitForCount(
        handlerWaiters,
        event,
        handlers.get(event)?.length ?? 0,
        minCount,
      ),
    waitForPush: (event, minCount = 1) =>
      waitForCount(
        pushWaiters,
        event,
        calls.push.filter((call) => call.event === event).length,
        minCount,
      ),
  };
};

export const harnessOk = ok;
export const harnessPending = pending;
export const harnessError = (error: PhoenixErrors.TransportError): ScriptedResult => ({
  kind: 'error',
  error,
});
